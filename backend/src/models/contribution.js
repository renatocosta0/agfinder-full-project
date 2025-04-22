module.exports = (sequelize, DataTypes) => {
  const Contribution = sequelize.define('Contribution', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    poi_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'points_of_interest',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    contribution_type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isValidContributionType(value) {
          const atmTypes = ['money_paper', 'money_only', 'paper_only', 'none'];
          const gasStationTypes = ['gasoline_diesel', 'gasoline_only', 'diesel_only', 'none'];
          
          if (!atmTypes.includes(value) && !gasStationTypes.includes(value)) {
            throw new Error('Invalid contribution type');
          }
        },
      },
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    tableName: 'contributions',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      {
        name: 'contributions_poi_current_idx',
        fields: ['poi_id', 'is_current'],
      },
      {
        name: 'contributions_user_idx',
        fields: ['user_id'],
      },
    ],
  });

  Contribution.associate = (models) => {
    Contribution.belongsTo(models.PointOfInterest, {
      foreignKey: 'poi_id',
      as: 'pointOfInterest',
    });
    
    Contribution.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    
    Contribution.hasMany(models.Validation, {
      foreignKey: 'contribution_id',
      as: 'validations',
    });
    
    Contribution.hasMany(models.BonusTransaction, {
      foreignKey: 'related_contribution_id',
      as: 'bonusTransactions',
    });
  };

  // Instance methods
  Contribution.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  Contribution.prototype.getValidationsCount = async function() {
    const validationCount = await sequelize.models.Validation.count({
      where: {
        contribution_id: this.id,
        validation_type: 'valid',
      },
    });
    
    return validationCount;
  };

  Contribution.prototype.getReportsCount = async function() {
    const reportCount = await sequelize.models.Validation.count({
      where: {
        contribution_id: this.id,
        validation_type: 'report',
      },
    });
    
    return reportCount;
  };

  return Contribution;
}; 