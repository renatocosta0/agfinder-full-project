const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getSubscriptionPlans = {
  query: Joi.object().keys({
    // Não precisa de parâmetros específicos para esta rota
  }),
};

const createSubscription = {
  body: Joi.object().keys({
    subscription_type: Joi.string().valid('daily', 'weekly', 'monthly').required(),
  }),
};

const checkSubscriptionStatus = {
  params: Joi.object().keys({
    reference: Joi.string().required(),
  }),
};

const getUserTransactions = {
  query: Joi.object().keys({
    status: Joi.string().valid('pending', 'completed', 'failed', 'expired'),
    startDate: Joi.date(),
    endDate: Joi.date(),
    sortBy: Joi.string().valid('created_at:desc', 'created_at:asc', 'amount:desc', 'amount:asc').default('created_at:desc'),
    limit: Joi.number().integer().min(1).max(100).default(20),
    page: Joi.number().integer().min(1).default(1),
  }),
};

const simulatePaymentDev = {
  params: Joi.object().keys({
    reference: Joi.string().required(),
  }),
  body: Joi.object().keys({
    action: Joi.string().valid('complete', 'fail').required(),
  }),
};

module.exports = {
  getSubscriptionPlans,
  createSubscription,
  checkSubscriptionStatus,
  getUserTransactions,
  simulatePaymentDev,
};