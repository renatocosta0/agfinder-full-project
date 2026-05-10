/**
 * Queue Service for managing Google Maps API requests
 * Implements a rate-limited queue to prevent API quota exhaustion
 */

const logger = require('../utils/logger');
const EventEmitter = require('events');

class QueueService {
  constructor(options = {}) {
    // Configuration
    this.maxConcurrent = options.maxConcurrent || 5;
    this.requestsPerMinute = options.requestsPerMinute || 100;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 2000;
    
    // Queue state
    this.queue = [];
    this.active = 0;
    this.requestCount = 0;
    this.resetTime = Date.now() + 60000; // Reset counter after 1 minute
    
    // Events
    this.events = new EventEmitter();
    
    // Start queue processor
    this.processing = false;
    
    // Statistics
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalErrors: 0,
      totalRetries: 0
    };
    
    logger.info(`Queue service initialized with maxConcurrent=${this.maxConcurrent}, requestsPerMinute=${this.requestsPerMinute}`);
  }
  
  /**
   * Add a task to the queue
   * @param {Function} task - The async function to execute
   * @param {Object} metadata - Additional information about the task
   * @returns {Promise} Promise that resolves when task is completed
   */
  enqueue(task, metadata = {}) {
    return new Promise((resolve, reject) => {
      this.stats.totalQueued++;
      
      this.queue.push({
        task,
        metadata: {
          ...metadata,
          queuedAt: Date.now()
        },
        resolve,
        reject,
        attempts: 0
      });
      
      logger.debug(`Task added to queue. Queue length: ${this.queue.length}`, { metadata });
      
      // Start processing if not already started
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process the queue
   */
  async processQueue() {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Rate limiting check
      if (this.requestCount >= this.requestsPerMinute) {
        const now = Date.now();
        if (now < this.resetTime) {
          const waitTime = this.resetTime - now;
          logger.info(`Rate limit reached. Waiting ${waitTime}ms before continuing`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          this.requestCount = 0;
          this.resetTime = Date.now() + 60000;
        } else {
          this.requestCount = 0;
          this.resetTime = Date.now() + 60000;
        }
      }
      
      // Concurrency check
      if (this.active >= this.maxConcurrent) {
        // Wait for an active task to complete
        await new Promise(resolve => this.events.once('taskComplete', resolve));
        continue;
      }
      
      // Get next task
      const item = this.queue.shift();
      this.active++;
      this.requestCount++;
      
      // Process the task
      this.executeTask(item).catch(err => {
        logger.error('Error in queue processor:', err);
      });
    }
    
    this.processing = false;
  }
  
  /**
   * Execute a task with retry logic
   * @param {Object} item - Queue item with task and metadata
   */
  async executeTask(item) {
    try {
      const startTime = Date.now();
      item.attempts++;
      
      if (item.attempts > 1) {
        this.stats.totalRetries++;
        logger.info(`Retrying task (attempt ${item.attempts}/${this.retryAttempts})`, { metadata: item.metadata });
      }
      
      // Execute the task
      const result = await item.task();
      
      // Success
      const duration = Date.now() - startTime;
      logger.debug(`Task completed in ${duration}ms`, { metadata: item.metadata });
      
      item.resolve(result);
      this.stats.totalProcessed++;
    } catch (error) {
      // Handle error
      if (item.attempts < this.retryAttempts) {
        // Retry the task
        logger.warn(`Task failed, will retry (${item.attempts}/${this.retryAttempts}): ${error.message}`, { metadata: item.metadata });
        
        // Add back to the queue with delay
        setTimeout(() => {
          this.queue.unshift(item);
        }, this.retryDelay * item.attempts);
      } else {
        // Max retries reached
        logger.error(`Task failed after ${item.attempts} attempts: ${error.message}`, { metadata: item.metadata });
        item.reject(error);
        this.stats.totalErrors++;
      }
    } finally {
      this.active--;
      this.events.emit('taskComplete');
    }
  }
  
  /**
   * Get current queue statistics
   * @returns {Object} Queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentQueueLength: this.queue.length,
      activeRequests: this.active,
      currentRequestRate: this.requestCount
    };
  }
  
  /**
   * Clear the queue
   */
  clear() {
    const queueLength = this.queue.length;
    this.queue.forEach(item => {
      item.reject(new Error('Queue was cleared'));
    });
    this.queue = [];
    logger.info(`Queue cleared, ${queueLength} tasks removed`);
  }
}

// Singleton instance
const queueService = new QueueService({
  maxConcurrent: parseInt(process.env.MAPS_API_MAX_CONCURRENT || '5', 10),
  requestsPerMinute: parseInt(process.env.MAPS_API_REQUESTS_PER_MINUTE || '100', 10),
  retryAttempts: parseInt(process.env.MAPS_API_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.MAPS_API_RETRY_DELAY || '2000', 10)
});

module.exports = queueService; 