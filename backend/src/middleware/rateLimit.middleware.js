/**
 * Rate Limiter Middleware
 * Implements various rate limiters for different API endpoints
 * Optimized for the AGFINDER context in Angola
 * 
 * (Atualizado para remover limitações específicas para API do Google Maps)
 */

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const dbHelpers = require('../utils/dbHelpers');

// Default configurations (fallback if database settings not available)
const DEFAULT_CONFIG = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 500
  },
  contribution: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20
  },
  auth: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10
  },
  admin: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100
  },
  redis: {
    prefix: 'rl:',
    expiry: 60 * 15 // 15 minutes in seconds
  }
};

// Create Redis client for rate limiting only if Redis is configured
let redisClient = null;
let useMemoryStore = true;

if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  try {
    if (process.env.REDIS_URL) {
      const parsed = new URL(process.env.REDIS_URL);
      if (!parsed.port) parsed.port = '6379';
      redisClient = new Redis(process.env.REDIS_URL);
    } else {
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      if (Number.isNaN(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid REDIS_PORT: ${process.env.REDIS_PORT}`);
      }
      redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port,
        password: process.env.REDIS_PASSWORD || '',
        db: process.env.REDIS_RATE_LIMIT_DB || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        connectTimeout: 10000,
        maxRetriesPerRequest: 3
      });
    }
    useMemoryStore = false;

    redisClient.on('error', (err) => {
      logger.error(`Redis rate limiter error: ${err.message}`);
      if (!useMemoryStore) {
        logger.warn('Redis connection failed, falling back to memory store for rate limiting');
        useMemoryStore = true;
      }
    });

    redisClient.on('connect', () => {
      logger.info('Redis rate limiter connected successfully');
    });
  } catch (e) {
    logger.warn('Failed to initialize Redis for rate limiting, using memory store:', e.message || e);
    redisClient = null;
    useMemoryStore = true;
  }
}

// Use database settings if available
let CONFIG = { ...DEFAULT_CONFIG };

// Function to load settings from database
async function loadSettings() {
  try {
    const dbSettings = await dbHelpers.loadRateLimitSettings();
    if (dbSettings) {
      logger.info('Loading rate limiter settings from database');
      CONFIG = dbSettings;
      logger.info('Rate limiter settings loaded successfully');
    } else {
      logger.info('No rate limiter settings found in database, using defaults');
    }
  } catch (error) {
    logger.error(`Error loading rate limiter settings: ${error.message}`);
  }
}

// Load settings on startup
loadSettings().catch(err => {
  logger.error(`Failed to load rate limiter settings: ${err.message}`);
});

// Base configuration for rate limiting
function getBaseConfig() {
  const config = {
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    handler: (req, res, next, options) => {
      const errorResponse = {
        ...options.message,
        detail: `Limit of ${options.max} requests per ${options.windowMs / 60000} minute(s) exceeded. Try again after ${Math.ceil(options.windowMs / 60000)} minute(s).`
      };

      logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.originalUrl}`);
      res.status(429).json(errorResponse);
    }
  };

  // Use Redis store if connection is available, otherwise use memory store
  if (!useMemoryStore) {
    try {
      config.store = new RedisStore({
        // The RedisStore v4 requires sendCommand with ioredis v5
        sendCommand: (...args) => redisClient.call(...args),
        prefix: CONFIG.redis.prefix,
        // Optional: Keys expire after windowMs
        expiry: CONFIG.redis.expiry,
        // Optional: Prefix key with route
        prefixKeyWithRoute: true
      });
    } catch (error) {
      logger.error(`Error creating Redis store: ${error.message}`);
      useMemoryStore = true;
    }
  }

  return config;
}

// General API rate limiter
const apiLimiter = rateLimit({
  ...getBaseConfig(),
  windowMs: CONFIG.api.windowMs,
  max: CONFIG.api.maxRequests,
  keyGenerator: (req) => {
    // Create a key based on IP and API version if available
    const apiVersion = req.headers['accept-version'] || 'v1';
    return `${req.ip}:${apiVersion}`;
  }
});

// Obsoleto: limitador para API do Google Maps foi removido após mudança na arquitetura
// const placesApiLimiter = rateLimit({
//   ...baseOptions,
//   windowMs: 5 * 60 * 1000,
//   max: 50,
// });

// Contribution limiter: prevent spam submissions
const contributionLimiter = rateLimit({
  ...getBaseConfig(),
  windowMs: CONFIG.contribution.windowMs,
  max: CONFIG.contribution.maxRequests,
  message: {
    status: 'error',
    message: 'Too many contribution requests, please try again later.',
    code: 'CONTRIBUTION_RATE_LIMIT_EXCEEDED'
  }
});

// Auth limiter: prevent brute force attacks
const authLimiter = rateLimit({
  ...getBaseConfig(),
  windowMs: CONFIG.auth.windowMs,
  max: CONFIG.auth.maxRequests,
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// Admin limiter: moderate access to admin functionality
const adminLimiter = rateLimit({
  ...getBaseConfig(),
  windowMs: CONFIG.admin.windowMs,
  max: CONFIG.admin.maxRequests,
  message: {
    status: 'error',
    message: 'Too many admin requests, please try again later.',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  }
});

// Export rate limiters and functions
module.exports = {
  apiLimiter,
  // placesApiLimiter removido da exportação
  contributionLimiter,
  authLimiter,
  adminLimiter,
  redisClient,
  loadSettings // Export to allow reloading settings on demand
}; 