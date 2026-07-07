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
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
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
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'User does not exist or has been deactivated'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    let code = 'UNAUTHENTICATED';
    let message = 'Invalid or expired token';
    if (error.name === 'TokenExpiredError') {
      code = 'TOKEN_EXPIRED';
      message = 'Token has expired';
    }
    return res.status(401).json({
      success: false,
      error: {
        code,
        message
      }
    });
  }
};


/**
 * Helper function to generate a JWT for a user.
 * Useful for authentication routes and testing.
 */
const generateToken = (user, roleId = null, societyId = null) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      roleId: roleId ? roleId.toString() : (user.roleId ? user.roleId.toString() : null),
      societyId: societyId ? societyId.toString() : (user.societyId ? user.societyId.toString() : null),
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
};

module.exports = {
  authenticate,
  generateToken,
  JWT_SECRET
};
