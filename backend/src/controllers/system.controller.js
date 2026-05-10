/**
 * Controller para funcionalidades do sistema
 */

const httpStatus = require('http-status');
const queueService = require('../services/queue.service');
const poiSyncService = require('../services/poiSync.service');
const logger = require('../utils/logger');

/**
 * Obter estatísticas do sistema
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 * @returns {Promise<Object>} - Estatísticas do sistema
 */
const getSystemStats = async (req, res) => {
  try {
    // Obter estatísticas de sincronização de POIs
    const syncStats = poiSyncService.getSyncStats();
    
    // Construir objeto de resposta
    const stats = {
      serverTime: new Date().toISOString(),
      poi: {
        sync: {
          activeRegions: syncStats.activeRegions,
          regionsInHistory: syncStats.syncHistory,
        },
        queue: syncStats.queueStats,
      },
      memory: {
        usage: process.memoryUsage(),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100, // MB
      },
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'não disponível',
    };

    return res.status(httpStatus.OK).json(stats);
  } catch (error) {
    logger.error('Erro ao obter estatísticas do sistema:', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      message: 'Erro ao obter estatísticas do sistema',
      error: error.message,
    });
  }
};

module.exports = {
  getSystemStats,
}; 