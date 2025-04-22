const { v4: uuidv4 } = require('uuid');
const PaymentAdapter = require('./payment-adapter');
const logger = require('../../utils/logger');

// In-memory storage for fake payments
const fakePayments = new Map();

/**
 * Fake payment adapter for testing purposes
 */
class FakePaymentAdapter extends PaymentAdapter {
  /**
   * Create a fake payment order
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Payment order details
   */
  async createPayment(paymentData) {
    const { userId, subscriptionType, amount, currency = 'AOA' } = paymentData;
    
    // Generate fake reference
    const reference = `FAKE-${uuidv4().substring(0, 8).toUpperCase()}`;
    
    // Calculate expiry date (expires in 1 hour)
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);
    
    // Create fake payment order
    const paymentOrder = {
      reference,
      amount,
      currency,
      userId,
      subscriptionType,
      entity: 'FAKE-PAYMENT',
      status: 'pending',
      createdAt: new Date(),
      expiryDate,
      paymentUrl: `/fake-payment/${reference}`,
    };
    
    // Store in memory
    fakePayments.set(reference, paymentOrder);
    
    logger.info(`Created fake payment order: ${reference} for user ${userId}, amount: ${amount} ${currency}`);
    
    return paymentOrder;
  }

  /**
   * Verify fake payment status
   * @param {string} paymentReference - Payment reference
   * @returns {Promise<Object>} Payment status
   */
  async verifyPayment(paymentReference) {
    const payment = fakePayments.get(paymentReference);
    
    if (!payment) {
      throw new Error(`Payment reference not found: ${paymentReference}`);
    }
    
    return {
      reference: paymentReference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      entity: payment.entity,
      userId: payment.userId,
      completedAt: payment.status === 'completed' ? payment.completedAt : null,
    };
  }

  /**
   * Get payment provider name
   * @returns {string} Name of the payment provider
   */
  getProviderName() {
    return 'fake-payment';
  }

  /**
   * Simulate payment completion (for testing)
   * @param {string} reference - Payment reference
   * @returns {Promise<Object>} Updated payment status
   */
  async simulatePaymentCompletion(reference) {
    const payment = fakePayments.get(reference);
    
    if (!payment) {
      throw new Error(`Payment reference not found: ${reference}`);
    }
    
    payment.status = 'completed';
    payment.completedAt = new Date();
    
    logger.info(`Simulated payment completion for: ${reference}`);
    
    return {
      reference,
      status: payment.status,
      amount: payment.amount,
      completedAt: payment.completedAt,
    };
  }

  /**
   * Simulate payment failure (for testing)
   * @param {string} reference - Payment reference
   * @returns {Promise<Object>} Updated payment status
   */
  async simulatePaymentFailure(reference) {
    const payment = fakePayments.get(reference);
    
    if (!payment) {
      throw new Error(`Payment reference not found: ${reference}`);
    }
    
    payment.status = 'failed';
    payment.failedAt = new Date();
    
    logger.info(`Simulated payment failure for: ${reference}`);
    
    return {
      reference,
      status: payment.status,
      amount: payment.amount,
      failedAt: payment.failedAt,
    };
  }

  /**
   * Get all fake payments for admin panel
   * @returns {Array} List of all fake payments
   */
  getAllPayments() {
    return Array.from(fakePayments.values());
  }
}

module.exports = FakePaymentAdapter; 