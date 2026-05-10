'use strict';
const { Op } = require('sequelize');

/**
 * Modelo para configurações do sistema
 * Utilizado para armazenar configurações, incluindo do rate limiter com Redis
 */
module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define('Setting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'settings',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  /**
   * Obter configuração pelo nome
   * @param {string} key - Nome da configuração
   * @param {*} defaultValue - Valor padrão caso não encontre
   * @returns {Promise<*>} Valor da configuração
   */
  Setting.getSetting = async function(key, defaultValue = null) {
    const setting = await this.findOne({ where: { key } });
    return setting ? setting.value : defaultValue;
  };

  /**
   * Obter todas as configurações que começam com um prefixo
   * @param {string} prefix - Prefixo das configurações (ex: 'rate_limit.')
   * @returns {Promise<Object>} Objeto com as configurações
   */
  Setting.getSettingsByPrefix = async function(prefix) {
    const settings = await this.findAll({ 
      where: { 
        key: { 
          [Op.like]: `${prefix}%` 
        } 
      } 
    });
    
    const result = {};
    settings.forEach(setting => {
      // Remove o prefixo e converte para objeto aninhado
      const keyParts = setting.key.substring(prefix.length).split('.');
      let current = result;
      
      for (let i = 0; i < keyParts.length - 1; i++) {
        const part = keyParts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
      }
      
      // Tenta converter para número se for numérico
      const value = !isNaN(setting.value) ? Number(setting.value) : setting.value;
      current[keyParts[keyParts.length - 1]] = value;
    });
    
    return result;
  };

  /**
   * Obter todas as configurações de rate limit
   * @returns {Promise<Object>} Configurações de rate limit
   */
  Setting.getRateLimitSettings = async function() {
    return this.getSettingsByPrefix('rate_limit.');
  };

  /**
   * Atualizar uma configuração
   * @param {string} key - Nome da configuração
   * @param {*} value - Novo valor
   * @returns {Promise<Setting>} Configuração atualizada
   */
  Setting.updateSetting = async function(key, value) {
    const [setting, created] = await this.findOrCreate({
      where: { key },
      defaults: { value: String(value) }
    });
    
    if (!created) {
      await setting.update({ value: String(value) });
    }
    
    return setting;
  };

  return Setting;
}; 