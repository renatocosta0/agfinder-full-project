/**
 * Middleware para otimização de respostas
 * Implementa compressão, caching e outras otimizações para API
 */

const compression = require('compression');
const etag = require('etag');
const logger = require('../utils/logger');

/**
 * Configura compressão gzip/brotli para todas as respostas
 * Utiliza níveis diferentes de compressão baseado no tamanho da resposta
 */
exports.setupCompression = () => {
  return compression({
    // Função para determinar quando comprimir
    filter: (req, res) => {
      // Não comprimir conteúdo binário ou respostas pequenas
      if (req.headers['content-type'] && req.headers['content-type'].includes('image/')) {
        return false;
      }
      
      // Sempre comprimir o restante
      return true;
    },
    // Configurar nível de compressão
    level: 6, // Balanço entre velocidade e taxa de compressão (0-9)
    // Tamanho mínimo para compressão (respostas menores não são comprimidas)
    threshold: 1024 // 1KB
  });
};

/**
 * Configura headers de cache adequados
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
exports.setupCaching = (req, res, next) => {
  // Identificar recursos que podem ser cacheados
  const cacheable = req.method === 'GET' && (
    req.path.includes('/api/pois') ||
    req.path.includes('/api/sync/regions') ||
    req.path.includes('/api/sync/status')
  );
  
  if (cacheable) {
    // Valor padrão mais conservador
    let maxAge = 60; // 1 minuto
    
    // Recursos mais estáveis podem ter cache mais longo
    if (req.path.includes('/api/sync/regions')) {
      maxAge = 300; // 5 minutos
    } else if (req.path.includes('/api/pois') && req.query.id) {
      // Detalhes de POIs específicos
      maxAge = 300; // 5 minutos
    } else if (req.path.includes('/api/sync/status')) {
      maxAge = 120; // 2 minutos
    }
    
    // Se o cliente forneceu um ETag, verificar se podemos retornar 304 Not Modified
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag) {
      // Hook para verificar o ETag após a preparação da resposta
      const originalEnd = res.end;
      
      res.end = function (data) {
        // Gerar ETag baseado no conteúdo JSON (se disponível)
        if (res.get('Content-Type') && res.get('Content-Type').includes('application/json')) {
          const serverEtag = etag(data || '');
          
          // Se o ETag não mudou, retornar 304 Not Modified
          if (clientEtag === serverEtag) {
            res.status(304).end();
            return;
          }
          
          // Configurar ETag para resposta
          res.set('ETag', serverEtag);
        }
        
        // Continuar com o fluxo normal
        return originalEnd.apply(this, arguments);
      };
    }
    
    // Configurar headers padrão de cache
    res.set('Cache-Control', `public, max-age=${maxAge}`);
    res.set('Expires', new Date(Date.now() + (maxAge * 1000)).toUTCString());
    res.set('Vary', 'Accept-Encoding');
  } else {
    // Para recursos não-cacheáveis ou métodos que modificam dados
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
  }
  
  next();
};

/**
 * Otimiza resposta para dispositivos móveis
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
exports.optimizeForMobile = (req, res, next) => {
  const isMobile = req.headers['user-agent'] && (
    req.headers['user-agent'].includes('Mobile') ||
    req.headers['user-agent'].includes('Android')
  );
  
  // Se for uma requisição mobile, otimizar a resposta
  if (isMobile) {
    // Interceptar a resposta JSON
    const originalJson = res.json;
    
    res.json = function(data) {
      // Se tem uma grande lista de POIs, limitar campos
      if (data && data.data && data.data.pois && Array.isArray(data.data.pois) && data.data.pois.length > 5) {
        // Manter apenas campos essenciais para economizar dados móveis
        data.data.pois = data.data.pois.map(poi => ({
          id: poi.id,
          name: poi.name,
          poi_type: poi.poi_type,
          latitude: poi.latitude,
          longitude: poi.longitude,
          status: poi.status,
          reliability_score: poi.reliability_score,
          data_quality: poi.data_quality || undefined,
          distance: poi.distance || undefined
        }));
      }
      
      // Continuar com a resposta original
      return originalJson.call(this, data);
    };
  }
  
  next();
};

module.exports = {
  setupCompression,
  setupCaching,
  optimizeForMobile
}; 