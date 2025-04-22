const express = require('express');
const auth = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate');
const bonusValidation = require('../../validations/bonus.validation');
const bonusController = require('../../controllers/bonus.controller');

const router = express.Router();

// Get current user's bonus status
router.get('/status', auth.authenticate, bonusController.getBonusStatus);

// Get user's bonus history with pagination and filtering
router.get(
  '/history',
  auth.authenticate,
  validate(bonusValidation.getBonusHistory),
  bonusController.getBonusHistory
);

// Admin routes
router.route('/process-pending')
  .post(
    auth.authenticate,
    bonusController.processPendingBonuses
  );

router.route('/recalculate-thresholds')
  .post(
    auth.authenticate,
    bonusController.recalculateThresholds
  );

router.route('/check-eligible-users')
  .post(
    auth.authenticate,
    bonusController.checkEligibleUsers
  );

router.route('/auto-convert')
  .post(
    auth.authenticate,
    bonusController.runAutoConvert
  );

router.route('/cleanup')
  .post(
    auth.authenticate,
    validate(bonusValidation.cleanupRecords),
    bonusController.cleanupRecords
  );

module.exports = router; 