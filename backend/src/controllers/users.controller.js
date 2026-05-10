const { User, BonusTransaction, SubscriptionTransaction, Contribution, sequelize } = require('../models');
const logger = require('../utils/logger');
const locationService = require('../services/location.service');

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
      switch (transaction.transaction_type) {
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

/**
 * Get user location history
 */
const getUserLocationHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const { from, to, page = 1, limit = 50 } = req.query;
    const result = await locationService.getUserLocationHistory(req.user.id, { from, to, page, limit });

    return res.status(200).json({
      status: 'success',
      data: {
        locations: result.locations,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    logger.error('Get user location history error:', error);
    return res.status(500).json({ status: 'error', message: 'Error fetching location history' });
  }
};

/**
 * Record a user location sample
 */
const recordUserLocation = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const { lat, lng, accuracy, source, recordedAt } = req.body || {};
    const entry = await locationService.recordUserLocation(req.user.id, {
      lat: typeof lat === 'string' ? parseFloat(lat) : lat,
      lng: typeof lng === 'string' ? parseFloat(lng) : lng,
      accuracy: typeof accuracy === 'string' ? parseFloat(accuracy) : accuracy,
      source,
      recordedAt,
    });

    return res.status(201).json({ status: 'success', data: entry });
  } catch (error) {
    logger.error('Record user location error:', error);
    return res.status(400).json({ status: 'error', message: error.message || 'Invalid location payload' });
  }
};

const updateMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const { name, email } = req.body || {};
    const user = req.user;

    if (typeof email === 'string' && email.trim()) {
      const nextEmail = email.trim().toLowerCase();
      if (nextEmail !== String(user.email).toLowerCase()) {
        const existing = await User.findOne({ where: { email: nextEmail } });
        if (existing) {
          return res.status(409).json({ status: 'error', message: 'Email já está em uso.' });
        }
      }
      user.email = nextEmail;
    }

    if (typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }

    await user.save();

    return res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_picture: user.profile_picture,
          bonus_points: user.bonus_points,
          subscription_type: user.has_active_subscription ? 'active' : 'none',
          subscription_end: user.current_subscription_end,
          is_banned: user.is_banned,
        },
      },
    });
  } catch (error) {
    logger.error('Update me error:', error);
    return res.status(500).json({ status: 'error', message: 'Erro ao atualizar perfil' });
  }
};

module.exports = {
  getUserBonusTransactions,
  getUserSubscription,
  getUserLocationHistory,
  recordUserLocation,
  updateMe,
};