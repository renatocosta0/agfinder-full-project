const cron = require('node-cron');
const logger = require('../utils/logger');
const { 
  processUnprocessedBonuses, 
  recalculateUserThresholds, 
  checkEligibleUsersForBonus,
  batchAutoConvertBonusPoints
} = require('./bonus.service');
const { checkPendingSubscriptions } = require('./subscription.service');

// Schedule all cron jobs
const scheduleJobs = () => {
  try {
    // Process bonus transactions every 4 hours
    cron.schedule('0 */4 * * *', async () => {
      logger.info('Running scheduled job: Process unprocessed bonuses');
      try {
        await processUnprocessedBonuses();
      } catch (error) {
        logger.error('Error in scheduled job - Process unprocessed bonuses:', error);
      }
    });
    
    // Recalculate user thresholds every week (Monday at 3 AM)
    cron.schedule('0 3 * * 1', async () => {
      logger.info('Running scheduled job: Recalculate user thresholds');
      try {
        await recalculateUserThresholds();
      } catch (error) {
        logger.error('Error in scheduled job - Recalculate user thresholds:', error);
      }
    });
    
    // Check for eligible users for bonus rewards daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      logger.info('Running scheduled job: Check eligible users for bonus');
      try {
        await checkEligibleUsersForBonus();
      } catch (error) {
        logger.error('Error in scheduled job - Check eligible users for bonus:', error);
      }
    });
    
    // Check pending subscription payments hourly
    cron.schedule('0 */1 * * *', async () => {
      logger.info('Running scheduled job: Check pending subscriptions');
      try {
        await checkPendingSubscriptions();
      } catch (error) {
        logger.error('Error in scheduled job - Check pending subscriptions:', error);
      }
    });
    
    // Auto-convert bonus points to subscriptions daily at 1 AM
    cron.schedule('0 1 * * *', async () => {
      logger.info('Running scheduled job: Auto-convert bonus points to subscriptions');
      try {
        await batchAutoConvertBonusPoints();
      } catch (error) {
        logger.error('Error in scheduled job - Auto-convert bonus points:', error);
      }
    });
    
    logger.info('All scheduled jobs are set up');
  } catch (error) {
    logger.error('Error setting up scheduled jobs:', error);
    throw error;
  }
};

module.exports = {
  scheduleJobs,
}; 