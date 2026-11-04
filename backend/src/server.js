require("dotenv").config();

// Fail fast if critical configuration is missing, instead of limping along
// with an undefined JWT secret or no DB connection string.
const REQUIRED_ENV_VARS = ["MONGODB_URI", "JWT_SECRET"];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(
    ` Missing required environment variable(s): ${missingEnvVars.join(", ")}`,
  );
  console.error("   Copy .env.example to .env and fill in the values.");
  process.exit(1);
}

// A blank or published-placeholder secret (for example the value copied from
// .env.example) is as good as none: anyone can read it and forge tokens. Refuse to start.
const { jwtSecretProblem } = require("./utils/jwtSecret");
const secretProblem = jwtSecretProblem(process.env.JWT_SECRET);
if (secretProblem && !missingEnvVars.includes("JWT_SECRET")) {
  console.error(` JWT_SECRET ${secretProblem}.`);
  console.error("   Set JWT_SECRET to a long random value (see .env.example).");
  process.exit(1);
}

// Cluster mode is not supported (AUD-012B): Socket.IO rooms and delivery, presence, typing
// state and every rate-limit counter live in each worker's own memory, with no adapter, shared
// store or sticky sessions, so several workers behave inconsistently. Refuse to start rather
// than run that way. Only the exact words true/false are understood; anything else is refused
// as malformed instead of being read as an opt-out.
const { parseClusterFlag } = require("./config/clusterMode");
let clusterRequested;
try {
  clusterRequested = parseClusterFlag(process.env.ENABLE_CLUSTER);
} catch (error) {
  console.error(` ${error.message}`);
  process.exit(1);
}
if (clusterRequested) {
  console.error(" ENABLE_CLUSTER=true is not supported: realtime delivery, presence and rate limits are per process.");
  console.error("   Run a single process (leave ENABLE_CLUSTER unset or false).");
  process.exit(1);
}

// Trusted proxies are configured explicitly (see config/trustProxy.js); an invalid value, or a
// missing one in production, stops the server before it listens or connects.
const { parseTrustProxy } = require("./config/trustProxy");
let trustProxy;
try {
  trustProxy = parseTrustProxy(process.env.TRUST_PROXY, { production: process.env.NODE_ENV === "production" });
} catch (error) {
  console.error(` ${error.message}`);
  process.exit(1);
}

const appInstance = startServer();

function startServer() {
  const express = require("express");
  const cors = require("cors");
  const helmet = require("helmet");
  const compression = require("compression");
  const mongoSanitize = require("express-mongo-sanitize");
  const hpp = require("hpp");
  const mongoose = require("mongoose");
  const connectDB = require("./config/database");
  const routes = require("./routes");
  const { errorHandler, notFound } = require("./middleware/errorHandler");
  const { generalLimiter } = require("./middleware/rateLimiter");

  const app = express();
  const PORT = process.env.PORT || 5000;

  connectDB().then(async (conn) => {
    if (!conn) return;

    // In dev (esp. the in-memory DB used by `npm run dev:memory`) the
    // Opportunity collection starts empty every boot, and the daily cron
    // wouldn't fill it until 3am. Seed it once on startup if empty so the
    // Awards & Scholarships page has data immediately.
    try {
      const Opportunity = require("./models/Opportunity");
      const count = await Opportunity.countDocuments();
      if (count === 0) {
        console.log("No opportunities found — running initial scrape...");
        const { scrapeAllSocieties } = require("./services/opportunityScraper");
        scrapeAllSocieties()
          .then((results) => {
            const total = results.reduce((sum, r) => sum + r.items.length, 0);
            console.log(
              `Initial opportunities scrape complete: ${total} item(s).`,
            );
          })
          .catch((err) =>
            console.error("Initial opportunities scrape failed:", err),
          );
      }
    } catch (err) {
      console.error("Could not check/seed opportunities:", err.message);
    }
  });

  // req.ip (the rate-limit key and the audit-log address) only honours X-Forwarded-For for the
  // proxies named in TRUST_PROXY; by default none are trusted, so a client cannot pick its own
  // address. Parsed and validated at start-up (config/trustProxy.js).
  app.set("trust proxy", trustProxy.setting);

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
      ],
      credentials: true,
    }),
  );
  // The general limiter comes BEFORE the body parsers: a request the parser rejects
  // (malformed JSON, oversized body) never reaches later middleware, so with the limiter
  // behind them such requests were not counted at all. After CORS so a 429 still carries
  // the CORS headers the browser needs to read it.
  app.use(generalLimiter);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Strip any query/body keys starting with "$" or containing "." to block
  // NoSQL operator injection (e.g. ?societyId[$ne]=1), then drop duplicate
  // query params (HTTP parameter pollution) so a repeated ?limit=1&limit=2
  // can't be used to smuggle arrays into code that expects a scalar.
  app.use(mongoSanitize());
  app.use(hpp());

  // Request logging in development
  if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  // API Routes
  app.use("/api/v1", routes);

  // Root endpoint
  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "IEEE Campus Community Hub Backend API",
      version: "1.0.0",
      documentation: "/api/v1/health",
    });
  });

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`
                                                        
   IEEE Campus Community Hub                           
                                                          
   Server:  http://localhost:${PORT}
   API:     http://localhost:${PORT}/api/v1
   Health:  http://localhost:${PORT}/api/v1/health
                                                        
   Mode:    ${process.env.NODE_ENV || "development"}              
   PID:     ${process.pid}                                        
                                                          

  `);
  });

  // Initialize Socket.io
  const { Server } = require("socket.io");
  const { authenticateSocket } = require("./middleware/socketAuth");
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
      ],
      credentials: true,
    },
  });

  // Socket.io JWT Authentication Middleware (token must verify and the user
  // must still exist, as in the REST `authenticate` middleware)
  io.use(authenticateSocket);

  // Make io accessible in express application
  app.set("io", io);

  const { setupPresenceHandlers } = require("./services/presenceService");
  setupPresenceHandlers(io);

  // Daily scrape of IEEE society award/grant/scholarship pages (single process only:
  // cluster mode is refused above).
  {
    const cron = require("node-cron");
    const { scrapeAllSocieties } = require("./services/opportunityScraper");

    cron.schedule("0 3 * * *", () => {
      console.log("Running scheduled IEEE opportunities scrape...");
      scrapeAllSocieties()
        .then((results) => {
          const total = results.reduce((sum, r) => sum + r.items.length, 0);
          console.log(
            `Opportunities scrape complete: ${total} item(s) updated.`,
          );
        })
        .catch((err) => console.error("Opportunities scrape failed:", err));
    });
  }

  // Graceful shutdown: stop accepting new connections, let in-flight
  // requests finish, close the DB connection, then exit. Without this,
  // deploys/restarts (and cluster worker recycling) drop live requests.
  const shutdown = (signal) => {
    console.log(
      `\n${signal} received (pid ${process.pid}). Closing server gracefully...`,
    );
    server.close(async () => {
      try {
        await mongoose.connection.close(false);
        console.log("MongoDB connection closed.");
      } catch (err) {
        console.error("Error closing MongoDB connection:", err.message);
      }
      process.exit(0);
    });

    // Safety net in case something keeps the event loop alive.
    setTimeout(() => {
      console.error("Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return app;
}

module.exports = appInstance;
