/**
 * Contributions Service
 * Serviço para gerenciamento de contribuições dos usuários sobre POIs
 * - Registro de novas contribuições
 * - Busca de contribuições por região ou POI
 * - Cálculo de status baseado em contribuições
 */

const { Contribution, PointOfInterest, User, Validation, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const geoUtils = require('../utils/geo.utils');

/**
 * Registra uma nova contribuição para um POI
 * @param {Object} data - Dados da contribuição
 * @param {number} data.poiId - ID do POI
 * @param {number} data.userId - ID do usuário
 * @param {string} data.contributionType - Tipo de contribuição
 * @param {Object} [data.details] - Detalhes adicionais
 * @returns {Promise<Object>} Contribuição criada
 */
async function createContribution(data) {
  const { poiId, userId, contributionType, details = {} } = data;

  try {
    // Validar a existência do POI
    const poi = await PointOfInterest.findByPk(poiId);
    if (!poi) {
      throw new AppError('POI não encontrado', 404);
    }

    // Validar a existência do usuário
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Validar o tipo de contribuição de acordo com o tipo de POI
    validateContributionType(poi.poi_type, contributionType);

    // Iniciar uma transação para garantir consistência
    const transaction = await sequelize.transaction();

    try {
      // Marcar contribuições anteriores como não atuais
      await Contribution.markPreviousAsInactive(poiId, { transaction });

      // Criar nova contribuição
      const contribution = await Contribution.create({
        poi_id: poiId,
        user_id: userId,
        contribution_type: contributionType,
        details,
        is_current: true,
        status: 'pending',
        source: 'user',
        reliability_score: calculateReliabilityScore(user),
        created_at: new Date()
      }, { transaction });

      // Atualizar o status do POI
      await updatePoiStatusBasedOnContribution(poi, contributionType, transaction);

      // Commit da transação
      await transaction.commit();

      // Registrar atividade de contribuição
      logger.info(`Nova contribuição registrada: ${contributionType} para POI ${poiId} por usuário ${userId}`);

      // Buscar a contribuição com dados relacionados
      const completeContribution = await Contribution.findByPk(contribution.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'profile_picture']
          },
          {
            model: PointOfInterest,
            as: 'poi',
            attributes: ['id', 'name', 'address', 'latitude', 'longitude', 'poi_type']
          }
        ]
      });

      return formatContributionResponse(completeContribution);
    } catch (error) {
      // Rollback em caso de erro
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    logger.error(`Erro ao criar contribuição: ${error.message}`, { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Erro ao processar contribuição', 500);
  }
}

/**
 * Valida o tipo de contribuição de acordo com o tipo de POI
 * @param {string} poiType - Tipo de POI (atm, gasstation)
 * @param {string} contributionType - Tipo de contribuição
 * @throws {AppError} Erro se o tipo de contribuição for inválido
 */
function validateContributionType(poiType, contributionType) {
  // Tipos válidos de contribuição para ATMs
  const validATMTypes = ['money_paper', 'money_only', 'paper_only', 'none'];
  
  // Tipos válidos de contribuição para postos de gasolina
  const validGasStationTypes = ['gasoline_diesel', 'gasoline_only', 'diesel_only', 'none'];
  
  if (poiType === 'atm' && !validATMTypes.includes(contributionType)) {
    throw new AppError(`Tipo de contribuição inválido para ATM: ${contributionType}`, 400);
  } else if (poiType === 'gasstation' && !validGasStationTypes.includes(contributionType)) {
    throw new AppError(`Tipo de contribuição inválido para Posto: ${contributionType}`, 400);
  }
}

/**
 * Calcula pontuação de confiabilidade baseada no histórico do usuário e feedback
 * @param {Object} user - Objeto do usuário
 * @param {Object} [stats] - Estatísticas opcionais do histórico do usuário
 * @returns {number} Pontuação de confiabilidade (0-100)
 */
function calculateReliabilityScore(user, stats = null) {
  // Implementação avançada com múltiplos fatores
  let score = 50; // Base score
  
  // Considerar nível de confiança do usuário 
  if (user.trust_level === 'verified') {
    score += 30;
  } else if (user.trust_level === 'trusted') {
    score += 20;
  } else if (user.trust_level === 'new') {
    score -= 10;
  }
  
  // Se temos estatísticas avançadas
  if (stats) {
    // Contribuições históricas
    if (stats.totalContributions > 100) {
      score += 15;
    } else if (stats.totalContributions > 50) {
      score += 10;
    } else if (stats.totalContributions > 20) {
      score += 5;
    }

    // Validações recebidas
    if (stats.validationRatio !== undefined) {
      if (stats.validationRatio > 0.9 && stats.totalValidations > 20) {
        score += 15; // Excelente histórico de validações
      } else if (stats.validationRatio > 0.7 && stats.totalValidations > 10) {
        score += 10; // Bom histórico de validações
      } else if (stats.validationRatio < 0.3 && stats.totalValidations > 10) {
        score -= 15; // Histórico problemático
      }
    }

    // Contribuições recentes (atividade)
    if (stats.recentActivityScore) {
      score += stats.recentActivityScore * 5; // 0-5 pontos baseado na atividade recente
    }
  } else {
    // Lógica simples sem estatísticas avançadas
    if (user.contribution_count > 100) {
      score += 20;
    } else if (user.contribution_count > 50) {
      score += 10;
    } else if (user.contribution_count > 20) {
      score += 5;
    }
  }
  
  // Garantir que o score esteja entre 0 e 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Atualiza o status de um POI baseado em nova contribuição
 * @param {Object} poi - Objeto do POI
 * @param {string} contributionType - Tipo de contribuição
 * @param {Object} transaction - Transação do Sequelize
 * @returns {Promise<void>}
 */
async function updatePoiStatusBasedOnContribution(poi, contributionType, transaction) {
  // Extrair valores de disponibilidade do tipo de contribuição
  let status = {};
  
  if (poi.poi_type === 'atm') {
    switch (contributionType) {
      case 'money_paper':
        status.has_money = true;
        status.has_paper = true;
        break;
      case 'money_only':
        status.has_money = true;
        status.has_paper = false;
        break;
      case 'paper_only':
        status.has_money = false;
        status.has_paper = true;
        break;
      case 'none':
        status.has_money = false;
        status.has_paper = false;
        break;
    }
  } else if (poi.poi_type === 'gasstation') {
    switch (contributionType) {
      case 'gasoline_diesel':
        status.has_gasoline = true;
        status.has_diesel = true;
        break;
      case 'gasoline_only':
        status.has_gasoline = true;
        status.has_diesel = false;
        break;
      case 'diesel_only':
        status.has_gasoline = false;
        status.has_diesel = true;
        break;
      case 'none':
        status.has_gasoline = false;
        status.has_diesel = false;
        break;
    }
  }
  
  // Atualizar o POI com novos status
  await poi.update({
    status_details: status,
    last_update: new Date()
  }, { transaction });
}

/**
 * Busca contribuições recentes para um POI específico
 * @param {number} poiId - ID do POI
 * @param {Object} options - Opções de busca
 * @param {number} [options.limit=5] - Número máximo de contribuições
 * @returns {Promise<Array>} Lista de contribuições
 */
async function getContributionsByPoi(poiId, options = {}) {
  try {
    const { limit = 5 } = options;
    
    // Verificar se o POI existe
    const poi = await PointOfInterest.findByPk(poiId);
    if (!poi) {
      throw new AppError('POI não encontrado', 404);
    }
    
    // Buscar contribuições recentes
    const contributions = await Contribution.findRecentByPoi(poiId, limit);
    
    // Formatar resposta
    return {
      poi: {
        id: poi.id,
        name: poi.name,
        type: poi.poi_type,
        address: poi.address,
        location: {
          lat: parseFloat(poi.latitude),
          lng: parseFloat(poi.longitude)
        }
      },
      contributions: contributions.map(formatContributionResponse),
      metadata: {
        total: contributions.length,
        limit
      }
    };
  } catch (error) {
    logger.error(`Erro ao buscar contribuições para POI ${poiId}: ${error.message}`, { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Erro ao buscar contribuições', 500);
  }
}

/**
 * Busca contribuições recentes em uma região geográfica
 * @param {number} lat - Latitude central
 * @param {number} lng - Longitude central
 * @param {number} radiusKm - Raio em quilômetros
 * @param {Object} options - Opções de busca
 * @param {Date} [options.since] - Data mínima para filtrar
 * @param {string} [options.type] - Tipo de POI para filtrar
 * @returns {Promise<Object>} Objeto com contribuições e metadados
 */
async function getContributionsInRegion(lat, lng, radiusKm, options = {}) {
  try {
    // Validar coordenadas
    if (!geoUtils.isValidCoordinate(lat, lng)) {
      throw new AppError('Coordenadas inválidas', 400);
    }
    
    const { since, type } = options;
    
    // Usar o método do model para busca geoespacial
    const contributions = await Contribution.findInRegion(lat, lng, radiusKm, since);
    
    // Filtrar por tipo de POI se necessário
    const filteredContributions = type 
      ? contributions.filter(c => c.poi && c.poi.poi_type === type)
      : contributions;
    
    return {
      contributions: filteredContributions.map(formatContributionResponse),
      metadata: {
        total: filteredContributions.length,
        region: {
          center: { lat, lng },
          radius_km: radiusKm
        },
        filters: {
          since: since ? since.toISOString() : null,
          type: type || 'all'
        }
      }
    };
  } catch (error) {
    logger.error(`Erro ao buscar contribuições na região [${lat},${lng}]: ${error.message}`, { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Erro ao buscar contribuições na região', 500);
  }
}

/**
 * Registra uma validação para uma contribuição
 * @param {Object} data - Dados da validação
 * @param {number} data.contributionId - ID da contribuição
 * @param {number} data.userId - ID do usuário
 * @param {string} data.validationType - Tipo de validação ('valid'|'report')
 * @param {string} [data.comment] - Comentário opcional
 * @returns {Promise<Object>} Resultado da validação
 */
async function addValidation(data) {
  const { contributionId, userId, validationType, comment } = data;
  
  try {
    // Verificar se a contribuição existe
    const contribution = await Contribution.findByPk(contributionId);
    if (!contribution) {
      throw new AppError('Contribuição não encontrada', 404);
    }
    
    // Verificar se o usuário existe
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }
    
    // Verificar se o usuário já validou esta contribuição
    const alreadyValidated = await Validation.hasUserValidated(userId, contributionId);
    if (alreadyValidated) {
      throw new AppError('Usuário já validou esta contribuição', 400);
    }
    
    // Criar a validação
    await Validation.create({
      contribution_id: contributionId,
      user_id: userId,
      validation_type: validationType,
      comment,
      created_at: new Date()
    });
    
    // Contar validações para esta contribuição
    const counts = await Validation.countByContribution(contributionId);
    
    // Registrar atividade
    logger.info(`Nova validação: ${validationType} para contribuição ${contributionId} por usuário ${userId}`);
    
    return {
      contribution_id: contributionId,
      validation_type: validationType,
      counts
    };
  } catch (error) {
    logger.error(`Erro ao adicionar validação: ${error.message}`, { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Erro ao processar validação', 500);
  }
}

/**
 * Calcula o status de um POI com base em suas contribuições
 * @param {number} poiId - ID do POI
 * @returns {Promise<Object>} Status calculado
 */
async function calculatePoiStatus(poiId) {
  try {
    // Buscar POI com contribuição mais recente
    const poi = await PointOfInterest.findByPk(poiId);
    if (!poi) {
      throw new AppError('POI não encontrado', 404);
    }
    
    // Buscar contribuição mais recente
    const latestContribution = await Contribution.findLatestByPoi(poiId);
    
    if (!latestContribution) {
      return {
        status: 'unknown',
        status_label: 'Sem atualizações',
        last_update: null,
        details: {}
      };
    }
    
    // Calcular status baseado no tempo da última atualização
    const status = determineStatus(latestContribution.created_at);
    
    // Contar validações e reportes
    const validationCounts = await Validation.countByContribution(latestContribution.id);
    
    // Extrair detalhes da contribuição
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
    
    return {
      status,
      status_label: getStatusLabel(status),
      last_update: latestContribution.created_at,
      details,
      validation_counts: validationCounts,
      contributor: latestContribution.user ? {
        id: latestContribution.user.id,
        name: latestContribution.user.name,
        profile_picture: latestContribution.user.profile_picture
      } : null
    };
  } catch (error) {
    logger.error(`Erro ao calcular status para POI ${poiId}: ${error.message}`, { error });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError('Erro ao calcular status do POI', 500);
  }
}

/**
 * Formata uma contribuição para resposta da API
 * @param {Object} contribution - Objeto de contribuição do Sequelize
 * @returns {Object} Contribuição formatada
 */
function formatContributionResponse(contribution) {
  if (!contribution) return null;
  
  return {
    id: contribution.id,
    contribution_type: contribution.contribution_type,
    details: contribution.details,
    created_at: contribution.created_at,
    is_current: contribution.is_current,
    reliability_score: contribution.reliability_score,
    poi: contribution.poi ? {
      id: contribution.poi.id,
      name: contribution.poi.name,
      type: contribution.poi.poi_type,
      address: contribution.poi.address
    } : null,
    contributor: contribution.user ? {
      id: contribution.user.id,
      name: contribution.user.name,
      profile_picture: contribution.user.profile_picture
    } : null,
    validations: contribution.validations ? {
      valid: contribution.validations.filter(v => v.validation_type === 'valid').length,
      reports: contribution.validations.filter(v => v.validation_type === 'report').length
    } : { valid: 0, reports: 0 }
  };
}

/**
 * Determina o status de um POI baseado na última atualização e validações
 * @param {Date} lastUpdateTime - Data da última atualização
 * @param {Object} validationCounts - Contagem de validações e reportes
 * @param {Object} poiDetails - Detalhes específicos do POI
 * @returns {string} Código de status ('green', 'yellow', 'red', 'orange', 'unknown')
 */
function determineStatus(lastUpdateTime, validationCounts = null, poiDetails = null) {
  if (!lastUpdateTime) {
    return 'unknown';
  }

  const now = new Date();
  const updateTime = new Date(lastUpdateTime);
  const hoursSinceUpdate = (now - updateTime) / (1000 * 60 * 60);

  // Status baseado no tempo (base inicial)
  let timeBasedStatus;
  if (hoursSinceUpdate < 6) {
    timeBasedStatus = 'green'; // Muito recente (menos de 6h)
  } else if (hoursSinceUpdate < 12) {
    timeBasedStatus = 'green'; // Recente (menos de 12h)
  } else if (hoursSinceUpdate < 24) {
    timeBasedStatus = 'yellow'; // Moderadamente recente (menos de 24h)
  } else if (hoursSinceUpdate < 48) {
    timeBasedStatus = 'orange'; // Potencialmente desatualizado (1-2 dias)
  } else {
    timeBasedStatus = 'red'; // Desatualizado (mais de 2 dias)
  }

  // Se não temos dados de validação, retornar apenas baseado no tempo
  if (!validationCounts) {
    return timeBasedStatus;
  }

  // Calcular proporção de validações vs reportes
  const totalFeedback = validationCounts.valid + validationCounts.report;
  if (totalFeedback < 3) {
    // Feedback insuficiente, usar apenas tempo
    return timeBasedStatus;
  }

  const reportRatio = validationCounts.report / totalFeedback;

  // Ajustar status baseado no feedback dos usuários
  if (reportRatio > 0.5) {
    // Muitos reportes negativos, degradar status
    if (timeBasedStatus === 'green') return 'yellow';
    if (timeBasedStatus === 'yellow') return 'orange';
    return 'red';
  } else if (reportRatio > 0.3) {
    // Proporção significativa de reportes, degradar levemente
    if (timeBasedStatus === 'green') return 'yellow';
    return timeBasedStatus;
  } else if (validationCounts.valid > 5 && reportRatio < 0.1) {
    // Muitas validações positivas, melhorar status (exceto para muito antigos)
    if (timeBasedStatus === 'yellow') return 'green';
    if (timeBasedStatus === 'orange' && hoursSinceUpdate < 36) return 'yellow';
    if (timeBasedStatus === 'red' && hoursSinceUpdate < 72) return 'orange';
  }

  // Considerar detalhes específicos do POI (se disponíveis)
  if (poiDetails) {
    // Degradar status para ATMs sem dinheiro ou papel
    if (poiDetails.has_money === false && poiDetails.has_paper === false) {
      if (timeBasedStatus === 'green') return 'yellow';
      if (timeBasedStatus === 'yellow') return 'orange';
    }
    
    // Degradar status para postos sem combustível
    if (poiDetails.has_gasoline === false && poiDetails.has_diesel === false) {
      if (timeBasedStatus === 'green') return 'yellow';
      if (timeBasedStatus === 'yellow') return 'orange';
    }
  }

  return timeBasedStatus;
}

/**
 * Obtém rótulo legível para um código de status
 * @param {string} status - Código de status
 * @returns {string} Rótulo legível
 */
function getStatusLabel(status) {
  switch (status) {
    case 'green':
      return 'Atualizado (menos de 12h)';
    case 'yellow':
      return 'Atualização recente (menos de 24h)';
    case 'orange':
      return 'Potencialmente desatualizado (1-2 dias)';
    case 'red':
      return 'Desatualizado (mais de 2 dias)';
    case 'unknown':
    default:
      return 'Sem atualizações';
  }
}

/**
 * Calcular estatísticas de atividade recente de um usuário
 * @param {number} userId - ID do usuário
 * @returns {Promise<Object>} Estatísticas de atividade e confiabilidade
 */
async function calculateUserStats(userId) {
  try {
    // Buscar contribuições do usuário
    const contributions = await Contribution.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Validation,
          as: 'validations'
        }
      ]
    });

    if (!contributions || contributions.length === 0) {
      return {
        totalContributions: 0,
        totalValidations: 0,
        totalReports: 0,
        validationRatio: 0,
        recentActivityScore: 0
      };
    }

    // Calcular validações totais
    let totalValidations = 0;
    let totalReports = 0;
    
    // Calcular pontuação de atividade recente (últimos 30 dias)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    let recentContributions = 0;

    // Processar contribuições
    contributions.forEach(contribution => {
      // Contar validações
      if (contribution.validations) {
        contribution.validations.forEach(validation => {
          if (validation.validation_type === 'valid') {
            totalValidations++;
          } else if (validation.validation_type === 'report') {
            totalReports++;
          }
        });
      }
      
      // Verificar se é recente
      const contributionDate = new Date(contribution.created_at);
      if (contributionDate >= thirtyDaysAgo) {
        recentContributions++;
      }
    });

    // Calcular proporção de validações
    const totalFeedback = totalValidations + totalReports;
    const validationRatio = totalFeedback > 0 ? totalValidations / totalFeedback : 0;
    
    // Pontuação de atividade recente (0-1)
    // Máximo de 10 contribuições por mês para pontuação máxima
    const recentActivityScore = Math.min(1, recentContributions / 10);

    return {
      totalContributions: contributions.length,
      totalValidations,
      totalReports,
      validationRatio,
      recentActivityScore
    };
  } catch (error) {
    logger.error(`Erro ao calcular estatísticas do usuário ${userId}: ${error.message}`, { error });
    // Retornar valores padrão em caso de erro
    return {
      totalContributions: 0,
      totalValidations: 0,
      totalReports: 0,
      validationRatio: 0,
      recentActivityScore: 0
    };
  }
}

/**
 * Calcula agregados de validações para uma contribuição
 * @param {Array} validations - Array de validações
 * @returns {Object} Estatísticas agregadas
 */
function aggregateValidations(validations) {
  if (!validations || validations.length === 0) {
    return {
      valid: 0, 
      reports: 0, 
      total: 0,
      trustScore: 0,
      isReliable: false
    };
  }
  
  // Contar validações por tipo
  const validCount = validations.filter(v => v.validation_type === 'valid').length;
  const reportCount = validations.filter(v => v.validation_type === 'report').length;
  const total = validCount + reportCount;
  
  // Calcular pontuação de confiança (0-100)
  const trustScore = total > 0 ? Math.round((validCount / total) * 100) : 0;
  
  // Determinar se é confiável (pelo menos 3 validações e mais de 70% positivas)
  const isReliable = total >= 3 && (validCount / total) > 0.7;
  
  return {
    valid: validCount,
    reports: reportCount,
    total,
    trustScore,
    isReliable
  };
}

// Atualizar os exports para incluir as novas funções
module.exports = {
  createContribution,
  getContributionsByPoi,
  getContributionsInRegion,
  addValidation,
  calculatePoiStatus,
  calculateUserStats,
  aggregateValidations,
  determineStatus,
  getStatusLabel,
  calculateReliabilityScore
}; 