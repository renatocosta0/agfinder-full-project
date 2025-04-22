const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const authController = require('../controllers/auth.controller');

const router = express.Router();

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Authenticate with Google OAuth
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - platform
 *             properties:
 *               token:
 *                 type: string
 *                 description: Google OAuth token
 *               platform:
 *                 type: string
 *                 enum: [web, android, ios, expo]
 *                 description: Platform donde o login está sendo realizado
 *     responses:
 *       200:
 *         description: Authentication successful
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid token
 *       500:
 *         description: Server error
 */
router.post('/google', authController.googleAuth);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router; 