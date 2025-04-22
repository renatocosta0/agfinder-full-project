module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    google_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    profile_picture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_banned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    ban_reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ban_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    warning_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    bonus_points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    bonus_contribution_threshold: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    last_threshold_update: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_bonus_award_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    has_active_subscription: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    current_subscription_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
  });

  User.associate = (models) => {
    User.hasMany(models.Contribution, {
      foreignKey: 'user_id',
      as: 'contributions',
    });
    
    User.hasMany(models.Validation, {
      foreignKey: 'user_id',
      as: 'validations',
    });
    
    User.hasMany(models.BonusTransaction, {
      foreignKey: 'user_id',
      as: 'bonusTransactions',
    });
    
    User.hasMany(models.SubscriptionTransaction, {
      foreignKey: 'user_id',
      as: 'subscriptionTransactions',
    });
    
    User.hasMany(models.UserWarning, {
      foreignKey: 'user_id',
      as: 'warnings',
    });
  };

  return User;
}; 