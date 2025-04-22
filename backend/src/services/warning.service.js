const { UserWarning, User, sequelize } = require('../models');
const logger = require('../utils/logger');

/**
 * Get all warnings for a user with pagination
 */
const getUserWarnings = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 10, includeRead = false } = options;
    const offset = (page - 1) * limit;
    
    const where = { user_id: userId };
    
    // Filter by read status if requested
    if (!includeRead) {
      where.read = false;
    }
    
    const { count, rows } = await UserWarning.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    
    return {
      warnings: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    logger.error(`Error getting warnings for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Mark a warning as read
 */
const markWarningAsRead = async (warningId, userId) => {
  try {
    const warning = await UserWarning.findOne({
      where: {
        id: warningId,
        user_id: userId,
      },
    });
    
    if (!warning) {
      throw new Error(`Warning not found or does not belong to user: ${warningId}`);
    }
    
    await warning.update({
      read: true,
      is_used: true,
      used_at: new Date(),
    });
    
    logger.info(`Warning ${warningId} marked as read by user ${userId}`);
    return warning;
  } catch (error) {
    logger.error(`Error marking warning ${warningId} as read:`, error);
    throw error;
  }
};

/**
 * Mark all warnings as read for a user
 */
const markAllWarningsAsRead = async (userId) => {
  try {
    const now = new Date();
    const result = await UserWarning.update(
      {
        read: true,
        is_used: true,
        used_at: now,
      },
      {
        where: {
          user_id: userId,
          read: false,
        },
      }
    );
    
    const count = result[0];
    logger.info(`${count} warnings marked as read for user ${userId}`);
    return count;
  } catch (error) {
    logger.error(`Error marking all warnings as read for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Clean up old read warnings (older than 10 days)
 */
const cleanupOldWarnings = async (dryRun = false) => {
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
    // Find all warnings that were marked as used more than 10 days ago
    const oldWarnings = await UserWarning.findAll({
      where: {
        is_used: true,
        used_at: {
          [sequelize.Op.lt]: tenDaysAgo,
        },
      },
    });
    
    if (oldWarnings.length === 0) {
      logger.info('No old warnings to clean up');
      return { deleted: 0, dryRun };
    }
    
    if (dryRun) {
      logger.info(`Dry run: Would delete ${oldWarnings.length} old warnings`);
      return { deleted: oldWarnings.length, dryRun };
    }
    
    // Delete old warnings
    await UserWarning.destroy({
      where: {
        is_used: true,
        used_at: {
          [sequelize.Op.lt]: tenDaysAgo,
        },
      },
    });
    
    logger.info(`${oldWarnings.length} old warnings deleted`);
    return { deleted: oldWarnings.length, dryRun };
  } catch (error) {
    logger.error('Error cleaning up old warnings:', error);
    throw error;
  }
};

module.exports = {
  getUserWarnings,
  markWarningAsRead,
  markAllWarningsAsRead,
  cleanupOldWarnings,
}; 