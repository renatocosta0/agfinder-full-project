const express = require('express');
const auth = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const warningsValidation = require('../../validations/warnings.validation');
const warningsController = require('../../controllers/warnings.controller');

const router = express.Router();

// Routes for authenticated users
router
  .route('/')
  .get(
    auth.authenticate,
    validate(warningsValidation.getWarnings),
    warningsController.getMyWarnings
  );

router
  .route('/mark-all-read')
  .post(
    auth.authenticate,
    validate(warningsValidation.markAllAsRead),
    warningsController.markAllWarningsAsRead
  );

router
  .route('/:id/mark-read')
  .post(
    auth.authenticate,
    validate(warningsValidation.markAsRead),
    warningsController.markWarningAsRead
  );

module.exports = router; 