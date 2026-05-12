const { Op } = require('sequelize');
const { PointOfInterest, Contribution, User, Validation, sequelize } = require('../models');
const googleMapsService = require('../services/googleMaps.service');
const poiSyncService = require('../services/poiSync.service');
const placesService = require('../services/places.service');
const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');

// Função para calcular a distância haversine
function haversineDistanceQuery(lat1, lng1) {
  return `
    (
      6371 * acos(
        cos(radians(${lat1})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng1})) +
        sin(radians(${lat1})) * sin(radians(latitude))
      )
    )
  `;
}

// Get points of interest near a location
const getNearbyPOIs = async (req, res) => {
  logger.info('=== INICIANDO getNearbyPOIs ===');
  logger.info(`Query params: ${JSON.stringify(req.query)}`);
  logger.info(`User: ${req.user ? req.user.id : 'Não autenticado'}`);

  try {
    const { type, lat, lng } = req.query;
    const radius = req.query.radius || 5;
    const orderBy = req.query.orderBy || 'nearest';
    const page = parseInt(req.query.page || 1, 10);
    const limit = Math.min(parseInt(req.query.limit || 20, 10), 200);
    const rawFR = req.query.forceRefresh;
    const envForce = (process.env.FORCE_REFRESH_ALWAYS || '').toLowerCase() === 'true';
    const forceRefresh = envForce || rawFR === true || rawFR === '1' || (typeof rawFR === 'string' && rawFR.toLowerCase() === 'true');
    logger.info(`[getNearbyPOIs] forceRefresh=${forceRefresh} (envForce=${envForce}, raw='${rawFR}')`);

    if (!lat || !lng) {
      return res.status(400).json({ status: 'error', message: 'Latitude and longitude are required' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const validRadius = Math.min(50, Math.max(0.1, parseFloat(radius)));

    // Delegate to service
    const serviceRes = await placesService.findPOIsFromDatabase(
      latNum,
      lngNum,
      type,
      validRadius,
      {
        page,
        limit,
        sortBy: orderBy === 'nearest' ? 'distance' : orderBy,
        includeContributions: !req.limitedAccess,
        forceRefresh
      }
    );

    // Adapt service response to controller response shape
    const formattedPois = serviceRes.results.map(item => {
      let current = null;
      if (Array.isArray(item.contributions) && item.contributions.length > 0) {
        current = item.contributions.find(c => c.is_current) || item.contributions[0];
      }
      const validationsCount = current && current.validations ? (current.validations.valid || 0) : 0;
      const reportsCount = current && current.validations ? (current.validations.reports || 0) : 0;
      const totalInteractions = current ? 1 + validationsCount + reportsCount : 0;
      return {
        id: item.id,
        poi_type: item.type,
        google_place_id: item.google_place_id,
        name: item.name,
        address: item.address,
        latitude: item.location.lat,
        longitude: item.location.lng,
        distance_km: item.distance_km,
        google_data: item.google_data,
        has_current_contribution: !!current,
        total_interactions: totalInteractions,
        current_contribution: current ? {
          id: current.id,
          type: current.type || current.contribution_type,
          created_at: current.created_at
        } : null
      };
    });

    const response = {
      status: 'success',
      data: {
        pois: formattedPois,
        pagination: {
          total: serviceRes.metadata.total_results,
          page: serviceRes.metadata.page,
          limit: serviceRes.metadata.page_size,
          pages: serviceRes.metadata.total_pages,
          hasMore: serviceRes.metadata.page < serviceRes.metadata.total_pages
        },
        limited_access: !!req.limitedAccess,
        subscription_required: !!req.limitedAccess
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error('Get nearby POIs error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching points of interest',
    });
  }
};

// Get a single POI by ID
const getPOIById = async (req, res) => {
  logger.info('=== INICIANDO getPOIById ===');
  logger.info(`Params: ${JSON.stringify(req.params)}`);
  logger.info(`Query: ${JSON.stringify(req.query)}`);
  logger.info(`User: ${req.user ? req.user.id : 'Não autenticado'}`);

  try {
    const { id } = req.params;
    const { refresh } = req.query;

    const poi = await PointOfInterest.findByPk(id, {
      include: [
        {
          model: Contribution,
          as: 'contributions',
          where: {
            is_current: true,
          },
          required: false,
          attributes: ['id', 'poi_id', 'user_id', 'contribution_type', 'is_current', 'created_at'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'profile_picture'],
            },
            {
              model: Validation,
              as: 'validations',
              attributes: ['id', 'validation_type', 'created_at'],
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['id', 'name', 'profile_picture'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!poi) {
      return res.status(404).json({
        status: 'error',
        message: 'Point of interest not found',
      });
    }

    // Se refresh=true, atualizar dados do POI com o Google Maps
    if (refresh === 'true') {
      try {
        const placeDetails = await googleMapsService.getPlaceDetails(poi.google_place_id);

        // Atualizar dados do POI
        if (placeDetails) {
          await poi.update({
            name: placeDetails.name || poi.name,
            address: placeDetails.vicinity || placeDetails.formatted_address || poi.address,
            google_data: {
              rating: placeDetails.rating,
              user_ratings_total: placeDetails.user_ratings_total,
              opening_hours: placeDetails.opening_hours,
              photos: placeDetails.photos?.map(photo => ({
                reference: photo.photo_reference,
                width: photo.width,
                height: photo.height
              })),
              formatted_address: placeDetails.formatted_address
            }
          });
        }
      } catch (error) {
        logger.error(`Erro ao atualizar dados do POI ${id} do Google Maps:`, error);
        // Continuar com os dados existentes em caso de erro
      }
    }

    const currentContribution = poi.contributions[0] || null;

    let validations = [];
    let reports = [];

    if (currentContribution) {
      validations = currentContribution.validations
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

      reports = currentContribution.validations
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
    }

    // Calcular a idade dos dados
    const now = new Date();
    const lastUpdate = new Date(poi.updated_at);
    const dataAgeHours = Math.round((now - lastUpdate) / (1000 * 60 * 60));
    const dataAgeDays = Math.round(dataAgeHours / 24);

    // Delegate final formatting and caching to the service layer
    const details = await placesService.getPlaceDetails(poi.google_place_id || poi.id, {
      includeContributions: true,
      includeSyncInfo: false
    });

    return res.status(200).json({
      status: 'success',
      data: {
        poi: details,
      },
    });
  } catch (error) {
    logger.error('Get POI by ID error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching point of interest',
    });
  }
};

// Get contribution history for a POI
const getPOIContributionHistory = async (req, res) => {
  logger.info('=== INICIANDO getPOIContributionHistory ===');
  logger.info(`Params: ${JSON.stringify(req.params)}`);
  logger.info(`Query: ${JSON.stringify(req.query)}`);
  logger.info(`User: ${req.user ? req.user.id : 'Não autenticado'}`);

  try {
    const { id } = req.params;
    const { page = 1, limit = 20, sortBy = 'created_at:desc' } = req.query;
    const offset = (page - 1) * limit;

    // Extract sort field and direction
    const [sortField, sortDirection] = sortBy.split(':');
    const order = [[sortField, sortDirection.toUpperCase()]];

    const poi = await PointOfInterest.findByPk(id);

    if (!poi) {
      return res.status(404).json({
        status: 'error',
        message: 'Point of interest not found',
      });
    }

    // Get count of contributions first
    const count = await Contribution.count({
      where: {
        poi_id: id,
        is_current: false,
      },
    });

    // Get contributions with pagination
    const contributions = await Contribution.findAll({
      where: {
        poi_id: id,
        is_current: false,
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
          attributes: ['id', 'validation_type', 'created_at'],
        },
      ],
      order,
      limit: parseInt(limit, 10),
      offset,
    });

    const formattedContributions = contributions.map(contribution => {
      const validations = contribution.validations.filter(v => v.validation_type === 'valid').length;
      const reports = contribution.validations.filter(v => v.validation_type === 'report').length;

      return {
        id: contribution.id,
        contribution_type: contribution.contribution_type,
        created_at: contribution.created_at,
        expires_at: contribution.expires_at,
        user: {
          id: contribution.user.id,
          name: contribution.user.name,
          profile_picture: contribution.user.profile_picture,
        },
        validations,
        reports,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        poi_id: id,
        contributions: formattedContributions,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(count / limit)
        },
      },
    });
  } catch (error) {
    logger.error('Get POI contribution history error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching contribution history',
    });
  }
};

// Salvar POIs enviados pelo cliente (offline sync)
const saveCachedPOIs = async (req, res) => {
  logger.info('=== INICIANDO saveCachedPOIs ===');
  logger.info(`Body: ${JSON.stringify(req.body).substring(0, 200)}...`); // Limita o log para não ficar muito grande
  logger.info(`User: ${req.user ? req.user.id : 'Não autenticado'}`);

  try {
    const { pois } = req.body;

    if (!Array.isArray(pois) || pois.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Requisição inválida: o campo "pois" deve ser um array não vazio',
      });
    }

    logger.info(`Recebendo ${pois.length} POIs do cliente para sincronização`);

    // Arrays para tracking dos resultados
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    // Processar cada POI
    for (const poiData of pois) {
      try {
        // Verificar se já existe um POI com o mesmo google_place_id
        const existingPoi = await PointOfInterest.findOne({
          where: {
            google_place_id: poiData.google_place_id
          }
        });

        if (existingPoi) {
          // Verificar se o POI do cliente é mais recente
          const clientUpdatedAt = new Date(poiData.updated_at);
          const dbUpdatedAt = new Date(existingPoi.updated_at);

          if (clientUpdatedAt > dbUpdatedAt) {
            // Atualizar dados existentes
            await existingPoi.update({
              name: poiData.name,
              address: poiData.address,
              latitude: poiData.latitude,
              longitude: poiData.longitude,
              google_data: poiData.google_data,
              updated_at: clientUpdatedAt
            });

            results.updated++;
            results.details.push({
              id: existingPoi.id,
              google_place_id: poiData.google_place_id,
              status: 'updated',
              message: 'POI atualizado com sucesso'
            });
          } else {
            // POI do banco já está mais atualizado
            results.skipped++;
            results.details.push({
              id: existingPoi.id,
              google_place_id: poiData.google_place_id,
              status: 'skipped',
              message: 'Versão do servidor é mais recente'
            });
          }
        } else {
          // Criar novo POI
          const newPoi = await PointOfInterest.create({
            poi_type: poiData.poi_type,
            google_place_id: poiData.google_place_id,
            name: poiData.name,
            address: poiData.address,
            latitude: poiData.latitude,
            longitude: poiData.longitude,
            google_data: poiData.google_data,
            created_at: poiData.created_at || new Date(),
            updated_at: poiData.updated_at || new Date()
          });

          results.created++;
          results.details.push({
            id: newPoi.id,
            google_place_id: poiData.google_place_id,
            status: 'created',
            message: 'Novo POI criado com sucesso'
          });
        }
      } catch (poiError) {
        logger.error(`Erro ao processar POI ${poiData.google_place_id}:`, poiError);
        results.errors++;
        results.details.push({
          google_place_id: poiData.google_place_id,
          status: 'error',
          message: poiError.message
        });
      }
    }

    logger.info(`Sincronização concluída: ${results.created} criados, ${results.updated} atualizados, ${results.skipped} ignorados, ${results.errors} erros`);

    return res.status(200).json({
      status: 'success',
      data: {
        results
      }
    });
  } catch (error) {
    logger.error('Erro ao salvar POIs do cliente:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Erro ao processar a sincronização de POIs',
    });
  }
};


/**
 * Buscar detalhes de um POI específico
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 */
const getPoiDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { include_contributions = 'true' } = req.query;

    const { PointOfInterest, Contribution, User } = require('../models');

    const include = [];

    if (include_contributions === 'true') {
      include.push({
        model: Contribution,
        as: 'contributions',
        where: { is_current: true },
        required: false,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'profile_picture']
          }
        ]
      });
    }

    // SyncRegion deprecated: no extra include

    const poi = await PointOfInterest.findByPk(id, { include });

    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI não encontrado'
      });
    }

    // Compute current or last contribution with user info
    let currentContribution = Array.isArray(poi.contributions) && poi.contributions.length > 0
      ? poi.contributions[0]
      : null;
    let lastContribution = null;
    if (!currentContribution) {
      lastContribution = await Contribution.findOne({
        where: { poi_id: id },
        order: [['created_at', 'DESC']],
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'profile_picture'] }]
      });
    }

    // Determine if the authenticated user has already validated this contribution
    let userHasValidated = false;
    try {
      const { Validation } = require('../models');
      const target = currentContribution || lastContribution;
      if (req.user?.id && target?.id) {
        const existingVal = await Validation.findOne({
          where: { contribution_id: target.id, user_id: req.user.id },
        });
        userHasValidated = !!existingVal;
      }
    } catch { }

    const computeCanValidate = (c) => {
      try {
        const authId = req.user?.id;
        if (!authId || !c) return false;
        const ownerId = c.user_id || (c.user && c.user.id);
        if (ownerId && String(ownerId) === String(authId)) return false;
        if (c.expires_at && new Date() > new Date(c.expires_at)) return false;
        if (userHasValidated) return false;
        return true;
      } catch {
        return false;
      }
    };

    const mapContribution = (c) => c ? ({
      id: c.id,
      contribution_type: c.contribution_type,
      created_at: c.created_at,
      expires_at: c.expires_at,
      validations: typeof c.verification_count === 'number' ? c.verification_count : (Array.isArray(c.validations) ? c.validations.filter(v => v.validation_type === 'valid').length : undefined),
      reports: typeof c.dispute_count === 'number' ? c.dispute_count : (Array.isArray(c.validations) ? c.validations.filter(v => v.validation_type === 'report').length : undefined),
      can_validate: computeCanValidate(c),
      is_owner: (() => {
        const authId = req.user?.id;
        const ownerId = c?.user_id || (c?.user && c.user.id);
        return !!authId && !!ownerId && String(authId) === String(ownerId);
      })(),
      user: c.user ? {
        id: c.user.id,
        name: c.user.name,
        profile_picture: c.user.profile_picture
      } : null
    }) : null;

    const lastContributionBlock = mapContribution(currentContribution || lastContribution);

    // Verificar se dados estão expirados
    const isExpired = poi.isExpired();

    // Configurar cache baseado no status e idade dos dados
    if (!isExpired) {
      const now = new Date().getTime();
      const updatedAt = new Date(poi.updated_at).getTime();
      const ageInHours = (now - updatedAt) / (1000 * 60 * 60);

      // Determinar TTL do cache baseado na idade dos dados
      let ttl = 300; // 5 minutos padrão

      if (ageInHours > 24) ttl = 3600; // 1 hora se dados tiverem mais de 24h
      if (ageInHours > 72) ttl = 7200; // 2 horas se dados tiverem mais de 72h

      res.set('Cache-Control', `public, max-age=${ttl}`);
      res.set('ETag', `W/"poi-${id}-${poi.version}"`);
    } else {
      // Dados expirados, não cachear
      res.set('Cache-Control', 'no-cache');
    }

    // Build response POI with last_contribution included
    const responsePoi = {
      ...poi.toJSON(),
      last_contribution: lastContributionBlock
    };

    return res.json({
      success: true,
      data: {
        poi: responsePoi,
        meta: {
          is_expired: isExpired,
          data_quality: poi.reliability_score >= 8 ? 'high' : poi.reliability_score >= 5 ? 'medium' : 'low',
          last_updated: poi.updated_at
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes do POI:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar detalhes do POI'
    });
  }
};

/**
 * Buscar atualizações de POIs na região
 */
const getPoiUpdates = async (req, res) => {
  try {
    const { lat, lng, radius = 10, type, since } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius) || 10;

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ status: 'error', message: 'Coordenadas inválidas' });
    }

    let sinceDate = null;
    if (since) {
      sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Formato de data inválido para "since"' });
      }
    }

    const updates = await placesService.getRecentUpdates(
      latitude,
      longitude,
      radiusKm,
      type,
      sinceDate
    );

    return res.status(200).json({
      status: 'success',
      data: updates,
      metadata: {
        count: updates.length,
        region: { center: { lat: latitude, lng: longitude }, radius_km: radiusKm },
        filters: { type: type || 'all', since: sinceDate ? sinceDate.toISOString() : 'all' }
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar atualizações de POIs:', error);
    return res.status(500).json({ status: 'error', message: 'Erro ao buscar atualizações de POIs' });
  }
};

// Get POIs globally (no location filter) ordered by recent or reports
const getGlobalPOIs = async (req, res) => {
  try {
    const { type, orderBy = 'recent', page = 1, limit = 20, forceRefresh } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = Math.min(parseInt(limit, 10) || 20, 200);
    const sortBy = orderBy === 'reports' ? 'reports' : 'recent';

    const serviceRes = await placesService.findPOIsGlobal(
      type,
      sortBy,
      {
        page: pageNum,
        limit: pageSize,
        includeContributions: true,
        forceRefresh: forceRefresh === 'true' || forceRefresh === true
      }
    );

    const formattedPois = serviceRes.results.map(item => {
      let current = null;
      if (Array.isArray(item.contributions) && item.contributions.length > 0) {
        current = item.contributions.find(c => c.is_current) || item.contributions[0];
      }
      const validationsCount = current && current.validations ? (current.validations.valid || 0) : 0;
      const reportsCount = current && current.validations ? (current.validations.reports || 0) : 0;
      const totalInteractions = current ? 1 + validationsCount + reportsCount : 0;
      return {
        id: item.id,
        poi_type: item.type,
        google_place_id: item.google_place_id,
        name: item.name,
        address: item.address,
        latitude: item.location.lat,
        longitude: item.location.lng,
        distance_km: item.distance_km,
        google_data: item.google_data,
        has_current_contribution: !!current,
        total_interactions: totalInteractions,
        current_contribution: current ? {
          id: current.id,
          type: current.type || current.contribution_type,
          created_at: current.created_at
        } : null
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        pois: formattedPois,
        pagination: {
          total: serviceRes.metadata.total_results,
          page: serviceRes.metadata.page,
          limit: serviceRes.metadata.page_size,
          pages: serviceRes.metadata.total_pages,
          hasMore: serviceRes.metadata.page < serviceRes.metadata.total_pages
        }
      }
    });
  } catch (error) {
    logger.error('Get global POIs error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching global POIs',
    });
  }
};

// Text search POIs by name or address with pagination
const searchPOIs = async (req, res) => {
  try {
    const { q, page = 1, limit = 20, include_contributions = 'false' } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const pageSize = Math.min(parseInt(limit, 10) || 20, 50);
    const offset = (pageNum - 1) * pageSize;

    if (!q || String(q).trim().length < 2) {
      return res.status(400).json({ status: 'fail', message: 'Query q must be at least 2 characters' });
    }

    const query = `%${q}%`;

    const where = {
      [Op.or]: [
        { name: { [Op.iLike]: query } },
        { address: { [Op.iLike]: query } }
      ]
    };

    const include = [];
    if (include_contributions === 'true' || include_contributions === true) {
      include.push({
        model: Contribution,
        as: 'contributions',
        limit: 3,
        order: [['created_at', 'DESC']],
        required: false,
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'profile_picture'] },
          { model: Validation, as: 'validations', attributes: ['id', 'validation_type', 'created_at'] }
        ]
      });
    }

    const { rows, count } = await PointOfInterest.findAndCountAll({
      where,
      include,
      limit: pageSize,
      offset,
      order: [['reliability_score', 'DESC'], ['updated_at', 'DESC']]
    });

    const results = rows.map(item => {
      const current = Array.isArray(item.contributions) && item.contributions.length > 0
        ? (item.contributions.find(c => c.is_current) || item.contributions[0])
        : null;
      const validationsCount = current && current.validations ? current.validations.filter(v => v.validation_type === 'valid').length : 0;
      const reportsCount = current && current.validations ? current.validations.filter(v => v.validation_type === 'report').length : 0;
      const totalInteractions = current ? 1 + validationsCount + reportsCount : 0;
      return {
        id: item.id,
        poi_type: item.poi_type,
        google_place_id: item.google_place_id,
        name: item.name,
        address: item.address,
        latitude: parseFloat(item.latitude),
        longitude: parseFloat(item.longitude),
        distance_km: undefined,
        google_data: item.google_data || null,
        has_current_contribution: !!current,
        total_interactions: totalInteractions,
        current_contribution: current ? { id: current.id, type: current.contribution_type, created_at: current.created_at } : null
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        pois: results,
        pagination: {
          total: count,
          page: pageNum,
          limit: pageSize,
          pages: Math.ceil(count / pageSize)
        }
      }
    });
  } catch (error) {
    logger.error('Search POIs error:', error);
    return res.status(500).json({ status: 'error', message: 'Error searching points of interest' });
  }
};

module.exports = {
  getNearbyPOIs,
  getGlobalPOIs,
  getPOIById,
  getPOIContributionHistory,
  saveCachedPOIs,
  getPoiDetails,
  getPoiUpdates,
  searchPOIs
};