const logger = require('../utils/logger');
const { PointOfInterest, sequelize } = require('../models');
const googleMapsService = require('../services/googleMaps.service');

/**
 * Enrich top POIs with Google Place Details
 * Strategy:
 * - Prefer POIs missing key fields in google_data (rating, user_ratings_total, opening_hours)
 * - Or POIs with stale last_sync_at
 * - Limit batch size per run to control API usage
 */
async function runEnrichment(limit = 50) {
  logger.info(`Starting POI details enrichment job (limit=${limit})`);
  try {
    // Find candidates: missing rating or user_ratings_total or stale (older than 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Using raw SQL to check json fields stored as TEXT via getter/setter
    const candidates = await sequelize.query(
      `SELECT id, google_place_id
       FROM "points_of_interest"
       WHERE (
         (google_data IS NULL)
         OR (google_data NOT LIKE '%rating%')
         OR (google_data NOT LIKE '%user_ratings_total%')
       )
       OR (last_sync_at IS NULL OR last_sync_at < :cutoff)
       ORDER BY updated_at ASC
       LIMIT :limit`,
      {
        replacements: { cutoff: fourteenDaysAgo, limit },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!candidates.length) {
      logger.info('No POIs need enrichment at this time');
      return { enriched: 0 };
    }

    let enriched = 0;
    for (const row of candidates) {
      try {
        const poi = await PointOfInterest.findByPk(row.id);
        if (!poi) continue;

        const details = await googleMapsService.getPlaceDetails(poi.google_place_id);
        if (details) {
          const gd = poi.google_data || {};
          const newGoogleData = {
            ...gd,
            rating: details.rating ?? gd.rating,
            user_ratings_total: details.user_ratings_total ?? gd.user_ratings_total,
            opening_hours: details.opening_hours ?? gd.opening_hours,
            types: details.types ?? gd.types,
            formatted_address: details.formatted_address ?? gd.formatted_address,
            updated_with_details_at: new Date().toISOString(),
          };

          await poi.update({
            name: details.name || poi.name,
            address: details.vicinity || details.formatted_address || poi.address,
            google_data: newGoogleData,
            last_sync_at: new Date(),
          });
          enriched += 1;
        }
        // small delay to be courteous to API (details has its own quota)
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        logger.error(`Failed to enrich POI ${row.id}:`, err);
      }
    }

    logger.info(`POI details enrichment completed. Enriched: ${enriched}/${candidates.length}`);
    return { enriched, totalCandidates: candidates.length };
  } catch (error) {
    logger.error('POI details enrichment job error:', error);
    return { enriched: 0, error: error.message };
  }
}

module.exports = {
  runEnrichment,
};
