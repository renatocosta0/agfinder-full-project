const { Client } = require('@googlemaps/google-maps-services-js');
const { PointOfInterest, sequelize } = require('../models');
const logger = require('../utils/logger');

// Inicializar o cliente do Google Maps
const client = new Client({});

// Tipos de POIs suportados pelo aplicativo (definidos manualmente)
const SUPPORTED_POI_TYPES = {
  atm: 'atm',
  gasstation: 'gas_station'
};

/**
 * Busca POIs do Google Maps e salva no banco de dados
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radius - Raio em km
 * @param {string} type - Tipo de POI ('atm' ou 'gasstation')
 * @returns {Promise<Array>} - Array de POIs salvos
 */
const fetchAndSavePOIs = async (lat, lng, radius, type) => {
  try {
    if (!SUPPORTED_POI_TYPES[type]) {
      throw new Error(`Tipo de POI não suportado: ${type}`);
    }

    // Converter raio de km para metros (máximo 50km)
    const radiusInMeters = Math.min(50000, radius * 1000);

    logger.info(`Buscando ${type} próximos a ${lat},${lng} em um raio de ${radius}km`);

    // Fazer requisição para a API do Google Maps
    const response = await client.placesNearby({
      params: {
        location: { lat, lng },
        radius: radiusInMeters,
        type: SUPPORTED_POI_TYPES[type],
        key: process.env.GOOGLE_MAPS_API_KEY
      },
      timeout: 5000 // 5 segundos de timeout
    });

    if (response.data.status !== 'OK') {
      logger.error(`Erro na API do Google Maps: ${response.data.status}`);
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const places = response.data.results;
    logger.info(`Encontrados ${places.length} lugares do tipo ${type}`);

    // Preparar array de POIs para inserção em massa
    const poisToCreate = places.map(place => ({
      poi_type: type,
      google_place_id: place.place_id,
      name: place.name,
      address: place.vicinity,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      google_data: JSON.stringify({
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        types: place.types,
        open_now: place.opening_hours?.open_now
      })
    }));

    // Usar uma transação para garantir consistência
    const transaction = await sequelize.transaction();

    try {
      // Para cada POI, inserir se não existir ou atualizar se já existir
      const createdPois = await Promise.all(
        poisToCreate.map(async (poi) => {
          const [instance, created] = await PointOfInterest.findOrCreate({
            where: { google_place_id: poi.google_place_id },
            defaults: poi,
            transaction
          });

          // Se já existir, atualizar os dados
          if (!created) {
            await instance.update({
              name: poi.name,
              address: poi.address,
              latitude: poi.latitude,
              longitude: poi.longitude,
              google_data: poi.google_data
            }, { transaction });
          }

          return instance;
        })
      );

      await transaction.commit();
      logger.info(`Salvos ${createdPois.length} POIs no banco de dados.`);
      return createdPois;
    } catch (error) {
      await transaction.rollback();
      logger.error('Erro ao salvar POIs no banco de dados:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Erro ao buscar e salvar POIs:', error);
    throw error;
  }
};

/**
 * Busca detalhes de um POI específico no Google Maps
 * @param {string} placeId - ID do lugar no Google Maps
 * @returns {Promise<Object>} - Detalhes do POI
 */
const fetchPlaceDetails = async (placeId) => {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: ['name', 'vicinity', 'geometry', 'formatted_address', 'opening_hours', 'photos', 'rating', 'user_ratings_total'],
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status !== 'OK') {
      logger.error(`Erro na API do Google Maps (detalhes): ${response.data.status}`);
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    return response.data.result;
  } catch (error) {
    logger.error(`Erro ao buscar detalhes do lugar ${placeId}:`, error);
    throw error;
  }
};

/**
 * Sincroniza POIs de uma região específica
 * Útil para ser executado em um job periódico
 * @param {number} lat - Latitude central
 * @param {number} lng - Longitude central
 * @param {number} radius - Raio em km
 */
const syncRegionPOIs = async (lat, lng, radius) => {
  try {
    logger.info(`Iniciando sincronização de POIs na região ${lat},${lng} (raio: ${radius}km)`);
    
    // Buscar e salvar ATMs
    await fetchAndSavePOIs(lat, lng, radius, 'atm');
    
    // Buscar e salvar postos de gasolina
    await fetchAndSavePOIs(lat, lng, radius, 'gasstation');
    
    logger.info('Sincronização de POIs concluída com sucesso');
  } catch (error) {
    logger.error('Erro durante a sincronização de POIs:', error);
    throw error;
  }
};

module.exports = {
  fetchAndSavePOIs,
  fetchPlaceDetails,
  syncRegionPOIs
}; 