/**
 * Serviço para gerenciar a sincronização de POIs
 * Registra as regiões já sincronizadas e evita atualizações desnecessárias
 */

const { PointOfInterest, sequelize } = require('../models');
const logger = require('../utils/logger');
const googleMapsService = require('./googleMaps.service');
const { SYNC_CONFIG } = require('../config/pois.config');
const cacheService = require('./cache.service');
const crypto = require('crypto');

// Armazenamento temporário do histórico de sincronização
// Em produção, isto poderia ser armazenado no banco de dados
const syncHistory = new Map();

// Tracking de requisições de sincronização em andamento
const pendingSyncs = new Set();

// Tracking de jobs de sincronização (in-memory)
const syncJobs = new Map();

// Coordenadas que delimitam Angola
const ANGOLA_BOUNDS = {
  latMin: -18.0, // Sul
  latMax: -4.0,  // Norte
  lngMin: 11.0,  // Oeste
  lngMax: 24.0   // Leste
};

// Coordenadas que delimitam a região metropolitana de Luanda (aproximado)
const LUANDA_BOUNDS = {
  latMin: -9.10,
  latMax: -8.70,
  lngMin: 13.00,
  lngMax: 13.50,
};

// Hotspots (municípios/bairros) da região de Luanda com coordenadas aproximadas
const LUANDA_HOTSPOTS = [
  { name: 'Ingombota', lat: -8.812, lng: 13.235 },
  { name: 'Maianga', lat: -8.839, lng: 13.228 },
  { name: 'Sambizanga', lat: -8.785, lng: 13.229 },
  { name: 'Cazenga', lat: -8.807, lng: 13.279 },
  { name: 'Viana', lat: -8.902, lng: 13.368 },
  { name: 'Cacuaco', lat: -8.804, lng: 13.369 },
  { name: 'Talatona', lat: -8.938, lng: 13.204 },
  { name: 'Kilamba', lat: -8.995, lng: 13.205 },
  { name: 'Belas', lat: -9.082, lng: 13.177 },
  { name: 'Icolo e Bengo', lat: -9.378, lng: 14.898 },
  { name: 'Quiçama', lat: -9.446, lng: 13.108 }
];

// Função para calcular a distância haversine
function haversineDistanceQuery(lat1, lng1) {
  return `
    (
      6371 * acos(
        cos(radians(${lat1})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng1})) +
        sin(radians(${lat1})) * sin(radians(latitude))
      )
    )
  `;
}

/**
 * Sincroniza hotspots selecionados de Luanda (municípios/bairros)
 * Usa syncRegionIfNeeded com force=true para semear rapidamente
 * @param {number} radiusKm
 * @param {string[]} types
 */
async function syncLuandaHotspots(radiusKm = 8, types = undefined) {
  const results = [];
  for (const spot of LUANDA_HOTSPOTS) {
    try {
      const r = await syncRegionIfNeeded(spot.lat, spot.lng, radiusKm, 'high', true, types);
      results.push({ name: spot.name, lat: spot.lat, lng: spot.lng, ...r });
      // pequena pausa entre hotspots
      await new Promise((rsv) => setTimeout(rsv, 500));
    } catch (err) {
      logger.error(`Erro ao sincronizar hotspot ${spot.name} (${spot.lat},${spot.lng}):`, err);
      results.push({ name: spot.name, lat: spot.lat, lng: spot.lng, error: err.message });
    }
  }
  return { processed: results.length, results };
}

/**
 * Executa sincronização progressiva apenas na região de Luanda
 * @param {number} tilesPerRun - quantidade de tiles por execução
 * @param {number} radiusKm - raio de busca por tile
 * @param {string[]} types - tipos de POI a sincronizar (opcional)
 */
async function syncLuandaGridProgressively(tilesPerRun = 20, radiusKm = SYNC_CONFIG.defaultRadius, types = undefined) {
  const grid = generateAngolaGrid(LUANDA_BOUNDS, radiusKm);
  if (grid.length === 0) {
    logger.warn('Luanda grid generation returned 0 points');
    return { processed: 0 };
  }

  let processed = 0;
  for (let i = 0; i < tilesPerRun; i++) {
    const idx = (luandaGridCursor + i) % grid.length;
    const { lat, lng } = grid[idx];

    try {
      await googleMapsService.syncRegionPOIs(lat, lng, radiusKm, types);
      processed++;
    } catch (err) {
      logger.error(`Error syncing Luanda grid tile at ${lat},${lng}:`, err);
    }

    // pequena pausa para respeitar cotas
    await new Promise((r) => setTimeout(r, 1000));
  }

  luandaGridCursor = (luandaGridCursor + tilesPerRun) % grid.length;
  return { processed, totalTiles: grid.length, nextCursor: luandaGridCursor };
}

/**
 * Verifica se uma coordenada está dentro dos limites de Angola
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} - Verdadeiro se estiver em Angola
 */
const isInAngola = (lat, lng) => {
  return (
    lat >= ANGOLA_BOUNDS.latMin &&
    lat <= ANGOLA_BOUNDS.latMax &&
    lng >= ANGOLA_BOUNDS.lngMin &&
    lng <= ANGOLA_BOUNDS.lngMax
  );
};

/**
 * Verifica se uma região precisa ser atualizada (persistente via Redis)
 * @param {string} regionKey - "lat,lng,radius"
 * @param {string} priority - 'high' | 'medium' | 'low'
 * @returns {Promise<boolean>}
 */
const needsUpdate = async (regionKey, priority = 'medium') => {
  try {
    // Try in-memory cache first
    let lastSync = syncHistory.get(regionKey);
    if (!lastSync) {
      const storedVal = await cacheService.get(`sync:region:${regionKey}`);
      if (storedVal) {
        lastSync = new Date(storedVal);
        syncHistory.set(regionKey, lastSync);
      }
    }

    if (!lastSync) return true;

    const now = new Date();
    const daysSinceLastSync = Math.floor((now - lastSync) / (1000 * 60 * 60 * 24));

    switch (priority) {
      case 'high':
        return daysSinceLastSync >= SYNC_CONFIG.updateFrequency.highTraffic;
      case 'low':
        return daysSinceLastSync >= SYNC_CONFIG.updateFrequency.lowTraffic;
      case 'medium':
      default:
        return daysSinceLastSync >= SYNC_CONFIG.updateFrequency.mediumTraffic;
    }
  } catch (err) {
    logger.error('needsUpdate error (fallback to update):', err);
    return true;
  }
};

/**
 * Registra que uma região foi sincronizada (persistente via Redis)
 * @param {string} regionKey
 */
const recordSync = async (regionKey) => {
  try {
    const now = new Date();
    syncHistory.set(regionKey, now);
    await cacheService.set(`sync:region:${regionKey}`, now.toISOString());
  } catch (err) {
    logger.error('recordSync redis error:', err);
  } finally {
    pendingSyncs.delete(regionKey);
  }
};

const createJobId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const startRegionSyncJob = (lat, lng, radius, priority = 'medium', force = false, types = undefined) => {
  const jobId = createJobId();
  const payload = { lat, lng, radius, priority, force: !!force, types };

  syncJobs.set(jobId, {
    jobId,
    type: 'sync-region',
    status: 'queued',
    payload,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    result: null,
    error: null,
  });

  setImmediate(async () => {
    const job = syncJobs.get(jobId);
    if (!job) return;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    syncJobs.set(jobId, job);

    try {
      const result = await syncRegionIfNeeded(lat, lng, radius, priority, !!force, types);
      const updatedJob = syncJobs.get(jobId);
      if (!updatedJob) return;
      updatedJob.status = 'completed';
      updatedJob.finishedAt = new Date().toISOString();
      updatedJob.result = result;
      syncJobs.set(jobId, updatedJob);
    } catch (err) {
      const updatedJob = syncJobs.get(jobId);
      if (!updatedJob) return;
      updatedJob.status = 'failed';
      updatedJob.finishedAt = new Date().toISOString();
      updatedJob.error = err && err.message ? err.message : String(err);
      syncJobs.set(jobId, updatedJob);
      logger.error(`Region sync job failed (jobId=${jobId}):`, err);
    }
  });

  return jobId;
};

const getRegionSyncJobStatus = (jobId) => {
  return syncJobs.get(jobId) || null;
};

/**
 * Verifica se uma região já está sendo sincronizada
 * @param {string} regionKey - Chave única para a região
 * @returns {boolean} - Se a região já está em processo de sincronização
 */
const isSyncInProgress = (regionKey) => {
  return pendingSyncs.has(regionKey);
};

/**
 * Sincroniza POIs para uma região se necessário
 * @param {number} lat - Latitude central
 * @param {number} lng - Longitude central
 * @param {number} radius - Raio em km
 * @param {string} priority - Prioridade da região ('high', 'medium', 'low')
 * @param {boolean} force - Força atualização mesmo se não for necessário
 * @returns {Promise<{updated: boolean, count: number}>} - Resultado da sincronização
 */
const syncRegionIfNeeded = async (lat, lng, radius, priority = 'medium', force = false, types = undefined) => {
  const regionKey = `${lat},${lng},${radius}`;

  // Verificar se está em Angola
  if (!isInAngola(lat, lng)) {
    logger.info(`Região ${regionKey} está fora de Angola - sincronização não permitida`);
    return { updated: false, count: 0, message: 'Região fora de Angola' };
  }

  // Verificar se já está sendo sincronizada
  if (isSyncInProgress(regionKey)) {
    logger.info(`Região ${regionKey} já está em processo de sincronização`);
    return { updated: false, count: 0, message: 'Sincronização já em andamento' };
  }

  // Verificar se precisa atualizar
  if (!force) {
    const updateNeeded = await needsUpdate(regionKey, priority);
    if (!updateNeeded) {
      logger.info(`Região ${regionKey} não precisa ser atualizada (última atualização há menos de ${SYNC_CONFIG.updateFrequency[priority]} dias)`);
      return { updated: false, count: 0 };
    }
  }

  try {
    // Marcar que está sincronizando
    pendingSyncs.add(regionKey);

    // Contar POIs existentes na região antes da sincronização
    const pointsBeforeCount = await countPOIsInRegion(lat, lng, radius);

    // Sincronizar a região
    await googleMapsService.syncRegionPOIs(lat, lng, radius, types);

    // Contar POIs depois da sincronização
    const pointsAfterCount = await countPOIsInRegion(lat, lng, radius);

    // Registrar a sincronização
    await recordSync(regionKey);

    logger.info(`Região ${regionKey} sincronizada com sucesso. POIs antes: ${pointsBeforeCount}, depois: ${pointsAfterCount}`);

    return {
      updated: true,
      count: pointsAfterCount,
      added: pointsAfterCount - pointsBeforeCount
    };
  } catch (error) {
    // Remover do conjunto de sincronizações pendentes em caso de erro
    pendingSyncs.delete(regionKey);
    logger.error(`Erro ao sincronizar região ${regionKey}:`, error);
    throw error;
  }
};

/**
 * Conta quantos POIs existem em uma determinada região
 * @param {number} lat - Latitude central
 * @param {number} lng - Longitude central
 * @param {number} radius - Raio em km
 * @returns {Promise<number>} - Número de POIs na região
 */
const countPOIsInRegion = async (lat, lng, radius) => {
  try {
    const distanceQuery = haversineDistanceQuery(lat, lng);

    const countQuery = `
      SELECT COUNT(*) AS count 
      FROM "points_of_interest"
      WHERE ${distanceQuery} <= ${radius}
    `;

    const result = await sequelize.query(countQuery, {
      type: sequelize.QueryTypes.SELECT,
      plain: true
    });

    return parseInt(result.count, 10) || 0;
  } catch (error) {
    logger.error(`Erro ao contar POIs na região ${lat},${lng},${radius}:`, error);
    return 0;
  }
};

/**
 * Obtém estatísticas de sincronização
 * @returns {Object} - Objeto com as estatísticas
 */
const getSyncStats = () => {
  return {
    activeRegions: pendingSyncs.size,
    syncHistory: syncHistory.size,
    queueStats: googleMapsService.getQueueStats()
  };
};

// --- Angola tiling support ---
// Keep an in-memory cursor to continue the grid progressively between runs
let gridCursor = 0;
let luandaGridCursor = 0;

/**
 * Busca os POIs mais antigos para priorizar atualização
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function fetchOldestPOIs(limit = 50) {
  try {
    const pois = await PointOfInterest.findAll({
      order: [['updated_at', 'ASC']],
      limit,
      attributes: ['id', 'latitude', 'longitude', 'updated_at']
    });
    return pois;
  } catch (err) {
    logger.error('Erro ao buscar POIs antigos:', err);
    return [];
  }
}

/**
 * Agrupa POIs em regiões por grade para chamadas eficientes
 * @param {Array} pois
 * @param {number} cellDeg - tamanho da célula em graus (~0.1 ~ 11km)
 * @returns {Map<string, {lat:number,lng:number,pois:Array}>}
 */
function groupPOIsIntoRegions(pois, cellDeg = 0.1) {
  const regions = new Map();
  for (const poi of pois) {
    const lat = parseFloat(poi.latitude);
    const lng = parseFloat(poi.longitude);
    if (!isFinite(lat) || !isFinite(lng)) continue;
    const key = `${Math.round(lat / cellDeg) * cellDeg},${Math.round(lng / cellDeg) * cellDeg}`;
    if (!regions.has(key)) {
      const [kLat, kLng] = key.split(',').map(Number);
      regions.set(key, { lat: kLat, lng: kLng, pois: [] });
    }
    regions.get(key).pois.push(poi);
  }
  return regions;
}

/**
 * Gera uma malha (grid) de coordenadas que cobre Angola usando um passo aproximado por raio
 * @param {{latMin:number,latMax:number,lngMin:number,lngMax:number}} bounds
 * @param {number} radiusKm - raio usado por região
 * @returns {Array<{lat:number,lng:number}>}
 */
function generateAngolaGrid(bounds, radiusKm) {
  const stepKm = radiusKm * 1.6; // leve sobreposição entre círculos (~60%)
  const latStepDeg = stepKm / 111.0;
  const points = [];

  for (let lat = bounds.latMin; lat <= bounds.latMax; lat += latStepDeg) {
    const lngFactor = Math.cos((lat * Math.PI) / 180);
    const lngStepDeg = stepKm / (111.0 * Math.max(lngFactor, 0.1));
    for (let lng = bounds.lngMin; lng <= bounds.lngMax; lng += lngStepDeg) {
      points.push({ lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 });
    }
  }
  return points;
}

/**
 * Executa sincronização progressiva da malha de Angola, processando um número limitado de tiles por execução
 * @param {number} tilesPerRun - quantidade de tiles por execução
 * @param {number} radiusKm - raio de busca por tile
 */
async function syncAngolaGridProgressively(tilesPerRun = 20, radiusKm = SYNC_CONFIG.defaultRadius) {
  const grid = generateAngolaGrid(ANGOLA_BOUNDS, radiusKm);
  if (grid.length === 0) {
    logger.warn('Angola grid generation returned 0 points');
    return { processed: 0 };
  }

  let processed = 0;
  for (let i = 0; i < tilesPerRun; i++) {
    const idx = (gridCursor + i) % grid.length;
    const { lat, lng } = grid[idx];

    try {
      const result = await googleMapsService.syncRegionPOIs(lat, lng, radiusKm);
      logger.info(`Grid sync tile ${idx + 1}/${grid.length} at ${lat},${lng} -> ${result} POIs`);
      processed++;
    } catch (err) {
      logger.error(`Error syncing grid tile at ${lat},${lng}:`, err);
    }

    // pequena pausa para respeitar cotas
    await new Promise((r) => setTimeout(r, 1000));
  }

  gridCursor = (gridCursor + tilesPerRun) % grid.length;
  return { processed, totalTiles: grid.length, nextCursor: gridCursor };
}

module.exports = {
  syncRegionIfNeeded,
  needsUpdate,
  recordSync,
  startRegionSyncJob,
  getRegionSyncJobStatus,
  isInAngola,
  getSyncStats,
  generateAngolaGrid,
  syncAngolaGridProgressively,
  syncLuandaGridProgressively,
  syncLuandaHotspots,
  fetchOldestPOIs,
  groupPOIsIntoRegions
};