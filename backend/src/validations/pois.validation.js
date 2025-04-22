const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getNearbyPOIs = {
  query: Joi.object().keys({
    type: Joi.string().valid('atm', 'gasstation'),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
    radius: Joi.number().default(5),
    orderBy: Joi.string().valid('nearest', 'recent', 'most_interactions').default('nearest'),
    limit: Joi.number().integer().min(1).max(parseInt(process.env.MAX_PAGE_SIZE, 10) || 100).default(parseInt(process.env.DEFAULT_PAGE_SIZE, 10) || 20),
    page: Joi.number().integer().min(1).default(1),
    forceRefresh: Joi.boolean().default(false),
  }),
};

const getPOIById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
  query: Joi.object().keys({
    refresh: Joi.boolean().default(false),
  }),
};

const getPOIContributionHistory = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
  query: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(parseInt(process.env.MAX_PAGE_SIZE, 10) || 100).default(parseInt(process.env.DEFAULT_PAGE_SIZE, 10) || 20),
    page: Joi.number().integer().min(1).default(1),
    sortBy: Joi.string().valid('created_at:desc', 'created_at:asc').default('created_at:desc'),
  }),
};

module.exports = {
  getNearbyPOIs,
  getPOIById,
  getPOIContributionHistory,
}; 