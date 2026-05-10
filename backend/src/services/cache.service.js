/**
 * Cache Service utilizing Redis for efficient geospatial data caching
 */

const Redis = require('ioredis');
const zlib = require('zlib');
const { promisify } = require('util');
const logger = require('../utils/logger');
const { CACHE_CONFIG } = require('../config/maps.config');

// Promisify zlib functions
const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

// Initialize Redis client (optional — falls back to memory-only if Redis is not configured)
let redisClient;
const hasRedisConfig = process.env.REDIS_URL || process.env.REDIS_HOST;

if (hasRedisConfig) {
  try {
    redisClient = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL)
      : new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 3000);
          logger.info(`Redis connection retry in ${delay}ms (attempt ${times})`);
          return delay;
        }
      });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis server');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error.message || error);
    });
  } catch (e) {
    logger.warn('Failed to initialize Redis client, using memory cache only:', e.message || e);
    redisClient = {
      get: async () => null,
      set: async () => 'OK',
      setex: async () => 'OK',
      del: async () => 0,
      keys: async () => [],
      ttl: async () => -1,
      expire: async () => 1,
      hIncrBy: async () => 1,
      hGet: async () => null,
      hSet: async () => 1,
      hGetAll: async () => ({}),
      hDel: async () => 0,
    };
  }
} else {
  logger.info('Redis not configured (REDIS_URL/REDIS_HOST missing). Using memory cache only.');
  // Dummy client so downstream consumers don't crash
  redisClient = {
    get: async () => null,
    set: async () => 'OK',
    setex: async () => 'OK',
    del: async () => 0,
    keys: async () => [],
    ttl: async () => -1,
    expire: async () => 1,
    hIncrBy: async () => 1,
    hGet: async () => null,
    hSet: async () => 1,
    hGetAll: async () => ({}),
    hDel: async () => 0,
  };
}

// Also maintain a memory cache for ultra-fast access to frequent items
const memoryCache = new Map();
const memoryCacheTTL = new Map();

/**
 * Set a value in cache with optional compression
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttl - Time to live in seconds
 * @param {boolean} skipMemCache - Skip memory cache (for very large objects)
 * @returns {Promise<boolean>} Success indicator
 */
async function set(key, value, ttl, skipMemCache = false) {
  try {
    // Prepare data
    const valueStr = JSON.stringify(value);

    // Determine if compression should be used
    const shouldCompress = CACHE_CONFIG.compression.enabled &&
      valueStr.length > CACHE_CONFIG.compression.threshold;

    // Create cache item wrapper
    const cacheItem = {
      data: value,
      meta: {
        timestamp: Date.now(),
        compressed: shouldCompress,
      }
    };

    let dataToStore = JSON.stringify(cacheItem);

    // Compress if needed
    if (shouldCompress) {
      const compressedData = await gzipAsync(dataToStore);
      dataToStore = compressedData.toString('base64');

      logger.debug(`Compressed cache data for ${key}: ${valueStr.length} -> ${dataToStore.length} bytes`);
    }

    // Store in Redis
    if (redisClient) {
      if (ttl) {
        await redisClient.setex(key, ttl, dataToStore);
      } else {
        await redisClient.set(key, dataToStore);
      }
    }

    // Also store in memory cache if not too big
    if (!skipMemCache && valueStr.length < 10000) {
      memoryCache.set(key, cacheItem);

      if (ttl) {
        memoryCacheTTL.set(key, Date.now() + (ttl * 1000));

        // Set up automatic cleanup after TTL
        setTimeout(() => {
          memoryCache.delete(key);
          memoryCacheTTL.delete(key);
        }, ttl * 1000);
      }
    }

    return true;
  } catch (error) {
    logger.error(`Error setting cache key ${key}:`, error);
    return false;
  }
}

/**
 * Get a value from cache
 * @param {string} key - Cache key to retrieve
 * @returns {Promise<any>} Cached value or null if not found
 */
async function get(key) {
  try {
    // Try memory cache first (fastest)
    if (memoryCache.has(key)) {
      const now = Date.now();
      const expiry = memoryCacheTTL.get(key);

      // Check if expired in memory cache
      if (!expiry || now < expiry) {
        const cachedItem = memoryCache.get(key);
        logger.debug(`Memory cache hit for ${key}`);
        return cachedItem.data;
      } else {
        // Expired, clean up memory cache
        memoryCache.delete(key);
        memoryCacheTTL.delete(key);
      }
    }

    // Try Redis cache
    if (!redisClient) {
      return null;
    }
    const data = await redisClient.get(key);
    if (!data) {
      return null;
    }

    logger.debug(`Redis cache hit for ${key}`);

    // Parse cached item
    let cachedItem;

    try {
      // Try to parse as regular JSON first
      cachedItem = JSON.parse(data);
    } catch (parseError) {
      // If parsing fails, it might be compressed data
      try {
        const decompressed = await gunzipAsync(Buffer.from(data, 'base64'));
        cachedItem = JSON.parse(decompressed.toString());
      } catch (decompressError) {
        logger.error(`Error decompressing cache data for ${key}:`, decompressError);
        return null;
      }
    }

    // Store in memory cache for faster access next time
    if (cachedItem && cachedItem.data) {
      // Get TTL from Redis
      const ttl = redisClient ? await redisClient.ttl(key) : -1;

      if (ttl > 0) {
        memoryCache.set(key, cachedItem);
        memoryCacheTTL.set(key, Date.now() + (ttl * 1000));
      }

      return cachedItem.data;
    }

    return null;
  } catch (error) {
    logger.error(`Error getting cache key ${key}:`, error);
    return null;
  }
}

/**
 * Delete a value from cache
 * @param {string} key - Cache key to delete
 * @returns {Promise<boolean>} Success indicator
 */
async function del(key) {
  try {
    // Remove from memory cache
    memoryCache.delete(key);
    memoryCacheTTL.delete(key);

    // Remove from Redis
    if (redisClient) {
      await redisClient.del(key);
    }

    return true;
  } catch (error) {
    logger.error(`Error deleting cache key ${key}:`, error);
    return false;
  }
}

/**
 * Calculate the appropriate TTL for geographic data
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} resultsCount - Number of results found
 * @returns {number} TTL in seconds
 */
function calculateGeoTTL(lat, lng, resultsCount) {
  // Base TTL varies by density
  let baseTTL;

  if (resultsCount > 20) {
    // High density area
    baseTTL = CACHE_CONFIG.ttl.highDensity;
  } else if (resultsCount > 5) {
    // Medium density area
    baseTTL = CACHE_CONFIG.ttl.mediumDensity;
  } else {
    // Low density area
    baseTTL = CACHE_CONFIG.ttl.lowDensity;
  }

  // Luanda city center has faster-changing data, reduce TTL
  const isLuandaCenter =
    lat > -8.85 && lat < -8.8 &&
    lng > 13.22 && lng < 13.25;

  if (isLuandaCenter) {
    return Math.floor(baseTTL * 0.5); // 50% TTL for city center
  }

  return baseTTL;
}

/**
 * Delete all cache keys matching a pattern
 * @param {string} pattern - Redis key pattern to match
 * @returns {Promise<number>} Number of keys deleted
 */
async function deleteByPattern(pattern) {
  try {
    // Find keys matching pattern
    if (!redisClient) {
      return 0;
    }
    const keys = await redisClient.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    // Delete keys from Redis
    if (redisClient) {
      await redisClient.del(...keys);
    }

    // Also delete from memory cache
    keys.forEach(key => {
      memoryCache.delete(key);
      memoryCacheTTL.delete(key);
    });

    logger.info(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
    return keys.length;
  } catch (error) {
    logger.error(`Error deleting cache keys by pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Invalidate all POI data within a geographic region
 * @param {number} lat - Center latitude of region
 * @param {number} lng - Center longitude of region
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Promise<number>} Number of cache entries invalidated
 */
async function invalidateRegion(lat, lng, radiusKm) {
  try {
    // Create patterns for different radius values
    const patterns = [];

    // Round coordinates to different precision levels to match cache keys
    // geoHashForCaching may use precision up to 7 depending on radius
    const precisions = [1, 2, 3, 4, 5, 6, 7];

    for (const precision of precisions) {
      const latRounded = lat.toFixed(precision);
      const lngRounded = lng.toFixed(precision);
      // Match keys generated by places.service: `pois:db:${type}:${lat_lng_${radius}km}:p${page}:l${limit}`
      patterns.push(`pois:db:*:${latRounded}_${lngRounded}_*`);
      // Fallback for any other namespaces under pois:
      patterns.push(`pois:*:${latRounded}_${lngRounded}_*`);
    }

    // Delete all matching keys
    let totalDeleted = 0;
    for (const pattern of patterns) {
      const deleted = await deleteByPattern(pattern);
      totalDeleted += deleted;
    }

    logger.info(`Invalidated ${totalDeleted} POI cache entries for region around ${lat},${lng}`);
    return totalDeleted;
  } catch (error) {
    logger.error(`Error invalidating region cache:`, error);
    return 0;
  }

}

/**
 * Prefetch and cache POI data for popular regions
 * @returns {Promise<void>}
 */
async function prefetchPopularRegions() {
  // This would be called by a scheduled job
  if (!CACHE_CONFIG.prefetch.enabled) {
    return;
  }

  logger.info(`Starting prefetch for ${CACHE_CONFIG.prefetch.popularRegions.length} popular regions`);

  // Implementation would call places service to fetch and cache data
  // This is just a placeholder - actual implementation would depend on placesService
}

// Export the service
module.exports = {
  set,
  get,
  del,
  deleteByPattern,
  invalidateRegion,
  prefetchPopularRegions,
  calculateGeoTTL,
  redisClient
}; 