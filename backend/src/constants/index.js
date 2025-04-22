const BONUS_TYPES = {
  WELCOME: 'welcome',
  REFERRAL: 'referral',
  CONTRIBUTION: 'contribution',
  VALIDATION: 'validation',
  VALIDATION_BONUS: 'validation_bonus',
  SUBSCRIPTION: 'subscription',
  DAILY_REWARD: 'daily_reward',
  WEEKLY_REWARD: 'weekly_reward',
  ADMIN_AWARD: 'admin_award',
};

const BONUS_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

module.exports = {
  BONUS_TYPES,
  BONUS_STATUS,
}; 