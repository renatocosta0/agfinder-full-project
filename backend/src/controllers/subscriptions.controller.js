const axios = require('axios');
const { User, SubscriptionTransaction, sequelize } = require('../models');
const logger = require('../utils/logger');

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
    
    // Check if user has active subscription
    const { user } = req;
    const hasActiveSubscription = 
      user.subscription_type !== 'none' && 
      user.subscription_end && 
      new Date() < new Date(user.subscription_end);
    
    // Get daily subscription price for bonus conversion calculation
    const dailyPrice = parseInt(process.env.SUBSCRIPTION_DAILY_PRICE, 10) || 5;
    const bonusNeededForDaily = dailyPrice * 10; // 10 bonus points = 1 AOA
    
    // Calculate days user can get from their current bonus points
    const potentialDays = Math.floor(user.bonus_points / bonusNeededForDaily);
    
    return res.status(200).json({
      status: 'success',
      data: {
        plans: Object.values(subscriptionPlans),
        has_active_subscription: hasActiveSubscription,
        current_subscription: hasActiveSubscription ? {
          type: user.subscription_type,
          end_date: user.subscription_end,
        } : null,
        bonus_info: {
          bonus_points: user.bonus_points,
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

// Create subscription via ProxyPay
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
    
    // Calculate expiry date for the payment reference (24 hours)
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24);
    
    // Generate a unique reference (you may want to implement a more robust solution)
    const reference = `SUB-${Date.now()}-${userId.substring(0, 8)}`;
    
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
    
    // Create a pending subscription transaction
    const subscriptionTx = await SubscriptionTransaction.create(
      {
        user_id: userId,
        amount,
        subscription_type,
        payment_method: 'proxypay',
        entity: process.env.PROXYPAY_ENTITY,
        reference,
        status: 'pending',
        expires_at: expiryDate,
      },
      { transaction }
    );
    
    // Call ProxyPay API to create a payment reference
    // Note: this is a simplified example. You would need to implement the actual API call.
    const proxyPayResponse = {
      entity: process.env.PROXYPAY_ENTITY,
      reference,
      amount,
      end_datetime: expiryDate.toISOString(),
    };
    
    // In a real implementation, you would make an API call like this:
    /*
    const proxyPayResponse = await axios.post(
      'https://api.proxypay.co.ao/references',
      {
        amount,
        end_datetime: expiryDate.toISOString(),
        reference,
      },
      {
        headers: {
          'Authorization': `Token ${process.env.PROXYPAY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.proxypay.v2+json',
        },
      }
    );
    */
    
    await transaction.commit();
    
    return res.status(201).json({
      status: 'success',
      message: 'Subscription payment initiated',
      data: {
        subscription_transaction: {
          id: subscriptionTx.id,
          amount,
          subscription_type,
          entity: proxyPayResponse.entity,
          reference: proxyPayResponse.reference,
          expires_at: expiryDate,
        },
        payment_instructions: {
          entity: proxyPayResponse.entity,
          reference: proxyPayResponse.reference,
          amount,
          expires_at: expiryDate,
          steps: [
            'Go to your bank app or internet banking',
            'Select "Payments" or "Transfers"',
            'Choose "Payment by reference"',
            `Enter the entity: ${proxyPayResponse.entity}`,
            `Enter the reference: ${proxyPayResponse.reference}`,
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
        transactions: subscriptionTransactions,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(count / limit)
        },
        summary: {
          subscription: {
            type: req.user.subscription_type,
            is_active: hasActiveSubscription,
            days_remaining: daysRemaining,
            type_name: req.user.subscription_type !== 'none' 
              ? req.user.subscription_type.charAt(0).toUpperCase() + req.user.subscription_type.slice(1) 
              : 'None'
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

module.exports = {
  getSubscriptionPlans,
  createSubscription,
  checkSubscriptionStatus,
  getUserTransactions,
}; 