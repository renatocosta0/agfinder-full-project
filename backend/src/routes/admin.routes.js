/**
 * Admin routes for the AGFINDER application
 * Provides endpoints for system administration and data management
 */

const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const poiSyncService = require('../services/poiSync.service');

// Legacy import route removed: scripts/importAngolaData no longer exists

/**
 * @swagger
 * /api/admin/pois/sync-region:
 *   post:
 *     summary: Trigger POI sync for a specific region
 *     description: Calls syncRegionIfNeeded to synchronize POIs around the provided coordinates.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               radius:
 *                 type: number
 *                 description: Radius in kilometers (default 5)
 *               priority:
 *                 type: string
 *                 enum: [high, medium, low]
 *               types:
 *                 type: array
 *                 description: Optional list of POI types to sync (defaults to all)
 *                 items:
 *                   type: string
 *                   enum: [atm, gasstation]
 *               force:
 *                 type: boolean
 *                 description: Force update even if region is considered fresh
 *     responses:
 *       200:
 *         description: Sync executed
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/pois/sync-region', authenticate, isAdmin, async (req, res) => {
  try {
    const { lat, lng, radius = 5, priority = 'medium', types, force = false } = req.body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ success: false, message: 'lat and lng must be numbers' });
    }
    const result = await poiSyncService.syncRegionIfNeeded(lat, lng, radius, priority, !!force, types);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('Error syncing POI region:', error);
    return res.status(500).json({ success: false, message: 'Failed to sync region', error: error.message });
  }
});

/**
 * @swagger
 * /api/admin/pois/sync-luanda:
 *   post:
 *     summary: Trigger Luanda-only POI sync job (grid or hotspots)
 *     description: Runs a progressive Luanda grid sync or curated hotspots sync. Use types to restrict to specific POI categories.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [grid, hotspots]
 *                 description: grid (default) runs progressive grid; hotspots runs curated municipalities/bairros
 *               tilesPerRun:
 *                 type: integer
 *                 description: Number of tiles to process (grid mode only)
 *               radiusKm:
 *                 type: number
 *                 description: Radius in kilometers for each tile
 *               types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [atm, gasstation]
 *                 description: Optional list of POI types to sync
 *     responses:
 *       200:
 *         description: Job executed
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/pois/sync-luanda', authenticate, isAdmin, async (req, res) => {
  try {
    const { mode = 'grid', tilesPerRun = 15, radiusKm = 8, types } = req.body || {};
    if (mode === 'hotspots') {
      const result = await poiSyncService.syncLuandaHotspots(radiusKm, types);
      return res.status(200).json({ success: true, data: { mode, ...result } });
    }
    const result = await poiSyncService.syncLuandaGridProgressively(tilesPerRun, radiusKm, types);
    return res.status(200).json({ success: true, data: { mode, ...result } });
  } catch (error) {
    logger.error('Error running Luanda sync job:', error);
    return res.status(500).json({ success: false, message: 'Failed to run Luanda sync job', error: error.message });
  }
});

/**
 * @swagger
 * /api/admin/pois/sync-stats:
 *   get:
 *     summary: Get POI sync stats
 *     description: Returns in-memory stats for active regions, sync history size, and Google queue stats.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activeRegions:
 *                       type: integer
 *                     syncHistory:
 *                       type: integer
 *                     queueStats:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/pois/sync-stats', authenticate, isAdmin, async (req, res) => {
  try {
    const stats = poiSyncService.getSyncStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error getting sync stats:', error);
    return res.status(500).json({ success: false, message: 'Failed to get sync stats', error: error.message });
  }
});

module.exports = router; 