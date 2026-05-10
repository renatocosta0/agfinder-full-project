/**
 * Utilitários para operações de banco de dados
 * Funções auxiliares para consultas e atualizações eficientes
 */

const { Op } = require('sequelize');
const db = require('../models');
const logger = require('./logger');

/**
 * Atualização em lote de registros com base em consulta
 * @param {Object} model - Modelo Sequelize para atualizar
 * @param {Object} whereClause - Cláusula WHERE para selecionar registros
 * @param {Object} updateValues - Valores a serem atualizados
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} Resultado da atualização com contagem
 */
async function batchUpdate(model, whereClause, updateValues, options = {}) {
  try {
    const result = await model.update(updateValues, {
      where: whereClause,
      ...options
    });
    
    return {
      success: true,
      count: result[0],
      message: `${result[0]} registros atualizados`
    };
  } catch (error) {
    logger.error(`Erro em batchUpdate: ${error.message}`, { error });
    return {
      success: false,
      count: 0,
      message: error.message,
      error
    };
  }
}

/**
 * Busca POIs por proximidade geográfica com filtragem avançada
 * @param {Object} params - Parâmetros de consulta
 * @returns {Promise<Array>} Lista de POIs encontrados
 */
async function findPoisByLocation(params) {
  const {
    latitude,
    longitude,
    radiusKm = 5,
    poiType,
    status = 'active',
    minReliability = 3,
    limit = 50,
    offset = 0,
    includeSyncRegion = false,
    includeContributions = false
  } = params;
  
  // Construir cláusula WHERE geográfica básica
  const latitudeFloat = parseFloat(latitude);
  const longitudeFloat = parseFloat(longitude);
  const radiusFloat = parseFloat(radiusKm);
  
  // Cláusula WHERE simplificada para busca geográfica
  const geoWhere = {
    latitude: { [Op.between]: [latitudeFloat - 0.5, latitudeFloat + 0.5] },
    longitude: { [Op.between]: [longitudeFloat - 0.5, longitudeFloat + 0.5] }
  };
  
  // Adicionar filtros adicionais
  const whereClause = {
    ...geoWhere,
    reliability_score: { [Op.gte]: minReliability }
  };
  
  if (poiType) whereClause.poi_type = poiType;
  if (status) whereClause.status = status;
  
  // Configurar includes para relações
  const include = [];
  
  if (includeSyncRegion) {
    include.push({
      model: db.SyncRegion,
      as: 'syncRegion',
      attributes: ['id', 'name', 'priority']
    });
  }
  
  if (includeContributions) {
    include.push({
      model: db.Contribution,
      as: 'contributions',
      where: { is_current: true },
      required: false,
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['id', 'name', 'profile_picture']
        }
      ]
    });
  }
  
  // Executar consulta
  try {
    const result = await db.PointOfInterest.findAndCountAll({
      where: whereClause,
      include,
      limit,
      offset,
      order: [
        ['reliability_score', 'DESC'],
        ['updated_at', 'DESC']
      ]
    });
    
    // Calcular distância para cada POI encontrado
    const poisWithDistance = result.rows.map(poi => {
      // Cálculo simplificado de distância 
      const latDiff = latitudeFloat - parseFloat(poi.latitude);
      const lngDiff = longitudeFloat - parseFloat(poi.longitude);
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111.32; // Aproximação simples de km
      
      return {
        ...poi.toJSON(),
        distance: parseFloat(distance.toFixed(2))
      };
    });
    
    // Ordenar por distância
    poisWithDistance.sort((a, b) => a.distance - b.distance);
    
    return {
      pois: poisWithDistance,
      total: result.count,
      limit,
      offset
    };
  } catch (error) {
    logger.error(`Erro em findPoisByLocation: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Realiza expiração automática de registros
 * @param {string} modelName - Nome do modelo a processar
 * @param {string} expiryField - Nome do campo de data de expiração
 * @param {Object} expiryActions - Ações a realizar nos registros expirados
 * @param {number} batchSize - Tamanho do lote para processamento
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processExpiredRecords(modelName, expiryField, expiryActions, batchSize = 500) {
  const model = db[modelName];
  
  if (!model) {
    throw new Error(`Modelo ${modelName} não encontrado`);
  }
  
  try {
    // Encontrar registros expirados
    const now = new Date();
    const expired = await model.findAll({
      where: {
        [expiryField]: { [Op.lt]: now },
        ...expiryActions.whereCondition
      },
      limit: batchSize
    });
    
    if (!expired.length) {
      return { processed: 0, message: 'Nenhum registro expirado encontrado' };
    }
    
    // Obter IDs dos registros expirados
    const expiredIds = expired.map(record => record.id);
    
    // Aplicar ações de expiração
    const updateResult = await model.update(
      expiryActions.updateValues,
      {
        where: {
          id: { [Op.in]: expiredIds }
        }
      }
    );
    
    // Registrar resultado
    logger.info(`Processados ${updateResult[0]} registros expirados para ${modelName}`);
    
    // Se há ações adicionais para cada registro, executá-las
    if (expiryActions.perRecordAction && typeof expiryActions.perRecordAction === 'function') {
      for (const record of expired) {
        await expiryActions.perRecordAction(record);
      }
    }
    
    return {
      processed: updateResult[0],
      message: `${updateResult[0]} registros processados com sucesso`
    };
  } catch (error) {
    logger.error(`Erro ao processar registros expirados de ${modelName}: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Calcula estatísticas agregadas para entidades
 * @param {Object} params - Parâmetros para cálculo de estatísticas
 * @returns {Promise<Object>} Estatísticas calculadas
 */
async function calculateStats(params) {
  const { model, groupBy, countField, whereClause = {}, timeRange = null } = params;
  
  // Adicionar filtro de período, se especificado
  let where = { ...whereClause };
  
  if (timeRange) {
    const { startDate, endDate, dateField = 'created_at' } = timeRange;
    where[dateField] = {
      [Op.between]: [startDate, endDate]
    };
  }
  
  try {
    // Consulta para contar registros agrupados
    const stats = await model.findAll({
      attributes: [
        groupBy,
        [db.sequelize.fn('COUNT', db.sequelize.col(countField || '*')), 'count']
      ],
      where,
      group: [groupBy],
      raw: true
    });
    
    return {
      success: true,
      stats,
      total: stats.reduce((sum, item) => sum + parseInt(item.count, 10), 0)
    };
  } catch (error) {
    logger.error(`Erro em calculateStats: ${error.message}`, { error });
    return {
      success: false,
      message: error.message,
      error
    };
  }
}

/**
 * Carrega as configurações de rate limit do banco de dados
 * @returns {Promise<Object>} Configurações de rate limit
 */
async function loadRateLimitSettings() {
  try {
    if (!db.Setting) {
      logger.warn('Modelo Setting não encontrado para carregar configurações de rate limit');
      return null;
    }
    
    const settings = await db.Setting.getRateLimitSettings();
    if (!settings || Object.keys(settings).length === 0) {
      logger.info('Nenhuma configuração de rate limit encontrada no banco de dados');
      return null;
    }
    
    logger.info('Configurações de rate limit carregadas com sucesso');
    return {
      api: {
        windowMs: settings.api?.window_ms || 15 * 60 * 1000, // 15 minutos padrão
        maxRequests: settings.api?.max_requests || 500 // 500 requisições padrão
      },
      contribution: {
        windowMs: settings.contribution?.window_ms || 60 * 60 * 1000, // 1 hora padrão
        maxRequests: settings.contribution?.max_requests || 20 // 20 requisições padrão
      },
      auth: {
        windowMs: settings.auth?.window_ms || 60 * 60 * 1000, // 1 hora padrão
        maxRequests: settings.auth?.max_requests || 10 // 10 requisições padrão
      },
      admin: {
        windowMs: settings.admin?.window_ms || 60 * 60 * 1000, // 1 hora padrão
        maxRequests: settings.admin?.max_requests || 100 // 100 requisições padrão
      },
      redis: {
        prefix: settings.redis?.prefix || 'rl:',
        expiry: settings.redis?.expiry || 15 * 60 // 15 minutos em segundos
      }
    };
  } catch (error) {
    logger.error(`Erro ao carregar configurações de rate limit: ${error.message}`);
    return null;
  }
}

/**
 * Retorna uma configuração específica com valor padrão em caso de erro
 * @param {string} key - Chave da configuração
 * @param {*} defaultValue - Valor padrão caso não encontre
 * @returns {Promise<*>} Valor da configuração
 */
async function getSetting(key, defaultValue = null) {
  try {
    if (!db.Setting) return defaultValue;
    return await db.Setting.getSetting(key, defaultValue);
  } catch (error) {
    logger.error(`Erro ao obter configuração ${key}: ${error.message}`);
    return defaultValue;
  }
}

/**
 * Atualiza uma configuração específica
 * @param {string} key - Chave da configuração
 * @param {*} value - Novo valor
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function updateSetting(key, value) {
  try {
    if (!db.Setting) return false;
    await db.Setting.updateSetting(key, value);
    return true;
  } catch (error) {
    logger.error(`Erro ao atualizar configuração ${key}: ${error.message}`);
    return false;
  }
}

module.exports = {
  batchUpdate,
  findPoisByLocation,
  processExpiredRecords,
  calculateStats,
  loadRateLimitSettings,
  getSetting,
  updateSetting
}; 