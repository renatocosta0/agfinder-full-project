module.exports = (sequelize, DataTypes) => {
  const BonusTransaction = sequelize.define('BonusTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    transaction_type: {
      type: DataTypes.ENUM('contribution', 'referral', 'welcome', 'loyalty', 'promotion', 'validation', 'subscription', 'validation_bonus', 'contribution_reward'),
      allowNull: false,
    },
    related_contribution_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'contributions',
        key: 'id',
      },
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    applied_subscription_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'subscription_transactions',
        key: 'id',
      },
    },
  }, {
    tableName: 'bonus_transactions',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      {
        name: 'bonus_transactions_user_idx',
        fields: ['user_id'],
      },
      {
        name: 'bonus_transactions_contribution_idx',
        fields: ['related_contribution_id'],
      },
      {
        name: 'bonus_transactions_used_idx',
        fields: ['is_used'],
      },
      {
        name: 'bonus_transactions_expiry_idx',
        fields: ['expiry_date'],
      },
    ],
  });

  BonusTransaction.associate = (models) => {
    BonusTransaction.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    
    BonusTransaction.belongsTo(models.Contribution, {
      foreignKey: 'related_contribution_id',
      as: 'contribution',
    });
    
    BonusTransaction.belongsTo(models.SubscriptionTransaction, {
      foreignKey: 'applied_subscription_id',
      as: 'subscription',
    });
  };
  
  // Instance method to check if bonus is expired
  BonusTransaction.prototype.isExpired = function() {
    return this.expiry_date && new Date(this.expiry_date) < new Date();
  };

  // Instance method to check if bonus can be safely deleted (used + 90 days old)
  BonusTransaction.prototype.canBeDeleted = function() {
    if (!this.is_used) return false;
    
    const retentionDays = parseInt(process.env.BONUS_TRANSACTION_RETENTION_DAYS, 10) || 90;
    const retentionTimeInMs = retentionDays * 24 * 60 * 60 * 1000;
    const usedDate = new Date(this.used_at);
    const ninetyDaysAfterUsage = new Date(usedDate.getTime() + retentionTimeInMs);
    
    return ninetyDaysAfterUsage < new Date();
  };

  return BonusTransaction;
}; 