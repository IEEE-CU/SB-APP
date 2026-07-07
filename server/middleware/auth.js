const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'ieee_finance_pro_secret_key';

/**
 * Middleware to authenticate requests using JWT.
 * Assumes Authorization: Bearer <token>
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token is missing or invalid'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user from DB to ensure they exist
    const userId = decoded.id || decoded.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User does not exist or has been deactivated'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    let message = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') {
      message = 'Token has expired';
    }
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message
      }
    });
  }
};

/**
 * Helper function to generate a JWT for a user.
 * Useful for authentication routes and testing.
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
};

module.exports = {
  authenticate,
  generateToken,
  JWT_SECRET
};
