const axios = require('axios');
const config = require('../../config/config');
const PaymentAdapter = require('./payment-adapter');
const logger = require('../../utils/logger');

/**
 * ProxyPay payment adapter
 */
class ProxyPayAdapter extends PaymentAdapter {
  constructor() {
    super();
    this.apiKey = config.proxyPay.apiKey;
    this.baseUrl = config.proxyPay.baseUrl;
    this.entity = config.proxyPay.entity;
  }

  /**
   * Create a payment order with ProxyPay
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Payment order details
   */
  async createPayment(paymentData) {
    try {
      const { userId, subscriptionType, amount, currency = 'AOA' } = paymentData;
      
      const response = await axios.post(
        `${this.baseUrl}/payments`,
        {
          amount,
          currency,
          entity: this.entity,
          reference: `${subscriptionType.toUpperCase()}-${userId}-${Date.now()}`,
          expirationTime: config.proxyPay.expirationSeconds,
        },
        {
          headers: {
            'Authorization': `ApiKey ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Created ProxyPay payment: ${response.data.reference} for user ${userId}`);
      
      return {
        reference: response.data.reference,
        amount: response.data.amount,
        currency: response.data.currency,
        userId,
        subscriptionType,
        entity: response.data.entity,
        status: 'pending',
        createdAt: new Date(),
        expiryDate: new Date(response.data.expirationTime * 1000),
        paymentUrl: response.data.paymentUrl || `/proxypay/${response.data.reference}`,
      };
    } catch (error) {
      logger.error('ProxyPay payment creation failed:', error.message);
      throw new Error(`Failed to create ProxyPay payment: ${error.message}`);
    }
  }

  /**
   * Verify payment status with ProxyPay
   * @param {string} paymentReference - Payment reference
   * @returns {Promise<Object>} Payment status
   */
  async verifyPayment(paymentReference) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payments/${paymentReference}`,
        {
          headers: {
            'Authorization': `ApiKey ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Map ProxyPay status to internal status
      const statusMap = {
        'paid': 'completed',
        'pending': 'pending',
        'expired': 'failed',
        'cancelled': 'failed',
      };

      const status = statusMap[response.data.status] || 'pending';
      
      return {
        reference: paymentReference,
        status,
        amount: response.data.amount,
        currency: response.data.currency,
        entity: response.data.entity,
        completedAt: status === 'completed' ? new Date() : null,
      };
    } catch (error) {
      logger.error('ProxyPay payment verification failed:', error.message);
      throw new Error(`Failed to verify ProxyPay payment: ${error.message}`);
    }
  }

  /**
   * Get payment provider name
   * @returns {string} Name of the payment provider
   */
  getProviderName() {
    return 'proxypay';
  }
}

module.exports = ProxyPayAdapter; 