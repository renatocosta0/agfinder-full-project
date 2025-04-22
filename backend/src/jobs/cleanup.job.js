const { subscriptionService, bonusService, warningService } = require('../services');
const logger = require('../utils/logger');

/**
 * Perform monthly cleanup of old records:
 * - Expired subscriptions older than 90 days
 * - Used bonuses older than 90 days
 * - Read warnings older than 10 days
 */
const performMonthlyCleanup = async () => {
  try {
    logger.info('Starting monthly cleanup job');
    
    // Clean up old subscriptions
    const subscriptionResult = await subscriptionService.cleanupOldSubscriptions();
    logger.info(`Subscription cleanup: ${subscriptionResult.deleted} records deleted`);
    
    // Clean up old bonuses
    const bonusResult = await bonusService.cleanupOldBonuses();
    logger.info(`Bonus cleanup: ${bonusResult.deleted} records deleted`);
    
    // Clean up old warnings
    const warningResult = await warningService.cleanupOldWarnings();
    logger.info(`Warning cleanup: ${warningResult.deleted} records deleted`);
    
    logger.info('Monthly cleanup job completed successfully');
    
    return {
      subscriptions: subscriptionResult.deleted,
      bonuses: bonusResult.deleted,
      warnings: warningResult.deleted,
    };
  } catch (error) {
    logger.error('Error in monthly cleanup job:', error);
    throw error;
  }
};

module.exports = {
  performMonthlyCleanup,
}; 