/**
 * Validation Model
 * Armazena validações (confirmações ou reportes) de contribuições por outros usuários
 */

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Validation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * @param {Object} models - The models object
     */
    static associate(models) {
      // Associação com contribuição validada
      Validation.belongsTo(models.Contribution, {
        foreignKey: 'contribution_id',
        as: 'contribution'
      });
      
      // Associação com usuário que validou
      Validation.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
    }

    /**
     * Conta validações por tipo para uma contribuição
     * @param {number} contributionId - ID da contribuição
     * @returns {Promise<Object>} Contagens por tipo
     */
    static async countByContribution(contributionId) {
      const counts = await this.findAll({
        where: { contribution_id: contributionId },
        attributes: [
          'validation_type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['validation_type'],
        raw: true
      });

      // Formatar resultado como objeto
      const result = {
        valid: 0,
        report: 0
      };

      counts.forEach(count => {
        result[count.validation_type] = parseInt(count.count, 10);
      });

      return result;
    }

    /**
     * Verifica se um usuário já validou uma contribuição
     * @param {number} userId - ID do usuário
     * @param {number} contributionId - ID da contribuição
     * @returns {Promise<boolean>} Verdadeiro se o usuário já validou
     */
    static async hasUserValidated(userId, contributionId) {
      const count = await this.count({
        where: {
          user_id: userId,
          contribution_id: contributionId
        }
      });

      return count > 0;
    }
  }

  Validation.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    contribution_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'contributions',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    validation_type: {
      type: DataTypes.ENUM('valid', 'report'),
      allowNull: false,
      comment: 'Tipo de validação: valid (confirmação) ou report (denúncia)'
    },
    comment: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Comentário opcional do usuário sobre a validação'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'Validation',
    tableName: 'validations',
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
    underscored: true,
    indexes: [
      // Índice para busca por contribuição (frequente)
      {
        name: 'idx_validations_contribution',
        fields: ['contribution_id']
      },
      // Índice para busca por usuário
      {
        name: 'idx_validations_user',
        fields: ['user_id']
      },
      // Restrição de unicidade (um usuário só pode validar uma contribuição uma vez)
      {
        name: 'idx_validations_unique_user_contribution',
        unique: true,
        fields: ['contribution_id', 'user_id']
      }
    ]
  });

  return Validation;
}; 