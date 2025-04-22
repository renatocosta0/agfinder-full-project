const cron = require('node-cron');
const logger = require('../utils/logger');
const resetService = require('../services/reset.service');
const subscriptionService = require('../services/subscription.service');
const bonusService = require('../services/bonus.service');
const backupService = require('../services/backup.service');
const cleanupJob = require('./cleanup.job');

// Initialize all cron jobs
const initJobs = () => {
  // Daily reset at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily reset job');
    try {
      await resetService.performDailyReset();
      logger.info('Daily reset completed successfully');
    } catch (error) {
      logger.error('Error in daily reset job:', error);
    }
  });

  // Check subscriptions hourly
  cron.schedule('0 * * * *', async () => {
    logger.info('Running subscription check job');
    try {
      await subscriptionService.checkExpiredSubscriptions();
      await subscriptionService.checkPendingSubscriptions();
      logger.info('Subscription check completed successfully');
    } catch (error) {
      logger.error('Error in subscription check job:', error);
    }
  });

  // Process bonus points every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Running bonus processing job');
    try {
      await bonusService.processUnprocessedBonuses();
      logger.info('Bonus processing completed successfully');
    } catch (error) {
      logger.error('Error in bonus processing job:', error);
    }
  });

  // Daily database backup at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running database backup job');
    try {
      await backupService.performDatabaseBackup();
      logger.info('Database backup completed successfully');
    } catch (error) {
      logger.error('Error in database backup job:', error);
    }
  });
  
  // Monthly cleanup at 3 AM on the first day of the month
  cron.schedule('0 3 1 * *', async () => {
    logger.info('Running monthly cleanup job');
    try {
      const result = await cleanupJob.performMonthlyCleanup();
      logger.info(`Monthly cleanup completed successfully: ${result.subscriptions} subscriptions, ${result.bonuses} bonuses, ${result.warnings} warnings deleted`);
    } catch (error) {
      logger.error('Error in monthly cleanup job:', error);
    }
  });

  logger.info('All cron jobs initialized');
};

module.exports = {
  initJobs,
}; 