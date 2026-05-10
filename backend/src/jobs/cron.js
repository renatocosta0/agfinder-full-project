const cron = require('node-cron');
const logger = require('../utils/logger');
const subscriptionService = require('../services/subscription.service');
const bonusService = require('../services/bonus.service');
const backupService = require('../services/backup.service');
const cleanupJob = require('./cleanup.job');
const enrichPoiDetailsJob = require('./enrichPoiDetails.job');
const poiSyncService = require('../services/poiSync.service');
const { CITY_COORDINATES, PRIORITY_CITIES, SYNC_CONFIG } = require('../config/pois.config');

// Initialize all cron jobs
const initJobs = () => {
  // Short-interval expiry scanner for contributions
  const scanInterval = parseInt(process.env.EXPIRE_SCAN_INTERVAL_MINUTES, 10);
  const everyNMinutes = Number.isFinite(scanInterval) && scanInterval > 0 ? `*/${scanInterval} * * * *` : '*/1 * * * *';
  cron.schedule(everyNMinutes, async () => {
    try {
      const { Contribution, sequelize } = require('../models');
      // Ensure underlying table exists before querying (first boot without migrations)
      const qi = sequelize.getQueryInterface();
      const tables = await qi.showAllTables();
      const hasContribTable = tables
        .map(t => (typeof t === 'string' ? t : t.tableName || t.table_name))
        .includes('contributions');

      if (!hasContribTable) {
        return logger.debug('Contributions table not found yet; skipping expiry scan');
      }

      if (Contribution && typeof Contribution.processExpiredContributions === 'function') {
        const count = await Contribution.processExpiredContributions();
        if (count > 0) {
          logger.info(`Expired contributions processed: ${count}`);
        }
      } else {
        logger.debug('processExpiredContributions() not implemented; skipping expiry scan');
      }
    } catch (error) {
      logger.error('Error processing expired contributions:', error);
    }
  });
  // Daily reset via dedicated job is handled by dailyReset.job.js at 23:59

  // Check subscriptions (cron via ENV, default hourly)
  const deactivateCron = process.env.SUBSCRIPTION_DEACTIVATE_CRON || '0 * * * *';
  cron.schedule(deactivateCron, async () => {
    logger.info('Running subscription check job');
    try {
      // Deactivate expired subscriptions; cleanup old ones
      const result = await subscriptionService.deactivateExpiredSubscriptions();
      logger.info(`Subscription deactivation completed: ${result.deactivated || 0} deactivated`);
      const cleanup = await subscriptionService.cleanupOldSubscriptions(false);
      logger.info(`Subscription cleanup completed: ${cleanup.deleted || 0} deleted (dryRun=${cleanup.dryRun})`);
    } catch (error) {
      logger.error('Error in subscription check job:', error);
    }
  });

  // Expire pending transactions past expiry (cron via ENV, default every 15 minutes)
  const pendingExpireCron = process.env.SUBSCRIPTION_PENDING_EXPIRE_CRON || '*/15 * * * *';
  cron.schedule(pendingExpireCron, async () => {
    logger.info('Running pending->expired transition job');
    try {
      const res = await subscriptionService.expirePendingTransactions();
      logger.info(`Pending->expired transition: ${res.expired || 0} updated`);
    } catch (error) {
      logger.error('Error in pending->expired transition job:', error);
    }
  });

  // Purge stale transactions (pending/failed/expired) (cron via ENV, default daily at 03:10)
  const purgeStaleCron = process.env.SUBSCRIPTION_PURGE_STALE_CRON || '10 3 * * *';
  cron.schedule(purgeStaleCron, async () => {
    logger.info('Running stale subscription transactions purge job');
    try {
      const res = await subscriptionService.purgeStaleTransactions(false);
      logger.info(`Stale purge completed: pending=${res.pending || 0}, failed=${res.failed || 0}, expired=${res.expired || 0}`);
    } catch (error) {
      logger.error('Error in stale subscription transactions purge job:', error);
    }
  });

  // Process bonus points every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Running bonus processing job');
    try {
      await bonusService.processUnprocessedBonuses();
      logger.info('Bonus processing completed successfully');
    } catch (error) {
      logger.error('Error in bonus processing job:', error);
    }
  });

  // Daily database backup at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running database backup job');
    try {
      await backupService.performDatabaseBackup();
      logger.info('Database backup completed successfully');
    } catch (error) {
      logger.error('Error in database backup job:', error);
    }
  });
  
  // Daily Angola grid progressive sync at 2:30 AM
  cron.schedule('30 2 * * *', async () => {
    logger.info('Running Angola grid progressive sync job');
    try {
      const result = await poiSyncService.syncAngolaGridProgressively(20, SYNC_CONFIG.defaultRadius);
      logger.info(`Angola grid progressive sync completed. Tiles processed: ${result.processed}/${result.totalTiles}, next cursor: ${result.nextCursor}`);
    } catch (error) {
      logger.error('Error in Angola grid progressive sync job:', error);
    }
  });

  // Daily POI details enrichment at 3:30 AM
  cron.schedule('30 3 * * *', async () => {
    logger.info('Running POI details enrichment job');
    try {
      const result = await enrichPoiDetailsJob.runEnrichment(50);
      logger.info(`POI enrichment completed: enriched ${result.enriched}/${result.totalCandidates || 0}`);
    } catch (error) {
      logger.error('Error in POI details enrichment job:', error);
    }
  });
  
  // Monthly cleanup at 3 AM on the first day of the month
  cron.schedule('0 3 1 * *', async () => {
    logger.info('Running monthly cleanup job');
    try {
      const result = await cleanupJob.performMonthlyCleanup();
      logger.info(`Monthly cleanup completed successfully: ${result.subscriptions} subscriptions, ${result.bonuses} bonuses, ${result.warnings} warnings deleted`);
    } catch (error) {
      logger.error('Error in monthly cleanup job:', error);
    }
  });

  // Weekly Angola POIs update removed; use poiSyncService-based weekly sync below

  // Weekly POI sync at 4 AM every Sunday
  cron.schedule('0 4 * * 0', async () => {
    logger.info('Running weekly POI sync job');
    try {
      // Usar as cidades prioritárias definidas na configuração
      let totalUpdated = 0;
      let totalAdded = 0;
      
      // Sincroniza cada cidade sequencialmente para evitar sobrecarga
      for (const city of PRIORITY_CITIES) {
        try {
          const { lat, lng } = CITY_COORDINATES[city];
          
          logger.info(`Sincronizando POIs para ${city} (${lat}, ${lng})`);
          
          // Usar o novo serviço com prioridade alta para cidades prioritárias
          const result = await poiSyncService.syncRegionIfNeeded(
            lat, 
            lng, 
            SYNC_CONFIG.defaultRadius,
            'high', // Prioridade alta para cidades principais
            true    // Forçar atualização semanal
          );
          
          if (result.updated) {
            totalUpdated++;
            totalAdded += result.added || 0;
            logger.info(`POIs para ${city} atualizados com sucesso. Total: ${result.count}, Novos: ${result.added || 0}`);
          } else {
            logger.info(`POIs para ${city} já estavam atualizados`);
          }
        } catch (cityError) {
          logger.error(`Erro ao sincronizar POIs para ${city}:`, cityError);
          // Continua para a próxima cidade mesmo se houver erro
        }
      }
      
      logger.info(`Weekly POI sync job completed successfully. Cities updated: ${totalUpdated}, new POIs added: ${totalAdded}`);
    } catch (error) {
      logger.error('Error in weekly POI sync job:', error);
    }
  });

  // Daily progressive update for older data at 5 AM
  cron.schedule('0 5 * * *', async () => {
    const correlationId = `prog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    logger.info(`[${correlationId}] Running daily progressive POI update job`);
    try {
      const poiSyncService = require('../services/poiSync.service');

      const BATCH_LIMIT = 20;
      const oldestPois = await poiSyncService.fetchOldestPOIs(BATCH_LIMIT);

      if (!oldestPois || oldestPois.length === 0) {
        logger.info(`[${correlationId}] No POIs found for progressive update`);
        return;
      }

      logger.info(`[${correlationId}] Found ${oldestPois.length} older POIs for progressive update`);

      const regions = poiSyncService.groupPOIsIntoRegions(oldestPois);
      logger.info(`[${correlationId}] Grouped POIs into ${regions.size} regions for efficient updates`);

      let updatedRegions = 0;
      let updatedPois = 0;

      for (const [key, region] of regions.entries()) {
        try {
          const result = await poiSyncService.syncRegionIfNeeded(
            region.lat,
            region.lng,
            10, // 10km radius
            'low',
            true
          );

          if (result.updated) {
            updatedRegions++;
            updatedPois += region.pois.length;
            logger.info(`[${correlationId}] Updated region ${key} with ${region.pois.length} older POIs`);
          }
        } catch (error) {
          logger.error(`[${correlationId}] Error updating region ${key}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      logger.info(`[${correlationId}] Daily progressive update completed: ${updatedRegions} regions and approximately ${updatedPois} POIs updated`);
    } catch (error) {
      logger.error(`[${correlationId}] Error in daily progressive POI update job:`, error);
    }
  });

  logger.info('All cron jobs initialized');
};

module.exports = {
  initJobs,
}; 