const { User, BonusTransaction, SubscriptionTransaction, Contribution, sequelize } = require('../models');
const logger = require('../utils/logger');

// Get user bonus transactions
const getUserBonusTransactions = async (req, res) => {
  try {
    const { id: userId } = req.user;
    
    const rows = await BonusTransaction.findAll({
      where: {
        user_id: userId,
      },
      order: [['created_at', 'DESC']],
      limit: 50,
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
    const bonusTransactions = rows.map(tx => {
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
      
      return {
        ...transaction,
        type_description: typeDescription,
        is_positive: transaction.amount > 0,
        // Extract key values for easier display in UI
        display_info: {
          date: new Date(transaction.created_at).toISOString().split('T')[0],
          datetime: new Date(transaction.created_at).toISOString().replace('T', ' ').substring(0, 19),
          points: Math.abs(transaction.amount),
          is_points: !['contribution_reward', 'welcome'].includes(transaction.transaction_type),
          is_days: ['contribution_reward', 'welcome'].includes(transaction.transaction_type),
          days: ['contribution_reward', 'welcome'].includes(transaction.transaction_type) ? 
            Math.abs(transaction.amount) : 0,
          type: typeDescription
        }
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        bonus_points: req.user.bonus_points,
        transactions: bonusTransactions,
        has_free_subscription_bonuses: bonusTransactions.some(tx => 
          ['contribution_reward', 'welcome'].includes(tx.transaction_type) && tx.amount > 0
        )
      },
    });
  } catch (error) {
    logger.error('Get user bonus transactions error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching bonus transactions',
    });
  }
};

// Get user subscription info
const getUserSubscription = async (req, res) => {
  try {
    const { id: userId } = req.user;
    
    const rows = await SubscriptionTransaction.findAll({
      where: {
        user_id: userId,
      },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    // Check if user has an active subscription
    const hasActiveSubscription = 
      req.user.subscription_type !== 'none' && 
      req.user.subscription_end && 
      new Date() < new Date(req.user.subscription_end);

    // Calculate days remaining if subscription active
    let daysRemaining = 0;
    if (hasActiveSubscription) {
      const today = new Date();
      const end = new Date(req.user.subscription_end);
      daysRemaining = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    }

    // Format subscription transactions for easier display
    const subscriptionTransactions = rows.map(tx => {
      const transaction = tx.toJSON();
      
      // Calculate duration in days
      let durationDays;
      switch (transaction.subscription_type) {
        case 'daily':
          durationDays = 1;
          break;
        case 'weekly':
          durationDays = 7;
          break;
        case 'monthly':
          durationDays = 30;
          break;
        default:
          durationDays = 0;
      }

      // Determine if transaction is expired
      const isExpired = transaction.status === 'pending' && 
        new Date() > new Date(transaction.expires_at);
      
      // Get status with expiry consideration
      let displayStatus = transaction.status;
      if (isExpired && displayStatus === 'pending') {
        displayStatus = 'expired';
      }
      
      return {
        ...transaction,
        // Add formatted dates
        formatted_dates: {
          created_at: {
            date: new Date(transaction.created_at).toISOString().split('T')[0],
            datetime: new Date(transaction.created_at).toISOString().replace('T', ' ').substring(0, 19)
          },
          completed_at: transaction.completed_at ? {
            date: new Date(transaction.completed_at).toISOString().split('T')[0],
            datetime: new Date(transaction.completed_at).toISOString().replace('T', ' ').substring(0, 19)
          } : null,
          expires_at: {
            date: new Date(transaction.expires_at).toISOString().split('T')[0],
            datetime: new Date(transaction.expires_at).toISOString().replace('T', ' ').substring(0, 19)
          }
        },
        // Add display info
        display_info: {
          subscription_type_name: transaction.subscription_type.charAt(0).toUpperCase() + transaction.subscription_type.slice(1),
          duration_days: durationDays,
          amount_formatted: `${transaction.amount} AOA`,
          payment_method_name: transaction.payment_method === 'bonus' ? 'Bonus Points' : 'ProxyPay',
          status: displayStatus,
          is_completed: transaction.status === 'completed',
          is_pending: transaction.status === 'pending' && !isExpired,
          is_failed: transaction.status === 'failed',
          is_expired: isExpired
        }
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        subscription: {
          type: req.user.subscription_type,
          start_date: req.user.subscription_start ? new Date(req.user.subscription_start).toISOString() : null,
          end_date: req.user.subscription_end ? new Date(req.user.subscription_end).toISOString() : null,
          is_active: hasActiveSubscription,
          days_remaining: daysRemaining,
          type_name: req.user.subscription_type !== 'none' 
            ? req.user.subscription_type.charAt(0).toUpperCase() + req.user.subscription_type.slice(1) 
            : 'None'
        },
        transactions: subscriptionTransactions,
        subscription_options: {
          daily: parseInt(process.env.SUBSCRIPTION_DAILY_PRICE, 10),
          weekly: parseInt(process.env.SUBSCRIPTION_WEEKLY_PRICE, 10),
          monthly: parseInt(process.env.SUBSCRIPTION_MONTHLY_PRICE, 10),
        },
        has_pending_transactions: subscriptionTransactions.some(tx => 
          tx.display_info.is_pending
        ),
        has_completed_transactions: subscriptionTransactions.some(tx => 
          tx.display_info.is_completed
        )
      },
    });
  } catch (error) {
    logger.error('Get user subscription error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching subscription information',
    });
  }
};

module.exports = {
  getUserBonusTransactions,
  getUserSubscription,
}; 