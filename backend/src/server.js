require('dotenv').config();

// Fail fast if critical configuration is missing, instead of limping along
// with an undefined JWT secret or no DB connection string.
const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
    console.error(` Missing required environment variable(s): ${missingEnvVars.join(', ')}`);
    console.error('   Copy .env.example to .env and fill in the values.');
    process.exit(1);
}

const cluster = require('cluster');
const os = require('os');

// Load-balance across CPU cores using Node's built-in cluster module: the
// primary process forks one worker per core and the OS round-robins incoming
// connections across them on the same port. Opt-in via ENABLE_CLUSTER so
// local dev (nodemon) keeps a single process for fast reloads.
const ENABLE_CLUSTER = process.env.ENABLE_CLUSTER === 'true';
const WORKER_COUNT = parseInt(process.env.WEB_CONCURRENCY, 10) || os.cpus().length;

let appInstance;

if (ENABLE_CLUSTER && cluster.isPrimary) {
    console.log(`🧵 Primary ${process.pid} is starting ${WORKER_COUNT} worker(s) for load balancing...`);

    for (let i = 0; i < WORKER_COUNT; i++) {
        cluster.fork();
    }

    let shuttingDown = false;

    cluster.on('exit', (worker, code, signal) => {
        if (shuttingDown) return;
        console.error(`  Worker ${worker.process.pid} exited (code=${code}, signal=${signal}). Forking a replacement...`);
        cluster.fork();
    });

    const shutdownPrimary = (signal) => {
        shuttingDown = true;
        console.log(`\n${signal} received on primary. Shutting down all workers...`);
        for (const id in cluster.workers) {
            cluster.workers[id].process.kill(signal);
        }
    };

    process.on('SIGTERM', () => shutdownPrimary('SIGTERM'));
    process.on('SIGINT', () => shutdownPrimary('SIGINT'));
} else {
    appInstance = startServer();
}

function startServer() {
    const express = require('express');
    const cors = require('cors');
    const helmet = require('helmet');
    const compression = require('compression');
    const mongoSanitize = require('express-mongo-sanitize');
    const hpp = require('hpp');
    const mongoose = require('mongoose');
    const connectDB = require('./config/database');
    const routes = require('./routes');
    const { errorHandler, notFound } = require('./middleware/errorHandler');
    const { generalLimiter } = require('./middleware/rateLimiter');

    const app = express();
    const PORT = process.env.PORT || 5000;

    connectDB();

    // Trust the first proxy hop (Nginx/ELB/etc.) so req.ip and rate limiting
    // see the real client IP instead of the proxy's address.
    app.set('trust proxy', 1);

    app.use(helmet());
    app.use(compression());
    app.use(cors({
        origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
        credentials: true
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Strip any query/body keys starting with "$" or containing "." to block
    // NoSQL operator injection (e.g. ?societyId[$ne]=1), then drop duplicate
    // query params (HTTP parameter pollution) so a repeated ?limit=1&limit=2
    // can't be used to smuggle arrays into code that expects a scalar.
    app.use(mongoSanitize());
    app.use(hpp());

    app.use(generalLimiter);

    // Request logging in development
    if (process.env.NODE_ENV === 'development') {
        app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }

    // API Routes
    app.use('/api/v1', routes);

    // Root endpoint
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'IEEE Finance Pro Backend API',
            version: '1.0.0',
            documentation: '/api/v1/health'
        });
    });

    // Error handling
    app.use(notFound);
    app.use(errorHandler);

    // Start server
    const http = require('http');
    const server = http.createServer(app);
    const { Server } = require('socket.io');
    const io = new Server(server, { cors: { origin: '*' } });
    app.set('io', io);
    io.on('connection', (socket) => { console.log('Socket connected'); });

    server.listen(PORT, () => {
        console.log(`
                                                        
   IEEE Finance Pro Backend                            
                                                          
   Server:  http://localhost:${PORT}
   API:     http://localhost:${PORT}/api/v1
   Health:  http://localhost:${PORT}/api/v1/health
                                                        
   Mode:    ${process.env.NODE_ENV || 'development'}              
   PID:     ${process.pid}                                        
                                                          

  `);
    });

    // Graceful shutdown: stop accepting new connections, let in-flight
    // requests finish, close the DB connection, then exit. Without this,
    // deploys/restarts (and cluster worker recycling) drop live requests.
    const shutdown = (signal) => {
        console.log(`\n${signal} received (pid ${process.pid}). Closing server gracefully...`);
        server.close(async () => {
            try {
                await mongoose.connection.close(false);
                console.log('MongoDB connection closed.');
            } catch (err) {
                console.error('Error closing MongoDB connection:', err.message);
            }
            process.exit(0);
        });

        // Safety net in case something keeps the event loop alive.
        setTimeout(() => {
            console.error('Graceful shutdown timed out. Forcing exit.');
            process.exit(1);
        }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return app;
}

module.exports = appInstance;
