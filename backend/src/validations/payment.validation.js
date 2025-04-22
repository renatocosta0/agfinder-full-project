const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createPayment = {
  body: Joi.object().keys({
    amount: Joi.number().required(),
    currency: Joi.string().required().valid('USD', 'EUR', 'GBP', 'NGN'),
    description: Joi.string().required(),
    method: Joi.string().required().valid('card', 'bank', 'crypto', 'wallet'),
    metadata: Joi.object()
  }),
};

const getPayment = {
  params: Joi.object().keys({
    reference: Joi.string().required(),
  }),
};

const verifyPayment = {
  params: Joi.object().keys({
    reference: Joi.string().required(),
  }),
};

const getPaymentsByUser = {
  query: Joi.object().keys({
    userId: Joi.string().custom(objectId),
    status: Joi.string().valid('pending', 'successful', 'failed'),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

module.exports = {
  createPayment,
  getPayment,
  verifyPayment,
  getPaymentsByUser,
}; 