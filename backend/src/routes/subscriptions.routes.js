const express = require('express');
const { authenticate, checkSubscription } = require('../middleware/auth.middleware');
const subscriptionsController = require('../controllers/subscriptions.controller');
const validate = require('../middleware/validate.middleware');
const subscriptionsValidation = require('../validations/subscriptions.validation');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/subscriptions/plans:
 *   get:
 *     summary: Get subscription plans
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription plans retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/plans', validate(subscriptionsValidation.getSubscriptionPlans), subscriptionsController.getSubscriptionPlans);

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     summary: Create a subscription payment request
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription_type
 *             properties:
 *               subscription_type:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *                 description: Type of subscription
 *     responses:
 *       201:
 *         description: Subscription payment initiated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', validate(subscriptionsValidation.createSubscription), subscriptionsController.createSubscription);

/**
 * @swagger
 * /api/subscriptions/status/{reference}:
 *   get:
 *     summary: Check subscription payment status
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference
 *     responses:
 *       200:
 *         description: Subscription status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription transaction not found
 *       500:
 *         description: Server error
 */
router.get('/status/:reference', validate(subscriptionsValidation.checkSubscriptionStatus), subscriptionsController.checkSubscriptionStatus);

/**
 * @swagger
 * /api/subscriptions/transactions:
 *   get:
 *     summary: Get user subscription transactions with pagination
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, expired]
 *         description: Filter by transaction status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by transactions after this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by transactions before this date (YYYY-MM-DD)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at:desc, created_at:asc, amount:desc, amount:asc]
 *           default: created_at:desc
 *         description: Field and direction to sort by
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Subscription transactions retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/transactions', validate(subscriptionsValidation.getUserTransactions), subscriptionsController.getUserTransactions);

/**
 * @swagger
 * /api/subscriptions/dev/simulate/{reference}:
 *   post:
 *     summary: DEV ONLY - Simulate subscription payment status (complete or fail)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment reference
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [complete, fail]
 *     responses:
 *       200:
 *         description: Simulation applied successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not allowed in production
 *       404:
 *         description: Subscription transaction not found
 *       500:
 *         description: Server error
 */
router.post('/dev/simulate/:reference', validate(subscriptionsValidation.simulatePaymentDev), subscriptionsController.simulatePaymentDev);

module.exports = router; 