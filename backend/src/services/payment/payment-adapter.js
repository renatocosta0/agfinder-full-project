/**
 * Payment adapter interface to allow switching between payment providers
 */
class PaymentAdapter {
  /**
   * Create a payment order
   * @param {Object} paymentData - Payment data
   * @param {string} paymentData.userId - User ID
   * @param {string} paymentData.subscriptionType - Subscription type
   * @param {number} paymentData.amount - Payment amount
   * @param {string} paymentData.currency - Payment currency
   * @returns {Promise<Object>} Payment order details
   */
  async createPayment(paymentData) {
    throw new Error('Method not implemented');
  }

  /**
   * Verify payment status
   * @param {string} paymentReference - Payment reference
   * @returns {Promise<Object>} Payment status
   */
  async verifyPayment(paymentReference) {
    throw new Error('Method not implemented');
  }

  /**
   * Get payment provider name
   * @returns {string} Name of the payment provider
   */
  getProviderName() {
    throw new Error('Method not implemented');
  }
}

module.exports = PaymentAdapter; 