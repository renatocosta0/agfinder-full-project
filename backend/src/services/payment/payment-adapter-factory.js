const config = require('../../config/config');
const FakePaymentAdapter = require('./fake-payment-adapter');
const ProxyPayAdapter = require('./proxypay-adapter');
const logger = require('../../utils/logger');

/**
 * Factory for creating payment adapters
 */
class PaymentAdapterFactory {
  /**
   * Get the configured payment adapter
   * @returns {object} The appropriate payment adapter instance
   */
  static getAdapter() {
    const provider = config.payment.provider;
    logger.info(`Initializing payment adapter for provider: ${provider}`);

    switch (provider) {
      case 'fake-payment':
        return new FakePaymentAdapter();
      case 'proxypay':
        return new ProxyPayAdapter();
      default:
        logger.error(`Unknown payment provider: ${provider}`);
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  }
}

module.exports = PaymentAdapterFactory; 