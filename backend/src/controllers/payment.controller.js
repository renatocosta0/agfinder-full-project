const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { paymentService } = require('../services');

const createPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.createPayment({
    ...req.body,
    userId: req.user.id,
  });
  res.status(httpStatus.CREATED).send(payment);
});

const getPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.getPaymentByReference(req.params.reference);
  
  // Ensure users can only access their own payments (except admins)
  if (payment.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(httpStatus.FORBIDDEN).send({ message: 'Access denied' });
  }
  
  res.send(payment);
});

const verifyPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.verifyPayment(req.params.reference);
  
  // Ensure users can only verify their own payments (except admins)
  if (payment.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(httpStatus.FORBIDDEN).send({ message: 'Access denied' });
  }
  
  res.send(payment);
});

const getPaymentsByUser = catchAsync(async (req, res) => {
  // Use the userId from the authenticated user or the one provided in query (for admins)
  const userId = req.user.role === 'admin' && req.query.userId ? req.query.userId : req.user.id;
  
  const filter = { userId };
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  // Pagination options
  const options = {
    sortBy: req.query.sortBy || 'createdAt:desc',
    limit: parseInt(req.query.limit, 10) || parseInt(process.env.PAYMENT_DEFAULT_LIMIT, 10) || 10,
    page: parseInt(req.query.page, 10) || parseInt(process.env.PAYMENT_DEFAULT_PAGE, 10) || 1,
  };
  
  const result = await paymentService.queryPayments(filter, options);
  res.send(result);
});

module.exports = {
  createPayment,
  getPayment,
  verifyPayment,
  getPaymentsByUser,
}; 