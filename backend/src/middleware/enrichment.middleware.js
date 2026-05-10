/**
 * Middleware de Enriquecimento de POIs
 * Adiciona dados de contribuições e status aos resultados de POIs
 */

const { PointOfInterest, Contribution, Validation, User } = require('../models');
const contributionsService = require('../services/contributions.service');
const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Middleware para enriquecer resultados de POIs com dados de contribuições
 * @param {Object} req - Objeto de requisição do Express
 * @param {Object} res - Objeto de resposta do Express
 * @param {Function} next - Função next do Express
 */
async function enrichPoiResults(req, res, next) {
  // Armazenar o método original de envio de resposta
  const originalSend = res.send;

  // Sobrescrever o método send para interceptar a resposta
  res.send = async function(body) {
    try {
      // Tentar processar apenas respostas JSON
      if (res.getHeader('content-type')?.includes('application/json')) {
        let responseData = body;
        
        // Se for string, tentar converter para objeto
        if (typeof body === 'string') {
          try {
            responseData = JSON.parse(body);
          } catch (e) {
            // Não é um JSON válido, continuar com o body original
            return originalSend.call(this, body);
          }
        }

        // Verificar se a resposta contém dados de POIs
        if (responseData && 
            responseData.status === 'success' && 
            responseData.data && 
            Array.isArray(responseData.data)) {
          
          // Enriquecer os resultados com dados de contribuições
          responseData.data = await enrichPois(responseData.data, req.query.full === 'true');
          
          // Atualizar o body com os dados enriquecidos
          body = JSON.stringify(responseData);
        }
      }
    } catch (error) {
      // Logar o erro mas permitir que a resposta continue
      logger.error('Erro ao enriquecer resultados:', error);
    }

    // Chamar o método original com o body (possivelmente modificado)
    return originalSend.call(this, body);
  };

  // Continuar para o próximo middleware
  next();
}

/**
 * Enriquece uma lista de POIs com dados de contribuições
 * @param {Array} pois - Lista de POIs para enriquecer
 * @param {boolean} fullDetails - Se deve incluir detalhes completos
 * @returns {Promise<Array>} Lista de POIs enriquecida
 */
async function enrichPois(pois, fullDetails = false) {
  if (!pois || pois.length === 0) {
    return pois;
  }

  try {
    // Extrair IDs dos POIs
    const poiIds = pois.map(poi => 
      poi.id || poi.place_id || (poi.poi ? poi.poi.id : null)
    ).filter(id => id);

    if (poiIds.length === 0) {
      return pois; // Nenhum POI com ID válido
    }

    // Tentar obter dados de contribuições em lote do cache
    const cachedData = await getCachedContributions(poiIds);
    const missingPoiIds = poiIds.filter(id => !cachedData[id]);

    // Buscar dados faltantes do banco de dados
    let dbData = {};
    if (missingPoiIds.length > 0) {
      dbData = await getContributionsFromDb(missingPoiIds);
      
      // Armazenar em cache os dados recuperados do banco
      for (const [poiId, data] of Object.entries(dbData)) {
        await cacheContributionData(poiId, data);
      }
    }

    // Combinar dados de cache e banco de dados
    const contributionsData = { ...cachedData, ...dbData };

    // Enriquecer cada POI com os dados de contribuições
    return pois.map(poi => {
      const poiId = poi.id || poi.place_id || (poi.poi ? poi.poi.id : null);
      
      if (!poiId || !contributionsData[poiId]) {
        // Sem ID ou sem dados de contribuição disponíveis
        return {
          ...poi,
          agfinder: poi.agfinder || {
            status: 'unknown',
            statusLabel: 'Sem atualizações',
            lastUpdate: null
          }
        };
      }

      // Adicionar dados de contribuições ao POI
      const contribData = contributionsData[poiId];
      const enrichedPoi = { ...poi };

      // Determinar o nível de detalhes a incluir
      if (fullDetails) {
        // Incluir detalhes completos
        enrichedPoi.agfinder = {
          status: contribData.status,
          statusLabel: contribData.statusLabel,
          lastUpdate: contribData.lastUpdate,
          details: contribData.details,
          contributor: contribData.contributor,
          validations: contribData.validations,
          contribution: contribData.contribution
        };
      } else {
        // Incluir apenas informações essenciais
        enrichedPoi.agfinder = {
          status: contribData.status,
          statusLabel: contribData.statusLabel,
          lastUpdate: contribData.lastUpdate,
          details: contribData.details,
          contributor: contribData.contributor ? {
            name: contribData.contributor.name
          } : null
        };
      }

      return enrichedPoi;
    });
  } catch (error) {
    logger.error('Erro ao enriquecer POIs:', error);
    return pois; // Retornar POIs originais em caso de erro
  }
}

/**
 * Obtém dados de contribuições do cache
 * @param {Array} poiIds - Lista de IDs de POIs
 * @returns {Promise<Object>} Objeto com dados de contribuições por POI ID
 */
async function getCachedContributions(poiIds) {
  const result = {};

  // Processar em lotes para evitar sobrecarga
  const batchSize = 20;
  for (let i = 0; i < poiIds.length; i += batchSize) {
    const batch = poiIds.slice(i, i + batchSize);
    
    // Obter dados do cache em paralelo
    const promises = batch.map(poiId => {
      const cacheKey = `enrich:poi:${poiId}`;
      return cacheService.get(cacheKey)
        .then(data => ({ poiId, data }))
        .catch(() => ({ poiId, data: null }));
    });

    const cachedItems = await Promise.all(promises);
    
    // Adicionar ao resultado
    cachedItems.forEach(item => {
      if (item.data) {
        result[item.poiId] = item.data;
      }
    });
  }

  return result;
}

/**
 * Armazena dados de contribuição no cache
 * @param {string|number} poiId - ID do POI
 * @param {Object} data - Dados a serem armazenados
 * @returns {Promise<void>}
 */
async function cacheContributionData(poiId, data) {
  try {
    const cacheKey = `enrich:poi:${poiId}`;
    
    // Calcular TTL baseado no status
    let ttl = 3600; // 1 hora padrão
    
    if (data.status === 'green') {
      ttl = 15 * 60; // 15 minutos para status verde (mais volátil)
    } else if (data.status === 'yellow') {
      ttl = 30 * 60; // 30 minutos para status amarelo
    } else if (data.status === 'orange') {
      ttl = 60 * 60; // 1 hora para status laranja
    } else if (data.status === 'red') {
      ttl = 3 * 60 * 60; // 3 horas para status vermelho (menos volátil)
    }
    
    await cacheService.set(cacheKey, data, ttl);
  } catch (error) {
    logger.error(`Erro ao armazenar dados em cache para POI ${poiId}:`, error);
    // Falhas de cache não devem interromper o fluxo
  }
}

/**
 * Busca dados de contribuições do banco de dados
 * @param {Array} poiIds - Lista de IDs de POIs
 * @returns {Promise<Object>} Objeto com dados de contribuições por POI ID
 */
async function getContributionsFromDb(poiIds) {
  const result = {};

  try {
    // Buscar POIs com contribuições mais recentes
    const pois = await PointOfInterest.findAll({
      where: {
        id: {
          [Op.in]: poiIds
        }
      },
      include: [
        {
          model: Contribution,
          as: 'contributions',
          limit: 1,
          order: [['created_at', 'DESC']],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'profile_picture']
            },
            {
              model: Validation,
              as: 'validations'
            }
          ]
        }
      ]
    });

    // Processar cada POI
    for (const poi of pois) {
      const latestContribution = poi.contributions && poi.contributions.length > 0 
        ? poi.contributions[0] 
        : null;

      if (!latestContribution) {
        // Sem contribuições, usar status padrão
        result[poi.id] = {
          status: 'unknown',
          statusLabel: 'Sem atualizações',
          lastUpdate: null,
          details: {},
          validations: { valid: 0, reports: 0 }
        };
        continue;
      }

      // Agregar validações
      const validationStats = contributionsService.aggregateValidations(
        latestContribution.validations
      );

      // Extrair detalhes específicos do tipo de POI
      let details = {};
      if (poi.poi_type === 'atm') {
        switch(latestContribution.contribution_type) {
          case 'money_paper':
            details = { has_money: true, has_paper: true };
            break;
          case 'money_only':
            details = { has_money: true, has_paper: false };
            break;
          case 'paper_only':
            details = { has_money: false, has_paper: true };
            break;
          case 'none':
            details = { has_money: false, has_paper: false };
            break;
        }
      } else if (poi.poi_type === 'gasstation') {
        switch(latestContribution.contribution_type) {
          case 'gasoline_diesel':
            details = { has_gasoline: true, has_diesel: true };
            break;
          case 'gasoline_only':
            details = { has_gasoline: true, has_diesel: false };
            break;
          case 'diesel_only':
            details = { has_gasoline: false, has_diesel: true };
            break;
          case 'none':
            details = { has_gasoline: false, has_diesel: false };
            break;
        }
      }

      // Calcular status com base em tempo e validações
      const validationCounts = {
        valid: validationStats.valid,
        report: validationStats.reports
      };
      
      const status = contributionsService.determineStatus(
        latestContribution.created_at,
        validationCounts,
        details
      );

      // Preparar dados de contribuição
      result[poi.id] = {
        status,
        statusLabel: contributionsService.getStatusLabel(status),
        lastUpdate: latestContribution.created_at,
        details,
        contributor: latestContribution.user ? {
          id: latestContribution.user.id,
          name: latestContribution.user.name,
          profile_picture: latestContribution.user.profile_picture
        } : null,
        validations: {
          valid: validationStats.valid,
          reports: validationStats.reports,
          total: validationStats.total,
          trustScore: validationStats.trustScore
        },
        contribution: {
          id: latestContribution.id,
          type: latestContribution.contribution_type,
          createdAt: latestContribution.created_at
        }
      };
    }
  } catch (error) {
    logger.error('Erro ao buscar contribuições do banco:', error);
  }

  return result;
}

/**
 * Middleware para enriquecer um único resultado de POI detalhado
 * @param {Object} req - Objeto de requisição do Express
 * @param {Object} res - Objeto de resposta do Express
 * @param {Function} next - Função next do Express
 */
async function enrichPoiDetail(req, res, next) {
  // Armazenar o método original de envio de resposta
  const originalSend = res.send;

  // Sobrescrever o método send para interceptar a resposta
  res.send = async function(body) {
    try {
      // Tentar processar apenas respostas JSON
      if (res.getHeader('content-type')?.includes('application/json')) {
        let responseData = body;
        
        // Se for string, tentar converter para objeto
        if (typeof body === 'string') {
          try {
            responseData = JSON.parse(body);
          } catch (e) {
            // Não é um JSON válido, continuar com o body original
            return originalSend.call(this, body);
          }
        }

        // Verificar se a resposta contém dados de um único POI
        if (responseData && 
            responseData.status === 'success' && 
            responseData.data && 
            responseData.data.place_id) {
          
          // Obter dados detalhados de contribuições para este POI
          const poiId = responseData.data.id || responseData.data.place_id;
          const contributionData = await contributionsService.calculatePoiStatus(poiId);
          
          // Adicionar os dados de contribuições ao objeto de resposta
          if (!responseData.data.agfinder) {
            responseData.data.agfinder = {};
          }
          
          // Mesclar dados de contribuições
          responseData.data.agfinder = {
            ...responseData.data.agfinder,
            ...contributionData
          };
          
          // Atualizar o body com os dados enriquecidos
          body = JSON.stringify(responseData);
        }
      }
    } catch (error) {
      // Logar o erro mas permitir que a resposta continue
      logger.error('Erro ao enriquecer detalhe de POI:', error);
    }

    // Chamar o método original com o body (possivelmente modificado)
    return originalSend.call(this, body);
  };

  // Continuar para o próximo middleware
  next();
}

/**
 * Invalidar cache de enriquecimento para um POI
 * @param {string|number} poiId - ID do POI
 * @returns {Promise<void>}
 */
async function invalidateEnrichmentCache(poiId) {
  try {
    const cacheKey = `enrich:poi:${poiId}`;
    await cacheService.del(cacheKey);
    logger.debug(`Cache de enriquecimento invalidado para POI ${poiId}`);
  } catch (error) {
    logger.error(`Erro ao invalidar cache para POI ${poiId}:`, error);
  }
}

module.exports = {
  enrichPoiResults,
  enrichPoiDetail,
  enrichPois,
  invalidateEnrichmentCache
}; 