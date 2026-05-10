/**
 * Monitoring Utility
 * Implements a comprehensive monitoring system for tracking performance metrics,
 * error rates, and API quota usage.
 * Optimized for AGFINDER context in Angola, with limited connectivity considerations.
 */

const logger = require('./logger');
const { API_KEYS } = require('../config/maps.config');
const { redisClient } = require('../services/cache.service');

// Constants for monitoring
const METRICS_PREFIX = 'metrics:';
const ERROR_PREFIX = 'errors:';
const QUOTA_PREFIX = 'quota:';
const DEFAULT_METRICS_TTL = 60 * 60 * 24 * 7; // 7 days
const ALERT_THRESHOLD = 0.8; // 80% of quota

// Track metrics keyed by endpoint
const activeRequests = new Map();

/**
 * Initialize monitoring system
 * @returns {Object} Monitoring middleware and utility functions
 */
function initMonitoring() {
  logger.info('Initializing monitoring system');
  
  // Periodically clean up metrics from memory and persist to Redis
  setInterval(persistMetrics, 60 * 1000); // Every minute
  
  return {
    trackEndpoint,
    trackError,
    trackApiQuota,
    getMetrics,
    resetMetrics,
    monitoringMiddleware,
    checkApiQuota
  };
}

/**
 * Middleware to track request performance metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function monitoringMiddleware(req, res, next) {
  const startTime = Date.now();
  const endpoint = getEndpointPath(req);
  
  // Add request ID for tracking
  req.requestId = generateRequestId();
  
  // Track active request
  activeRequests.set(req.requestId, {
    endpoint,
    startTime,
    method: req.method
  });
  
  // Track response
  const originalSend = res.send;
  res.send = function(...args) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Track performance metric
    trackEndpoint(endpoint, {
      duration,
      statusCode: res.statusCode,
      method: req.method
    });
    
    // Remove from active requests
    activeRequests.delete(req.requestId);
    
    return originalSend.apply(this, args);
  };
  
  // Continue with request
  next();
}

/**
 * Track endpoint performance metrics
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Metric data
 * @param {number} data.duration - Request duration in ms
 * @param {number} data.statusCode - HTTP status code
 * @param {string} data.method - HTTP method
 */
async function trackEndpoint(endpoint, { duration, statusCode, method }) {
  try {
    const key = `${METRICS_PREFIX}${endpoint}:${method}`;
    const timestamp = new Date().toISOString().split('T')[0]; // Daily tracking
    
    // Store metrics in Redis
    await redisClient.hIncrBy(key, `count:${timestamp}`, 1);
    await redisClient.hIncrBy(key, `total_duration:${timestamp}`, duration);
    
    if (statusCode >= 400) {
      await redisClient.hIncrBy(key, `errors:${statusCode}:${timestamp}`, 1);
    }
    
    // Update min/max response times
    const currentMin = await redisClient.hGet(key, `min:${timestamp}`);
    const currentMax = await redisClient.hGet(key, `max:${timestamp}`);
    
    if (!currentMin || duration < parseInt(currentMin)) {
      await redisClient.hSet(key, `min:${timestamp}`, duration);
    }
    
    if (!currentMax || duration > parseInt(currentMax)) {
      await redisClient.hSet(key, `max:${timestamp}`, duration);
    }
    
    // Set expiry if new key
    const ttl = await redisClient.ttl(key);
    if (ttl < 0) {
      await redisClient.expire(key, DEFAULT_METRICS_TTL);
    }
    
    // Log slow endpoints (over 1000ms)
    if (duration > 1000) {
      logger.warn(`Slow endpoint detected: ${method} ${endpoint} (${duration}ms)`);
    }
  } catch (error) {
    logger.error(`Error tracking endpoint metrics: ${error.message}`, { error });
  }
}

/**
 * Track error with context
 * @param {string} endpoint - API endpoint
 * @param {Error} error - Error object
 * @param {Object} context - Error context
 */
async function trackError(endpoint, error, context = {}) {
  try {
    const key = `${ERROR_PREFIX}${endpoint}`;
    const timestamp = new Date().toISOString();
    const errorId = generateErrorId();
    
    // Store error details
    const errorData = {
      message: error.message,
      stack: error.stack,
      code: error.code || 'UNKNOWN',
      timestamp,
      context: JSON.stringify(context)
    };
    
    // Store error in Redis
    await redisClient.hSet(key, errorId, JSON.stringify(errorData));
    await redisClient.expire(key, DEFAULT_METRICS_TTL);
    
    // Increment error counter
    const dailyKey = timestamp.split('T')[0];
    await redisClient.hIncrBy(`${ERROR_PREFIX}counts`, `${endpoint}:${dailyKey}`, 1);
    
    // Log error
    logger.error(`Error in ${endpoint}: ${error.message}`, {
      errorId,
      endpoint,
      ...context,
      error
    });
    
    return errorId;
  } catch (err) {
    logger.error(`Failed to track error: ${err.message}`, { err });
    return null;
  }
}

/**
 * Track Google Maps API quota usage
 * @param {string} apiType - API type (places, geocoding, etc.)
 * @param {number} count - Number of requests made
 */
async function trackApiQuota(apiType, count = 1) {
  try {
    const key = `${QUOTA_PREFIX}${apiType}`;
    const timestamp = new Date().toISOString().split('T')[0]; // Daily tracking
    
    // Increment quota usage
    await redisClient.hIncrBy(key, timestamp, count);
    await redisClient.expire(key, DEFAULT_METRICS_TTL * 4); // Keep quota longer
    
    // Check if we're approaching quota limits
    await checkApiQuota(apiType);
  } catch (error) {
    logger.error(`Error tracking API quota: ${error.message}`, { error });
  }
}

/**
 * Check if API quota is nearing exhaustion
 * @param {string} apiType - API type to check
 * @returns {Promise<boolean>} True if quota is nearing exhaustion
 */
async function checkApiQuota(apiType) {
  try {
    const key = `${QUOTA_PREFIX}${apiType}`;
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Get current usage
    const usage = parseInt(await redisClient.hGet(key, timestamp) || '0');
    
    // Get limits from config
    const config = getApiConfig(apiType);
    if (!config) return false;
    
    const { requestsPerDay } = config;
    const percentUsed = usage / requestsPerDay;
    
    // Alert if usage is high
    if (percentUsed >= ALERT_THRESHOLD) {
      logger.warn(`API quota alert: ${apiType} at ${Math.round(percentUsed * 100)}% (${usage}/${requestsPerDay})`);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Error checking API quota: ${error.message}`, { error });
    return false;
  }
}

/**
 * Get API configuration based on type
 * @param {string} apiType - API type
 * @returns {Object|null} API configuration
 */
function getApiConfig(apiType) {
  const apiConfig = {
    places: {
      requestsPerDay: 25000,
      requestsPerMinute: 100
    },
    geocoding: {
      requestsPerDay: 10000,
      requestsPerMinute: 50
    }
  };
  
  return apiConfig[apiType] || null;
}

/**
 * Get aggregated metrics for endpoints
 * @param {string} [endpoint] - Optional endpoint filter
 * @param {string} [timeframe='7d'] - Timeframe (1d, 7d, 30d)
 * @returns {Promise<Object>} Metrics data
 */
async function getMetrics(endpoint, timeframe = '7d') {
  try {
    // Calculate date range based on timeframe
    const days = timeframe === '1d' ? 1 : timeframe === '7d' ? 7 : 30;
    const dates = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    // Get all metrics keys
    const pattern = endpoint 
      ? `${METRICS_PREFIX}${endpoint}:*` 
      : `${METRICS_PREFIX}*`;
    
    const keys = await redisClient.keys(pattern);
    
    // Collect metrics data
    const result = {};
    for (const key of keys) {
      const [, path, method] = key.split(':');
      const endpointKey = `${path}:${method}`;
      result[endpointKey] = { path, method, days: {} };
      
      const data = await redisClient.hGetAll(key);
      
      // Process data by date
      for (const date of dates) {
        const count = parseInt(data[`count:${date}`] || '0');
        const totalDuration = parseInt(data[`total_duration:${date}`] || '0');
        const min = parseInt(data[`min:${date}`] || '0');
        const max = parseInt(data[`max:${date}`] || '0');
        
        // Calculate errors
        let errors = 0;
        for (const dataKey of Object.keys(data)) {
          if (dataKey.startsWith(`errors:`) && dataKey.endsWith(`:${date}`)) {
            errors += parseInt(data[dataKey]);
          }
        }
        
        result[endpointKey].days[date] = {
          count,
          avgDuration: count > 0 ? Math.round(totalDuration / count) : 0,
          min: min || 0,
          max: max || 0,
          errors,
          errorRate: count > 0 ? Math.round((errors / count) * 100) / 100 : 0
        };
      }
      
      // Calculate aggregates
      let totalCount = 0;
      let totalDuration = 0;
      let totalErrors = 0;
      let globalMin = Infinity;
      let globalMax = 0;
      
      for (const date of dates) {
        const dayData = result[endpointKey].days[date];
        totalCount += dayData.count;
        totalDuration += dayData.count * dayData.avgDuration;
        totalErrors += dayData.errors;
        
        if (dayData.min > 0 && dayData.min < globalMin) globalMin = dayData.min;
        if (dayData.max > globalMax) globalMax = dayData.max;
      }
      
      result[endpointKey].aggregate = {
        totalRequests: totalCount,
        avgDuration: totalCount > 0 ? Math.round(totalDuration / totalCount) : 0,
        min: globalMin === Infinity ? 0 : globalMin,
        max: globalMax,
        totalErrors,
        errorRate: totalCount > 0 ? Math.round((totalErrors / totalCount) * 100) / 100 : 0
      };
    }
    
    return result;
  } catch (error) {
    logger.error(`Error getting metrics: ${error.message}`, { error });
    return {};
  }
}

/**
 * Reset metrics data
 * @param {string} [endpoint] - Optional endpoint to reset
 * @returns {Promise<boolean>} Success status
 */
async function resetMetrics(endpoint) {
  try {
    const pattern = endpoint 
      ? `${METRICS_PREFIX}${endpoint}:*` 
      : `${METRICS_PREFIX}*`;
    
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logger.info(`Reset metrics for ${endpoint || 'all endpoints'}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error resetting metrics: ${error.message}`, { error });
    return false;
  }
}

/**
 * Persist current metrics from memory to Redis
 */
async function persistMetrics() {
  try {
    // Nothing to implement here since we're directly using Redis
    // This is just a placeholder for potential in-memory aggregation
    cleanupOldMetrics();
  } catch (error) {
    logger.error(`Error persisting metrics: ${error.message}`, { error });
  }
}

/**
 * Clean up old metrics data
 */
async function cleanupOldMetrics() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days of data
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    // Get all metrics keys
    const keys = await redisClient.keys(`${METRICS_PREFIX}*`);
    
    for (const key of keys) {
      const data = await redisClient.hGetAll(key);
      
      // Find old date fields to delete
      const fieldsToDelete = Object.keys(data).filter(field => {
        const parts = field.split(':');
        const date = parts[parts.length - 1];
        return date < cutoffString && /^\d{4}-\d{2}-\d{2}$/.test(date);
      });
      
      if (fieldsToDelete.length > 0) {
        await redisClient.hDel(key, ...fieldsToDelete);
      }
    }
  } catch (error) {
    logger.error(`Error cleaning up old metrics: ${error.message}`, { error });
  }
}

/**
 * Generate a unique request ID
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a unique error ID
 * @returns {string} Unique error ID
 */
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get normalized endpoint path
 * @param {Object} req - Express request object
 * @returns {string} Normalized endpoint path
 */
function getEndpointPath(req) {
  let path = req.route ? req.route.path : req.path;
  
  // Normalize path by replacing IDs with placeholders
  // e.g. /api/users/123 -> /api/users/:id
  return path.replace(/\/\d+/g, '/:id');
}

module.exports = initMonitoring(); 