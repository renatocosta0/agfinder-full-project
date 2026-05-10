const Joi = require('joi');

// POST /api/users/location
const recordUserLocationSchema = {
  body: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).optional(),
    source: Joi.string().max(50).optional(),
    recordedAt: Joi.date().iso().optional(),
  }),
};

// GET /api/users/location/history
const getUserLocationHistorySchema = {
  query: Joi.object({
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(500).default(50),
  }),
};

// PUT /api/users/me
const updateMeSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().max(255).optional(),
  }).min(1),
};

module.exports = {
  recordUserLocationSchema,
  getUserLocationHistorySchema,
  updateMeSchema,
};
