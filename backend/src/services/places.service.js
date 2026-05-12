/**
 * Places Service for handling POI queries with database access
 * - Local database access
 * - Smart caching
 * - Data enrichment
 * - Optimized for Angola
 * 
 * Atualizado para a nova arquitetura baseada em banco de dados local
 */

const { PointOfInterest, Contribution, Validation, User, sequelize } = require('../models');
const logger = require('../utils/logger');
const geoUtils = require('../utils/geo.utils');
const cacheService = require('./cache.service');
const { POI_TYPES } = require('../config/pois.config');
const { Op, literal } = require('sequelize');
const AppError = require('../utils/AppError');

/**
 * Find POIs from local database based on geographic location
 * Função que substitui as chamadas diretas ao Google Maps API
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} type - Tipo de POI ('atm'|'gasstation')
 * @param {number} radiusKm - Raio de busca em quilômetros
 * @param {Object} options - Opções de paginação e ordenação
 * @returns {Promise<Object>} Resultados com POIs e metadados
 */
async function findPOIsFromDatabase(lat, lng, type, radiusKm = 5, options = {}) {
  // Opções padrão
  const {
    page = 1,
    limit = 20,
    sortBy = 'distance',
    includeContributions = false
  } = options;

  // Validar coordenadas
  if (!geoUtils.isValidCoordinate(lat, lng)) {
    throw new AppError('Coordenadas inválidas', 400);
  }

  // Validar tipo de POI quando fornecido; permitir todos quando ausente
  if (type && !POI_TYPES[type]) {
    throw new AppError(`Tipo de POI não suportado: ${type}`, 400);
  }

  // Calcular offset para paginação
  const offset = (page - 1) * limit;

  // Verificar cache primeiro
  const cacheKey = `pois:db:${type || 'all'}:${geoUtils.geoHashForCaching(lat, lng, radiusKm * 1000)}:p${page}:l${limit}`;
  logger.info(`[places.findPOIsFromDatabase] cacheKey=${cacheKey} forceRefresh=${!!options.forceRefresh}`);
  const cachedResults = options.forceRefresh ? null : await cacheService.get(cacheKey);
  logger.info(`[places.findPOIsFromDatabase] cache ${cachedResults ? 'HIT' : 'MISS'} for ${cacheKey}`);

  if (cachedResults) {
    logger.info(`Cache hit for ${cacheKey}`);
    return {
      ...cachedResults,
      source: 'cache'
    };
  }

  // Construir cláusula where usando bounding box aproximado
  const latDiff = radiusKm / 111.0;
  const lngFactor = Math.cos(lat * Math.PI / 180);
  const lngDiff = radiusKm / (111.0 * (lngFactor || 1));

  const whereClause = {
    latitude: { [Op.between]: [parseFloat(lat) - latDiff, parseFloat(lat) + latDiff] },
    longitude: { [Op.between]: [parseFloat(lng) - lngDiff, parseFloat(lng) + lngDiff] }
  };
  if (type) {
    whereClause.poi_type = type;
  }

  // Incluir opções de associação
  const includeOptions = [];
  if (includeContributions) {
    includeOptions.push({
      model: Contribution,
      as: 'contributions',
      limit: 3,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'profile_picture']
        },
        {
          model: Validation,
          as: 'validations',
          attributes: ['id', 'validation_type', 'created_at']
        }
      ]
    });
  }

  // Buscar POIs
  const pois = await PointOfInterest.findAll({
    where: whereClause,
    include: includeOptions,
    order: sortBy === 'recent' ? [[literal('(SELECT MAX(created_at) FROM contributions WHERE contributions.poi_id = points_of_interest.id)'), 'DESC']] : undefined
  });

  // Processar resultados
  // Calcular distâncias, filtrar por raio real e ordenar
  const withDistance = pois.map(poi => {
    const distanceKm = geoUtils.calculateDistance(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(poi.latitude),
      parseFloat(poi.longitude)
    );
    return { poi, distanceKm };
  });

  const filtered = withDistance.filter(x => x.distanceKm <= radiusKm);

  // Sort based on sortBy parameter
  if (sortBy === 'distance' || sortBy === 'nearest') {
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);
  } else if (sortBy === 'reports') {
    // Sort by total interactions (validations + reports)
    filtered.sort((a, b) => {
      const aInteractions = (a.poi.contributions || []).reduce((sum, c) => {
        const valid = (c.validations || []).filter(v => v.validation_type === 'valid').length;
        const reports = (c.validations || []).filter(v => v.validation_type === 'report').length;
        return sum + 1 + valid + reports;
      }, 0);
      const bInteractions = (b.poi.contributions || []).reduce((sum, c) => {
        const valid = (c.validations || []).filter(v => v.validation_type === 'valid').length;
        const reports = (c.validations || []).filter(v => v.validation_type === 'report').length;
        return sum + 1 + valid + reports;
      }, 0);
      return bInteractions - aInteractions;
    });
  }
  // 'recent' is already handled by SQL ORDER BY

  // Paginar após filtrar/ordenar
  const totalCount = filtered.length;
  const pageItems = filtered.slice(offset, offset + limit);

  const results = pageItems.map(({ poi, distanceKm }) => ({
    id: poi.id,
    google_place_id: poi.google_place_id,
    name: poi.name,
    type: poi.poi_type,
    location: {
      lat: parseFloat(poi.latitude),
      lng: parseFloat(poi.longitude)
    },
    distance_km: distanceKm,
    address: poi.address,
    last_sync_at: poi.last_sync_at,
    google_data: poi.google_data || null,
    contributions: includeContributions && poi.contributions ? poi.contributions.map(c => ({
      id: c.id,
      type: c.contribution_type,
      created_at: c.created_at,
      is_current: !!c.is_current,
      user: c.user ? {
        id: c.user.id,
        name: c.user.name,
        profile_picture: c.user.profile_picture
      } : null,
      validations: c.validations ? {
        valid: c.validations.filter(v => v.validation_type === 'valid').length,
        reports: c.validations.filter(v => v.validation_type === 'report').length
      } : { valid: 0, reports: 0 }
    })) : undefined
  }));

  // Preparar response
  const response = {
    results,
    metadata: {
      total_results: totalCount,
      page,
      page_size: results.length,
      total_pages: Math.ceil(totalCount / limit),
      search_radius_km: radiusKm
    },
    source: 'database'
  };

  // Guardar em cache
  const ttl = determineDataTTL(pois);
  await cacheService.set(cacheKey, response, ttl);

  return response;
}

/**
 * Calcular TTL para cache com base na idade dos dados
 * @param {Array} pois - Lista de POIs
 * @returns {number} Tempo em segundos
 */
function determineDataTTL(pois) {
  if (!pois || pois.length === 0) {
    return 300; // 5 minutos se não houver POIs
  }

  // Encontrar o POI com a sincronização mais recente
  const lastSyncTimes = pois
    .map(p => p.last_sync_at || p.last_sync)
    .filter(ts => !!ts)
    .map(ts => new Date(ts).getTime());

  if (lastSyncTimes.length === 0) {
    return 300; // 5 minutos se não houver datas de sincronização
  }

  const mostRecentSync = Math.max(...lastSyncTimes);
  const ageInHours = (Date.now() - mostRecentSync) / (1000 * 60 * 60);

  if (ageInHours < 24) {
    return 3600; // 1 hora para dados recentes
  } else if (ageInHours < 72) {
    return 7200; // 2 horas para dados de até 3 dias
  } else {
    return 14400; // 4 horas para dados mais antigos
  }
}

/**
 * Get details for a specific place from local database
 * Versão atualizada que prioriza o banco de dados local
 * 
 * @param {string} placeId - Google Place ID ou ID interno
 * @param {Object} options - Opções para inclusão de dados relacionados
 * @returns {Promise<Object>} Detalhes do POI
 */
async function getPlaceDetails(placeId, options = {}) {
  try {
    const { includeContributions = false, includeSyncInfo = false } = options;

    // Try cache first
    const cacheKey = `poi:detail:${placeId}:${includeContributions}:${includeSyncInfo}`;
    const cachedDetails = await cacheService.get(cacheKey);

    if (cachedDetails) {
      logger.info(`Cache hit for place details: ${placeId}`);
      return {
        ...cachedDetails,
        source: 'cache'
      };
    }

    // Buscar POI no banco de dados
    const poi = await PointOfInterest.findOne({
      where: {
        [Op.or]: [
          { id: isNaN(placeId) ? 0 : placeId },
          { google_place_id: placeId }
        ]
      },
      include: includeContributions ? [
        {
          model: Contribution,
          as: 'contributions',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'profile_picture']
            },
            {
              model: Validation,
              as: 'validations',
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['id', 'name']
                }
              ]
            }
          ]
        }
      ] : []
    });

    if (!poi) {
      throw new AppError('POI não encontrado', 404);
    }

    // Formatar resposta base
    const poiDetails = {
      id: poi.id,
      google_place_id: poi.google_place_id,
      name: poi.name,
      type: poi.poi_type,
      location: {
        lat: parseFloat(poi.latitude),
        lng: parseFloat(poi.longitude)
      },
      address: poi.address,
      google_data: poi.google_data || null,
      last_sync_at: poi.last_sync_at,
      status: poi.last_sync_at ?
        determineStatus(new Date(poi.last_sync_at)) : 'unknown',
      source: 'database'
    };

    // Adicionar contribuições se solicitado
    if (includeContributions && poi.contributions) {
      // Get the current contribution
      const currentContribution = poi.contributions.find(c => c.is_current);

      // Get contribution history
      const contributionHistory = poi.contributions
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(c => ({
          id: c.id,
          created_at: c.created_at,
          type: c.contribution_type,
          is_current: c.is_current,
          contributor: c.user ? {
            id: c.user.id,
            name: c.user.name,
            profile_picture: c.user.profile_picture
          } : null,
          validations: c.validations ? {
            valid: c.validations.filter(v => v.validation_type === 'valid').length,
            reports: c.validations.filter(v => v.validation_type === 'report').length
          } : { valid: 0, reports: 0 }
        }));

      // Calculate aggregate stats
      const stats = calculateAggregateStats(poi.contributions);

      // Add AGFINDER data to response
      poiDetails.contributions = {
        status: determineStatus(currentContribution ? new Date(currentContribution.created_at) : null),
        statusLabel: getStatusLabel(determineStatus(currentContribution ? new Date(currentContribution.created_at) : null)),
        current: currentContribution ? {
          id: currentContribution.id,
          type: currentContribution.contribution_type,
          created_at: currentContribution.created_at,
          contributor: currentContribution.user ? {
            id: currentContribution.user.id,
            name: currentContribution.user.name,
            profile_picture: currentContribution.user.profile_picture
          } : null,
          validations: currentContribution.validations ? {
            valid: currentContribution.validations.filter(v => v.validation_type === 'valid').length,
            reports: currentContribution.validations.filter(v => v.validation_type === 'report').length
          } : { valid: 0, reports: 0 }
        } : null,
        history: contributionHistory,
        stats
      };
    }

    // Adicionar informações de sincronização se solicitado
    if (includeSyncInfo) {
      // Buscar informações de sincronização do banco
      const syncInfo = await sequelize.query(`
        SELECT * FROM sync_logs
        WHERE region_id IN (
          SELECT id FROM sync_regions
          WHERE ST_DWithin(
            ST_MakePoint(center_lng, center_lat)::geography,
            ST_MakePoint(${poi.longitude}, ${poi.latitude})::geography,
            radius_km * 1000
          )
        )
        ORDER BY started_at DESC
        LIMIT 1
      `, { type: sequelize.QueryTypes.SELECT });

      if (syncInfo && syncInfo.length > 0) {
        poiDetails.sync_info = syncInfo[0];
      }
    }

    // Cache the details
    const ttl = poi.last_sync_at ?
      Math.max(300, 3600 - Math.floor((Date.now() - new Date(poi.last_sync_at).getTime()) / 1000)) :
      300; // Entre 5 minutos e 1 hora

    await cacheService.set(cacheKey, poiDetails, ttl);

    return poiDetails;
  } catch (error) {
    logger.error(`Error fetching place details for ${placeId}:`, error);

    if (error.response && error.response.status === 404) {
      throw new AppError('Local não encontrado', 404);
    }

    throw error.isAppError ? error : new AppError('Falha ao buscar detalhes do local', 500);
  }
}

/**
 * Get recent updates for POIs in a region
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @param {string} [type] - Optional POI type filter
 * @param {Date} [since] - Optional date to filter updates
 * @returns {Promise<Array>} List of recent POI updates
 */
async function getRecentUpdates(lat, lng, radiusKm, type = null, since = null) {
  try {
    // Validate coordinates
    if (!geoUtils.isValidCoordinate(lat, lng)) {
      throw new AppError('Coordenadas inválidas', 400);
    }

    // Convert radius to meters (for PostGIS)
    const radiusMeters = radiusKm * 1000;

    // Build query conditions
    const whereConditions = {};

    // Add type filter if provided
    if (type && POI_TYPES[type]) {
      whereConditions.poi_type = type;
    }

    // Add date filter if provided
    if (since instanceof Date) {
      whereConditions.created_at = {
        [Op.gte]: since
      };
    }

    // Get contributions in the geographic area
    const contributions = await Contribution.findAll({
      include: [
        {
          model: PointOfInterest,
          as: 'poi',
          where: literal(`ST_DWithin(ST_MakePoint(longitude, latitude)::geography, ST_MakePoint(${lng}, ${lat})::geography, ${radiusMeters})`),
          required: true
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'profile_picture'],
          required: false
        },
        {
          model: Validation,
          as: 'validations',
          required: false,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name'],
              required: false
            }
          ]
        }
      ],
      where: whereConditions,
      order: [['created_at', 'DESC']],
      limit: 50
    });

    // Format the response
    const results = contributions.map(contribution => {
      return {
        id: contribution.id,
        poi_id: contribution.poi_id,
        poi: {
          id: contribution.poi.id,
          name: contribution.poi.name,
          type: contribution.poi.type,
          location: {
            lat: parseFloat(contribution.poi.latitude),
            lng: parseFloat(contribution.poi.longitude)
          },
          address: contribution.poi.vicinity
        },
        type: contribution.contribution_type,
        created_at: contribution.created_at,
        status: contribution.status,
        contributor: contribution.user ? {
          id: contribution.user.id,
          name: contribution.user.name,
          profile_picture: contribution.user.profile_picture
        } : null,
        validations: {
          valid: contribution.validations.filter(v => v.validation_type === 'valid').length,
          reports: contribution.validations.filter(v => v.validation_type === 'report').length
        }
      };
    });

    return results;
  } catch (error) {
    logger.error(`Error fetching updates for region ${lat},${lng},${radiusKm}km:`, error);
    throw error.isAppError ? error : new AppError('Falha ao buscar atualizações', 500);
  }
}

/**
 * Determine the status of a POI based on the last update time
 * @param {Date} lastUpdateTime - Time of last update
 * @returns {string} Status code
 */
function determineStatus(lastUpdateTime) {
  if (!lastUpdateTime) {
    return 'unknown';
  }

  // ENV-driven thresholds (in hours)
  const recentH = parseInt(process.env.STATUS_RECENT_HOURS, 10);
  const relevantH = parseInt(process.env.STATUS_RELEVANT_HOURS, 10);
  const outdatedH = parseInt(process.env.STATUS_OUTDATED_HOURS, 10);
  const staleH = parseInt(process.env.STATUS_STALE_HOURS, 10);

  const RECENT = Number.isFinite(recentH) ? recentH : 24;
  const RELEVANT = Number.isFinite(relevantH) ? relevantH : 72;
  const OUTDATED = Number.isFinite(outdatedH) ? outdatedH : 168;
  const STALE = Number.isFinite(staleH) ? staleH : Infinity; // anything >= OUTDATED

  const now = new Date();
  const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);

  if (hoursSinceUpdate < RECENT) {
    return 'recent';
  } else if (hoursSinceUpdate < RELEVANT) {
    return 'relevant';
  } else if (hoursSinceUpdate < OUTDATED) {
    return 'outdated';
  } else {
    return 'stale';
  }
}

/**
 * Get a human-readable label for a status code
 * @param {string} status - Status code
 * @returns {string} Human-readable label
 */
function getStatusLabel(status) {
  const labels = {
    'recent': 'Atualizado recentemente',
    'relevant': 'Relativamente recente',
    'outdated': 'Desatualizado',
    'stale': 'Muito desatualizado',
    'unknown': 'Status desconhecido'
  };

  return labels[status] || 'Status desconhecido';
}

/**
 * Calculate aggregate statistics from contributions
 * @param {Array} contributions - List of contributions
 * @returns {Object} Aggregate statistics
 */
function calculateAggregateStats(contributions) {
  if (!contributions || contributions.length === 0) {
    return {
      totalContributions: 0,
      totalValidations: 0,
      totalReports: 0,
      lastUpdated: null,
      reliability: 0
    };
  }

  // Sort by date (newest first)
  const sortedContributions = [...contributions].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  // Total counts
  const totalContributions = contributions.length;
  const totalValidations = contributions.reduce(
    (sum, c) => sum + (c.validations ? c.validations.filter(v => v.validation_type === 'valid').length : 0),
    0
  );
  const totalReports = contributions.reduce(
    (sum, c) => sum + (c.validations ? c.validations.filter(v => v.validation_type === 'report').length : 0),
    0
  );

  // Last updated time
  const lastUpdated = sortedContributions[0].created_at;

  // Calculate reliability score (0-100)
  const validationWeight = totalValidations * 1;
  const reportWeight = totalReports * -2;
  const contributionWeight = totalContributions * 0.5;
  const timeWeight = determineTimeWeight(new Date(lastUpdated));

  let reliability = Math.max(0, Math.min(100,
    50 + validationWeight + reportWeight + contributionWeight + timeWeight
  ));

  return {
    totalContributions,
    totalValidations,
    totalReports,
    lastUpdated,
    reliability: Math.round(reliability)
  };
}

/**
 * Calculate weight factor based on recency
 * @param {Date} lastUpdateTime - Time of last update
 * @returns {number} Weight factor for reliability calculation
 */
function determineTimeWeight(lastUpdateTime) {
  if (!lastUpdateTime) {
    return -20;
  }

  const now = new Date();
  const daysSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate < 1) {
    return 20;
  } else if (daysSinceUpdate < 3) {
    return 10;
  } else if (daysSinceUpdate < 7) {
    return 0;
  } else if (daysSinceUpdate < 14) {
    return -10;
  } else {
    return -20;
  }
}

module.exports = {
  findPOIsFromDatabase,
  getPlaceDetails,
  getRecentUpdates,
  determineStatus,
  getStatusLabel,
  calculateAggregateStats
}; 