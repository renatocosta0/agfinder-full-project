const { Contribution, DailyReset, sequelize } = require('../models');
const logger = require('../utils/logger');

// Perform daily reset of contributions
const performDailyReset = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info('Starting daily reset process');
    
    // Mark all current contributions as not current
    const result = await Contribution.update(
      { is_current: false },
      {
        where: { is_current: true },
        transaction,
      }
    );
    
    const resetDate = new Date().toISOString().split('T')[0];
    
    // Create reset record
    await DailyReset.create(
      {
        reset_date: resetDate,
        status: 'success',
        details: `Reset ${result[0]} contributions`,
      },
      { transaction }
    );
    
    await transaction.commit();
    
    logger.info(`Daily reset completed. Reset ${result[0]} contributions.`);
    return { success: true, count: result[0] };
  } catch (error) {
    await transaction.rollback();
    
    // Log the error
    logger.error('Error performing daily reset:', error);
    
    // Create failed reset record
    try {
      const resetDate = new Date().toISOString().split('T')[0];
      await DailyReset.create({
        reset_date: resetDate,
        status: 'failed',
        details: `Error: ${error.message}`,
      });
    } catch (logError) {
      logger.error('Error logging reset failure:', logError);
    }
    
    // Re-throw the error
    throw error;
  }
};

module.exports = {
  performDailyReset,
}; 