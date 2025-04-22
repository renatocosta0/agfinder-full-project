const express = require('express');
const webhooksController = require('../controllers/webhooks.controller');

const router = express.Router();

/**
 * @swagger
 * /api/webhooks/proxypay:
 *   post:
 *     summary: ProxyPay webhook endpoint
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reference
 *               - entity
 *               - amount
 *               - payment_datetime
 *               - transaction_id
 *             properties:
 *               reference:
 *                 type: string
 *                 description: Reference code
 *               entity:
 *                 type: string
 *                 description: Entity code
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               payment_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Payment datetime
 *               transaction_id:
 *                 type: string
 *                 description: Transaction ID
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Subscription transaction not found
 *       500:
 *         description: Server error
 */
router.post('/proxypay', webhooksController.proxyPayWebhook);

module.exports = router; 