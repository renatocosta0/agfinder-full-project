const Joi = require('joi');

const proxyPayWebhookSchema = {
  body: Joi.object({
    // ProxyPay v2 fields
    transaction_id: Joi.alternatives(Joi.string(), Joi.number()).required(),
    entity_id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
    reference_id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
    amount: Joi.alternatives(Joi.string(), Joi.number()).required(),
    datetime: Joi.date().iso().optional(),
    custom_fields: Joi.object().unknown(true).optional(),
    // Legacy/our mapping compatibility
    reference: Joi.string().optional(),
    entity: Joi.string().optional(),
    payment_datetime: Joi.date().iso().optional(),
  }).unknown(true),
};

module.exports = {
  proxyPayWebhookSchema,
};
