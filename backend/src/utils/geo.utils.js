/**
 * Geolocation utility functions
 * Optimized for the AGFINDER context in Angola
 */

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param {number} lat1 - Latitude of first point in degrees
 * @param {number} lon1 - Longitude of first point in degrees
 * @param {number} lat2 - Latitude of second point in degrees
 * @param {number} lon2 - Longitude of second point in degrees
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert latitude and longitude from degrees to radians
  const radLat1 = (Math.PI * lat1) / 180;
  const radLon1 = (Math.PI * lon1) / 180;
  const radLat2 = (Math.PI * lat2) / 180;
  const radLon2 = (Math.PI * lon2) / 180;

  // Haversine formula
  const dLat = radLat2 - radLat1;
  const dLon = radLon2 - radLon1;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Earth's radius in kilometers
  const R = 6371;
  
  // Distance in kilometers
  return R * c;
}

/**
 * Validates if coordinates are within valid ranges
 * @param {number} lat - Latitude in degrees
 * @param {number} lng - Longitude in degrees
 * @returns {boolean} True if coordinates are valid
 */
function isValidCoordinate(lat, lng) {
  // Latitude must be between -90 and 90
  // Longitude must be between -180 and 180
  return (
    !isNaN(lat) && 
    !isNaN(lng) && 
    lat >= -90 && 
    lat <= 90 && 
    lng >= -180 && 
    lng <= 180
  );
}

/**
 * Calculate bounds from a center point and radius
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusInKm - Radius in kilometers
 * @returns {Object} Bounds object with southwest and northeast points
 */
function calculateBounds(lat, lng, radiusInKm) {
  // Approximately 0.009 degrees per kilometer for latitude
  // Longitude degrees per km varies by latitude
  const latDelta = radiusInKm * 0.009;
  const lngDelta = radiusInKm * 0.009 / Math.cos((Math.PI * lat) / 180);
  
  return {
    southwest: {
      lat: lat - latDelta,
      lng: lng - lngDelta
    },
    northeast: {
      lat: lat + latDelta,
      lng: lng + lngDelta
    }
  };
}

/**
 * Calculate a bounding box from a center point and radius (alternative format)
 * Useful for more efficient database queries
 * @param {number} centerLat - Center latitude in degrees
 * @param {number} centerLng - Center longitude in degrees
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} Bounding box with minLat, maxLat, minLng, maxLng
 */
function calculateBoundingBox(centerLat, centerLng, radiusKm) {
  // Quick approximation: 1 degree of latitude ~= 111 km
  const latDiff = radiusKm / 111.0;
  
  // 1 degree of longitude ~= 111 * cos(latitude) km
  const lngFactor = Math.cos(centerLat * Math.PI / 180);
  const lngDiff = radiusKm / (111.0 * lngFactor);
  
  return {
    minLat: centerLat - latDiff,
    maxLat: centerLat + latDiff,
    minLng: centerLng - lngDiff,
    maxLng: centerLng + lngDiff
  };
}

/**
 * Gets a geohash-like string for a location and radius (for caching)
 * @param {number} lat - Latitude in degrees
 * @param {number} lng - Longitude in degrees 
 * @param {number} radiusInMeters - Radius in meters
 * @returns {string} Location hash for caching
 */
function geoHashForCaching(lat, lng, radiusInMeters) {
  // Precision based on radius
  let precision = 5; // Default precision
  
  if (radiusInMeters <= 1000) {
    precision = 7; // Very precise for small radius
  } else if (radiusInMeters <= 5000) {
    precision = 6; // More precise for medium radius
  } else if (radiusInMeters <= 20000) {
    precision = 4; // Less precise for large radius
  } else {
    precision = 3; // Low precision for very large radius
  }
  
  // Round coordinates based on precision
  const latRounded = lat.toFixed(precision);
  const lngRounded = lng.toFixed(precision);
  
  // Create hash string
  return `${latRounded}_${lngRounded}_${Math.round(radiusInMeters / 1000)}km`;
}

/**
 * Determine if a point is within Angola borders (approximate)
 * @param {number} lat - Latitude in degrees
 * @param {number} lng - Longitude in degrees
 * @returns {boolean} True if the point is likely within Angola
 */
function isInAngola(lat, lng) {
  // Approximate bounding box for Angola
  const bounds = {
    north: -4.3, // Northern border
    south: -18.0, // Southern border
    west: 11.5, // Western border
    east: 24.0, // Eastern border
  };
  
  return (
    lat <= bounds.north &&
    lat >= bounds.south &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

/**
 * Adapts search radius based on location and network conditions
 * @param {number} lat - Latitude in degrees 
 * @param {number} lng - Longitude in degrees
 * @param {number} initialRadius - Initial radius in meters
 * @param {number} currentResults - Number of results found so far
 * @returns {number} Adapted radius in meters
 */
function adaptiveRadiusStrategy(lat, lng, initialRadius, currentResults) {
  // Base expansion factor based on current results
  let expansionFactor = 1;
  
  if (currentResults === 0) {
    expansionFactor = 3; // Triple the radius if no results
  } else if (currentResults < 5) {
    expansionFactor = 2; // Double the radius if few results
  }
  
  // Adjust based on population density region
  const isInLuanda = 
    lat > -9.0 && lat < -8.7 &&
    lng > 13.1 && lng < 13.4;
    
  if (isInLuanda) {
    // Smaller radius in dense urban areas
    return Math.min(initialRadius * expansionFactor, 15000);
  } else {
    // Larger radius in less dense areas
    return Math.min(initialRadius * expansionFactor * 1.5, 50000);
  }
}

/**
 * Format coordinates to a standard format
 * @param {Object|string|Array} location - Location in various formats
 * @returns {Object} Standardized location object with lat and lng
 */
function formatCoordinates(location) {
  // Handle string format "lat,lng"
  if (typeof location === 'string') {
    const [lat, lng] = location.split(',').map(Number);
    return { lat, lng };
  }
  
  // Handle array format [lng, lat] (GeoJSON order)
  if (Array.isArray(location)) {
    return { lat: location[1], lng: location[0] };
  }
  
  // Handle object format with different property names
  if (typeof location === 'object') {
    const lat = location.lat || location.latitude;
    const lng = location.lng || location.longitude;
    
    if (lat !== undefined && lng !== undefined) {
      return { lat: Number(lat), lng: Number(lng) };
    }
  }
  
  throw new Error('Invalid location format');
}

/**
 * Checks if a point is within a polygon (ray casting algorithm)
 * @param {number} lat - Latitude of point in degrees
 * @param {number} lng - Longitude of point in degrees
 * @param {Array} polygon - Array of points [lat, lng] forming the polygon
 * @returns {boolean} True if the point is inside the polygon
 */
function isPointInPolygon(lat, lng, polygon) {
  // Ray casting algorithm implementation
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];
    
    const intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Divides a large area into smaller cells for efficient processing
 * Useful for dividing large regions into smaller parts for synchronization
 * @param {Object} bounds - Area bounds (minLat, maxLat, minLng, maxLng)
 * @param {number} rows - Number of rows to divide
 * @param {number} cols - Number of columns to divide
 * @returns {Array} Array of cells, each with its own bounds
 */
function gridDivide(bounds, rows, cols) {
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const latStep = (maxLat - minLat) / rows;
  const lngStep = (maxLng - minLng) / cols;
  
  const cells = [];
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellMinLat = minLat + (r * latStep);
      const cellMaxLat = minLat + ((r + 1) * latStep);
      const cellMinLng = minLng + (c * lngStep);
      const cellMaxLng = minLng + ((c + 1) * lngStep);
      
      const centerLat = (cellMinLat + cellMaxLat) / 2;
      const centerLng = (cellMinLng + cellMaxLng) / 2;
      
      cells.push({
        bounds: {
          minLat: cellMinLat,
          maxLat: cellMaxLat,
          minLng: cellMinLng,
          maxLng: cellMaxLng
        },
        center: {
          lat: centerLat,
          lng: centerLng
        },
        id: `cell_${r}_${c}`
      });
    }
  }
  
  return cells;
}

/**
 * Calculates appropriate time-to-live (TTL) for data based on density
 * Regions with more POIs are updated more frequently
 * @param {number} poiCount - Number of POIs in the region
 * @param {number} areaKm2 - Area in square kilometers
 * @returns {number} TTL in seconds
 */
function calculateDataTTL(poiCount, areaKm2) {
  // POI density per km²
  const density = poiCount / areaKm2;
  
  if (density > 10) {
    // Very dense areas (urban centers) - 12 hours
    return 12 * 60 * 60;
  } else if (density > 5) {
    // Dense areas - 24 hours
    return 24 * 60 * 60;
  } else if (density > 1) {
    // Moderate areas - 3 days
    return 3 * 24 * 60 * 60;
  } else {
    // Rural/low density areas - 7 days
    return 7 * 24 * 60 * 60;
  }
}

/**
 * Builds a SQL WHERE clause for filtering by geographic region
 * @param {string} latField - Name of latitude field
 * @param {string} lngField - Name of longitude field
 * @param {number} centerLat - Center latitude
 * @param {number} centerLng - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} WHERE clause for Sequelize
 */
function buildGeoWhereClause(latField, lngField, centerLat, centerLng, radiusKm) {
  const { Op } = require('sequelize');
  const box = calculateBoundingBox(centerLat, centerLng, radiusKm);
  
  return {
    [latField]: {
      [Op.between]: [box.minLat, box.maxLat]
    },
    [lngField]: {
      [Op.between]: [box.minLng, box.maxLng]
    }
  };
}

module.exports = {
  calculateDistance,
  isValidCoordinate,
  calculateBounds,
  calculateBoundingBox,
  geoHashForCaching,
  isInAngola,
  adaptiveRadiusStrategy,
  formatCoordinates,
  isPointInPolygon,
  gridDivide,
  calculateDataTTL,
  buildGeoWhereClause
}; 