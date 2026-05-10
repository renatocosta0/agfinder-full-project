const express = require('express');
const { authenticate, checkSubscription } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const {
  recordUserLocationSchema,
  getUserLocationHistorySchema,
  updateMeSchema
} = require('../validators/users.validators');
const usersController = require('../controllers/users.controller');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/users/me/bonus:
 *   get:
 *     summary: Get user's bonus transactions
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bonus transactions retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/me/bonus', usersController.getUserBonusTransactions);

/**
 * @swagger
 * /api/users/me/subscription:
 *   get:
 *     summary: Get user's subscription information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription information retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/me/subscription', usersController.getUserSubscription);

/**
 * @swagger
 * /api/users/location/history:
 *   get:
 *     summary: Get user's location history
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Location history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/location/history', validate(getUserLocationHistorySchema), usersController.getUserLocationHistory);

router.put('/me', validate(updateMeSchema), usersController.updateMe);

/**
 * @swagger
 * /api/users/location:
 *   post:
 *     summary: Record current user location
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               accuracy:
 *                 type: number
 *                 description: Accuracy in meters
 *               source:
 *                 type: string
 *                 description: Source identifier (e.g., app, gps, network)
 *               recordedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Location recorded
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 */
router.post('/location', validate(recordUserLocationSchema), usersController.recordUserLocation);

module.exports = router; 