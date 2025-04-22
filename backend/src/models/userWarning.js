module.exports = (sequelize, DataTypes) => {
  const UserWarning = sequelize.define('UserWarning', {
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
    warning_type: {
      type: DataTypes.ENUM('bad_contribution', 'system', 'admin'),
      allowNull: false,
      defaultValue: 'bad_contribution',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    warning_level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
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
    tableName: 'user_warnings',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id', 'read'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['is_used'],
      }
    ]
  });

  UserWarning.associate = (models) => {
    UserWarning.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };
  
  // Instance method to check if warning can be safely deleted (used + 10 days old)
  UserWarning.prototype.canBeDeleted = function() {
    if (!this.is_used) return false;
    
    const retentionDays = parseInt(process.env.USER_WARNING_RETENTION_DAYS, 10) || 10;
    const retentionTimeInMs = retentionDays * 24 * 60 * 60 * 1000;
    const usedDate = new Date(this.used_at);
    const tenDaysAfterUsage = new Date(usedDate.getTime() + retentionTimeInMs);
    
    return tenDaysAfterUsage < new Date();
  };

  return UserWarning;
}; 