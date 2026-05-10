const crypto = require('crypto');
const { SubscriptionTransaction, User, sequelize } = require('../models');
const logger = require('../utils/logger');
const config = require('../config/config');

// ProxyPay webhook handler
const proxyPayWebhook = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Validate webhook signature according to ProxyPay docs:
    // signature == HexEncode(HMAC-SHA-256(API_KEY, raw HTTP body)) compared with X-Signature header
    const headerSignature = req.headers['x-signature'];
    if (!headerSignature) {
      await transaction.rollback();
      return res.status(400).json({ status: 'error', message: 'Missing X-Signature header' });
    }
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto
      .createHmac('sha256', config.proxyPay.apiKey || '')
      .update(raw)
      .digest('hex');
    // constant-time comparison
    const ok = (() => {
      try {
        return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(String(headerSignature), 'utf8'));
      } catch (_) {
        return expected === headerSignature;
      }
    })();
    if (!ok) {
      await transaction.rollback();
      logger.warn('ProxyPay webhook signature mismatch');
      return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }
    
    // Get payment data (support both doc-aligned and legacy fields)
    const paymentData = req.body;
    
    // Expected data structure from ProxyPay:
    // {
    //   reference: 'SUB-1234567890-abcdef12',
    //   entity: '12345',
    //   amount: 500,
    //   payment_datetime: '2023-01-01T12:00:00Z',
    //   transaction_id: 'pp-tx-123456789'
    // }
    
    // Map incoming fields
    const reference = paymentData.reference || (paymentData.reference_id != null ? String(paymentData.reference_id) : undefined);
    const entity = paymentData.entity || (paymentData.entity_id != null ? String(paymentData.entity_id) : undefined);
    const amountValue = paymentData.amount != null ? parseFloat(String(paymentData.amount)) : undefined;
    const paidAt = paymentData.payment_datetime || paymentData.datetime || new Date().toISOString();

    // Find the subscription transaction: prefer reference; fallback to entity+amount pending
    let subscriptionTx = null;
    if (reference) {
      subscriptionTx = await SubscriptionTransaction.findOne({
        where: { reference, status: 'pending' },
        include: [{ model: User, as: 'user' }],
      });
    }
    if (!subscriptionTx && entity && amountValue != null) {
      subscriptionTx = await SubscriptionTransaction.findOne({
        where: { entity, amount: amountValue, status: 'pending' },
        include: [{ model: User, as: 'user' }],
      });
    }
    
    if (!subscriptionTx) {
      await transaction.rollback();
      logger.error('ProxyPay webhook: Subscription transaction not found', { paymentData });
      return res.status(404).json({
        status: 'error',
        message: 'Subscription transaction not found',
      });
    }
    
    // Calculate subscription duration
    let days;
    switch (subscriptionTx.subscription_type) {
      case 'daily':
        days = 1;
        break;
      case 'weekly':
        days = 7;
        break;
      case 'monthly':
        days = 30;
        break;
      default:
        days = 0;
    }
    
    if (days === 0) {
      await transaction.rollback();
      logger.error('ProxyPay webhook: Invalid subscription type', { subscriptionTx });
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription type',
      });
    }
    
    // Calculate start and end dates
    const startDate = new Date(paidAt);
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    // Check if user already has an active subscription and extend it
    if (subscriptionTx.user.subscription_type !== 'none' && 
        subscriptionTx.user.subscription_end && 
        new Date(subscriptionTx.user.subscription_end) > new Date()) {
      // Extend existing subscription
      endDate = new Date(subscriptionTx.user.subscription_end);
      endDate.setDate(endDate.getDate() + days);
      logger.info(`Extending existing subscription for user ${subscriptionTx.user_id} by ${days} days`);
    }
    
    // Update subscription transaction
    await subscriptionTx.update(
      {
        status: 'completed',
        completed_at: new Date(),
      },
      { transaction }
    );
    
    // Update user subscription
    await subscriptionTx.user.update(
      {
        subscription_type: subscriptionTx.subscription_type,
        subscription_start: startDate,
        subscription_end: endDate,
      },
      { transaction }
    );
    
    await transaction.commit();
    
    // Log the successful payment
    logger.info('ProxyPay webhook: Payment processed successfully', {
      user_id: subscriptionTx.user_id,
      subscription_type: subscriptionTx.subscription_type,
      amount: subscriptionTx.amount,
      reference: subscriptionTx.reference,
    });
    
    return res.status(204).send();
  } catch (error) {
    await transaction.rollback();
    logger.error('ProxyPay webhook error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error processing payment webhook',
    });
  }
};

module.exports = {
  proxyPayWebhook,
}; 