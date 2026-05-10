const bonusService = require('./bonus.service');
const placesService = require('./places.service');
const cacheService = require('./cache.service');
const queueService = require('./queue.service');
const poiSyncService = require('./poiSync.service');

module.exports = {
  subscriptionService: require('./subscription.service'),
  bonusService,
  warningService: require('./warning.service'),
  placesService,
  cacheService,
  queueService,
  poiSyncService
}; 