const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

// Middleware to authenticate JWT tokens
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by id
    const user = await User.findByPk(decoded.id);

    // If user not found or banned
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token. User not found.',
      });
    }

    if (user.is_banned) {
      // Check if ban has expired
      if (user.ban_expiry && new Date() > user.ban_expiry) {
        // Unban user
        user.is_banned = false;
        user.ban_reason = null;
        user.ban_expiry = null;
        await user.save();
      } else {
        return res.status(403).json({
          status: 'error',
          message: 'Your account has been suspended.',
          reason: user.ban_reason,
          expiry: user.ban_expiry,
        });
      }
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token.',
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expired.',
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Authentication error.',
    });
  }
};

// Middleware to check for subscription
const checkSubscription = async (req, res, next) => {
  try {
    // Skip check if route doesn't require subscription
    if (req.path.startsWith('/auth') || req.path.startsWith('/webhooks')) {
      return next();
    }

    const { user } = req;

    // If no subscription or expired (aligned with model fields)
    const activeEnd = user.current_subscription_end ? new Date(user.current_subscription_end) : null;
    const isActive = (user.has_active_subscription === true) || (activeEnd && new Date() < activeEnd);
    if (!isActive) {
      // If requesting list of POIs, allow but with limited data
      if (req.method === 'GET' && req.path.startsWith('/pois') && !req.path.includes('/')) {
        req.limitedAccess = true;
        return next();
      }

      // If contributing, allow - users can contribute without subscription
      if (req.method === 'POST' && req.path.includes('/contributions')) {
        return next();
      }

      // For all other routes, require subscription
      return res.status(403).json({
        status: 'error',
        message: 'Subscription required for this feature.',
        subscriptionOptions: {
          daily: process.env.SUBSCRIPTION_DAILY_PRICE,
          weekly: process.env.SUBSCRIPTION_WEEKLY_PRICE,
          monthly: process.env.SUBSCRIPTION_MONTHLY_PRICE,
        },
      });
    }

    next();
  } catch (error) {
    logger.error('Subscription check error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error checking subscription.',
    });
  }
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const { user } = req;
    if (!user || !user.is_admin) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required.',
      });
    }
    next();
  } catch (error) {
    logger.error('Admin check error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error checking admin status.',
    });
  }
};

module.exports = {
  authenticate,
  checkSubscription,
  isAdmin,
};