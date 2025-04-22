const express = require('express');
const { authenticate, checkSubscription } = require('../middleware/auth.middleware');
const poisController = require('../controllers/pois.controller');
const contributionsController = require('../controllers/contributions.controller');
const validate = require('../middleware/validate');
const poisValidation = require('../validations/pois.validation');

const router = express.Router();

// Apply middlewares to all routes
router.use(authenticate, checkSubscription);

/**
 * @swagger
 * /api/pois:
 *   get:
 *     summary: Get nearby points of interest
 *     tags: [Points of Interest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [atm, gasstation]
 *         description: Type of points of interest
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 5
 *         description: Search radius in kilometers
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [nearest, recent, most_interactions]
 *           default: nearest
 *         description: Ordering of results
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
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of data from Google Maps API
 *     responses:
 *       200:
 *         description: Points of interest retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', validate(poisValidation.getNearbyPOIs), poisController.getNearbyPOIs);

/**
 * @swagger
 * /api/pois/{id}:
 *   get:
 *     summary: Get a point of interest by ID
 *     tags: [Points of Interest]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Point of interest ID
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of data from Google Maps API
 *     responses:
 *       200:
 *         description: Point of interest retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Point of interest not found
 *       500:
 *         description: Server error
 */
router.get('/:id', validate(poisValidation.getPOIById), poisController.getPOIById);

/**
 * @swagger
 * /api/pois/{id}/contributions:
 *   post:
 *     summary: Add a contribution to a point of interest
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Point of interest ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contribution_type
 *             properties:
 *               contribution_type:
 *                 type: string
 *                 description: Type of contribution
 *     responses:
 *       201:
 *         description: Contribution added successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Point of interest not found
 *       500:
 *         description: Server error
 */
router.post('/:id/contributions', contributionsController.addContribution);

/**
 * @swagger
 * /api/pois/{id}/contributions/current:
 *   get:
 *     summary: Get current contribution for a point of interest
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Point of interest ID
 *     responses:
 *       200:
 *         description: Current contribution retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Point of interest not found
 *       500:
 *         description: Server error
 */
router.get('/:id/contributions/current', contributionsController.getCurrentContribution);

/**
 * @swagger
 * /api/pois/{id}/contributions/history:
 *   get:
 *     summary: Get contribution history for a point of interest
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Point of interest ID
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
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at:desc, created_at:asc]
 *           default: created_at:desc
 *         description: Field and direction to sort by
 *     responses:
 *       200:
 *         description: Contribution history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Point of interest not found
 *       500:
 *         description: Server error
 */
router.get('/:id/contributions/history', validate(poisValidation.getPOIContributionHistory), poisController.getPOIContributionHistory);

module.exports = router; 