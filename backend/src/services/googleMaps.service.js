/**
 * Google Maps Service
 * Serviço para interações com a API do Google Maps através do mapsClient
 * 
 * IMPORTANTE: Este serviço foi adaptado para a nova arquitetura e deve ser
 * utilizado EXCLUSIVAMENTE pelos jobs cron (pois-collector.js, etc.), não
 * para responder requisições em tempo real da API. Todas as consultas ao
 * Google Maps API devem ser feitas de forma assíncrona pelos jobs.
 * 
 * As requisições da API para o usuário final devem usar o banco de dados local.
 */

const mapsClient = require('../utils/mapsClient');
const logger = require('../utils/logger');
const { POI_TYPES } = require('../config/pois.config');
const { PointOfInterest, sequelize } = require('../models');

/**
 * Synchronize POIs for a specific region
 * @param {number} lat - Latitude of center point
 * @param {number} lng - Longitude of center point
 * @param {number} radius - Radius in kilometers
 * @returns {Promise<number>} Number of POIs synchronized
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const REQUEST_TIMEOUT_MS = 10000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function nearbySearchWithRetry(params, maxRetries = 2) {
  let attempt = 0;
  let delay = 1000;
  // Basic jitter
  const jitter = () => Math.floor(Math.random() * 250);

  while (true) {
    try {
      const resp = await withTimeout(
        mapsClient.nearbySearch(params),
        REQUEST_TIMEOUT_MS,
        'nearbySearch'
      );
      const status = resp?.data?.status;
      if (status === 'OK' || status === 'ZERO_RESULTS' || !status) {
        return resp;
      }
      if (status === 'OVER_QUERY_LIMIT' || status === 'RESOURCE_EXHAUSTED') {
        if (attempt >= maxRetries) throw new Error(`NearbySearch quota limit after ${attempt} retries`);
        logger.warn(`NearbySearch rate limited (attempt ${attempt + 1}/${maxRetries}), backing off ${delay}ms`);
        await sleep(delay + jitter());
        attempt++;
        delay *= 2;
        continue;
      }
      // Other API statuses treated as errors
      throw new Error(`NearbySearch API status: ${status}`);
    } catch (err) {
      // Network/HTTP errors or API errors
      if (attempt >= maxRetries) {
        logger.error(`NearbySearch failed after ${attempt + 1} attempts`, err);
        throw err;
      }
      logger.warn(`NearbySearch error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms`);
      await sleep(delay + jitter());
      attempt++;
      delay *= 2;
    }
  }
}

const syncRegionPOIs = async (lat, lng, radius, types = undefined) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }
    logger.info(`Synchronizing POIs for region: ${lat}, ${lng}, radius: ${radius}km`);

    let totalPOIs = 0;
    const details = [];

    // Convert radius from kilometers to meters for Google Maps API
    const radiusInMeters = radius * 1000;

    // Build list of POI types to sync
    const entries = Object.entries(POI_TYPES).filter(([k]) => {
      if (!types || !Array.isArray(types) || types.length === 0) return true;
      return types.includes(k);
    });

    // Synchronize each selected POI type
    for (const [poiKey, poiConfig] of entries) {
      logger.info(`Syncing ${poiKey} (${poiConfig.googleType}) POIs...`);

      try {
        let pageToken = null;
        let pageIndex = 0;

        const MAX_PAGES = 3;
        do {
          const params = pageToken
            ? { pagetoken: pageToken, key: process.env.GOOGLE_MAPS_API_KEY }
            : {
              location: `${lat},${lng}`,
              radius: radiusInMeters,
              type: poiConfig.googleType,
              key: process.env.GOOGLE_MAPS_API_KEY,
            };

          if (pageToken) {
            // Google requires a short delay before using next_page_token
            await sleep(2000);
          }

          const response = await nearbySearchWithRetry(params);

          const results = response?.data?.results || [];
          logger.info(`Page ${pageIndex} for ${poiKey}: ${results.length} results`);

          if (results.length > 0) {
            // Map results to POI rows
            const rows = results.map((place) => mapPlaceToPOIRow(place, poiKey));

            // Bulk upsert with timeout to avoid hanging on DB
            await withTimeout(
              PointOfInterest.bulkCreate(rows, {
                updateOnDuplicate: [
                  'name',
                  'address',
                  'latitude',
                  'longitude',
                  'poi_type',
                  'google_data',
                  'last_sync_at',
                ],
              }),
              30000,
              'bulkCreate'
            );

            totalPOIs += results.length;
          }

          pageToken = response?.data?.next_page_token || null;
          pageIndex += 1;
        } while (pageToken && pageIndex < MAX_PAGES);

        details.push({
          type: poiKey,
          googleStatus: response?.data?.status || 'UNKNOWN',
          pages: pageIndex,
          added: totalPOIs - (details.reduce((s, d) => s + (d.added || 0), 0)),
        });
      } catch (error) {
        logger.error(`Error fetching ${poiKey} POIs:`, error);
        details.push({ type: poiKey, error: error.message });
        // Continue with other POI types even if one fails
      }

      // If requesting ATMs, also search for bank branches with multiple keywords and fallback to Text Search if needed
      if (poiKey === 'atm' && (!types || (Array.isArray(types) && types.includes('atm')))) {
        const bankKeywords = ['ATM', 'Multicaixa', 'Caixa automático'];
        for (const keyword of bankKeywords) {
          logger.info(`Secondary pass for ATMs: searching banks with keyword "${keyword}"`);
          try {
            let bankPageToken = null;
            let bankPageIndex = 0;
            const MAX_BANK_PAGES = 2;
            do {
              const bankParams = bankPageToken
                ? { pagetoken: bankPageToken, key: process.env.GOOGLE_MAPS_API_KEY }
                : {
                  location: `${lat},${lng}`,
                  radius: radiusInMeters,
                  type: 'bank',
                  keyword,
                  key: process.env.GOOGLE_MAPS_API_KEY,
                };

              if (bankPageToken) await sleep(2000);

              const bankResponse = await nearbySearchWithRetry(bankParams);
              const bankResults = bankResponse?.data?.results || [];
              logger.info(`ATM bank-pass(${keyword}) page ${bankPageIndex}: ${bankResults.length} results`);

              if (bankResults.length > 0) {
                const bankRows = bankResults.map((place) => mapPlaceToPOIRow(place, 'atm'));
                await withTimeout(
                  PointOfInterest.bulkCreate(bankRows, {
                    updateOnDuplicate: ['name', 'address', 'latitude', 'longitude', 'poi_type', 'google_data', 'last_sync_at'],
                  }),
                  30000,
                  'bulkCreate'
                );
                totalPOIs += bankResults.length;
              }

              bankPageToken = bankResponse?.data?.next_page_token || null;
              bankPageIndex += 1;
            } while (bankPageToken && bankPageIndex < MAX_BANK_PAGES);
          } catch (bankErr) {
            logger.error(`Secondary ATM bank-pass error for keyword ${keyword}:`, bankErr);
          }
        }

        // Text Search fallback if overall ATM yield remains low in this tile
        try {
          // Simple heuristic: if less than 10 results were added in this tile for ATM, try textsearch
          // We don't track per-tile adds precisely here, so we run a single text search sweep per tile
          const textKeywords = ['ATM', 'Multicaixa', 'Caixa automático'];
          for (const query of textKeywords) {
            logger.info(`TextSearch fallback for ATMs with query "${query}"`);
            let textPageToken = null;
            let textPageIndex = 0;
            const MAX_TEXT_PAGES = 2;
            do {
              const textParams = textPageToken
                ? { pagetoken: textPageToken, key: process.env.GOOGLE_MAPS_API_KEY }
                : {
                  query,
                  location: `${lat},${lng}`,
                  radius: radiusInMeters,
                  key: process.env.GOOGLE_MAPS_API_KEY,
                };
              if (textPageToken) await sleep(2000);
              const textResp = await withTimeout(
                mapsClient.textSearch(textParams),
                REQUEST_TIMEOUT_MS,
                'textSearch'
              );
              const textResults = textResp?.data?.results || [];
              logger.info(`TextSearch(${query}) page ${textPageIndex}: ${textResults.length} results`);
              if (textResults.length > 0) {
                const rows = textResults.map((place) => mapPlaceToPOIRow(place, 'atm'));
                await withTimeout(
                  PointOfInterest.bulkCreate(rows, {
                    updateOnDuplicate: ['name', 'address', 'latitude', 'longitude', 'poi_type', 'google_data', 'last_sync_at'],
                  }),
                  30000,
                  'bulkCreate'
                );
                totalPOIs += textResults.length;
              }
              textPageToken = textResp?.data?.next_page_token || null;
              textPageIndex += 1;
            } while (textPageToken && textPageIndex < MAX_TEXT_PAGES);
          }
        } catch (tsErr) {
          logger.error('TextSearch fallback error:', tsErr);
        }
      }
    }

    logger.info(`Sync completed. Total POIs synchronized: ${totalPOIs}`);
    return { totalPOIs, details };
  } catch (error) {
    logger.error('Error in syncRegionPOIs:', error);
    throw error;
  }
};

/**
 * Save a POI to the database
 * @param {Object} place - Google Place object
 * @param {string} poiType - Type of POI
 * @returns {Promise<Object>} Created or updated POI
 */
const mapPlaceToPOIRow = (place, poiType) => {
  const lat = place?.geometry?.location?.lat;
  const lng = place?.geometry?.location?.lng;
  return {
    google_place_id: place.place_id,
    name: place.name || '',
    address: place.vicinity || place.formatted_address || '',
    latitude: lat,
    longitude: lng,
    poi_type: poiType,
    google_data: {
      business_status: place.business_status,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      types: place.types,
      open_now: place.opening_hours?.open_now,
    },
    last_sync_at: new Date(),
  };
};

/**
 * Get details for a specific place
 * @param {string} placeId - Google Place ID
 * @returns {Promise<Object>} Place details
 */
const getPlaceDetails = async (placeId) => {
  try {
    const response = await mapsClient.placeDetails({
      place_id: placeId,
      key: process.env.GOOGLE_MAPS_API_KEY
    });

    if (response.data.status === 'OK' && response.data.result) {
      return response.data.result;
    } else {
      throw new Error(`Failed to get place details: ${response.data.status}`);
    }
  } catch (error) {
    logger.error(`Error fetching place details for ${placeId}:`, error);
    throw error;
  }
};

module.exports = {
  syncRegionPOIs,
  getPlaceDetails,
  getQueueStats: () => ({ pending: 0, inFlight: 0 })
};