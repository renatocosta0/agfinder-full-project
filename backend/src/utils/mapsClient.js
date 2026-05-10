/**
 * Google Maps API Client
 * Enhanced with circuit breaker and monitoring for resilience
 * 
 * IMPORTANTE: Este cliente foi adaptado para a nova arquitetura e deve ser
 * utilizado EXCLUSIVAMENTE pelos jobs cron (pois-collector.js, etc.), não
 * para responder requisições em tempo real da API. Todas as consultas ao
 * Google Maps API devem ser feitas de forma assíncrona pelos jobs.
 * 
 * As requisições da API para o usuário final devem usar o banco de dados local.
 */

const axios = require('axios');
const logger = require('./logger');
const { createCircuitBreaker, createCacheFallback } = require('./circuitBreaker');
const monitoring = require('./monitoring');
const cacheService = require('../services/cache.service');

// Base URL for Google Maps API
const MAPS_BASE_URL = 'https://maps.googleapis.com/maps/api';

// Create axios instance with default config
const axiosInstance = axios.create({
  timeout: 8000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Circuit breakers for different API endpoints
const circuitBreakers = {
  nearbySearch: createCircuitBreaker('google-places-nearby', {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    requestTimeout: 10000 // 10 seconds
  }),
  
  placeDetails: createCircuitBreaker('google-places-details', {
    failureThreshold: 3,
    resetTimeout: 30000,
    requestTimeout: 10000
  }),
  
  textSearch: createCircuitBreaker('google-places-text', {
    failureThreshold: 3,
    resetTimeout: 30000,
    requestTimeout: 10000
  }),
  
  geocode: createCircuitBreaker('google-geocode', {
    failureThreshold: 3,
    resetTimeout: 30000,
    requestTimeout: 10000
  })
};

// Register cache fallbacks
circuitBreakers.nearbySearch.registerFallback(
  createCacheFallback(async (context) => {
    const { location, radius, type } = context;
    if (!location) return null;
    
    // Try to find any previously cached results for this general area
    const [lat, lng] = location.split(',').map(parseFloat);
    const cacheKey = `pois:${type}:${lat.toFixed(2)}_${lng.toFixed(2)}_*`;
    const keys = await cacheService.redisClient.keys(cacheKey);
    
    if (keys.length > 0) {
      // Use the first matching key
      return await cacheService.get(keys[0]);
    }
    return null;
  })
);

circuitBreakers.placeDetails.registerFallback(
  createCacheFallback(async (context) => {
    const { place_id } = context;
    if (!place_id) return null;
    
    return await cacheService.get(`poi:detail:${place_id}`);
  })
);

/**
 * Execute a Google Maps API request with circuit breaker protection
 * @param {string} endpoint - API endpoint
 * @param {string} circuitBreakerKey - Circuit breaker to use
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} API response
 */
async function executeRequest(endpoint, circuitBreakerKey, params) {
  // Build request URL
  const url = `${MAPS_BASE_URL}${endpoint}`;
  
  // Track API quota
  const apiType = circuitBreakerKey.replace('google-', '').split('-')[0];
  await monitoring.trackApiQuota(apiType);
  
  // Use circuit breaker to execute request
  return circuitBreakers[circuitBreakerKey].execute(
    async () => {
      try {
        const response = await axiosInstance.get(url, { params });
        
        // Check for API errors in the response
        if (response.data.status === 'OVER_QUERY_LIMIT') {
          const error = new Error('Google API quota exceeded');
          error.isQuotaError = true;
          error.response = response;
          throw error;
        } else if (response.data.status === 'REQUEST_DENIED') {
          const error = new Error('Google API request denied');
          error.response = response;
          throw error;
        } else if (response.data.status === 'INVALID_REQUEST') {
          const error = new Error('Google API invalid request');
          error.response = response;
          throw error;
        }
        
        return response;
      } catch (error) {
        // Track the error
        const endpoint = url.replace(MAPS_BASE_URL, '');
        monitoring.trackError(endpoint, error, { params });
        
        // Check for quota errors
        if (error.response && error.response.status === 429) {
          error.isQuotaError = true;
        }
        
        throw error;
      }
    },
    [],
    params // Context for fallback
  );
}

/**
 * Perform a nearby search for places
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} Nearby search results
 */
async function nearbySearch(params) {
  return executeRequest('/place/nearbysearch/json', 'nearbySearch', params);
}

/**
 * Get details for a specific place
 * @param {Object} params - Place details parameters
 * @returns {Promise<Object>} Place details
 */
async function placeDetails(params) {
  return executeRequest('/place/details/json', 'placeDetails', params);
}

/**
 * Perform a text search for places
 * @param {Object} params - Text search parameters
 * @returns {Promise<Object>} Text search results
 */
async function textSearch(params) {
  return executeRequest('/place/textsearch/json', 'textSearch', params);
}

/**
 * Geocode an address or location
 * @param {Object} params - Geocoding parameters
 * @returns {Promise<Object>} Geocoding results
 */
async function geocode(params) {
  return executeRequest('/geocode/json', 'geocode', params);
}

module.exports = {
  nearbySearch,
  placeDetails,
  textSearch,
  geocode,
  // Export circuit breakers for health monitoring
  circuitBreakers
};