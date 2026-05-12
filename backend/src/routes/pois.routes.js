const express = require('express');
const { authenticate, checkSubscription } = require('../middleware/auth.middleware');
const poisController = require('../controllers/pois.controller');
const contributionsController = require('../controllers/contributions.controller');
const validate = require('../middleware/validate.middleware');
const poisValidation = require('../validations/pois.validation');
const { getPoiUpdatesSchema } = require('../validators/pois.validators');
const validationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

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
 * /api/pois:
 *   get:
 *     summary: Buscar POIs com filtros
 *     description: Busca POIs com opção de filtro por localização, região ou tipo
 *     tags: [POIs]
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
 *         description: Raio de busca em km (padrão 5km)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Tipo de POI (atm ou gasstation)
 *       - in: query
 *         name: region_id
 *         schema:
 *           type: integer
 *         description: ID da região para filtrar
 *       - in: query
 *         name: min_reliability
 *         schema:
 *           type: number
 *         description: Score mínimo de confiabilidade (0-10, padrão 3)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Página atual (paginação)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limite de resultados por página
 *     responses:
 *       200:
 *         description: Lista de POIs encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     pois:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           poi_type:
 *                             type: string
 *                             enum: [atm, gasstation]
 *                           google_place_id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           address:
 *                             type: string
 *                           latitude:
 *                             type: number
 *                           longitude:
 *                             type: number
 *                           distance_km:
 *                             type: number
 *                             description: Distância em quilômetros ao ponto consultado
 *                           google_data:
 *                             type: object
 *                             description: Dados do Google como objeto (não string)
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 */
router.get('/', optionalAuth, validate(poisValidation.getNearbyPOIs), poisController.getNearbyPOIs);

/**
 * @swagger
 * /api/pois/global:
 *   get:
 *     summary: Buscar POIs globalmente ordenados por recent ou reports
 *     description: Retorna POIs de qualquer lugar, ordenados por atualizações recentes ou mais reportados
 *     tags: [POIs]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [atm, gasstation]
 *         description: Tipo de POI (atm ou gasstation)
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [recent, reports]
 *         description: Ordenação (recent ou reports)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Página (paginação)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limite por página
 *     responses:
 *       200:
 *         description: Lista de POIs globais
 */
router.get('/global', optionalAuth, poisController.getGlobalPOIs);

/**
 * @swagger
 * /api/pois/search:
 *   get:
 *     summary: Buscar POIs por nome/endereço (texto)
 *     tags: [POIs]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Texto para buscar em nome ou endereço
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Página (paginação)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limite por página (máx 50)
 *       - in: query
 *         name: include_contributions
 *         schema:
 *           type: boolean
 *         description: Incluir contribuições recentes
 *     responses:
 *       200:
 *         description: Lista de POIs encontrados
 */
router.get('/search', optionalAuth, validate(poisValidation.searchPOIs), poisController.searchPOIs);

/**
 * @swagger
 * /api/pois/{id}:
 *   get:
 *     summary: Detalhes de um POI específico
 *     description: Obtém detalhes completos de um POI incluindo contribuições recentes
 *     tags: [POIs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do POI
 *       - in: query
 *         name: include_contributions
 *         schema:
 *           type: boolean
 *         description: Incluir contribuições recentes (default true)
 *       - in: query
 *         name: include_sync_info
 *         schema:
 *           type: boolean
 *         description: Incluir informações de sincronização (default false)
 *     responses:
 *       200:
 *         description: Detalhes do POI
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     poi:
 *                       $ref: '#/components/schemas/POI'
 *       404:
 *         description: POI não encontrado
 */
router.get('/:id', optionalAuth, validate(poisValidation.getPOIById), poisController.getPoiDetails);

/**
 * @swagger
 * /api/pois/updates:
 *   get:
 *     summary: Obter atualizações recentes de POIs em uma região
 *     tags: [POIs]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude do centro da região
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitude do centro da região
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Raio em quilômetros (padrão 10)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [atm, gasstation]
 *         description: Tipo de POI para filtrar
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Buscar atualizações desde esta data/hora
 *     responses:
 *       200:
 *         description: Lista de atualizações de POIs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/POIUpdate'
 *                 metadata:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Parâmetros inválidos
 *       500:
 *         description: Erro no servidor
 */
router.get('/updates', optionalAuth, validate(getPoiUpdatesSchema), poisController.getPoiUpdates);

/**
 * @swagger
 * /api/pois/{id}/contributions:
 *   post:
 *     summary: Contribuir com informações para um POI
 *     description: Adiciona uma nova contribuição a um POI existente
 *     tags: [POIs, Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do POI
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
 *                 description: Tipo de contribuição (ex. money_paper, gasoline_diesel)
 *               details:
 *                 type: object
 *                 description: Detalhes específicos do tipo de contribuição
 *     responses:
 *       201:
 *         description: Contribuição criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: POI não encontrado
 */
router.post(
  '/:id/contributions',
  authenticate,
  validationMiddleware.validateContribution,
  contributionsController.addContribution
);

// Manter compatibilidade com rotas existentes
// Compat routes removed: use /api/pois and /api/pois/:id endpoints

/**
 * @swagger
 * /api/pois/sync:
 *   post:
 *     summary: Sincronizar POIs armazenados em cache no cliente
 *     tags: [Points of Interest]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pois
 *             properties:
 *               pois:
 *                 type: array
 *                 description: Lista de POIs para sincronizar
 *                 items:
 *                   type: object
 *                   required:
 *                     - poi_type
 *                     - google_place_id
 *                     - name
 *                     - address
 *                     - latitude
 *                     - longitude
 *                   properties:
 *                     poi_type:
 *                       type: string
 *                       enum: [atm, gasstation]
 *                     google_place_id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     address:
 *                       type: string
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     google_data:
 *                       type: object
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       200:
 *         description: POIs sincronizados com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro no servidor
 */
router.post('/sync', validate(poisValidation.saveCachedPOIs), poisController.saveCachedPOIs);

module.exports = router; 