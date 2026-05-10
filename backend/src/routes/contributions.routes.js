const express = require('express');
const router = express.Router();
const contributionsController = require('../controllers/contributions.controller');
const { authenticate, checkSubscription } = require('../middleware/auth.middleware');
const validationMiddleware = require('../middleware/validation.middleware');
const rateLimiter = require('../middleware/rateLimit.middleware');

// Autenticação opcional para algumas rotas
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }
  req.user = null; // Usuário anônimo
  next();
};

/**
 * @swagger
 * /api/contributions/recent:
 *   get:
 *     summary: Buscar contribuições recentes
 *     description: |
 *       Retorna contribuições recentes com opção de filtros geográficos e por status.
 *       Políticas de retenção: contribuições têm uma janela "current" configurável por minutos (ENV `CONTRIBUTION_TTL_MINUTES`).
 *       Às 23:59 diariamente (`DAILY_RESET_SCHEDULE`), todas as contribuições do dia anterior são removidas (`PURGE_OLD_CONTRIBUTIONS=true`).
 *     tags: [Contributions]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude central para busca
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude central para busca
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 10
 *         description: Raio de busca em km
 *       - in: query
 *         name: poi_id
 *         schema:
 *           type: string
 *         description: Filtrar por POI específico
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data mínima das contribuições
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, verified, disputed, expired, rejected, all]
 *           default: all
 *         description: Status das contribuições
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página atual
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Itens por página
 *     responses:
 *       200:
 *         description: Lista de contribuições obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       poi_id: { type: string }
 *                       type: { type: string }
 *                       created_at: { type: string, format: date-time }
 *                       status: { type: string }
 *                       validations:
 *                         type: object
 *                         properties:
 *                           valid: { type: integer }
 *                           reports: { type: integer }
 */
router.get('/recent', optionalAuth, contributionsController.getRecentContributions);

/**
 * @swagger
 * /api/contributions/{id}/validate:
 *   post:
 *     summary: Validar uma contribuição
 *     description: |
 *       Confirma ou disputa a validade de uma contribuição.
 *       Observação: contribuições expiradas (após `CONTRIBUTION_TTL_MINUTES`) não podem ser validadas e retornarão erro 400.
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da contribuição
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
 *                 enum: [confirm, dispute]
 *                 description: Tipo de validação
 *               notes:
 *                 type: string
 *                 description: Observações opcionais
 *     responses:
 *       200:
 *         description: Contribuição validada com sucesso
 *       400:
 *         description: Requisição inválida
 *       404:
 *         description: Contribuição não encontrada
 */
router.post(
  '/:id/validate',
  authenticate,
  rateLimiter.contributionLimiter,
  validationMiddleware.validateValidation,
  contributionsController.validateContribution
);

// Manter compatibilidade com rotas existentes
router.get('/', optionalAuth, contributionsController.getRecentContributions);
router.post('/:id/validate', authenticate, rateLimiter.contributionLimiter, contributionsController.validateContribution);
router.post('/:id/report', authenticate, rateLimiter.contributionLimiter, contributionsController.reportContribution);

module.exports = router; 