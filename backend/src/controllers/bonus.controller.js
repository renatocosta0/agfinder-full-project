const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { bonusService } = require('../services');

/**
 * Get bonus status for the authenticated user
 */
const getBonusStatus = catchAsync(async (req, res) => {
  const bonusStatus = await bonusService.getUserBonusStatus(req.user.id);
  res.status(httpStatus.OK).send(bonusStatus);
});

/**
 * Get bonus history with filtering and pagination
 */
const getBonusHistory = catchAsync(async (req, res) => {
  const filters = req.query;
  const result = await bonusService.getBonusHistory(req.user.id, filters);
  res.status(httpStatus.OK).send(result);
});

/**
 * Process pending bonuses in the system
 */
const processPendingBonuses = catchAsync(async (req, res) => {
  const result = await bonusService.processPendingBonuses();
  res.status(httpStatus.OK).send({
    success: true,
    processed: result.processed,
    failed: result.failed
  });
});

/**
 * Recalculate bonus thresholds
 */
const recalculateThresholds = catchAsync(async (req, res) => {
  await bonusService.recalculateThresholds();
  res.status(httpStatus.OK).send({ success: true });
});

/**
 * Check for eligible users for bonuses
 */
const checkEligibleUsers = catchAsync(async (req, res) => {
  const result = await bonusService.checkEligibleUsers();
  res.status(httpStatus.OK).send({
    success: true,
    eligibleUsers: result.eligible,
    totalChecked: result.total
  });
});

/**
 * Run automatic bonus conversion for all users
 */
const runAutoConvert = catchAsync(async (req, res) => {
  const result = await bonusService.batchAutoConvertBonusPoints();
  res.status(httpStatus.OK).send({
    success: true,
    convertedUsers: result.count,
  });
});

/**
 * Clean up old bonus records
 */
const cleanupRecords = catchAsync(async (req, res) => {
  const { olderThan, status, dryRun } = req.body;
  const result = await bonusService.cleanupRecords(olderThan, status, dryRun);
  res.status(httpStatus.OK).send({
    success: true,
    recordsDeleted: result.deleted,
    dryRun: dryRun
  });
});

module.exports = {
  getBonusStatus,
  getBonusHistory,
  processPendingBonuses,
  recalculateThresholds,
  checkEligibleUsers,
  runAutoConvert,
  cleanupRecords,
}; 