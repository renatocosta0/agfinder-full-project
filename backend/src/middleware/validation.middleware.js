/**
 * Middleware de Validação
 * Implementa funções para validação e sanitização de parâmetros de requisição
 */

const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const geoUtils = require('../utils/geo.utils');

/**
 * Função que verifica os resultados da validação e retorna os erros
 * @returns {Function} Middleware function
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

  logger.warn(`Erro de validação: ${JSON.stringify(extractedErrors)}`);
  
  return res.status(400).json({
    status: 'error',
    message: 'Erro de validação nos dados fornecidos',
    errors: extractedErrors
  });
};

/**
 * Validação de coordenadas geográficas (latitude e longitude)
 */
const validateCoordinates = [
  query('lat')
    .exists().withMessage('Latitude (lat) é obrigatória')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude deve ser um número entre -90 e 90')
    .toFloat(),
  
  query('lng')
    .exists().withMessage('Longitude (lng) é obrigatória')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude deve ser um número entre -180 e 180')
    .toFloat(),
  
  // Validação personalizada para área de Angola
  query(['lat', 'lng']).custom((value, { req }) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    
    // Verifica se está na área aproximada de Angola ou proximidades
    // Angola está aproximadamente entre 4°S-18°S e 11°E-24°E
    if (lat < -20 || lat > 0 || lng < 8 || lng > 26) {
      throw new Error('As coordenadas estão fora da área de Angola e proximidades');
    }
    return true;
  }),
  
  validate
];

/**
 * Validação de raio de busca em km
 */
const validateRadius = [
  query('radius')
    .optional()
    .isFloat({ min: 0.1, max: 100 }).withMessage('Raio deve ser um número entre 0.1 e 100 km')
    .toFloat(),
  
  validate
];

/**
 * Validação de ID de POI
 */
const validatePoiId = [
  param('id')
    .exists().withMessage('ID do POI é obrigatório')
    .isInt().withMessage('ID do POI deve ser um número inteiro')
    .toInt(),
  
  validate
];

/**
 * Validação de ID de usuário
 */
const validateUserId = [
  param('userId')
    .exists().withMessage('ID do usuário é obrigatório')
    .isInt().withMessage('ID do usuário deve ser um número inteiro')
    .toInt(),
  
  validate
];

/**
 * Validação de parâmetros de paginação
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro maior que zero')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser um número inteiro entre 1 e 100')
    .toInt(),
  
  query('pageToken')
    .optional()
    .isString().withMessage('Token de página deve ser uma string válida')
    .isLength({ min: 5, max: 200 }).withMessage('Token de página inválido'),
  
  validate
];

/**
 * Validação de dados para criação de contribuição
 */
const validateContributionData = [
  body('poiId')
    .exists().withMessage('ID do POI é obrigatório')
    .isInt().withMessage('ID do POI deve ser um número inteiro')
    .toInt(),
  
  body('userId')
    .exists().withMessage('ID do usuário é obrigatório')
    .isInt().withMessage('ID do usuário deve ser um número inteiro')
    .toInt(),
  
  body('contributionType')
    .exists().withMessage('Tipo de contribuição é obrigatório')
    .isString().withMessage('Tipo de contribuição deve ser uma string')
    .isIn(['money_paper', 'money_only', 'paper_only', 'none', 'gasoline_diesel', 'gasoline_only', 'diesel_only'])
    .withMessage('Tipo de contribuição inválido'),
  
  body('details')
    .optional()
    .isObject().withMessage('Detalhes devem ser um objeto'),
  
  validate
];

/**
 * Validação de dados para criação de validação
 */
const validateValidationData = [
  body('contributionId')
    .exists().withMessage('ID da contribuição é obrigatório')
    .isInt().withMessage('ID da contribuição deve ser um número inteiro')
    .toInt(),
  
  body('userId')
    .exists().withMessage('ID do usuário é obrigatório')
    .isInt().withMessage('ID do usuário deve ser um número inteiro')
    .toInt(),
  
  body('validationType')
    .exists().withMessage('Tipo de validação é obrigatório')
    .isString().withMessage('Tipo de validação deve ser uma string')
    .isIn(['valid', 'report']).withMessage('Tipo de validação deve ser "valid" ou "report"'),
  
  body('comment')
    .optional()
    .isString().withMessage('Comentário deve ser uma string')
    .isLength({ max: 500 }).withMessage('Comentário não pode exceder 500 caracteres'),
  
  validate
];

/**
 * Validação de parâmetros para busca de POIs
 */
const validatePlaceSearch = [
  query('keyword')
    .optional()
    .isString().withMessage('Palavra-chave deve ser uma string')
    .isLength({ min: 2, max: 100 }).withMessage('Palavra-chave deve ter entre 2 e 100 caracteres'),
  
  query('type')
    .optional()
    .isString().withMessage('Tipo deve ser uma string')
    .isIn(['atm', 'gasstation', 'any']).withMessage('Tipo deve ser "atm", "gasstation" ou "any"'),
  
  validate
];

/**
 * Sanitização de parâmetros de texto
 * @param {string} value - Valor a ser sanitizado
 * @returns {string} Valor sanitizado
 */
function sanitizeText(value) {
  if (!value) return value;
  
  // Remove caracteres especiais e scripts potencialmente perigosos
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Middleware para sanitizar automaticamente todos os inputs de texto
 */
function sanitizeInputs(req, res, next) {
  // Sanitizar parâmetros de query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeText(req.query[key]);
      }
    });
  }
  
  // Sanitizar parâmetros de body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeText(req.body[key]);
      }
    });
  }
  
  next();
}

/**
 * Middleware para validar token de autenticação
 */
function validateAuthToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Token de autenticação não fornecido ou inválido'
    });
  }
  
  // O token JWT é validado em outro middleware (auth.middleware.js)
  next();
}

/**
 * Validação de solicitação de contribuição
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
const validateContribution = (req, res, next) => {
  const { contribution_type, details } = req.body;
  
  // Verificar campos obrigatórios
  if (!contribution_type) {
    return res.status(400).json({
      success: false,
      error: 'O tipo de contribuição é obrigatório'
    });
  }
  
  // Validar tipo de contribuição: aceitar tanto os tipos legados quanto os tipos usados pelo controller
  const legacyTypes = [
    'cash_available',
    'cash_unavailable',
    'paper_available',
    'paper_unavailable',
    'gasoline_available',
    'gasoline_unavailable',
    'diesel_available',
    'diesel_unavailable',
    'services_disrupted'
  ];
  const controllerAtmTypes = ['money_paper', 'money_only', 'paper_only', 'none'];
  const controllerGasTypes = ['gasoline_diesel', 'gasoline_only', 'diesel_only', 'none'];
  const validTypes = [...new Set([...legacyTypes, ...controllerAtmTypes, ...controllerGasTypes])];
  
  if (!validTypes.includes(contribution_type)) {
    return res.status(400).json({
      success: false,
      error: `Tipo de contribuição inválido. Valores permitidos: ${validTypes.join(', ')}`
    });
  }
  
  // Validar campos específicos para tipos legados *_available
  if (legacyTypes.includes(contribution_type) && contribution_type.includes('_available') && (!details || !details.status)) {
    return res.status(400).json({
      success: false,
      error: 'O campo details.status é obrigatório para este tipo de contribuição'
    });
  }
  
  // Se chegou até aqui, a contribuição é válida
  next();
};

/**
 * Validação de solicitação de validação
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
const validateValidation = (req, res, next) => {
  const { validation_type, notes } = req.body;
  
  // Verificar campos obrigatórios
  if (!validation_type) {
    return res.status(400).json({
      success: false,
      error: 'O tipo de validação é obrigatório'
    });
  }
  
  // Validar tipo de validação
  if (!['confirm', 'dispute'].includes(validation_type)) {
    return res.status(400).json({
      success: false,
      error: 'Tipo de validação inválido. Valores permitidos: confirm, dispute'
    });
  }
  
  // Verificar tamanho das notas (se fornecidas)
  if (notes && notes.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'As notas não podem exceder 500 caracteres'
    });
  }
  
  // Se chegou até aqui, a validação é válida
  next();
};

module.exports = {
  validate,
  validateCoordinates,
  validateRadius,
  validatePoiId,
  validateUserId,
  validatePagination,
  validateContributionData,
  validateValidationData,
  validatePlaceSearch,
  sanitizeInputs,
  validateAuthToken,
  validateContribution,
  validateValidation
}; 