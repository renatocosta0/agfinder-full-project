const express = require('express');
const { authenticate, checkSubscription } = require('../middleware/auth.middleware');
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

module.exports = router; 