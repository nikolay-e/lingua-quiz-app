const jwt = require('jsonwebtoken');

const { ENV, logger } = require('../config');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

/**
 * Middleware to authenticate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1];

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      req.userId = decoded.userId;
      logger.debug(`Token authenticated for userId: ${req.userId}`);
      next();
    } catch (error) {
      logger.warn('Invalid token received', { error: error.message });
      throw new AuthorizationError('Invalid or expired token');
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticateToken,
};
