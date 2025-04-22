const { Op } = require('sequelize');
const { PointOfInterest, Contribution, User, Validation, sequelize } = require('../models');
const googleMapsService = require('../services/googleMaps.service');
const logger = require('../utils/logger');

// Get points of interest near a location
const getNearbyPOIs = async (req, res) => {
  try {
    const {
      type,
      lat,
      lng,
      radius = 5,
      orderBy = 'nearest',
      page = 1,
      limit = 20,
      forceRefresh = false, // Novo parâmetro para forçar atualização dos dados
    } = req.query;

    // Validate required parameters
    if (!lat || !lng) {
      return res.status(400).json({
        status: 'error',
        message: 'Latitude and longitude are required',
      });
    }

    // Validate type parameter
    if (type && !['atm', 'gasstation'].includes(type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Type must be either "atm" or "gasstation"',
      });
    }

    // Calculate pagination parameters
    const offset = (page - 1) * limit;
    
    // Maximum radius 50km
    const validRadius = Math.min(50, Math.max(0.1, parseFloat(radius)));
    
    // Build where clause
    const where = {};
    if (type) {
      where.poi_type = type;
    }

    // Calculate distance and limit results to points within radius
    const distanceQuery = `
      ST_Distance(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
      )
    `;

    let order;
    switch (orderBy) {
      case 'recent':
        order = [['updated_at', 'DESC']];
        break;
      case 'most_interactions':
        // This requires a JOIN with contributions to count interactions
        // Will be handled later in the code
        order = [];
        break;
      case 'nearest':
      default:
        order = [[sequelize.literal(distanceQuery), 'ASC']];
    }

    // First get count of POIs within radius
    const countQuery = `
      SELECT COUNT(*) AS total FROM "PointOfInterests" 
      WHERE ${distanceQuery} <= ${validRadius * 1000}
      ${type ? ` AND poi_type = '${type}'` : ''}
    `;
    
    const [countResult] = await sequelize.query(countQuery, {
      replacements: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
      },
      plain: true,
    });
    
    let totalCount = parseInt(countResult.total, 10);

    // Se não houver resultados ou forceRefresh for true, buscar dados do Google Maps
    if (totalCount === 0 || forceRefresh === 'true') {
      try {
        logger.info(`Nenhum POI encontrado próximo a ${lat},${lng} ou atualização forçada. Buscando do Google Maps.`);
        
        if (type) {
          // Buscar apenas o tipo específico
          await googleMapsService.fetchAndSavePOIs(
            parseFloat(lat), 
            parseFloat(lng), 
            validRadius, 
            type
          );
        } else {
          // Buscar todos os tipos suportados
          await googleMapsService.syncRegionPOIs(
            parseFloat(lat), 
            parseFloat(lng), 
            validRadius
          );
        }
        
        // Recalcular contagem após a atualização
        const [updatedCount] = await sequelize.query(countQuery, {
          replacements: {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
          },
          plain: true,
        });
        
        totalCount = parseInt(updatedCount.total, 10);
        logger.info(`Após atualização: ${totalCount} POIs encontrados.`);
      } catch (error) {
        logger.error('Erro ao buscar POIs do Google Maps:', error);
        // Continuar com os dados existentes mesmo em caso de erro
      }
    }

    // Get POIs with current contributions
    const pois = await PointOfInterest.findAll({
      where,
      attributes: [
        'id',
        'poi_type',
        'google_place_id',
        'name',
        'address',
        'latitude',
        'longitude',
        'google_data',
        'created_at',
        'updated_at',
        [
          sequelize.literal(distanceQuery),
          'distance',
        ],
      ],
      include: [
        {
          model: Contribution,
          as: 'contributions',
          where: {
            is_current: true,
          },
          required: false,
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
        },
      ],
      order,
      having: sequelize.literal(`distance <= ${validRadius * 1000}`), // Convert km to meters
      replacements: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
      },
      limit: parseInt(limit, 10),
      offset,
    });

    // If user has limited access, filter out the details
    if (req.limitedAccess) {
      const limitedPois = pois.map(poi => ({
        id: poi.id,
        poi_type: poi.poi_type,
        name: poi.name,
        address: poi.address,
        latitude: poi.latitude,
        longitude: poi.longitude,
        distance: poi.getDataValue('distance'),
        has_current_contribution: poi.contributions.length > 0,
      }));

      return res.status(200).json({
        status: 'success',
        data: {
          pois: limitedPois,
          pagination: {
            total: totalCount,
            page,
            limit,
            pages: Math.ceil(totalCount / limit)
          },
          limited_access: true,
          subscription_required: true,
        },
      });
    }

    // Format the response for full access
    const formattedPois = pois.map(poi => {
      const currentContribution = poi.contributions[0] || null;
      
      let validations = 0;
      let reports = 0;
      
      if (currentContribution) {
        validations = currentContribution.validations.filter(v => v.validation_type === 'valid').length;
        reports = currentContribution.validations.filter(v => v.validation_type === 'report').length;
      }
      
      return {
        id: poi.id,
        poi_type: poi.poi_type,
        google_place_id: poi.google_place_id,
        name: poi.name,
        address: poi.address,
        latitude: poi.latitude,
        longitude: poi.longitude,
        distance: poi.getDataValue('distance'),
        created_at: poi.created_at,
        updated_at: poi.updated_at,
        google_data: poi.google_data,
        current_status: currentContribution ? {
          id: currentContribution.id,
          contribution_type: currentContribution.contribution_type,
          created_at: currentContribution.created_at,
          expires_at: currentContribution.expires_at,
          user: {
            id: currentContribution.user.id,
            name: currentContribution.user.name,
            profile_picture: currentContribution.user.profile_picture,
          },
          validations,
          reports,
        } : null,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        pois: formattedPois,
        pagination: {
          total: totalCount,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(totalCount / limit)
        },
      },
    });
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
        const placeDetails = await googleMapsService.fetchPlaceDetails(poi.google_place_id);
        
        // Atualizar dados do POI
        if (placeDetails) {
          await poi.update({
            name: placeDetails.name || poi.name,
            address: placeDetails.vicinity || placeDetails.formatted_address || poi.address,
            google_data: JSON.stringify({
              rating: placeDetails.rating,
              user_ratings_total: placeDetails.user_ratings_total,
              opening_hours: placeDetails.opening_hours,
              photos: placeDetails.photos?.map(photo => ({
                reference: photo.photo_reference,
                width: photo.width,
                height: photo.height
              })),
              formatted_address: placeDetails.formatted_address
            })
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

    const formattedPoi = {
      id: poi.id,
      poi_type: poi.poi_type,
      google_place_id: poi.google_place_id,
      name: poi.name,
      address: poi.address,
      latitude: poi.latitude,
      longitude: poi.longitude,
      created_at: poi.created_at,
      updated_at: poi.updated_at,
      google_data: poi.google_data,
      current_status: currentContribution ? {
        id: currentContribution.id,
        contribution_type: currentContribution.contribution_type,
        created_at: currentContribution.created_at,
        expires_at: currentContribution.expires_at,
        user: {
          id: currentContribution.user.id,
          name: currentContribution.user.name,
          profile_picture: currentContribution.user.profile_picture,
        },
        validations,
        reports,
        can_validate: currentContribution.user_id !== req.user.id,
      } : null,
    };

    return res.status(200).json({
      status: 'success',
      data: {
        poi: formattedPoi,
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

module.exports = {
  getNearbyPOIs,
  getPOIById,
  getPOIContributionHistory,
}; 