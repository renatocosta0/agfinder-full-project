const { SubscriptionTransaction, User, sequelize } = require('../models');
const logger = require('../utils/logger');

/**
 * Create a new subscription
 * @param {Object} subscriptionData
 * @param {UUID} subscriptionData.user_id - User ID
 * @param {string} subscriptionData.subscription_type - Type of subscription (daily, weekly, monthly)
 * @param {Date} [subscriptionData.starts_at] - Start date (defaults to now)
 * @param {Object} [transaction] - Sequelize transaction
 * @returns {Promise<Object>} Created subscription
 */
const createSubscription = async (subscriptionData, transaction) => {
  try {
    const { user_id, subscription_type, payment_method = 'proxypay' } = subscriptionData;
    const starts_at = subscriptionData.starts_at || new Date();
    
    // Calculate end date based on subscription type
    const ends_at = new Date(starts_at);
    switch (subscription_type) {
      case 'daily':
        ends_at.setDate(ends_at.getDate() + 1);
        break;
      case 'weekly':
        ends_at.setDate(ends_at.getDate() + 7);
        break;
      case 'monthly':
        ends_at.setMonth(ends_at.getMonth() + 1);
        break;
      case 'bonus':
        // For bonus subscriptions, end date should be provided
        if (!subscriptionData.ends_at) {
          throw new Error('End date must be provided for bonus subscriptions');
        }
        break;
      default:
        throw new Error(`Invalid subscription type: ${subscription_type}`);
    }
    
    // If a specific end date was provided, use it
    const finalEndsAt = subscriptionData.ends_at || ends_at;
    
    // Use provided transaction or create a new one
    const t = transaction || await sequelize.transaction();
    
    try {
      // Create subscription
      const subscription = await SubscriptionTransaction.create({
        user_id,
        amount: subscriptionData.amount || 0,
        subscription_type,
        payment_method,
        status: 'completed',
        completed_at: starts_at,
        expires_at: finalEndsAt,
        is_active: true,
        entity: subscriptionData.entity,
        reference: subscriptionData.reference,
        payment_amount: subscriptionData.payment_amount,
        payment_currency: subscriptionData.payment_currency,
      }, { transaction: t });
      
      // Update user subscription status
      await User.update({
        has_active_subscription: true,
        current_subscription_end: finalEndsAt,
      }, { 
        where: { id: user_id },
        transaction: t 
      });
      
      // If we created our own transaction, commit it
      if (!transaction) {
        await t.commit();
      }
      
      logger.info(`Subscription created for user ${user_id}, type: ${subscription_type}, ends at: ${finalEndsAt}`);
      return subscription;
    } catch (error) {
      // Only rollback if we created our own transaction
      if (!transaction) {
        await t.rollback();
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error creating subscription:', error);
    throw error;
  }
};

/**
 * Get active subscriptions for a user
 * @param {UUID} userId - User ID
 * @returns {Promise<Array>} Array of active subscriptions
 */
const getUserActiveSubscriptions = async (userId) => {
  try {
    return await SubscriptionTransaction.findAll({
      where: {
        user_id: userId,
        is_active: true,
        status: 'completed',
      },
      order: [['expires_at', 'DESC']],
    });
  } catch (error) {
    logger.error(`Error getting active subscriptions for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Get all subscriptions for a user with pagination
 * @param {UUID} userId - User ID
 * @param {Object} options - Filter and pagination options
 * @returns {Promise<Object>} Paginated subscriptions
 */
const getUserSubscriptions = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 10, includeExpired = true } = options;
    const offset = (page - 1) * limit;
    
    const where = { 
      user_id: userId,
      status: 'completed',
    };
    
    // Filter by active status if requested
    if (!includeExpired) {
      where.is_active = true;
    }
    
    const { count, rows } = await SubscriptionTransaction.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    
    return {
      subscriptions: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    logger.error(`Error getting subscriptions for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Extend an active subscription
 * @param {UUID} subscriptionId - Subscription ID
 * @param {number} days - Number of days to extend
 * @param {Object} [transaction] - Sequelize transaction
 * @returns {Promise<Object>} Updated subscription
 */
const extendSubscription = async (subscriptionId, days, transaction) => {
  try {
    // Use provided transaction or create a new one
    const t = transaction || await sequelize.transaction();
    
    try {
      // Get the subscription
      const subscription = await SubscriptionTransaction.findByPk(subscriptionId, { 
        transaction: t 
      });
      
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      
      if (!subscription.is_active || subscription.status !== 'completed') {
        throw new Error(`Cannot extend inactive subscription: ${subscriptionId}`);
      }
      
      // Calculate new end date
      const currentEndDate = new Date(subscription.expires_at);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + days);
      
      // Update subscription
      await subscription.update({
        expires_at: newEndDate,
      }, { transaction: t });
      
      // Update user's current subscription end date if this extends beyond current end
      const user = await User.findByPk(subscription.user_id, { 
        transaction: t 
      });
      
      if (user) {
        const currentUserEndDate = user.current_subscription_end 
          ? new Date(user.current_subscription_end) 
          : new Date();
          
        if (newEndDate > currentUserEndDate) {
          await user.update({
            has_active_subscription: true,
            current_subscription_end: newEndDate,
          }, { transaction: t });
        }
      }
      
      // If we created our own transaction, commit it
      if (!transaction) {
        await t.commit();
      }
      
      logger.info(`Subscription ${subscriptionId} extended by ${days} days, new end date: ${newEndDate}`);
      return await SubscriptionTransaction.findByPk(subscriptionId);
    } catch (error) {
      // Only rollback if we created our own transaction
      if (!transaction) {
        await t.rollback();
      }
      throw error;
    }
  } catch (error) {
    logger.error(`Error extending subscription ${subscriptionId}:`, error);
    throw error;
  }
};

/**
 * Mark expired subscriptions as inactive
 * @returns {Promise<Object>} Count of subscriptions marked as inactive
 */
const deactivateExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    
    // Find all active subscriptions that have expired
    const expiredSubscriptions = await SubscriptionTransaction.findAll({
      where: {
        is_active: true,
        status: 'completed',
        expires_at: {
          [sequelize.Op.lt]: now,
        },
      },
    });
    
    if (expiredSubscriptions.length === 0) {
      logger.info('No expired subscriptions to deactivate');
      return { deactivated: 0 };
    }
    
    // Create a transaction
    const t = await sequelize.transaction();
    
    try {
      // Group subscriptions by user
      const userSubscriptionsMap = {};
      
      expiredSubscriptions.forEach(subscription => {
        if (!userSubscriptionsMap[subscription.user_id]) {
          userSubscriptionsMap[subscription.user_id] = [];
        }
        userSubscriptionsMap[subscription.user_id].push(subscription);
      });
      
      // Process each user's subscriptions
      for (const userId in userSubscriptionsMap) {
        const userSubscriptions = userSubscriptionsMap[userId];
        
        // Deactivate all expired subscriptions
        for (const subscription of userSubscriptions) {
          await subscription.update({
            is_active: false,
          }, { transaction: t });
        }
        
        // Check if user has any active subscriptions left
        const remainingActiveSubscription = await SubscriptionTransaction.findOne({
          where: {
            user_id: userId,
            is_active: true,
            status: 'completed',
            expires_at: {
              [sequelize.Op.gt]: now,
            },
          },
          order: [['expires_at', 'DESC']],
          transaction: t,
        });
        
        // Update user status
        if (remainingActiveSubscription) {
          await User.update({
            has_active_subscription: true,
            current_subscription_end: remainingActiveSubscription.expires_at,
          }, { 
            where: { id: userId },
            transaction: t,
          });
        } else {
          await User.update({
            has_active_subscription: false,
            current_subscription_end: null,
          }, { 
            where: { id: userId },
            transaction: t,
          });
        }
      }
      
      await t.commit();
      
      logger.info(`${expiredSubscriptions.length} expired subscriptions marked as inactive`);
      return { deactivated: expiredSubscriptions.length };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    logger.error('Error deactivating expired subscriptions:', error);
    throw error;
  }
};

/**
 * Clean up old subscriptions (expired and older than 90 days)
 * @param {boolean} [dryRun=false] - If true, only count records but don't delete
 * @returns {Promise<Object>} Count of subscriptions deleted
 */
const cleanupOldSubscriptions = async (dryRun = false) => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // Find all inactive subscriptions that ended more than 90 days ago
    const oldSubscriptions = await SubscriptionTransaction.findAll({
      where: {
        is_active: false,
        expires_at: {
          [sequelize.Op.lt]: ninetyDaysAgo,
        },
      },
    });
    
    if (oldSubscriptions.length === 0) {
      logger.info('No old subscriptions to clean up');
      return { deleted: 0, dryRun };
    }
    
    if (dryRun) {
      logger.info(`Dry run: Would delete ${oldSubscriptions.length} old subscriptions`);
      return { deleted: oldSubscriptions.length, dryRun };
    }
    
    // Delete old subscriptions
    await SubscriptionTransaction.destroy({
      where: {
        is_active: false,
        expires_at: {
          [sequelize.Op.lt]: ninetyDaysAgo,
        },
      },
    });
    
    logger.info(`${oldSubscriptions.length} old subscriptions deleted`);
    return { deleted: oldSubscriptions.length, dryRun };
  } catch (error) {
    logger.error('Error cleaning up old subscriptions:', error);
    throw error;
  }
};

module.exports = {
  createSubscription,
  getUserActiveSubscriptions,
  getUserSubscriptions,
  extendSubscription,
  deactivateExpiredSubscriptions,
  cleanupOldSubscriptions,
}; 