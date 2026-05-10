/**
 * Validation schemas for places API requests
 */

const Joi = require('joi');

// Schema for getting nearby POIs
const getNearbyPOIs = {
  query: Joi.object({
    latitude: Joi.number()
      .required()
      .min(-90)
      .max(90)
      .messages({
        'number.base': 'Latitude deve ser um número',
        'number.min': 'Latitude deve ser maior ou igual a -90',
        'number.max': 'Latitude deve ser menor ou igual a 90',
        'any.required': 'Latitude é obrigatória'
      }),
    longitude: Joi.number()
      .required()
      .min(-180)
      .max(180)
      .messages({
        'number.base': 'Longitude deve ser um número',
        'number.min': 'Longitude deve ser maior ou igual a -180',
        'number.max': 'Longitude deve ser menor ou igual a 180',
        'any.required': 'Longitude é obrigatória'
      }),
    type: Joi.string()
      .required()
      .valid('atm', 'gasstation')
      .messages({
        'string.base': 'Tipo deve ser uma string',
        'any.required': 'Tipo é obrigatório',
        'any.only': 'Tipo deve ser "atm" ou "gasstation"'
      }),
    radius: Joi.number()
      .integer()
      .min(1000)
      .max(50000)
      .default(5000)
      .messages({
        'number.base': 'Raio deve ser um número',
        'number.integer': 'Raio deve ser um número inteiro',
        'number.min': 'Raio deve ser no mínimo 1000 metros',
        'number.max': 'Raio deve ser no máximo 50000 metros'
      }),
    pageToken: Joi.string()
      .optional()
      .messages({
        'string.base': 'Token de paginação deve ser uma string'
      })
  })
};

// Schema for getting place details
const getPlaceDetails = {
  params: Joi.object({
    placeId: Joi.string()
      .required()
      .messages({
        'string.base': 'ID do local deve ser uma string',
        'any.required': 'ID do local é obrigatório'
      })
  })
};

// Schema for getting place updates
const getPlaceUpdates = {
  query: Joi.object({
    latitude: Joi.number()
      .required()
      .min(-90)
      .max(90)
      .messages({
        'number.base': 'Latitude deve ser um número',
        'number.min': 'Latitude deve ser maior ou igual a -90',
        'number.max': 'Latitude deve ser menor ou igual a 90',
        'any.required': 'Latitude é obrigatória'
      }),
    longitude: Joi.number()
      .required()
      .min(-180)
      .max(180)
      .messages({
        'number.base': 'Longitude deve ser um número',
        'number.min': 'Longitude deve ser maior ou igual a -180',
        'number.max': 'Longitude deve ser menor ou igual a 180',
        'any.required': 'Longitude é obrigatória'
      }),
    radius: Joi.number()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.base': 'Raio deve ser um número',
        'number.min': 'Raio deve ser no mínimo 1 km',
        'number.max': 'Raio deve ser no máximo 100 km'
      }),
    type: Joi.string()
      .valid('atm', 'gasstation')
      .optional()
      .messages({
        'string.base': 'Tipo deve ser uma string',
        'any.only': 'Tipo deve ser "atm" ou "gasstation"'
      }),
    since: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.base': 'Data deve ser uma data válida',
        'date.format': 'Data deve estar no formato ISO 8601'
      })
  })
};

// Schema for contributing to a place
const contributeToPlace = {
  params: Joi.object({
    placeId: Joi.string()
      .required()
      .messages({
        'string.base': 'ID do local deve ser uma string',
        'any.required': 'ID do local é obrigatório'
      })
  }),
  body: Joi.object({
    contribution_type: Joi.string()
      .required()
      .valid(
        'money_paper', 'money_only', 'paper_only', 'none',
        'gasoline_diesel', 'gasoline_only', 'diesel_only', 'none'
      )
      .messages({
        'string.base': 'Tipo de contribuição deve ser uma string',
        'any.required': 'Tipo de contribuição é obrigatório',
        'any.only': 'Tipo de contribuição inválido'
      })
  })
};

module.exports = {
  getNearbyPOIs,
  getPlaceDetails,
  getPlaceUpdates,
  contributeToPlace
}; 