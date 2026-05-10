const Joi = require('joi');

// GET /api/pois/updates
const getPoiUpdatesSchema = {
  query: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().positive().max(500).default(10),
    type: Joi.string().valid('atm', 'gasstation').optional(),
    since: Joi.date().iso().optional(),
  }),
};

module.exports = {
  getPoiUpdatesSchema,
};
