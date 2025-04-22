const express = require('express');
const { authenticate, checkSubscription } = require('../middleware/auth.middleware');
const contributionsController = require('../controllers/contributions.controller');

const router = express.Router();

// Apply middlewares to all routes
router.use(authenticate, checkSubscription);

/**
 * @swagger
 * /api/contributions/{id}/validate:
 *   post:
 *     summary: Validate a contribution
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Contribution ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - validation_type
 *             properties:
 *               validation_type:
 *                 type: string
 *                 enum: [valid]
 *                 description: Type of validation
 *     responses:
 *       201:
 *         description: Contribution validated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contribution not found
 *       500:
 *         description: Server error
 */
router.post('/:id/validate', contributionsController.validateContribution);

/**
 * @swagger
 * /api/contributions/{id}/report:
 *   post:
 *     summary: Report a contribution
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Contribution ID
 *     responses:
 *       201:
 *         description: Contribution reported successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Contribution not found
 *       500:
 *         description: Server error
 */
router.post('/:id/report', contributionsController.reportContribution);

module.exports = router; 