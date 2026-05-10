/**
 * Circuit Breaker Utility
 * Implements a robust circuit breaker pattern to handle external service failures gracefully.
 * - Stops cascading failures by failing fast
 * - Implements half-open state for recovery
 * - Provides fallback mechanisms
 * 
 * IMPORTANTE: Este utilitário foi adaptado para a nova arquitetura e deve ser
 * utilizado EXCLUSIVAMENTE pelos jobs cron (pois-collector.js, etc.), não
 * para responder requisições em tempo real da API. Todas as consultas ao
 * Google Maps API devem ser feitas de forma assíncrona pelos jobs.
 * 
 * As requisições da API para o usuário final devem usar o banco de dados local.
 */

const logger = require('./logger');
const { redisClient } = require('../services/cache.service');
const EventEmitter = require('events');

// Circuit breaker states
const STATES = {
  CLOSED: 'CLOSED',      // Normal operation - requests flow through
  OPEN: 'OPEN',          // Circuit is open - requests fail fast
  HALF_OPEN: 'HALF_OPEN' // Testing if service is back online
};

// Default circuit breaker options
const DEFAULT_OPTIONS = {
  failureThreshold: 5,       // Number of failures until opening circuit
  resetTimeout: 30000,       // Time in ms to wait before setting to half-open
  halfOpenMaxRequests: 1,    // Max concurrent requests in half-open state
  requestTimeout: 10000,     // Request timeout in ms
  monitorInterval: 60000,    // Health check interval in ms
  storageKeyPrefix: 'cb:',   // Redis key prefix for circuit state
  fallbackFunction: null,    // Fallback function to call when circuit is open
  notifyOnStatusChange: true // Log status changes
};

// Event emitter for circuit breaker events
const events = new EventEmitter();

/**
 * Create a new circuit breaker
 * @param {string} name - Circuit breaker name/identifier
 * @param {Object} [options] - Circuit breaker options
 * @returns {Object} Circuit breaker instance
 */
function createCircuitBreaker(name, options = {}) {
  // Merge options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Initialize state
  let state = STATES.CLOSED;
  let failureCount = 0;
  let lastFailureTime = null;
  let halfOpenExecutions = 0;
  let resetTimeoutId = null;
  
  // Create circuit breaker instance
  const circuitBreaker = {
    name,
    state,
    failureCount,
    execute,
    forceClose,
    forceOpen,
    getState,
    registerFallback,
    on: events.on.bind(events),
    off: events.removeListener.bind(events)
  };
  
  // Set up monitoring interval
  const monitorIntervalId = setInterval(() => {
    checkCircuitState();
  }, config.monitorInterval);
  
  // Attempt to restore state from Redis
  restoreState();
  
  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @param {Array} args - Arguments to pass to the function
   * @param {Object} [context] - Additional context for logging/tracking
   * @returns {Promise<any>} Function result or fallback result
   */
  async function execute(fn, args = [], context = {}) {
    await checkCircuitState();
    
    // If circuit is open, fail fast
    if (state === STATES.OPEN) {
      logger.warn(`Circuit breaker "${name}" is OPEN - failing fast`, { context });
      return handleRejection(null, 'Circuit is open', context);
    }
    
    // If circuit is half-open, limit concurrent requests
    if (state === STATES.HALF_OPEN) {
      if (halfOpenExecutions >= config.halfOpenMaxRequests) {
        logger.warn(`Circuit breaker "${name}" is HALF-OPEN with max executions - failing fast`, { context });
        return handleRejection(null, 'Circuit is half-open with max executions', context);
      }
      
      halfOpenExecutions++;
    }
    
    try {
      // Execute function with timeout
      const result = await Promise.race([
        fn(...args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), config.requestTimeout)
        )
      ]);
      
      // Success - reset failure count
      await handleSuccess();
      return result;
    } catch (error) {
      // Failure - record and possibly open circuit
      return handleRejection(error, error.message, context);
    }
  }
  
  /**
   * Handle successful execution
   */
  async function handleSuccess() {
    if (state === STATES.HALF_OPEN) {
      // If successful in half-open state, close the circuit
      await changeState(STATES.CLOSED);
      failureCount = 0;
      halfOpenExecutions = 0;
      await saveState();
    } else if (state === STATES.CLOSED && failureCount > 0) {
      // Reset failure count in closed state
      failureCount = 0;
      await saveState();
    }
  }
  
  /**
   * Handle rejected execution
   * @param {Error} error - Error object
   * @param {string} reason - Rejection reason
   * @param {Object} context - Execution context
   * @returns {Promise<any>} Fallback result
   */
  async function handleRejection(error, reason, context) {
    if (state === STATES.CLOSED) {
      failureCount++;
      lastFailureTime = Date.now();
      
      if (failureCount >= config.failureThreshold) {
        await changeState(STATES.OPEN);
        scheduleReset();
      }
      
      await saveState();
    } else if (state === STATES.HALF_OPEN) {
      // If failed in half-open state, re-open the circuit
      halfOpenExecutions = 0;
      await changeState(STATES.OPEN);
      scheduleReset();
      await saveState();
    }
    
    // Call fallback function if available
    if (typeof config.fallbackFunction === 'function') {
      logger.info(`Circuit breaker "${name}" using fallback`, { context });
      try {
        return await config.fallbackFunction(error, context);
      } catch (fallbackError) {
        logger.error(`Circuit breaker "${name}" fallback error: ${fallbackError.message}`, { context, fallbackError });
        throw fallbackError;
      }
    }
    
    // No fallback or fallback failed
    const circuitError = new Error(`Circuit Breaker Error: ${reason}`);
    circuitError.originalError = error;
    circuitError.context = context;
    throw circuitError;
  }
  
  /**
   * Check and update circuit state
   */
  async function checkCircuitState() {
    // Restore from Redis to ensure consistency across instances
    await restoreState();
    
    if (state === STATES.OPEN && lastFailureTime) {
      const elapsed = Date.now() - lastFailureTime;
      
      if (elapsed >= config.resetTimeout) {
        await changeState(STATES.HALF_OPEN);
        halfOpenExecutions = 0;
        await saveState();
      }
    }
  }
  
  /**
   * Schedule circuit reset
   */
  function scheduleReset() {
    if (resetTimeoutId) {
      clearTimeout(resetTimeoutId);
    }
    
    resetTimeoutId = setTimeout(async () => {
      if (state === STATES.OPEN) {
        await changeState(STATES.HALF_OPEN);
        halfOpenExecutions = 0;
        await saveState();
      }
    }, config.resetTimeout);
  }
  
  /**
   * Change circuit state
   * @param {string} newState - New circuit state
   */
  async function changeState(newState) {
    if (state === newState) return;
    
    const oldState = state;
    state = newState;
    
    if (config.notifyOnStatusChange) {
      logger.info(`Circuit breaker "${name}" changed from ${oldState} to ${newState}`);
    }
    
    // Emit event
    events.emit('stateChange', { name, oldState, newState });
    
    // Save state to Redis
    await saveState();
  }
  
  /**
   * Force circuit to closed state
   */
  async function forceClose() {
    failureCount = 0;
    halfOpenExecutions = 0;
    await changeState(STATES.CLOSED);
    await saveState();
  }
  
  /**
   * Force circuit to open state
   */
  async function forceOpen() {
    lastFailureTime = Date.now();
    await changeState(STATES.OPEN);
    scheduleReset();
    await saveState();
  }
  
  /**
   * Register a fallback function
   * @param {Function} fallback - Fallback function
   */
  function registerFallback(fallback) {
    if (typeof fallback !== 'function') {
      throw new Error('Fallback must be a function');
    }
    
    config.fallbackFunction = fallback;
  }
  
  /**
   * Get current circuit state
   * @returns {Object} Circuit state
   */
  function getState() {
    return {
      name,
      state,
      failureCount,
      lastFailureTime,
      halfOpenExecutions,
      options: config
    };
  }
  
  /**
   * Save circuit state to Redis
   */
  async function saveState() {
    try {
      const stateData = {
        state,
        failureCount,
        lastFailureTime,
        halfOpenExecutions,
        updatedAt: Date.now()
      };
      
      const key = `${config.storageKeyPrefix}${name}`;
      await redisClient.set(key, JSON.stringify(stateData));
      
      // Set TTL to avoid stale circuit breakers
      await redisClient.expire(key, 86400); // 24 hours
    } catch (error) {
      logger.error(`Failed to save circuit breaker state: ${error.message}`, { error });
    }
  }
  
  /**
   * Restore circuit state from Redis
   */
  async function restoreState() {
    try {
      const key = `${config.storageKeyPrefix}${name}`;
      const savedState = await redisClient.get(key);
      
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Only restore state if not too old (10 minutes)
        const stateAge = Date.now() - (parsedState.updatedAt || 0);
        if (stateAge <= 600000) {
          state = parsedState.state;
          failureCount = parsedState.failureCount;
          lastFailureTime = parsedState.lastFailureTime;
          halfOpenExecutions = parsedState.halfOpenExecutions;
          
          // If we restored an open state, schedule a reset
          if (state === STATES.OPEN) {
            scheduleReset();
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to restore circuit breaker state: ${error.message}`, { error });
    }
  }
  
  // Return the circuit breaker instance
  return circuitBreaker;
}

/**
 * Create a fallback function that returns cached data
 * @param {Function} cacheGetter - Function to retrieve from cache
 * @param {Function} [transform] - Optional transform function for cached data
 * @returns {Function} Fallback function
 */
function createCacheFallback(cacheGetter, transform) {
  return async (error, context) => {
    try {
      const cachedData = await cacheGetter(context);
      
      if (!cachedData) {
        throw new Error('No cached data available for fallback');
      }
      
      return typeof transform === 'function'
        ? transform(cachedData, context)
        : cachedData;
    } catch (fallbackError) {
      logger.error(`Cache fallback error: ${fallbackError.message}`, { 
        originalError: error, 
        fallbackError, 
        context 
      });
      throw fallbackError;
    }
  };
}

/**
 * Create a function that always returns the same value as fallback
 * @param {any} value - Value to return
 * @returns {Function} Fallback function
 */
function createStaticFallback(value) {
  return async () => value;
}

/**
 * Get all circuit breakers
 * @returns {Promise<Array>} Array of circuit breaker states
 */
async function getAllCircuitBreakers() {
  try {
    const keys = await redisClient.keys(`${DEFAULT_OPTIONS.storageKeyPrefix}*`);
    const states = [];
    
    for (const key of keys) {
      const savedState = await redisClient.get(key);
      if (savedState) {
        const name = key.replace(DEFAULT_OPTIONS.storageKeyPrefix, '');
        states.push({ name, ...JSON.parse(savedState) });
      }
    }
    
    return states;
  } catch (error) {
    logger.error(`Failed to get all circuit breakers: ${error.message}`, { error });
    return [];
  }
}

/**
 * Reset all circuit breakers
 * @returns {Promise<boolean>} Success status
 */
async function resetAllCircuitBreakers() {
  try {
    const keys = await redisClient.keys(`${DEFAULT_OPTIONS.storageKeyPrefix}*`);
    
    for (const key of keys) {
      await redisClient.del(key);
    }
    
    logger.info(`Reset ${keys.length} circuit breakers`);
    return true;
  } catch (error) {
    logger.error(`Failed to reset all circuit breakers: ${error.message}`, { error });
    return false;
  }
}

module.exports = {
  createCircuitBreaker,
  createCacheFallback,
  createStaticFallback,
  getAllCircuitBreakers,
  resetAllCircuitBreakers,
  STATES
}; 