const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getNearbyPOIs = {
  query: Joi.object().keys({
    type: Joi.string().valid('atm', 'gasstation'),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
    radius: Joi.number().default(5),
    orderBy: Joi.string().valid('nearest', 'recent', 'most_interactions').default('nearest'),
    limit: Joi.number().integer().min(1).max(50).default(20),
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

const saveCachedPOIs = {
  body: Joi.object().keys({
    pois: Joi.array().items(
      Joi.object().keys({
        poi_type: Joi.string().valid('atm', 'gasstation').required(),
        google_place_id: Joi.string().required(),
        name: Joi.string().required(),
        address: Joi.string().required(),
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
        google_data: Joi.object().optional(),
        created_at: Joi.date().iso().optional(),
        updated_at: Joi.date().iso().optional()
      })
    ).min(1).required(),
  }),
};

// Text search for POIs by name or address
const searchPOIs = {
  query: Joi.object().keys({
    q: Joi.string().min(2).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    include_contributions: Joi.boolean().default(false)
  }),
};

module.exports = {
  getNearbyPOIs,
  getPOIById,
  getPOIContributionHistory,
  saveCachedPOIs,
  searchPOIs,
};