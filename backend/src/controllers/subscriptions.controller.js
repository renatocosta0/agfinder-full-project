const { Op } = require('sequelize');
const { User, SubscriptionTransaction, sequelize } = require('../models');
const config = require('../config/config');
const logger = require('../utils/logger');
const PaymentAdapterFactory = require('../services/payment/payment-adapter-factory');

// Get subscription plans
const getSubscriptionPlans = async (req, res) => {
  try {
    // Get subscription prices from environment variables
    const subscriptionPlans = {
      daily: {
        type: 'daily',
        name: 'Daily Access',
        price: parseInt(process.env.SUBSCRIPTION_DAILY_PRICE, 10),
        duration_days: 1,
        description: '24-hour access to all features',
      },
      weekly: {
        type: 'weekly',
        name: 'Weekly Access',
        price: parseInt(process.env.SUBSCRIPTION_WEEKLY_PRICE, 10),
        duration_days: 7,
        description: '7-day access to all features (14% savings)',
      },
      monthly: {
        type: 'monthly',
        name: 'Monthly Access',
        price: parseInt(process.env.SUBSCRIPTION_MONTHLY_PRICE, 10),
        duration_days: 30,
        description: '30-day access to all features (20% savings)',
      },
    };
    
    // Check if user has active subscription (aligned with User model)
    let freshUser = await User.findByPk(req.user.id);
    let effectiveEnd = freshUser.current_subscription_end ? new Date(freshUser.current_subscription_end) : null;
    let hasActiveSubscription = (freshUser.has_active_subscription === true) || (effectiveEnd && new Date() < effectiveEnd);

    // If not marked active, infer from latest completed transaction and fix user record
    if (!hasActiveSubscription) {
      const lastCompleted = await SubscriptionTransaction.findOne({
        where: { user_id: req.user.id, status: 'completed' },
        order: [['completed_at', 'DESC']],
      });
      if (lastCompleted) {
        let days = 0;
        switch (lastCompleted.subscription_type) {
          case 'daily': days = 1; break;
          case 'weekly': days = 7; break;
          case 'monthly': days = 30; break;
          default: days = 0;
        }
        if (days > 0 && lastCompleted.completed_at) {
          effectiveEnd = new Date(lastCompleted.completed_at);
          effectiveEnd.setDate(effectiveEnd.getDate() + days);
          if (effectiveEnd > new Date()) {
            hasActiveSubscription = true;
            try {
              await freshUser.update({ has_active_subscription: true, current_subscription_end: effectiveEnd });
              // refetch to ensure instance fields are current
              freshUser = await User.findByPk(req.user.id);
            } catch {}
          }
        }
      }
    }
    
    // Get daily subscription price for bonus conversion calculation
    const dailyPrice = parseInt(process.env.SUBSCRIPTION_DAILY_PRICE, 10) || 5;
    const bonusNeededForDaily = dailyPrice * 10; // 10 bonus points = 1 AOA
    
    // Calculate days user can get from their current bonus points
    const potentialDays = Math.floor((freshUser.bonus_points || 0) / bonusNeededForDaily);
    
    return res.status(200).json({
      status: 'success',
      data: {
        plans: Object.values(subscriptionPlans),
        has_active_subscription: hasActiveSubscription,
        current_subscription: hasActiveSubscription ? {
          type: null,
          end_date: freshUser.current_subscription_end || (effectiveEnd ? effectiveEnd.toISOString() : null),
        } : null,
        bonus_info: {
          bonus_points: freshUser.bonus_points || 0,
          exchange_rate: 10, // 10 points = 1 AOA
          info_message: potentialDays > 0 ? 
            `Your bonus points will be automatically converted to ${potentialDays} subscription day(s)` : 
            'Earn more bonus points through contributions to get free subscription days'
        }
      },
    });
  } catch (error) {
    logger.error('Get subscription plans error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching subscription plans',
    });
  }
};

// Create subscription via payment adapter (proxypay or fake-payment)
const createSubscription = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { subscription_type } = req.body;
    const { id: userId } = req.user;
    
    // Validate subscription type
    if (!['daily', 'weekly', 'monthly'].includes(subscription_type)) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription type',
      });
    }
    
    // Get subscription price
    const subscriptionPrices = {
      daily: parseInt(process.env.SUBSCRIPTION_DAILY_PRICE, 10),
      weekly: parseInt(process.env.SUBSCRIPTION_WEEKLY_PRICE, 10),
      monthly: parseInt(process.env.SUBSCRIPTION_MONTHLY_PRICE, 10),
    };
    
    const amount = subscriptionPrices[subscription_type];
    const adapter = PaymentAdapterFactory.getAdapter();
    const paymentOrder = await adapter.createPayment({
      userId,
      subscriptionType: subscription_type,
      amount,
      currency: config.payment.defaultCurrency || 'AOA',
    });
    
    // Calculate subscription duration for metadata (used after payment confirmation)
    let days;
    switch (subscription_type) {
      case 'daily':
        days = 1;
        break;
      case 'weekly':
        days = 7;
        break;
      case 'monthly':
        days = 30;
        break;
    }
    
    // Normalize payment method to match DB enum (proxypay|bonus). Treat fake-payment as proxypay for DEV.
    const paymentMethod = adapter.getProviderName() === 'fake-payment' ? 'proxypay' : adapter.getProviderName();

    // Create a pending subscription transaction
    const subscriptionTx = await SubscriptionTransaction.create(
      {
        user_id: userId,
        amount,
        subscription_type,
        payment_method: paymentMethod,
        entity: paymentOrder.entity,
        reference: paymentOrder.reference,
        status: 'pending',
        expires_at: paymentOrder.expiryDate,
      },
      { transaction }
    );
    
    
    await transaction.commit();
    
    return res.status(201).json({
      status: 'success',
      message: 'Subscription payment initiated',
      data: {
        subscription_transaction: {
          id: subscriptionTx.id,
          amount,
          subscription_type,
          entity: paymentOrder.entity,
          reference: paymentOrder.reference,
          expires_at: paymentOrder.expiryDate,
        },
        payment_instructions: {
          entity: paymentOrder.entity,
          reference: paymentOrder.reference,
          amount,
          expires_at: paymentOrder.expiryDate,
          steps: [
            'Go to your bank app or internet banking',
            'Select "Payments" or "Transfers"',
            'Choose "Payment by reference"',
            `Enter the entity: ${paymentOrder.entity}`,
            `Enter the reference: ${paymentOrder.reference}`,
            `Enter the amount: ${amount} AOA`,
            'Confirm the payment',
            'Wait for confirmation (it may take a few minutes)',
          ],
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Create subscription error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error creating subscription',
    });
  }
};

// Check subscription payment status
const checkSubscriptionStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    
    const subscriptionTx = await SubscriptionTransaction.findOne({
      where: {
        reference,
        user_id: req.user.id,
      },
    });
    
    if (!subscriptionTx) {
      return res.status(404).json({
        status: 'error',
        message: 'Subscription transaction not found',
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        subscription_transaction: {
          id: subscriptionTx.id,
          amount: subscriptionTx.amount,
          subscription_type: subscriptionTx.subscription_type,
          status: subscriptionTx.status,
          created_at: subscriptionTx.created_at,
          completed_at: subscriptionTx.completed_at,
          expires_at: subscriptionTx.expires_at,
        },
      },
    });
  } catch (error) {
    logger.error('Check subscription status error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error checking subscription status',
    });
  }
};

// Get user subscription transactions with pagination
const getUserTransactions = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { 
      page = 1, 
      limit = 20, 
      status, 
      startDate, 
      endDate, 
      sortBy = 'created_at:desc' 
    } = req.query;
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = { user_id: userId };
    
    // Normalize status filter; handle 'expired' specially
    if (status) {
      if (status === 'expired') {
        // expired = pending and past expiry
        where.status = 'pending';
        where.expires_at = { [Op.lt]: new Date() };
      } else if (status === 'pending') {
        // pending should exclude expired ones
        where.status = 'pending';
        where.expires_at = { [Op.gte]: new Date() };
      } else {
        where.status = status;
      }
    }
    
    if (startDate) {
      where.created_at = {
        ...(where.created_at || {}),
        [Op.gte]: new Date(startDate)
      };
    }
    
    if (endDate) {
      where.created_at = {
        ...(where.created_at || {}),
        [Op.lte]: new Date(endDate)
      };
    }
    
    // Parse sort options
    const [sortField, sortDirection] = sortBy.split(':');
    const order = [[sortField, sortDirection.toUpperCase()]];
    
    // Get transactions with pagination
    const { count, rows } = await SubscriptionTransaction.findAndCountAll({
      where,
      order,
      limit: parseInt(limit, 10),
      offset,
    });
    
    // Check if user has an active subscription (aligned with model fields)
    const end = req.user.current_subscription_end ? new Date(req.user.current_subscription_end) : null;
    const hasActiveSubscription = (req.user.has_active_subscription === true) || (end && new Date() < end);

    // Calculate days remaining if subscription active
    let daysRemaining = 0;
    if (hasActiveSubscription && end) {
      const today = new Date();
      daysRemaining = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (isNaN(daysRemaining) || daysRemaining < 0) daysRemaining = 0;
    }

    // Format subscription transactions for easier display
    const subscriptionTransactions = rows.map(tx => {
      const transaction = tx.toJSON();
      
      // Calculate duration in days
      const subType = transaction.subscription_type || 'unknown';
      let durationDays;
      switch (subType) {
        case 'daily':
          durationDays = 1;
          break;
        case 'weekly':
          durationDays = 7;
          break;
        case 'monthly':
          durationDays = 30;
          break;
        case 'bonus':
          durationDays = 0;
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
          subscription_type_name: String(subType).charAt(0).toUpperCase() + String(subType).slice(1),
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
        transactions: subscriptionTransactions,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(count / limit)
        },
        summary: {
          subscription: {
            type: hasActiveSubscription ? 'active' : 'none',
            is_active: hasActiveSubscription,
            days_remaining: daysRemaining,
            type_name: hasActiveSubscription ? 'Active' : 'None'
          },
          has_pending_transactions: subscriptionTransactions.some(tx => 
            tx.display_info.is_pending
          ),
          has_completed_transactions: subscriptionTransactions.some(tx => 
            tx.display_info.is_completed
          )
        }
      },
    });
  } catch (error) {
    logger.error('Get user subscription transactions error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching subscription transactions',
    });
  }
};

// DEV ONLY: simulate completing or failing a pending payment
const simulatePaymentDev = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ status: 'error', message: 'Not allowed in production' });
  }

  const { reference } = req.params;
  const { action } = req.body || {};

  if (!reference || !['complete', 'fail'].includes(action)) {
    return res.status(400).json({ status: 'error', message: 'Invalid reference or action' });
  }

  const t = await sequelize.transaction();
  try {
    const tx = await SubscriptionTransaction.findOne({
      where: { reference, user_id: req.user.id, status: 'pending' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!tx) {
      await t.rollback();
      return res.status(404).json({ status: 'error', message: 'Subscription transaction not found or not pending' });
    }

    if (action === 'fail') {
      await tx.update({ status: 'failed' }, { transaction: t });
      await t.commit();
      return res.status(200).json({ status: 'success', message: 'Transaction marked as failed' });
    }

    // complete
    let days = 0;
    switch (tx.subscription_type) {
      case 'daily': days = 1; break;
      case 'weekly': days = 7; break;
      case 'monthly': days = 30; break;
      default: days = 0;
    }
    if (days === 0) {
      await t.rollback();
      return res.status(400).json({ status: 'error', message: 'Invalid subscription type' });
    }

    const now = new Date();
    let endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);

    const user = await User.findByPk(req.user.id, { transaction: t, lock: t.LOCK.UPDATE });
    const hasActive = !!user.current_subscription_end && new Date(user.current_subscription_end) > now;
    if (hasActive) {
      endDate = new Date(user.current_subscription_end);
      endDate.setDate(endDate.getDate() + days);
    }

    await tx.update({ status: 'completed', completed_at: now }, { transaction: t });
    await user.update({
      has_active_subscription: true,
      current_subscription_end: endDate,
    }, { transaction: t });

    await t.commit();
    return res.status(200).json({ status: 'success', message: 'Transaction marked as completed' });
  } catch (err) {
    await t.rollback();
    logger.error('simulatePaymentDev error:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to simulate payment' });
  }
};

module.exports = {
  getSubscriptionPlans,
  createSubscription,
  checkSubscriptionStatus,
  getUserTransactions,
  simulatePaymentDev,
};