const { Op } = require('sequelize');
const { PointOfInterest, Contribution, User, Validation, BonusTransaction, UserWarning, sequelize } = require('../models');
const logger = require('../utils/logger');
const geoUtils = require('../utils/geo.utils');

// Add a contribution to a POI
const addContribution = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id: poiId } = req.params;
    const { contribution_type } = req.body;
    const { id: userId } = req.user;

    // Validate contribution type based on POI type
    const poi = await PointOfInterest.findByPk(poiId);
    
    if (!poi) {
      await transaction.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Point of interest not found',
      });
    }

    // Validate contribution type
    const atmTypes = ['money_paper', 'money_only', 'paper_only', 'none'];
    const gasStationTypes = ['gasoline_diesel', 'gasoline_only', 'diesel_only', 'none'];
    
    if (
      (poi.poi_type === 'atm' && !atmTypes.includes(contribution_type)) ||
      (poi.poi_type === 'gasstation' && !gasStationTypes.includes(contribution_type))
    ) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: `Invalid contribution type for ${poi.poi_type}`,
        valid_types: poi.poi_type === 'atm' ? atmTypes : gasStationTypes,
      });
    }

    // Check if user already has a current contribution for this POI
    const existingContribution = await Contribution.findOne({
      where: {
        poi_id: poiId,
        user_id: userId,
        is_current: true,
      },
    });

    if (existingContribution) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'You already have an active contribution for this point of interest',
      });
    }

    // Find any current contributions for this POI and mark as not current
    await Contribution.update(
      { is_current: false },
      {
        where: {
          poi_id: poiId,
          is_current: true,
        },
        transaction,
      }
    );

    // Calculate expiry time (ENV: CONTRIBUTION_TTL_MINUTES)
    const ttlMinutes = parseInt(process.env.CONTRIBUTION_TTL_MINUTES, 10);
    const expiryMinutes = Number.isFinite(ttlMinutes) ? ttlMinutes : 60;
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);

    // Create new contribution
    const contribution = await Contribution.create(
      {
        poi_id: poiId,
        user_id: userId,
        contribution_type,
        is_current: true,
        expires_at: expiryDate,
      },
      { transaction }
    );

    // Update POI counters
    // - contributions_count is cumulative (increment)
    // - total_interactions should reflect ONLY the current contribution: start at 1 (the contribution itself)
    // - validations and reports reset to 0 for the new current contribution
    await PointOfInterest.increment(['contributions_count'], {
      by: 1,
      where: { id: poiId },
      transaction,
    });
    await PointOfInterest.update(
      { total_interactions: 1, validations: 0, reports: 0 },
      { where: { id: poiId }, transaction }
    );

    // Add bonus points for contribution
    const bonusPoints = parseInt(process.env.BONUS_CONTRIBUTION, 10) || 10;
    
    await BonusTransaction.create(
      {
        user_id: userId,
        amount: bonusPoints,
        transaction_type: 'contribution',
        related_contribution_id: contribution.id,
        description: `Bonus for contributing to ${poi.name}`,
      },
      { transaction }
    );

    // Update user bonus points
    await User.increment(
      { bonus_points: bonusPoints },
      {
        where: { id: userId },
        transaction,
      }
    );

    await transaction.commit();

    // Invalidate caches so POI listings reflect validation/report updates
    try {
      const cacheService = require('../services/cache.service');
      const poiInstance = await PointOfInterest.findByPk(contribution.poi_id);
      if (poiInstance) {
        const lat = parseFloat(poiInstance.latitude);
        const lng = parseFloat(poiInstance.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const radiusKm = Number(process.env.CACHE_INVALIDATION_RADIUS_KM || 5);
          await cacheService.invalidateRegion(lat, lng, radiusKm);
        }
      }
    } catch (cacheErr) {
      logger.warn('Cache invalidation failed after validation/report:', cacheErr);
    }

    return res.status(201).json({
      status: 'success',
      message: 'Contribution added successfully',
      data: {
        contribution: {
          id: contribution.id,
          contribution_type,
          created_at: contribution.created_at,
          expires_at: contribution.expires_at,
          bonus_points: bonusPoints,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Add contribution error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error adding contribution',
    });
  }
};

// Get current contribution for a POI
const getCurrentContribution = async (req, res) => {
  try {
    const { id: poiId } = req.params;

    // Check if POI exists
    const poi = await PointOfInterest.findByPk(poiId);
    
    if (!poi) {
      return res.status(404).json({
        status: 'error',
        message: 'Point of interest not found',
      });
    }

    // Get current contribution
    const contribution = await Contribution.findOne({
      where: {
        poi_id: poiId,
        is_current: true,
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'profile_picture'],
        },
        {
          model: Validation,
          as: 'validations',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'profile_picture'],
            },
          ],
        },
      ],
    });

    if (!contribution) {
      return res.status(404).json({
        status: 'error',
        message: 'No current contribution found for this point of interest',
      });
    }

    // Format validations and reports
    const validations = contribution.validations
      .filter(v => v.validation_type === 'valid')
      .map(v => ({
        id: v.id,
        created_at: v.created_at,
        user: {
          id: v.user.id,
          name: v.user.name,
          profile_picture: v.user.profile_picture,
        },
      }));
      
    const reports = contribution.validations
      .filter(v => v.validation_type === 'report')
      .map(v => ({
        id: v.id,
        created_at: v.created_at,
        user: {
          id: v.user.id,
          name: v.user.name,
          profile_picture: v.user.profile_picture,
        },
      }));

    return res.status(200).json({
      status: 'success',
      data: {
        contribution: {
          id: contribution.id,
          contribution_type: contribution.contribution_type,
          created_at: contribution.created_at,
          expires_at: contribution.expires_at,
          is_expired: contribution.isExpired(),
          user: {
            id: contribution.user.id,
            name: contribution.user.name,
            profile_picture: contribution.user.profile_picture,
          },
          validations,
          reports,
          can_validate: contribution.user_id !== req.user.id,
        },
      },
    });
  } catch (error) {
    logger.error('Get current contribution error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching current contribution',
    });
  }
};

// Validate a contribution
const validateContribution = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id: contributionId } = req.params;
    const { validation_type } = req.body;
    const { id: userId } = req.user;

    // Check if contribution exists and is current
    const contribution = await Contribution.findOne({
      where: {
        id: contributionId,
        is_current: true,
      },
      include: [
        {
          model: User,
          as: 'user',
        },
      ],
    });
    
    if (!contribution) {
      await transaction.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Contribution not found or no longer current',
      });
    }

    // Check if contribution has expired
    if (contribution.isExpired()) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Contribution has expired',
      });
    }

    // Check if user is trying to validate their own contribution
    if (contribution.user_id === userId) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'You cannot validate your own contribution',
      });
    }

    // Check if user has already validated/reported this contribution
    const existingValidation = await Validation.findOne({
      where: {
        contribution_id: contributionId,
        user_id: userId,
      },
    });

    if (existingValidation) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'You have already validated/reported this contribution',
      });
    }

    // Validate validation type
    if (!['valid', 'report'].includes(validation_type)) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Validation type must be either "valid" or "report"',
      });
    }

    // Create validation
    const validation = await Validation.create(
      {
        contribution_id: contributionId,
        user_id: userId,
        validation_type,
      },
      { transaction }
    );

    // Update POI counters based on validation type (for current contribution only)
    try {
      const poiId = contribution.poi_id;
      if (validation_type === 'valid') {
        await PointOfInterest.increment(['validations'], {
          by: 1,
          where: { id: poiId },
          transaction,
        });
      } else if (validation_type === 'report') {
        await PointOfInterest.increment(['reports'], {
          by: 1,
          where: { id: poiId },
          transaction,
        });
      }
      // total_interactions = 1 (current contribution) + validations + reports
      await PointOfInterest.update(
        { total_interactions: sequelize.literal('1 + validations + reports') },
        { where: { id: poiId }, transaction }
      );
    } catch (incErr) {
      logger.warn('Failed to update POI counters for validation:', incErr);
    }

    // If validation type is 'valid', add bonus points to the contribution creator
    if (validation_type === 'valid') {
      const bonusPoints = parseInt(process.env.BONUS_VALIDATION, 10) || 5;
      
      await BonusTransaction.create(
        {
          user_id: contribution.user_id,
          amount: bonusPoints,
          transaction_type: 'validation',
          related_contribution_id: contributionId,
          description: 'Bonus for contribution validation',
        },
        { transaction }
      );

      // Update user bonus points
      await User.increment(
        { bonus_points: bonusPoints },
        {
          where: { id: contribution.user_id },
          transaction,
        }
      );
    }
    
    // If it's a report, check if user already has reports that should result in ban
    if (validation_type === 'report') {
      const reportedContributions = await Contribution.findAll({
        where: {
          user_id: contribution.user_id,
        },
        include: [
          {
            model: Validation,
            as: 'validations',
          },
        ],
      });
      
      // Count contributions with more reports than validations
      let badContributions = 0;
      
      for (const contrib of reportedContributions) {
        const validCount = contrib.validations.filter(v => v.validation_type === 'valid').length;
        const reportCount = contrib.validations.filter(v => v.validation_type === 'report').length;
        
        if (reportCount > validCount && reportCount >= 3) {
          badContributions++;
        }
      }
      
      // Add warning if user has exactly 3 bad contributions
      if (badContributions === 3) {
        // Create a warning record
        await UserWarning.create(
          {
            user_id: contribution.user_id,
            warning_type: 'bad_contribution',
            message: 'You have received a warning for having multiple reported contributions. Continued violations may result in temporary or permanent ban from the platform.',
            warning_level: 1,
          },
          { transaction }
        );
        
        // Update the user's warning count
        await User.increment(
          { warning_count: 1 },
          {
            where: { id: contribution.user_id },
            transaction,
          }
        );
        
        logger.info(`Warning added for user ${contribution.user_id} with 3 bad contributions`);
      }
      
      // Apply penalties if necessary
      if (badContributions >= 10) {
        // Permanent ban
        await User.update(
          {
            is_banned: true,
            ban_reason: 'Too many reported contributions',
            ban_expiry: null, // No expiry = permanent
          },
          {
            where: { id: contribution.user_id },
            transaction,
          }
        );
        
        // Create severe warning record
        await UserWarning.create(
          {
            user_id: contribution.user_id,
            warning_type: 'bad_contribution',
            message: 'Your account has been permanently banned due to excessive reported contributions.',
            warning_level: 3,
          },
          { transaction }
        );
        
        logger.info(`User ${contribution.user_id} permanently banned for having ${badContributions} bad contributions`);
      } else if (badContributions >= 5) {
        // Temporary ban (1 week)
        const banExpiry = new Date();
        banExpiry.setDate(banExpiry.getDate() + 7);
        
        await User.update(
          {
            is_banned: true,
            ban_reason: 'Multiple reported contributions',
            ban_expiry: banExpiry,
          },
          {
            where: { id: contribution.user_id },
            transaction,
          }
        );
        
        // Create major warning record
        await UserWarning.create(
          {
            user_id: contribution.user_id,
            warning_type: 'bad_contribution',
            message: `Your account has been temporarily banned until ${banExpiry.toISOString().split('T')[0]} due to multiple reported contributions.`,
            warning_level: 2,
          },
          { transaction }
        );
        
        logger.info(`User ${contribution.user_id} temporarily banned for having ${badContributions} bad contributions`);
      }
    }

    await transaction.commit();

    // Invalidate cached regions so lists refresh with the new contribution
    try {
      const cacheService = require('../services/cache.service');
      const lat = parseFloat(poi.latitude);
      const lng = parseFloat(poi.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const radiusKm = Number(process.env.CACHE_INVALIDATION_RADIUS_KM || 5);
        await cacheService.invalidateRegion(lat, lng, radiusKm);
      }
    } catch (cacheErr) {
      logger.warn('Cache invalidation failed after contribution:', cacheErr);
    }

    return res.status(201).json({
      status: 'success',
      message: validation_type === 'valid' ? 'Contribution validated successfully' : 'Contribution reported successfully',
      data: {
        validation: {
          id: validation.id,
          validation_type,
          created_at: validation.created_at,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Validate contribution error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error validating contribution',
    });
  }
};

// Report a contribution (calls the newer validateContribution implementation)
const reportContribution = async (req, res) => {
  req.body.validation_type = 'dispute';
  return exports.validateContribution(req, res);
};

/**
 * Buscar contribuições recentes
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 */
const getRecentContributions = async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 10,
      limit = 20,
      page = 1,
      poi_id,
      since,
      status = 'all'
    } = req.query;

    const { Contribution, PointOfInterest, User } = require('../models');
    const { Op } = require('sequelize');
    
    const offset = (page - 1) * parseInt(limit);
    const whereClause = {};
    
    // Filtro por status
    if (status !== 'all') {
      whereClause.processing_status = status;
    } else {
      whereClause.processing_status = {
        [Op.notIn]: ['rejected', 'expired']
      };
    }
    
    // Filtro por data
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        whereClause.created_at = {
          [Op.gte]: sinceDate
        };
      }
    }

    // Filtro por POI específico
    if (poi_id) {
      whereClause.poi_id = poi_id;
      
      const contributions = await Contribution.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'profile_picture']
          },
          {
            model: PointOfInterest,
            as: 'poi',
            attributes: ['id', 'name', 'address', 'poi_type', 'latitude', 'longitude']
          }
        ]
      });
      
      // Não cachear resultados específicos de contribuições
      res.set('Cache-Control', 'no-cache');
      
      return res.json({
        success: true,
        data: {
          contributions: contributions.rows,
          pagination: {
            total: contributions.count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(contributions.count / parseInt(limit))
          }
        }
      });
    }
    
    // Filtro por região geográfica
    if (lat && lng) {
      const radiusKm = parseFloat(radius);
      
      // Usar função otimizada para consultas geográficas
      const result = await Contribution.findInRegion(
        parseFloat(lat),
        parseFloat(lng),
        radiusKm,
        since ? new Date(since) : null
      );
      
      // Paginar os resultados após a filtragem geográfica
      const pagedResults = result.slice(offset, offset + parseInt(limit));
      
      // Não cachear resultados geográficos
      res.set('Cache-Control', 'no-cache');
      
      return res.json({
        success: true,
        data: {
          contributions: pagedResults,
          pagination: {
            total: result.length,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(result.length / parseInt(limit))
          },
          meta: {
            query_center: { lat: parseFloat(lat), lng: parseFloat(lng) },
            radius_km: radiusKm
          }
        }
      });
    }
    
    // Busca padrão sem filtro geográfico
    const contributions = await Contribution.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'profile_picture']
        },
        {
          model: PointOfInterest,
          as: 'poi',
          attributes: ['id', 'name', 'address', 'poi_type', 'latitude', 'longitude']
        }
      ]
    });
    
    // Não cachear contribuições
    res.set('Cache-Control', 'no-cache');
    
    return res.json({
      success: true,
      data: {
        contributions: contributions.rows,
        pagination: {
          total: contributions.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(contributions.count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar contribuições recentes:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar contribuições recentes'
    });
  }
};

/**
 * Validar uma contribuição específica
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 */
exports.validateContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { validation_type, notes } = req.body;
    const userId = req.user.id;

    // Validar parâmetros
    if (!validation_type || !['confirm', 'dispute'].includes(validation_type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de validação inválido. Deve ser "confirm" ou "dispute"'
      });
    }

    const { Contribution, Validation, PointOfInterest } = require('../models');
    
    // Buscar a contribuição
    const contribution = await Contribution.findByPk(id, {
      include: [
        {
          model: PointOfInterest,
          as: 'poi'
        }
      ]
    });
    
    if (!contribution) {
      return res.status(404).json({
        success: false,
        error: 'Contribuição não encontrada'
      });
    }
    
    // Verificar se não expirou
    if (contribution.expires_at && new Date() > new Date(contribution.expires_at)) {
      return res.status(400).json({
        success: false,
        error: 'Esta contribuição expirou e não pode mais ser validada'
      });
    }
    
    // Verificar se usuário não está validando sua própria contribuição
    if (contribution.user_id === userId) {
      return res.status(400).json({
        success: false,
        error: 'Não é possível validar sua própria contribuição'
      });
    }
    
    // Verificar se o usuário já validou esta contribuição
    const existingValidation = await Validation.findOne({
      where: {
        contribution_id: id,
        user_id: userId
      }
    });
    
    if (existingValidation) {
      return res.status(400).json({
        success: false,
        error: 'Você já validou esta contribuição anteriormente'
      });
    }
    
    // Normalizar para ENUM do modelo ('valid' | 'report')
    const normalizedType = validation_type === 'confirm' ? 'valid' : 'report';

    // Criar a validação
    const validation = await Validation.create({
      contribution_id: id,
      user_id: userId,
      validation_type: normalizedType,
      notes: notes || null
    });
    
    // Atualizar contadores e status da contribuição
    if (validation_type === 'confirm') {
      contribution.verification_count += 1;
      
      // Se atingiu um limiar, marcar como verificada
      if (contribution.verification_count >= 3 && contribution.processing_status === 'pending') {
        contribution.processing_status = 'verified';
        contribution.verified_at = new Date();
        
        // Atualizar a confiabilidade do POI
        if (contribution.poi) {
          const poi = contribution.poi;
          const newScore = Math.min(10, poi.reliability_score + 0.5);
          await poi.update({ reliability_score: newScore });
        }
      }
    } else {
      contribution.dispute_count += 1;
      
      // Se recebeu muitas disputas, marcar como disputada
      if (contribution.dispute_count >= 2 && contribution.processing_status === 'pending') {
        contribution.processing_status = 'disputed';
      }
    }
    
    // Atualizar pontuação de confiabilidade da contribuição
    const confirmWeight = 1;
    const disputeWeight = -1.5;
    const baseScore = 5;
    
    contribution.reliability_score = Math.max(0, Math.min(10, 
      baseScore + (contribution.verification_count * confirmWeight) + (contribution.dispute_count * disputeWeight)
    ));
    
    await contribution.save();
    
    return res.json({
      success: true,
      data: {
        validation: { ...validation.toJSON(), validation_type: normalizedType },
        contribution: {
          id: contribution.id,
          verification_count: contribution.verification_count,
          dispute_count: contribution.dispute_count,
          processing_status: contribution.processing_status,
          reliability_score: contribution.reliability_score
        }
      }
    });
  } catch (error) {
    console.error('Erro ao validar contribuição:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao validar contribuição'
    });
  }
};

module.exports = {
  addContribution,
  getCurrentContribution,
  validateContribution: exports.validateContribution,
  reportContribution,
  getRecentContributions,
};