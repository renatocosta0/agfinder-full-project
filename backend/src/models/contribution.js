/**
 * Contribution Model
 * Armazena as contribuições dos usuários sobre POIs (ATMs e postos)
 */

const { Model, DataTypes } = require('sequelize');
const { Op } = require('sequelize');

module.exports = (sequelize) => {
  class Contribution extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * @param {Object} models - The models object
     */
    static associate(models) {
      // Associação com usuário que fez a contribuição
      Contribution.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });

      // Associação com POI
      Contribution.belongsTo(models.PointOfInterest, {
        foreignKey: 'poi_id',
        as: 'poi'
      });

      // Associação com validações
      Contribution.hasMany(models.Validation, {
        foreignKey: 'contribution_id',
        as: 'validations'
      });

      // Associação com transações de bônus relacionadas a esta contribuição
      Contribution.hasMany(models.BonusTransaction, {
        foreignKey: 'related_contribution_id',
        as: 'bonusTransactions'
      });
    }

    /**
     * Busca contribuições recentes para um POI específico
     * @param {number} poiId - ID do POI
     * @param {number} [limit=5] - Número máximo de resultados
     * @returns {Promise<Array>} Lista de contribuições
     */
    static async findRecentByPoi(poiId, limit = 5) {
      return this.findAll({
        where: { poi_id: poiId },
        limit,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'name', 'profile_picture']
          },
          {
            model: sequelize.models.Validation,
            as: 'validations'
          }
        ]
      });
    }

    /**
     * Busca a contribuição mais recente para um POI
     * @param {number} poiId - ID do POI
     * @returns {Promise<Contribution>} Contribuição mais recente
     */
    static async findLatestByPoi(poiId) {
      return this.findOne({
        where: { poi_id: poiId },
        order: [['created_at', 'DESC']],
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'name', 'profile_picture']
          },
          {
            model: sequelize.models.Validation,
            as: 'validations'
          }
        ]
      });
    }

    /**
     * Marca todas as contribuições anteriores como não atuais
     * @param {number} poiId - ID do POI
     * @returns {Promise<number>} Número de registros atualizados
     */
    static async markPreviousAsInactive(poiId) {
      return this.update(
        { is_current: false },
        { where: { poi_id: poiId, is_current: true } }
      );
    }

    /**
     * Busca contribuições em uma região
     * @param {number} lat - Latitude central
     * @param {number} lng - Longitude central
     * @param {number} radiusKm - Raio em quilômetros
     * @param {Date} [since] - Data mínima (opcional)
     * @returns {Promise<Array>} Lista de contribuições na região
     */
    static async findInRegion(lat, lng, radiusKm, since = null) {
      // Consulta que utiliza o relacionamento com POI para filtrar por localização
      const whereClause = since ? { created_at: { [Op.gte]: since } } : {};
      
      // Aproximação rápida: 1 grau de latitude ~= 111 km
      // 1 grau de longitude ~= 111 * cos(latitude) km
      const latDiff = radiusKm / 111.0;
      const lngFactor = Math.cos(lat * Math.PI / 180);
      const lngDiff = radiusKm / (111.0 * lngFactor);
      
      return this.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.PointOfInterest,
            as: 'poi',
            required: true,
            where: {
              latitude: {
                [Op.between]: [lat - latDiff, lat + latDiff]
              },
              longitude: {
                [Op.between]: [lng - lngDiff, lng + lngDiff]
              }
            }
          },
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'name', 'profile_picture']
          }
        ],
        order: [['created_at', 'DESC']]
      });
    }

    /**
     * Busca contribuições de um usuário
     * @param {number} userId - ID do usuário
     * @param {number} [limit=20] - Limite de resultados
     * @param {number} [offset=0] - Offset para paginação
     * @returns {Promise<Object>} Objeto com resultados e metadados
     */
    static async findByUser(userId, limit = 20, offset = 0) {
      const results = await this.findAndCountAll({
        where: { user_id: userId },
        limit,
        offset,
        order: [['created_at', 'DESC']],
        include: [
          {
            model: sequelize.models.PointOfInterest,
            as: 'poi',
            attributes: ['id', 'name', 'address', 'latitude', 'longitude', 'poi_type']
          }
        ]
      });

      return {
        contributions: results.rows,
        metadata: {
          total: results.count,
          offset,
          limit
        }
      };
    }

    /**
     * Busca contribuições que estão expiradas
     * @param {number} [limit=100] - Limite de resultados
     * @returns {Promise<Array>} Lista de contribuições expiradas
     */
    static async findExpired(limit = 100) {
      const now = new Date();
      
      return this.findAll({
        where: { 
          expires_at: { [Op.lt]: now },
          processing_status: { [Op.notIn]: ['expired', 'rejected'] }
        },
        limit,
        order: [['expires_at', 'ASC']],
        include: [
          {
            model: sequelize.models.PointOfInterest,
            as: 'poi',
            attributes: ['id', 'name', 'poi_type']
          }
        ]
      });
    }
    
    /**
     * Processa expiração automática de contribuições
     * @returns {Promise<number>} Número de contribuições expiradas
     */
    static async processExpiredContributions() {
      const expired = await this.findExpired(500);
      
      if (!expired.length) return 0;
      
      const ids = expired.map(c => c.id);
      
      await this.update(
        { 
          processing_status: 'expired',
          is_current: false 
        },
        { 
          where: { id: { [Op.in]: ids } }
        }
      );
      
      return ids.length;
    }
  }

  Contribution.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    poi_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'points_of_interest',
        key: 'id'
      }
    },
    contribution_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Tipo específico de contribuição (ex: money_paper, gasoline_diesel)'
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('details');
        return value ? JSON.parse(value) : {};
      },
      set(value) {
        this.setDataValue('details', JSON.stringify(value));
      }
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    // Novos campos para expiração e verificação
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verification_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    dispute_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    reliability_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 5.0,
    },
    processing_status: {
      type: DataTypes.ENUM('pending', 'verified', 'disputed', 'expired', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'Contribution',
    tableName: 'contributions',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: (contribution) => {
        // Define a data de expiração com base em minutos (ENV: CONTRIBUTION_TTL_MINUTES)
        if (!contribution.expires_at) {
          const ttlMinutes = parseInt(process.env.CONTRIBUTION_TTL_MINUTES, 10);
          const minutes = Number.isFinite(ttlMinutes) ? ttlMinutes : 60;
          const expiresAt = new Date();
          expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
          contribution.expires_at = expiresAt;
        }
      }
    },
    indexes: [
      {
        name: 'idx_contributions_poi',
        fields: ['poi_id']
      },
      {
        name: 'idx_contributions_user',
        fields: ['user_id']
      },
      {
        name: 'idx_contributions_current',
        fields: ['is_current']
      },
      {
        name: 'idx_contributions_expiration',
        fields: ['expires_at']
      },
      {
        name: 'idx_contributions_status',
        fields: ['processing_status']
      },
      {
        name: 'idx_contributions_reliability',
        fields: ['reliability_score']
      },
      {
        name: 'idx_contributions_verification',
        fields: ['verification_count']
      }
    ]
  });

  return Contribution;
};