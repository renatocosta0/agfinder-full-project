const express = require('express');
const auth = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate');
const paymentValidation = require('../../validations/payment.validation');
const paymentController = require('../../controllers/payment.controller');

const router = express.Router();

router
  .route('/')
  .post(auth.authenticate, validate(paymentValidation.createPayment), paymentController.createPayment)
  .get(auth.authenticate, validate(paymentValidation.getPaymentsByUser), paymentController.getPaymentsByUser);

router
  .route('/:reference')
  .get(auth.authenticate, validate(paymentValidation.getPayment), paymentController.getPayment);

router
  .route('/:reference/verify')
  .get(auth.authenticate, validate(paymentValidation.verifyPayment), paymentController.verifyPayment);

module.exports = router; 