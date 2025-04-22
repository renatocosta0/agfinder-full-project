const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getWarnings = {
  query: Joi.object().keys({
    // No special query params needed for now
  }),
};

const markAsRead = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};

const markAllAsRead = {
  body: Joi.object().keys({
    // No special body params needed
  }),
};

module.exports = {
  getWarnings,
  markAsRead,
  markAllAsRead,
}; 