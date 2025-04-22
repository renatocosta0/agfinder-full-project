const PaymentAdapterFactory = require('./payment/payment-adapter-factory');
const logger = require('../utils/logger');
const db = require('../models');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

/**
 * Create a new payment
 * @param {Object} paymentData - Payment data
 * @returns {Object} Payment object
 */
const createPayment = async (paymentData) => {
  try {
    const adapter = PaymentAdapterFactory.getAdapter();
    
    // Create payment through the adapter
    const adapterResult = await adapter.createPayment({
      userId: paymentData.userId,
      subscriptionType: paymentData.type || 'standard',
      amount: paymentData.amount,
      currency: paymentData.currency || process.env.PAYMENT_DEFAULT_CURRENCY || 'NGN'
    });
    
    // Store payment in database
    const payment = await db.Payment.create({
      userId: paymentData.userId,
      reference: adapterResult.reference,
      amount: adapterResult.amount,
      currency: adapterResult.currency,
      paymentUrl: adapterResult.paymentUrl,
      status: 'pending',
      provider: adapter.getProviderName(),
      type: paymentData.type || 'standard',
      description: paymentData.description,
      method: paymentData.method,
      metadata: paymentData.metadata || {},
    });
    
    logger.info(`Payment created: ${payment.reference}`);
    return payment;
  } catch (error) {
    logger.error(`Error creating payment: ${error.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create payment');
  }
};

/**
 * Verify a payment status
 * @param {string} reference - Payment reference
 * @returns {Object} Updated payment object
 */
const verifyPayment = async (reference) => {
  try {
    // Get payment from database
    const payment = await db.Payment.findOne({ where: { reference } });
    if (!payment) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
    }
    
    const adapter = PaymentAdapterFactory.getAdapter();
    
    // Verify payment through the adapter
    const verificationResult = await adapter.verifyPayment(reference);
    
    // Update payment status in database
    payment.status = verificationResult.status;
    payment.verifiedAt = verificationResult.status === 'completed' ? new Date() : null;
    await payment.save();
    
    logger.info(`Payment verified: ${reference}, status: ${payment.status}`);
    return payment;
  } catch (error) {
    logger.error(`Error verifying payment: ${error.message}`);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to verify payment');
  }
};

/**
 * Get payment by reference
 * @param {string} reference - Payment reference
 * @returns {Object} Payment object
 */
const getPaymentByReference = async (reference) => {
  const payment = await db.Payment.findOne({ where: { reference } });
  if (!payment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  }
  return payment;
};

/**
 * Get payments by user ID
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Payments and pagination info
 */
const getPaymentsByUser = async (userId, options = {}) => {
  const page = options.page || parseInt(process.env.PAYMENT_DEFAULT_PAGE, 10) || 1;
  const limit = options.limit || parseInt(process.env.PAYMENT_DEFAULT_LIMIT, 10) || 10;
  const skip = (page - 1) * limit;
  
  const query = { userId };
  if (options.status) query.status = options.status;
  
  const [payments, total] = await Promise.all([
    db.Payment.findAll({ where: query, order: [['createdAt', 'DESC']], offset: skip, limit }),
    db.Payment.count({ where: query })
  ]);
  
  return {
    results: payments,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    totalResults: total
  };
};

/**
 * Generate a unique payment reference
 * @returns {String}
 */
const generatePaymentReference = () => {
  const timestamp = Date.now().toString();
  const maxRandom = parseInt(process.env.PAYMENT_RANDOM_MAX, 10) || 10000;
  const random = Math.floor(Math.random() * maxRandom).toString().padStart(4, '0');
  return `PAY-${timestamp}-${random}`;
};

/**
 * Query for payments
 * @param {Object} filter - Sequelize filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<Object>} Paginated result
 */
const queryPayments = async (filter, options) => {
  return db.Payment.paginate(filter, options);
};

module.exports = {
  createPayment,
  verifyPayment,
  getPaymentByReference,
  getPaymentsByUser,
  generatePaymentReference,
  queryPayments
}; 