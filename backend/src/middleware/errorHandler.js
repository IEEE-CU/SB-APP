/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: messages
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
            success: false,
            message: `${field} already exists.`
        });
    }

    // Mongoose ObjectId error
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format.'
        });
    }

    // Default server error. Unexpected (5xx) errors can carry internal detail
    // (DB connection strings, stack fragments, etc.) that shouldn't reach the
    // client in production - the full error is already logged above.
    const statusCode = err.statusCode || 500;
    const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : (err.message || 'Internal Server Error');

    res.status(statusCode).json({
        success: false,
        message
    });
};

/**
 * 404 handler
 */
const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
};

module.exports = { errorHandler, notFound };
