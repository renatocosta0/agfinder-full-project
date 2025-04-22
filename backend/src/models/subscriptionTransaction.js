module.exports = (sequelize, DataTypes) => {
  const SubscriptionTransaction = sequelize.define('SubscriptionTransaction', {
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
    subscription_type: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'bonus'),
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.ENUM('proxypay', 'bonus'),
      allowNull: false,
    },
    entity: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    payment_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    payment_currency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'subscription_transactions',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      {
        name: 'subscription_transactions_user_idx',
        fields: ['user_id'],
      },
      {
        name: 'subscription_transactions_reference_idx',
        fields: ['reference'],
      },
      {
        name: 'subscription_transactions_status_idx',
        fields: ['status'],
      },
      {
        name: 'subscription_transactions_active_idx',
        fields: ['is_active'],
      },
      {
        name: 'subscription_transactions_expiry_idx',
        fields: ['expires_at'],
      },
    ],
  });

  SubscriptionTransaction.associate = (models) => {
    SubscriptionTransaction.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    
    SubscriptionTransaction.hasMany(models.BonusTransaction, {
      foreignKey: 'applied_subscription_id',
      as: 'bonuses',
    });
  };
  
  // Instance method to check if subscription is active
  SubscriptionTransaction.prototype.isActive = function() {
    return this.is_active && this.status === 'completed' && new Date(this.expires_at) > new Date();
  };

  // Instance method to check if subscription can be safely deleted (expired + 90 days old)
  SubscriptionTransaction.prototype.canBeDeleted = function() {
    if (!this.isActive()) return false;
    
    const retentionDays = parseInt(process.env.SUBSCRIPTION_TRANSACTION_RETENTION_DAYS, 10) || 90;
    const retentionTimeInMs = retentionDays * 24 * 60 * 60 * 1000;
    return (Date.now() - this.expires_at) > retentionTimeInMs;
  };

  return SubscriptionTransaction;
}; 