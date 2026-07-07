const express = require('express');
const cors = require('cors');

const rbacRoutes = require('./modules/rbac/routes/rbac.routes');
const contractGuard = require('./middleware/contractGuard');

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enforce API contract compliance in non-production environments
if (process.env.NODE_ENV !== 'production') {
  app.use(contractGuard);
}

// Health check endpoint conforming to Section 5.4 contract
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      version: '1.0.0'
    }
  });
});

// Mount RBAC module routes under /api/v1
app.use('/api/v1', rbacRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  
  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  const errorMessage = err.message || 'An unexpected error occurred on the server';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: errorMessage
    }
  });
});


module.exports = app;
