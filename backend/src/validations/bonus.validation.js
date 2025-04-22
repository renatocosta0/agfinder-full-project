const Joi = require('joi');
const { objectId } = require('./custom.validation');

/**
 * Validation schemas for bonus-related requests
 */
const getBonusHistory = {
  query: Joi.object().keys({
    userId: Joi.string().custom(objectId),
    status: Joi.string().valid('pending', 'processed', 'failed', 'cancelled'),
    startDate: Joi.date(),
    endDate: Joi.date(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const cleanupRecords = {
  body: Joi.object().keys({
    olderThan: Joi.date().required(),
    status: Joi.string().valid('processed', 'failed', 'cancelled'),
    dryRun: Joi.boolean().default(false),
  }),
};

module.exports = {
  getBonusHistory,
  cleanupRecords,
}; 