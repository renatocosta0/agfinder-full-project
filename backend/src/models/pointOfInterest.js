module.exports = (sequelize, DataTypes) => {
  const PointOfInterest = sequelize.define('PointOfInterest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    poi_type: {
      type: DataTypes.ENUM('atm', 'gasstation'),
      allowNull: false,
    },
    google_place_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      validate: {
        min: -90,
        max: 90,
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
      validate: {
        min: -180,
        max: 180,
      },
    },
    google_data: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('google_data');
        return value ? JSON.parse(value) : {};
      },
      set(value) {
        this.setDataValue('google_data', JSON.stringify(value));
      },
    },
    // Novos campos para sincronização
    sync_source: {
      type: DataTypes.ENUM('google', 'user', 'admin', 'api'),
      allowNull: false,
      defaultValue: 'google',
    },
    
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reliability_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 5.0,
      validate: {
        min: 0,
        max: 10
      }
    },
    data_expiration: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'pending', 'deleted'),
      allowNull: false,
      defaultValue: 'active',
    },
    status_reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    change_history: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('change_history');
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue('change_history', JSON.stringify(value));
      },
    },
    // Novos campos para métricas de interação
    contributions_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'contributions',
      comment: 'Número total de contribuições feitas para este POI'
    },
    validations: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Número total de validações positivas recebidas'
    },
    reports: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Número total de reportes/denúncias recebidas'
    },
    total_interactions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Soma total de contribuições, validações e reportes'
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
    tableName: 'points_of_interest',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_poi_location_status_reliability',
        fields: ['latitude', 'longitude', 'status', 'reliability_score'],
      },
      {
        name: 'points_of_interest_poi_type_idx',
        fields: ['poi_type'],
      },
      {
        name: 'idx_poi_status',
        fields: ['status'],
      },
      
      {
        name: 'idx_poi_reliability',
        fields: ['reliability_score'],
      },
      {
        name: 'idx_poi_expiration',
        fields: ['data_expiration'],
      },
      // Novo índice para interactions
      {
        name: 'idx_poi_interactions',
        fields: ['total_interactions'],
      },
    ],
  });

  PointOfInterest.associate = (models) => {
    PointOfInterest.hasMany(models.Contribution, {
      foreignKey: 'poi_id',
      as: 'contributions',
    });
    
  };

  // Instance methods
  PointOfInterest.prototype.getCurrentStatus = async function() {
    const models = sequelize.models;
    const currentContribution = await models.Contribution.findOne({
      where: {
        poi_id: this.id,
        is_current: true,
      },
      include: [
        {
          model: models.User,
          as: 'user',
          attributes: ['id', 'name', 'profile_picture'],
        },
        {
          model: models.Validation,
          as: 'validations',
          attributes: ['id', 'validation_type', 'created_at'],
        },
      ],
    });

    return currentContribution;
  };

  // Novo método para registrar alterações no histórico
  PointOfInterest.prototype.recordChange = async function(change) {
    const history = this.change_history || [];
    const newEntry = {
      timestamp: new Date(),
      version: this.version + 1,
      ...change
    };
    
    history.push(newEntry);
    this.change_history = history;
    this.version += 1;
    
    return this.save();
  };

  // Novo método para verificar se os dados estão expirados
  PointOfInterest.prototype.isExpired = function() {
    if (!this.data_expiration) return false;
    return new Date() > this.data_expiration;
  };

  // Novo método estático para encontrar POIs por região geográfica
  PointOfInterest.findByGeoArea = async function(lat, lng, radiusKm, options = {}) {
    const { status, poiType, minReliability = 0, limit = 50, offset = 0 } = options;
    
    // Aproximação rápida: 1 grau de latitude ~= 111 km
    const latDiff = radiusKm / 111.0;
    // 1 grau de longitude ~= 111 * cos(latitude) km
    const lngFactor = Math.cos(lat * Math.PI / 180);
    const lngDiff = radiusKm / (111.0 * lngFactor);
    
    const where = {
      latitude: {
        [sequelize.Sequelize.Op.between]: [parseFloat(lat) - latDiff, parseFloat(lat) + latDiff]
      },
      longitude: {
        [sequelize.Sequelize.Op.between]: [parseFloat(lng) - lngDiff, parseFloat(lng) + lngDiff]
      },
      reliability_score: {
        [sequelize.Sequelize.Op.gte]: minReliability
      }
    };
    
    if (status) where.status = status;
    if (poiType) where.poi_type = poiType;
    
    return this.findAll({
      where,
      limit,
      offset,
      order: [
        ['reliability_score', 'DESC'],
        ['updated_at', 'DESC']
      ]
    });
  };

  // Novo método estático para atualização em lote de POIs
  PointOfInterest.batchUpdate = async function(poiIds, updateData) {
    if (!poiIds || !poiIds.length) return { count: 0 };
    
    return this.update(updateData, {
      where: {
        id: {
          [sequelize.Sequelize.Op.in]: poiIds
        }
      }
    });
  };

  // Cache invalidation hooks to keep geo caches fresh after POI changes
  const invalidateAroundPoi = async (poiInstance) => {
    try {
      const cacheService = require('../services/cache.service');
      const lat = parseFloat(poiInstance.latitude);
      const lng = parseFloat(poiInstance.longitude);
      if (isFinite(lat) && isFinite(lng)) {
        const radiusKm = Number(process.env.CACHE_INVALIDATION_RADIUS_KM || 5);
        await cacheService.invalidateRegion(lat, lng, radiusKm);
      }
    } catch (err) {
      // do not block DB operations due to cache errors
      // use logger lazily to avoid circular requires
      try { require('../utils/logger').warn('Cache invalidation failed for POI change:', err); } catch (_) {}
    }
  };

  PointOfInterest.addHook('afterCreate', async (poi, options) => {
    await invalidateAroundPoi(poi);
  });

  PointOfInterest.addHook('afterUpdate', async (poi, options) => {
    await invalidateAroundPoi(poi);
  });

  PointOfInterest.addHook('afterDestroy', async (poi, options) => {
    await invalidateAroundPoi(poi);
  });

  return PointOfInterest;
}; 