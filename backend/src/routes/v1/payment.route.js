const express = require('express');
const auth = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const paymentValidation = require('../../validations/payment.validation');
const paymentController = require('../../controllers/payment.controller');

const router = express.Router();

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Payment'
 *     responses:
 *       201:
 *         description: Payment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *   get:
 *     summary: List payments for the authenticated user
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, successful, failed]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           example: createdAt:desc
 *     responses:
 *       200:
 *         description: Paginated list of payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalResults:
 *                   type: integer
 */
router
  .route('/')
  .post(
    auth.authenticate,
    auth.checkSubscription,
    validate(paymentValidation.createPayment),
    paymentController.createPayment
  )
  .get(
    auth.authenticate,
    auth.checkSubscription,
    validate(paymentValidation.getPaymentsByUser),
    paymentController.getPaymentsByUser
  );

/**
 * @swagger
 * /api/payments/{reference}:
 *   get:
 *     summary: Get a payment by reference
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Not found
 */
router
  .route('/:reference')
  .get(
    auth.authenticate,
    auth.checkSubscription,
    validate(paymentValidation.getPayment),
    paymentController.getPayment
  );

/**
 * @swagger
 * /api/payments/{reference}/verify:
 *   get:
 *     summary: Verify a payment by reference
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Payment after verification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Not found
 */
router
  .route('/:reference/verify')
  .get(
    auth.authenticate,
    auth.checkSubscription,
    validate(paymentValidation.verifyPayment),
    paymentController.verifyPayment
  );

module.exports = router; 