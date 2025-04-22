const { BonusTransaction, User, Contribution, Validation, SubscriptionTransaction, sequelize } = require('../models');
const logger = require('../utils/logger');
const { BONUS_TYPES, BONUS_STATUS } = require('../constants');
const subscriptionService = require('./subscription.service');

// Process unprocessed bonuses from validations
const processUnprocessedBonuses = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info('Processing unprocessed bonus transactions');
    
    // Find contributions with more validations than reports
    const contributions = await Contribution.findAll({
      include: [
        {
          model: Validation,
          as: 'validations',
        },
        {
          model: BonusTransaction,
          as: 'bonusTransactions',
          where: {
            transaction_type: 'validation_bonus',
          },
          required: false,
        },
      ],
    });
    
    let processedCount = 0;
    
    // For each contribution, check if it needs a validation bonus
    for (const contribution of contributions) {
      // Skip if already has a validation bonus
      if (contribution.bonusTransactions.length > 0) {
        continue;
      }
      
      // Count validations and reports
      const validCount = contribution.validations.filter(v => v.validation_type === 'valid').length;
      const reportCount = contribution.validations.filter(v => v.validation_type === 'report').length;
      
      // If more validations than reports and at least 3 validations
      if (validCount > reportCount && validCount >= 3) {
        // Give bonus to contributor
        const bonusPoints = parseInt(process.env.BONUS_VALIDATION, 10) * 2 || 10;
        
        await BonusTransaction.create(
          {
            user_id: contribution.user_id,
            amount: bonusPoints,
            transaction_type: 'validation_bonus',
            related_contribution_id: contribution.id,
            description: `Bonus for validated contribution (${validCount} validations)`,
          },
          { transaction }
        );
        
        // Update user bonus points
        await User.increment(
          { bonus_points: bonusPoints },
          {
            where: { id: contribution.user_id },
            transaction,
          }
        );
        
        processedCount++;
        logger.info(`Added validation bonus for contribution ${contribution.id}, user ${contribution.user_id}, points ${bonusPoints}`);
        
        // After adding bonus points, check if they can be automatically converted to subscription
        await autoConvertBonusToSubscription(contribution.user_id, transaction);
      }

      // Process for random contribution reward (if doesn't have a validation_bonus yet)
      await processContributionReward(contribution.user_id, contribution.id, transaction);
    }
    
    await transaction.commit();
    
    logger.info(`Processed ${processedCount} bonus transactions`);
    return { success: true, count: processedCount };
  } catch (error) {
    await transaction.rollback();
    logger.error('Error processing bonus transactions:', error);
    throw error;
  }
};

// Automatically convert bonus points to subscription
const autoConvertBonusToSubscription = async (userId, transaction) => {
  try {
    // Get user with current bonus points
    const user = await User.findByPk(userId, { transaction });
    
    if (!user) {
      logger.error(`Auto convert bonus: User not found: ${userId}`);
      return { success: false, reason: 'user_not_found' };
    }
    
    // Get subscription prices
    const dailyPrice = parseInt(process.env.SUBSCRIPTION_DAILY_PRICE, 10) || 5;
    const weeklyPrice = parseInt(process.env.SUBSCRIPTION_WEEKLY_PRICE, 10) || 30;
    
    // Calculate bonus points needed (10 bonus points = 1 AOA)
    const dailyBonusNeeded = dailyPrice * 10;
    
    // Check if user has enough bonus points for at least a daily subscription
    if (user.bonus_points < dailyBonusNeeded) {
      logger.info(`User ${userId} has insufficient bonus points (${user.bonus_points}/${dailyBonusNeeded}) for auto-conversion`);
      return { success: false, reason: 'insufficient_points' };
    }
    
    // Determine which subscription type to use based on available points
    let subscriptionType = 'daily';
    let days = 1;
    let bonusNeeded = dailyBonusNeeded;
    
    // If user has enough for weekly and it's a better value, use that instead
    const weeklyBonusNeeded = weeklyPrice * 10;
    if (user.bonus_points >= weeklyBonusNeeded) {
      subscriptionType = 'weekly';
      days = 7;
      bonusNeeded = weeklyBonusNeeded;
    }
    
    // Calculate start and end dates
    const startDate = new Date();
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    // Check if user already has an active subscription and extend it
    if (user.subscription_type !== 'none' && 
        user.subscription_end && 
        new Date(user.subscription_end) > new Date()) {
      // Extend existing subscription
      endDate = new Date(user.subscription_end);
      endDate.setDate(endDate.getDate() + days);
    }
    
    // Create subscription transaction
    const subscriptionTx = await SubscriptionTransaction.create(
      {
        user_id: userId,
        amount: bonusNeeded / 10, // Convert back to AOA for record
        subscription_type: subscriptionType,
        payment_method: 'bonus',
        status: 'completed',
        completed_at: new Date(),
        expires_at: endDate,
      },
      { transaction }
    );
    
    // Deduct bonus points
    await user.update(
      {
        bonus_points: user.bonus_points - bonusNeeded,
        subscription_type: subscriptionType,
        subscription_start: startDate,
        subscription_end: endDate,
      },
      { transaction }
    );
    
    // Create bonus transaction record for history
    await BonusTransaction.create(
      {
        user_id: userId,
        amount: -bonusNeeded,
        transaction_type: 'subscription',
        description: `Automatic conversion: ${bonusNeeded} bonus points to ${subscriptionType} subscription`,
      },
      { transaction }
    );
    
    logger.info(`Automatically converted ${bonusNeeded} bonus points to ${subscriptionType} subscription for user ${userId}`);
    
    return {
      success: true,
      subscription_type: subscriptionType,
      days,
      bonus_used: bonusNeeded,
      end_date: endDate,
    };
  } catch (error) {
    logger.error(`Error in auto convert bonus for user ${userId}:`, error);
    return { success: false, reason: 'internal_error' };
  }
};

// Calculate random threshold for contributions
const calculateRandomThreshold = () => {
  return Math.floor(Math.random() * 11) + 5; // Between 5 and 15
};

// Determine randomly if user will receive a bonus
const shouldReceiveBonus = () => {
  const probability = Math.random() * 100;
  const threshold = Math.random() * 40 + 30; // Between 30% and 70%
  return probability <= threshold;
};

// Determine bonus type (daily or weekly)
const determineBonusType = () => {
  const roll = Math.random() * 100;
  return roll <= 70 ? 'daily' : 'weekly';
};

// Count valid contributions for a user
const countValidContributions = async (userId) => {
  const contributions = await Contribution.findAll({
    where: {
      user_id: userId,
    },
    include: [
      {
        model: Validation,
        as: 'validations',
      },
    ],
  });

  // Count contributions with more validations than reports
  let validCount = 0;
  for (const contribution of contributions) {
    const validations = contribution.validations.filter(v => v.validation_type === 'valid').length;
    const reports = contribution.validations.filter(v => v.validation_type === 'report').length;
    
    if (validations > reports) {
      validCount++;
    }
  }
  
  return validCount;
};

// Extend user subscription
const extendUserSubscription = async (userId, bonusDays, transaction) => {
  // Find user
  const user = await User.findByPk(userId, { transaction });
  
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  
  // Calculate new subscription dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + bonusDays);
  
  // If user already has an active subscription, extend it
  if (user.subscription_type !== 'none' && 
      user.subscription_end && 
      new Date(user.subscription_end) > new Date()) {
    endDate.setTime(new Date(user.subscription_end).getTime() + (bonusDays * 24 * 60 * 60 * 1000));
  }
  
  // Update user subscription
  await user.update({
    subscription_type: bonusDays === 1 ? 'daily' : 'weekly',
    subscription_start: startDate,
    subscription_end: endDate,
  }, { transaction });
  
  return {
    startDate,
    endDate,
  };
};

// Process contribution reward (random bonus)
const processContributionReward = async (userId, contributionId, transaction) => {
  try {
    // Find user
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      logger.error(`User not found for contribution reward: ${userId}`);
      return;
    }
    
    // Get contribution
    const contribution = await Contribution.findByPk(contributionId, {
      include: [
        {
          model: Validation,
          as: 'validations',
        },
      ],
      transaction,
    });
    
    if (!contribution) {
      logger.error(`Contribution not found for reward: ${contributionId}`);
      return;
    }
    
    // Check if contribution has more validations than reports
    const validCount = contribution.validations.filter(v => v.validation_type === 'valid').length;
    const reportCount = contribution.validations.filter(v => v.validation_type === 'report').length;
    
    if (validCount <= reportCount) {
      return; // Skip if not more validations than reports
    }
    
    // Count valid contributions
    const validContributions = await countValidContributions(userId);
    
    // Check if it's time to recalculate threshold (every X days)
    if (!user.last_threshold_update || 
        (new Date() - new Date(user.last_threshold_update)) > 
        (parseInt(process.env.BONUS_THRESHOLD_UPDATE_DAYS, 10) || 7) * 24 * 60 * 60 * 1000) {
      await user.update({
        bonus_contribution_threshold: calculateRandomThreshold(),
        last_threshold_update: new Date(),
      }, { transaction });
      
      logger.info(`Updated bonus threshold for user ${userId} to ${user.bonus_contribution_threshold}`);
    }
    
    // Check if user passed threshold and didn't receive bonus in last X days
    if (validContributions >= user.bonus_contribution_threshold && 
        (!user.last_bonus_award_date || 
        (new Date() - new Date(user.last_bonus_award_date)) > 
        (parseInt(process.env.BONUS_AWARD_COOLDOWN_DAYS, 10) || 3) * 24 * 60 * 60 * 1000)) {
      // Determine if user will receive bonus
      if (shouldReceiveBonus()) {
        // Determine bonus type
        const bonusType = determineBonusType();
        const bonusDays = bonusType === 'daily' ? 1 : 7;
        
        logger.info(`User ${userId} will receive a ${bonusType} bonus reward (${bonusDays} days)`);
        
        // Create bonus transaction
        const bonusTx = await BonusTransaction.create({
          user_id: userId,
          amount: bonusDays,
          transaction_type: 'contribution_reward',
          related_contribution_id: contributionId,
          description: `Reward for ${validContributions} verified contributions (${bonusType} subscription)`,
          expiry_date: new Date(Date.now() + bonusDays * 24 * 60 * 60 * 1000),
        }, { transaction });
        
        // Extend user subscription
        const subscription = await extendUserSubscription(userId, bonusDays, transaction);
        
        // Update last bonus award date
        await user.update({
          last_bonus_award_date: new Date(),
        }, { transaction });
        
        logger.info(`Applied bonus reward for user ${userId}: ${bonusType} subscription (${bonusDays} days) until ${subscription.endDate.toISOString()}`);
        
        return {
          success: true,
          bonus_type: bonusType,
          bonus_days: bonusDays,
          expiry_date: subscription.endDate,
        };
      } else {
        logger.info(`User ${userId} was eligible but not selected for bonus reward`);
      }
    } else {
      logger.info(`User ${userId} has ${validContributions}/${user.bonus_contribution_threshold} contributions needed for bonus`);
    }
    
    return {
      success: false,
    };
  } catch (error) {
    logger.error('Error processing contribution reward:', error);
    throw error;
  }
};

// Recalculate bonus thresholds for all users (to be run every 7 days)
const recalculateUserThresholds = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info('Recalculating bonus thresholds for all users');
    
    const users = await User.findAll();
    let updatedCount = 0;
    
    for (const user of users) {
      await user.update({
        bonus_contribution_threshold: calculateRandomThreshold(),
        last_threshold_update: new Date(),
      }, { transaction });
      
      updatedCount++;
    }
    
    await transaction.commit();
    logger.info(`Recalculated bonus thresholds for ${updatedCount} users`);
    
    return {
      success: true,
      count: updatedCount,
    };
  } catch (error) {
    await transaction.rollback();
    logger.error('Error recalculating bonus thresholds:', error);
    throw error;
  }
};

// Apply welcome bonus with X days free subscription for new users
const applyWelcomeBonus = async (userId) => {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info(`Applying welcome bonus for new user: ${userId}`);
    
    const user = await User.findByPk(userId, { transaction });
    
    if (!user) {
      await transaction.rollback();
      throw new Error(`User not found: ${userId}`);
    }
    
    // Calculate subscription dates (X days)
    const startDate = new Date();
    const endDate = new Date();
    const welcomeDays = parseInt(process.env.WELCOME_BONUS_DAYS, 10) || 14;
    endDate.setDate(endDate.getDate() + welcomeDays);
    
    // Create bonus transaction
    await BonusTransaction.create({
      user_id: userId,
      amount: welcomeDays,
      transaction_type: 'welcome',
      description: `Welcome bonus: ${welcomeDays} days free subscription`,
      expiry_date: endDate,
    }, { transaction });
    
    // Update user subscription
    await user.update({
      subscription_type: 'weekly', // Using weekly type for the X-day subscription
      subscription_start: startDate,
      subscription_end: endDate,
      bonus_contribution_threshold: calculateRandomThreshold(), // Initialize threshold
      last_threshold_update: new Date(),
    }, { transaction });
    
    await transaction.commit();
    
    logger.info(`Applied welcome bonus for user ${userId}: ${welcomeDays} days free subscription until ${endDate.toISOString()}`);
    
    return {
      success: true,
      subscription_end: endDate,
    };
  } catch (error) {
    await transaction.rollback();
    logger.error('Error applying welcome bonus:', error);
    throw error;
  }
};

// Check for eligible users for random bonus rewards
const checkEligibleUsersForBonus = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info('Checking for users eligible for random bonus rewards');
    
    const users = await User.findAll();
    let processedCount = 0;
    
    for (const user of users) {
      // Skip users who received bonus in last X days
      if (user.last_bonus_award_date && 
          (new Date() - new Date(user.last_bonus_award_date)) <= 
          (parseInt(process.env.BONUS_AWARD_COOLDOWN_DAYS, 10) || 3) * 24 * 60 * 60 * 1000) {
        continue;
      }
      
      // Count valid contributions
      const validContributions = await countValidContributions(user.id);
      
      // Check threshold
      if (validContributions >= user.bonus_contribution_threshold) {
        // Determine if user will receive bonus
        if (shouldReceiveBonus()) {
          // Determine bonus type
          const bonusType = determineBonusType();
          const bonusDays = bonusType === 'daily' ? 1 : 7;
          
          logger.info(`User ${user.id} will receive a ${bonusType} bonus reward (${bonusDays} days)`);
          
          // Create bonus transaction
          await BonusTransaction.create({
            user_id: user.id,
            amount: bonusDays,
            transaction_type: 'contribution_reward',
            description: `Reward for ${validContributions} verified contributions (${bonusType} subscription)`,
            expiry_date: new Date(Date.now() + bonusDays * 24 * 60 * 60 * 1000),
          }, { transaction });
          
          // Extend user subscription
          await extendUserSubscription(user.id, bonusDays, transaction);
          
          // Update last bonus award date
          await user.update({
            last_bonus_award_date: new Date(),
          }, { transaction });
          
          processedCount++;
        }
      } else {
        // Even if user didn't get a new reward, check if they have bonus points to convert
        await autoConvertBonusToSubscription(user.id, transaction);
      }
    }
    
    await transaction.commit();
    
    logger.info(`Processed ${processedCount} users for random bonus rewards`);
    
    return {
      success: true,
      count: processedCount,
    };
  } catch (error) {
    await transaction.rollback();
    logger.error('Error checking eligible users for bonus:', error);
    throw error;
  }
};

// Check and convert bonus points to subscription for all users
const batchAutoConvertBonusPoints = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info('Running batch auto-conversion of bonus points to subscriptions');
    
    const users = await User.findAll();
    let convertedCount = 0;
    
    for (const user of users) {
      const result = await autoConvertBonusToSubscription(user.id, transaction);
      if (result.success) {
        convertedCount++;
      }
    }
    
    await transaction.commit();
    
    logger.info(`Auto-converted bonus points to subscriptions for ${convertedCount} users`);
    
    return {
      success: true,
      count: convertedCount,
    };
  } catch (error) {
    await transaction.rollback();
    logger.error('Error in batch auto-conversion of bonus points:', error);
    throw error;
  }
};

// Clean up old bonus records
const cleanupOldBonusRecords = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    logger.info('Cleaning up old bonus records');
    
    // Find expired bonus transactions older than 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const result = await BonusTransaction.destroy({
      where: {
        created_at: {
          [sequelize.Op.lt]: sixMonthsAgo,
        },
      },
      transaction,
    });
    
    await transaction.commit();
    
    logger.info(`Cleaned up ${result} old bonus records`);
    
    return {
      success: true,
      count: result,
    };
  } catch (error) {
    await transaction.rollback();
    logger.error('Error cleaning up old bonus records:', error);
    throw error;
  }
};

// Get user bonus status
const getUserBonusStatus = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    // Count valid contributions
    const validContributions = await countValidContributions(userId);
    
    // Get the total bonus amount received by the user
    const totalBonusAmount = await BonusTransaction.aggregate([
      { $match: { user_id: userId, transaction_type: 'validation_bonus' }, $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get the current bonus threshold and progress
    const currentThreshold = user.bonus_contribution_threshold || 0;
    const currentProgress = validContributions;
    const totalEarned = totalBonusAmount.length > 0 ? totalBonusAmount[0].total : 0;

    // Get pending bonuses
    const pendingBonuses = await BonusTransaction.findAll({
      where: {
        user_id: userId,
        transaction_type: 'validation_bonus',
        status: BONUS_STATUS.PENDING
      },
      order: [['created_at', 'DESC']],
      limit: 5
    });

    return {
      totalEarned,
      currentThreshold,
      currentProgress,
      pendingBonuses,
      percentageToNextBonus: currentThreshold > 0 
        ? Math.min(100, (currentProgress / currentThreshold) * 100)
        : 0
    };
  } catch (error) {
    logger.error(`Error getting user bonus status for ${userId}:`, error);
    throw error;
  }
};

// Get user bonus history with filtering
const getBonusHistory = async (userId, filters = {}) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate, sortBy } = filters;
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = { user_id: userId };
    
    if (status) {
      where.status = status;
    }
    
    if (startDate) {
      where.created_at = {
        ...where.created_at,
        [sequelize.Op.gte]: new Date(startDate)
      };
    }
    
    if (endDate) {
      where.created_at = {
        ...where.created_at,
        [sequelize.Op.lte]: new Date(endDate)
      };
    }
    
    // Build order clause
    const order = sortBy ? [[sortBy.split(':')[0], sortBy.split(':')[1] || 'ASC']] : [['created_at', 'DESC']];
    
    // Get transactions with pagination
    const { count, rows } = await BonusTransaction.findAndCountAll({
      where,
      order,
      limit,
      offset,
      include: [
        {
          model: Contribution,
          as: 'contribution',
          attributes: ['id', 'title', 'created_at'],
          required: false
        }
      ]
    });
    
    // Process transactions to add human-readable info
    const transactions = rows.map(tx => {
      const transaction = tx.toJSON();
      
      // Add human-readable type description
      let typeDescription;
      switch(transaction.transaction_type) {
        case 'validation_bonus':
          typeDescription = 'Points earned for validated contribution';
          break;
        case 'contribution_reward':
          typeDescription = 'Free subscription days for contributions';
          break;
        case 'welcome':
          typeDescription = 'Welcome bonus: 14 days free subscription';
          break;
        case 'subscription':
          typeDescription = 'Points used for subscription';
          break;
        case 'validation':
          typeDescription = 'Points for validating content';
          break;
        default:
          typeDescription = 'Bonus transaction';
      }
      
      // Determine if the transaction is for points or subscription days
      const isSubscriptionDays = ['contribution_reward', 'welcome'].includes(transaction.transaction_type);
      
      return {
        ...transaction,
        type_description: typeDescription,
        is_positive: transaction.amount > 0,
        // Add formatted dates
        formatted_dates: {
          created_at: {
            date: new Date(transaction.created_at).toISOString().split('T')[0],
            datetime: new Date(transaction.created_at).toISOString().replace('T', ' ').substring(0, 19)
          },
          expiry_date: transaction.expiry_date ? {
            date: new Date(transaction.expiry_date).toISOString().split('T')[0],
            datetime: new Date(transaction.expiry_date).toISOString().replace('T', ' ').substring(0, 19)
          } : null
        },
        // Add display information
        display_info: {
          bonus_type: transaction.transaction_type,
          type_name: typeDescription,
          value: Math.abs(transaction.amount),
          value_formatted: isSubscriptionDays 
            ? `${Math.abs(transaction.amount)} days` 
            : `${Math.abs(transaction.amount)} points`,
          is_points: !isSubscriptionDays,
          is_days: isSubscriptionDays,
          is_positive: transaction.amount > 0,
          is_negative: transaction.amount < 0,
          related_contribution: transaction.contribution 
            ? {
                id: transaction.contribution.id,
                title: transaction.contribution.title,
                date: new Date(transaction.contribution.created_at).toISOString().split('T')[0]
              } 
            : null
        },
        // Add color suggestion for UI
        ui_suggestion: {
          color: transaction.amount > 0 
            ? (isSubscriptionDays ? 'purple' : 'green')
            : 'red',
          icon: isSubscriptionDays 
            ? 'calendar'
            : (transaction.amount > 0 ? 'plus-circle' : 'minus-circle')
        }
      };
    });
    
    return {
      transactions,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      },
      summary: {
        total_transactions: count,
        has_points: transactions.some(tx => tx.display_info.is_points),
        has_subscription_days: transactions.some(tx => tx.display_info.is_days),
        has_positive_transactions: transactions.some(tx => tx.display_info.is_positive),
        has_negative_transactions: transactions.some(tx => tx.display_info.is_negative)
      }
    };
  } catch (error) {
    logger.error(`Error getting bonus history for ${userId}:`, error);
    throw error;
  }
};

/**
 * Create a new bonus
 * @param {Object} bonusData - Bonus data
 * @param {Object} [transaction] - Sequelize transaction
 * @returns {Promise<Object>} Created bonus
 */
const createBonus = async (bonusData, transaction) => {
  try {
    // Use provided transaction or create a new one
    const t = transaction || await sequelize.transaction();
    
    try {
      // Create bonus
      const bonus = await BonusTransaction.create({
        user_id: bonusData.user_id,
        amount: bonusData.amount,
        transaction_type: bonusData.transaction_type,
        related_contribution_id: bonusData.related_contribution_id,
        description: bonusData.description,
      }, { transaction: t });
      
      // If we created our own transaction, commit it
      if (!transaction) {
        await t.commit();
      }
      
      logger.info(`Bonus created for user ${bonusData.user_id}, type: ${bonusData.transaction_type}, amount: ${bonusData.amount}`);
      return bonus;
    } catch (error) {
      // Only rollback if we created our own transaction
      if (!transaction) {
        await t.rollback();
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error creating bonus:', error);
    throw error;
  }
};

/**
 * Get all active bonuses for a user
 * @param {UUID} userId - User ID
 * @returns {Promise<Array>} Array of active bonuses
 */
const getUserActiveBonuses = async (userId) => {
  try {
    return await BonusTransaction.findAll({
      where: {
        user_id: userId,
        transaction_type: 'validation_bonus',
      },
      order: [['created_at', 'DESC']],
    });
  } catch (error) {
    logger.error(`Error getting active bonuses for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Get all bonuses for a user with pagination
 * @param {UUID} userId - User ID
 * @param {Object} options - Filter and pagination options
 * @returns {Promise<Object>} Paginated bonuses
 */
const getUserBonuses = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 10, includeUsed = true } = options;
    const offset = (page - 1) * limit;
    
    const where = { user_id: userId };
    
    // Filter by used status if requested
    if (!includeUsed) {
      where.transaction_type = 'validation_bonus';
    }
    
    const { count, rows } = await BonusTransaction.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    
    return {
      bonuses: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
  } catch (error) {
    logger.error(`Error getting bonuses for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Clean up old used bonuses (used and older than 90 days)
 * @param {boolean} [dryRun=false] - If true, only count records but don't delete
 * @returns {Promise<Object>} Count of bonuses deleted
 */
const cleanupOldBonuses = async (dryRun = false) => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // Find all used bonuses that were used more than 90 days ago
    const oldBonuses = await BonusTransaction.findAll({
      where: {
        is_used: true,
        used_at: {
          [sequelize.Op.lt]: ninetyDaysAgo,
        },
      },
    });
    
    if (oldBonuses.length === 0) {
      logger.info('No old bonuses to clean up');
      return { deleted: 0, dryRun };
    }
    
    if (dryRun) {
      logger.info(`Dry run: Would delete ${oldBonuses.length} old bonuses`);
      return { deleted: oldBonuses.length, dryRun };
    }
    
    // Delete old bonuses
    await BonusTransaction.destroy({
      where: {
        is_used: true,
        used_at: {
          [sequelize.Op.lt]: ninetyDaysAgo,
        },
      },
    });
    
    logger.info(`${oldBonuses.length} old bonuses deleted`);
    return { deleted: oldBonuses.length, dryRun };
  } catch (error) {
    logger.error('Error cleaning up old bonuses:', error);
    throw error;
  }
};

/**
 * Apply a bonus to a user's subscription
 * @param {UUID} bonusId - Bonus ID
 * @param {UUID} [subscriptionId] - Optional subscription ID (uses most recent active if not provided)
 * @returns {Promise<Object>} Updated subscription and bonus
 */
const applyBonusToSubscription = async (bonusId, subscriptionId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Get the bonus
    const bonus = await BonusTransaction.findByPk(bonusId, { transaction });
    
    if (!bonus) {
      await transaction.rollback();
      throw new Error(`Bonus not found: ${bonusId}`);
    }
    
    if (bonus.is_used) {
      await transaction.rollback();
      throw new Error(`Bonus ${bonusId} has already been used`);
    }
    
    // Get user
    const user = await User.findByPk(bonus.user_id, { transaction });
    
    if (!user) {
      await transaction.rollback();
      throw new Error(`User not found: ${bonus.user_id}`);
    }
    
    // Get the subscription to extend
    let subscription;
    
    if (subscriptionId) {
      // If specific subscription ID provided, use that
      subscription = await SubscriptionTransaction.findOne({
        where: {
          id: subscriptionId,
          user_id: user.id,
          is_active: true,
          status: 'completed',
        },
        transaction,
      });
      
      if (!subscription) {
        await transaction.rollback();
        throw new Error(`Active subscription not found: ${subscriptionId}`);
      }
    } else {
      // Otherwise, get the user's most recent active subscription
      subscription = await SubscriptionTransaction.findOne({
        where: {
          user_id: user.id,
          is_active: true,
          status: 'completed',
        },
        order: [['expires_at', 'DESC']],
        transaction,
      });
      
      // If no active subscription, create a new bonus subscription
      if (!subscription) {
        const now = new Date();
        const endsAt = new Date(now);
        endsAt.setDate(endsAt.getDate() + bonus.amount);
        
        subscription = await SubscriptionTransaction.create({
          user_id: user.id,
          amount: bonus.amount,
          subscription_type: 'bonus',
          payment_method: 'bonus',
          status: 'completed',
          completed_at: now,
          expires_at: endsAt,
          is_active: true,
        }, { transaction });
      } else {
        // Extend existing subscription
        await subscriptionService.extendSubscription(subscription.id, bonus.amount, transaction);
      }
    }
    
    // Mark bonus as used
    await bonus.update({
      is_used: true,
      used_at: new Date(),
      applied_subscription_id: subscription.id,
    }, { transaction });
    
    // Update user subscription info
    await User.update({
      has_active_subscription: true,
      current_subscription_end: subscription.expires_at,
    }, { 
      where: { id: user.id },
      transaction 
    });
    
    await transaction.commit();
    
    logger.info(`Bonus ${bonusId} applied to subscription ${subscription.id}, extending by ${bonus.amount} days`);
    
    return {
      bonus: await BonusTransaction.findByPk(bonusId),
      subscription: await SubscriptionTransaction.findByPk(subscription.id),
    };
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error applying bonus ${bonusId} to subscription:`, error);
    throw error;
  }
};

module.exports = {
  processUnprocessedBonuses,
  recalculateUserThresholds,
  applyWelcomeBonus,
  checkEligibleUsersForBonus,
  cleanupOldBonusRecords,
  getUserBonusStatus,
  getBonusHistory,
  processContributionReward,
  autoConvertBonusToSubscription,
  batchAutoConvertBonusPoints,
  createBonus,
  getUserActiveBonuses,
  getUserBonuses,
  cleanupOldBonuses,
  applyBonusToSubscription,
}; 