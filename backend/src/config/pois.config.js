/**
 * Configurações para sincronização de Points of Interest (POIs)
 */

// Coordenadas das principais cidades
const CITY_COORDINATES = {
  // Angola
  luanda: { lat: -8.838333, lng: 13.234444 },
  benguela: { lat: -12.578889, lng: 13.407222 },
  lubango: { lat: -14.917222, lng: 13.491667 },
  huambo: { lat: -12.776667, lng: 15.734167 },
  lobito: { lat: -12.354722, lng: 13.533056 },
  // Adicione mais cidades conforme necessário
};

// Cidades prioritárias para atualizações programadas
const PRIORITY_CITIES = [
  'luanda',   // Capital e maior cidade
  'benguela', // Segunda maior cidade
  'lubango',  // Cidade importante no sul
  // Adicione ou remova cidades conforme necessário
];

// Configurações de sincronização
const SYNC_CONFIG = {
  defaultRadius: 20,  // Raio padrão em km para sincronização
  maxRadius: 50,      // Raio máximo permitido em km
  updateFrequency: {
    highTraffic: 7,    // Dias entre atualizações para áreas de alto tráfego
    mediumTraffic: 14, // Dias para áreas de médio tráfego
    lowTraffic: 30     // Dias para áreas de baixo tráfego
  }
};

// Tipos de POIs suportados
const POI_TYPES = {
  atm: {
    googleType: 'atm',
    description: 'Caixas eletrônicos',
  },
  gasstation: {
    googleType: 'gas_station',
    description: 'Postos de gasolina',
  }
  // Adicione mais tipos no futuro se necessário
};

module.exports = {
  CITY_COORDINATES,
  PRIORITY_CITIES,
  SYNC_CONFIG,
  POI_TYPES
}; 