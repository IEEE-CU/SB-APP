const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Import all route modules
const authRoutes = require("./auth");
const userRoutes = require("./users");
const societyRoutes = require("./societies");
const transactionRoutes = require("./transactions");
const eventRoutes = require("./events");
const projectRoutes = require("./projects");
const calendarRoutes = require("./calendar");
const announcementRoutes = require("./announcements");
const dashboardRoutes = require("./dashboard");
const projectReportRoutes = require("./projectReports");
const institutionRoutes = require("./institution");
const storageRoutes = require("./storage");

// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/user", require("./user"));
router.use("/societies", societyRoutes);
router.use("/transactions", transactionRoutes);
router.use("/events", eventRoutes);
router.use("/projects", projectRoutes);
router.use("/project-reports", projectReportRoutes);
router.use("/calendar", calendarRoutes);
router.use("/announcements", announcementRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/institution", institutionRoutes);
router.use("/storage", storageRoutes);

// Health check - reflects real DB connectivity so a load balancer / orchestrator
// only routes traffic to instances that can actually serve requests.
router.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    message: dbConnected
      ? "IEEE Finance Pro API is running"
      : "Database unavailable",
    db: dbConnected ? "connected" : "disconnected",
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
