/**
 * Configuration for Google Maps API integration
 */

// Google Maps API key configuration
const API_KEYS = {
  places: process.env.GOOGLE_MAPS_API_KEY,
  geocoding: process.env.GOOGLE_MAPS_API_KEY,
  // Use separate API keys for different services if needed
};

// API rate limits and configuration
const API_CONFIG = {
  // Request limits per API
  places: {
    requestsPerDay: parseInt(process.env.MAPS_API_REQUESTS_PER_DAY || '25000', 10),
    requestsPerMinute: parseInt(process.env.MAPS_API_REQUESTS_PER_MINUTE || '100', 10),
    maxConcurrent: parseInt(process.env.MAPS_API_MAX_CONCURRENT || '5', 10),
  },
  geocoding: {
    requestsPerDay: parseInt(process.env.GEOCODING_API_REQUESTS_PER_DAY || '10000', 10),
    requestsPerMinute: parseInt(process.env.GEOCODING_API_REQUESTS_PER_MINUTE || '50', 10),
  },
  
  // Retry configuration
  retry: {
    attempts: parseInt(process.env.MAPS_API_RETRY_ATTEMPTS || '3', 10),
    initialDelay: parseInt(process.env.MAPS_API_RETRY_DELAY || '2000', 10),
    maxDelay: parseInt(process.env.MAPS_API_MAX_RETRY_DELAY || '10000', 10),
  },
  
  // Network configuration
  timeout: {
    default: parseInt(process.env.MAPS_API_TIMEOUT || '5000', 10),
    slowConnection: parseInt(process.env.MAPS_API_SLOW_TIMEOUT || '15000', 10),
  }
};

// POI type configuration
const POI_TYPES = {
  atm: {
    googleType: 'atm',
    description: 'Caixas eletrônicos',
    fields: [
      'place_id', 'name', 'geometry', 'vicinity', 
      'business_status', 'opening_hours', 'photos', 
      'types', 'rating', 'user_ratings_total'
    ],
    minResults: 10,
  },
  gasstation: {
    googleType: 'gas_station',
    description: 'Postos de gasolina',
    fields: [
      'place_id', 'name', 'geometry', 'vicinity', 
      'business_status', 'opening_hours', 'photos', 
      'types', 'rating', 'user_ratings_total'
    ],
    minResults: 5,
  }
};

// Radius expansion strategy
const RADIUS_EXPANSION = {
  steps: [5000, 15000, 50000], // Passos de expansão em metros
  maxExpansionAttempts: 3
};

// Cache configuration
const CACHE_CONFIG = {
  // Base TTL values in seconds
  ttl: {
    highDensity: 3600 * 12,    // 12 hours for high density areas
    mediumDensity: 3600 * 24,   // 24 hours for medium density
    lowDensity: 3600 * 48,      // 48 hours for low density
  },
  
  // Prefetch configuration
  prefetch: {
    enabled: true,
    popularRegions: ['luanda_center', 'luanda_talatona', 'luanda_benfica'],
    prefetchRadius: 1000, // meters
  },
  
  // Compression configuration
  compression: {
    enabled: true,
    threshold: 1024, // bytes
  }
};

// Angola-specific configuration
const ANGOLA_CONFIG = {
  // Luanda regions of interest
  luanda: {
    center: { lat: -8.838333, lng: 13.234444 },
    districts: {
      luanda_center: { lat: -8.838333, lng: 13.234444 },
      talatona: { lat: -8.9179, lng: 13.1905 },
      benfica: { lat: -8.9915, lng: 13.1578 },
      viana: { lat: -8.9075, lng: 13.3630 },
      cacuaco: { lat: -8.7760, lng: 13.3689 },
      // Add more districts as needed
    },
    defaultRadius: 20000, // meters
  },
  
  // Other major cities
  majorCities: {
    benguela: { lat: -12.578889, lng: 13.407222 },
    lubango: { lat: -14.917222, lng: 13.491667 },
    huambo: { lat: -12.776667, lng: 15.734167 },
    // Add more cities as needed
  },
  
  // Network quality zones (for adaptive timeouts)
  networkQualityZones: {
    good: ['talatona', 'luanda_center', 'benfica'],
    medium: ['viana', 'cacuaco'],
    poor: ['rural_areas']
  }
};

// Configuração dos jobs
const JOBS_CONFIG = {
  // Configuração do job de coleta de POIs
  poisCollector: {
    // Horários de execução com diferentes taxas de processamento
    processingRates: {
      // Horários de baixo uso (noite/madrugada) - 01:00 - 07:59
      lowUsage: {
        startHour: 1,
        endHour: 8,
        regionsPerHour: 12, // ~12 regiões por hora
        waitBetweenRegions: 5 * 60 * 1000 // 5 minutos
      },
      // Horários de uso moderado - 08:00 - 13:59 e 20:00 - 00:59
      mediumUsage: {
        startHours: [8, 20],
        endHours: [14, 24],
        regionsPerHour: 8, // ~8 regiões por hora
        waitBetweenRegions: 7.5 * 60 * 1000 // 7.5 minutos
      },
      // Horários de pico - 14:00 - 19:59
      highUsage: {
        startHour: 14,
        endHour: 20,
        regionsPerHour: 4, // ~4 regiões por hora
        waitBetweenRegions: 15 * 60 * 1000 // 15 minutos
      }
    },
    
    // Limites de segurança
    safetyLimits: {
      quotaPercentage: 70, // Limite de segurança da quota diária (em %)
      maxErrorRate: 15, // Taxa máxima de erros permitida (em %)
      maxRuntime: 23 * 60 * 60 * 1000, // Tempo máximo de execução contínua (23 horas)
      pauseDuration: 30 * 60 * 1000 // Duração da pausa após atingir limite (30 minutos)
    },
    
    // Definições de retry
    retry: {
      maxAttempts: 3,
      initialDelay: 60 * 1000, // 1 minuto
      maxDelay: 10 * 60 * 1000, // 10 minutos
      backoffFactor: 2, // Multiplicador para retry exponencial
      retryableErrors: [
        'TIMEOUT', 
        'ZERO_RESULTS',
        'OVER_QUERY_LIMIT', 
        'NETWORK_ERROR'
      ]
    },
    
    // Priorização de regiões
    prioritization: {
      // Pesos para o cálculo de prioridade
      weights: {
        density: 0.5,
        timeSinceLastSync: 0.3,
        userActivity: 0.2
      },
      // Tempo máximo sem atualização por densidade (em dias)
      maxStaleness: {
        very_high: 3,
        high: 7,
        medium: 14,
        low: 30
      }
    }
  },
  
  // Configuração do job de reset diário
  dailyReset: {
    // Horário de execução
    executionTime: {
      hour: 3, // 3h da manhã
      minute: 0
    },
    // Duração máxima de execução
    maxRuntime: 30 * 60 * 1000, // 30 minutos
    // Tentativas em caso de falha
    retryTimes: [
      { hour: 4, minute: 0 },
      { hour: 5, minute: 0 }
    ],
    // Configurações de expiração de contribuições
    contributions: {
      expirationHours: 72, // Contribuições expiram após 72 horas
      minValidationsRequired: 2 // Número mínimo de validações para confirmar
    }
  }
};

// Configuração de sincronização de POIs
const SYNC_CONFIG = {
  // Frequência de atualização por tipo de tráfego (em dias)
  updateFrequency: {
    highTraffic: 3,    // Áreas de alto tráfego a cada 3 dias
    mediumTraffic: 7,  // Áreas de médio tráfego a cada 7 dias
    lowTraffic: 30     // Áreas de baixo tráfego a cada 30 dias
  },
  
  // Tipos de POIs a serem sincronizados
  syncTypes: ['atm', 'gasstation'],
  
  // Número máximo de POIs a serem armazenados por região
  maxPoisPerRegion: {
    atm: 50,
    gasstation: 30
  },
  
  // Configurações de sincronização inicial
  initialSync: {
    enableParallel: false, // Sincronização paralela desativada inicialmente
    maxConcurrent: 2 // Máximo de sincronizações paralelas (se habilitado)
  }
};

module.exports = {
  API_KEYS,
  API_CONFIG,
  POI_TYPES,
  RADIUS_EXPANSION,
  CACHE_CONFIG,
  ANGOLA_CONFIG,
  JOBS_CONFIG,
  SYNC_CONFIG
}; 