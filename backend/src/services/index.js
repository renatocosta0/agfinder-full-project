const bonusService = require('./bonus.service');
const googleMapsService = require('./googleMaps.service');

module.exports = {
  subscriptionService: require('./subscription.service'),
  bonusService,
  warningService: require('./warning.service'),
  googleMapsService,
}; 