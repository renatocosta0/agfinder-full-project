/**
 * Middleware para análise de qualidade de dados
 * Adiciona informações de confiabilidade e qualidade às respostas
 */

const { PointOfInterest, Contribution, SyncRegion } = require('../models');
const logger = require('../utils/logger');

/**
 * Calcula e adiciona scores de confiabilidade para POIs
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
exports.calculateReliabilityScores = async (req, res, next) => {
  // Só aplicar em rotas específicas
  const shouldProcess = req.path.includes('/api/pois') || 
                        req.path.includes('/api/sync/regions');
  
  if (!shouldProcess) {
    return next();
  }
  
  // Hook para interceptar a resposta
  const originalJson = res.json;
  
  res.json = function(data) {
    // Verificar se há POIs na resposta
    if (data && data.success && data.data) {
      
      // Adicionar informações de confiabilidade para POIs em arrays
      if (data.data.pois && Array.isArray(data.data.pois)) {
        data.data.pois = data.data.pois.map(poi => {
          // Adicionar informações de qualidade
          return {
            ...poi,
            data_quality: {
              score: poi.reliability_score,
              level: getQualityLevel(poi.reliability_score),
              is_expired: poi.data_expiration ? new Date() > new Date(poi.data_expiration) : false,
              freshness: calculateDataFreshness(poi.updated_at)
            }
          };
        });
        
        // Adicionar estatísticas agregadas de qualidade
        if (data.data.pois.length > 0) {
          const reliabilityScores = data.data.pois.map(poi => 
            typeof poi.reliability_score === 'number' ? poi.reliability_score : 
            parseFloat(poi.reliability_score || 0)
          );
          
          const avgScore = reliabilityScores.reduce((sum, score) => sum + score, 0) / reliabilityScores.length;
          
          data.data.meta = {
            ...data.data.meta,
            data_quality: {
              average_score: parseFloat(avgScore.toFixed(2)),
              level: getQualityLevel(avgScore),
              expired_count: data.data.pois.filter(p => 
                p.data_expiration && new Date() > new Date(p.data_expiration)
              ).length
            }
          };
        }
      }
      
      // Adicionar informações para POI único
      if (data.data.poi && !Array.isArray(data.data.poi)) {
        const poi = data.data.poi;
        
        data.data.poi.data_quality = {
          score: poi.reliability_score,
          level: getQualityLevel(poi.reliability_score),
          is_expired: poi.data_expiration ? new Date() > new Date(poi.data_expiration) : false,
          freshness: calculateDataFreshness(poi.updated_at)
        };
      }
      
      // Adicionar informações para regiões
      if (data.data.regions && Array.isArray(data.data.regions)) {
        data.data.regions = data.data.regions.map(region => {
          // Adicionar scores de qualidade para regiões
          return {
            ...region,
            data_quality: calculateRegionQuality(region)
          };
        });
      }
    }
    
    // Continuar com a resposta original
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Determina o nível de qualidade com base no score
 * @param {number} score - Score de confiabilidade (0-10)
 * @returns {string} Nível de qualidade (low, medium, high)
 */
function getQualityLevel(score) {
  if (score >= 8) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

/**
 * Calcula a "frescura" dos dados
 * @param {string|Date} updatedAt - Data de atualização
 * @returns {Object} Informações de frescura dos dados
 */
function calculateDataFreshness(updatedAt) {
  if (!updatedAt) return { level: 'unknown' };
  
  const now = new Date();
  const lastUpdate = new Date(updatedAt);
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  
  if (hoursSinceUpdate < 24) {
    return {
      level: 'fresh',
      hours_since_update: Math.round(hoursSinceUpdate)
    };
  } else if (hoursSinceUpdate < 72) {
    return {
      level: 'recent',
      hours_since_update: Math.round(hoursSinceUpdate),
      days_since_update: Math.round(hoursSinceUpdate / 24)
    };
  } else {
    return {
      level: 'stale',
      days_since_update: Math.round(hoursSinceUpdate / 24)
    };
  }
}

/**
 * Calcula a qualidade geral de uma região de sincronização
 * @param {Object} region - Objeto de região
 * @returns {Object} Informações de qualidade da região
 */
function calculateRegionQuality(region) {
  // Se tiver stats, usar para cálculo mais preciso
  if (region.stats) {
    const { activePoiCount, totalPoiCount } = region.stats;
    
    // Calcular um score baseado na cobertura ativa e data da última sincronização
    const coverageScore = totalPoiCount > 0 ? (activePoiCount / totalPoiCount) * 10 : 5;
    
    // Calcular score de atualização
    let freshnessScore = 5;
    if (region.last_sync_at) {
      const hoursSinceSync = (new Date() - new Date(region.last_sync_at)) / (1000 * 60 * 60);
      // Score inverso - quanto mais recente, melhor
      freshnessScore = Math.max(0, 10 - (hoursSinceSync / 24));
    }
    
    // Score combinado
    const qualityScore = (coverageScore * 0.6) + (freshnessScore * 0.4);
    
    return {
      score: parseFloat(qualityScore.toFixed(2)),
      level: getQualityLevel(qualityScore),
      coverage: parseFloat((activePoiCount / Math.max(1, totalPoiCount) * 100).toFixed(1)),
      freshness: calculateDataFreshness(region.last_sync_at)
    };
  }
  
  // Cálculo simplificado sem stats
  let qualityScore = 5; // Neutro por padrão
  
  // Ajustar com base na prioridade e status
  if (region.priority >= 8) qualityScore += 1;
  if (region.status === 'error') qualityScore -= 2;
  if (region.last_sync_at) {
    const daysSinceSync = (new Date() - new Date(region.last_sync_at)) / (1000 * 60 * 60 * 24);
    if (daysSinceSync < 1) qualityScore += 2;
    else if (daysSinceSync > 7) qualityScore -= 1;
  } else {
    qualityScore -= 1; // Nunca sincronizado
  }
  
  return {
    score: Math.min(10, Math.max(0, qualityScore)),
    level: getQualityLevel(qualityScore),
    freshness: calculateDataFreshness(region.last_sync_at)
  };
}

module.exports = {
  calculateReliabilityScores
}; 