#!/usr/bin/env node

/**
 * Script para sincronizar POIs do Google Maps
 * Este script pode ser executado manualmente ou como um cron job
 * 
 * Uso: 
 *   node syncGoogleMapsPOIs.js [OPTIONS]
 * 
 * Opções:
 *   --city=CITY_NAME    Nome da cidade (default: Luanda)
 *   --radius=RADIUS     Raio em km (default: 20)
 *   --type=POI_TYPE     Tipo de POI a sincronizar (atm, gasstation, all)
 */

require('dotenv').config();
const googleMapsService = require('../services/googleMaps.service');
const logger = require('../utils/logger');

// Coordenadas de cidades
const CITY_COORDINATES = {
  luanda: { lat: -8.838333, lng: 13.234444 },
  benguela: { lat: -12.578889, lng: 13.407222 },
  lubango: { lat: -14.917222, lng: 13.491667 },
  huambo: { lat: -12.776667, lng: 15.734167 },
  lobito: { lat: -12.354722, lng: 13.533056 },
};

// Função para analisar argumentos da linha de comando
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    city: 'luanda',
    radius: 20,
    type: 'all'
  };

  for (const arg of args) {
    if (arg.startsWith('--city=')) {
      options.city = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--radius=')) {
      options.radius = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1].toLowerCase();
    }
  }

  return options;
};

// Função principal
const syncPOIs = async () => {
  try {
    const options = parseArgs();
    
    // Validar cidade
    if (!CITY_COORDINATES[options.city]) {
      logger.error(`Cidade inválida: ${options.city}`);
      logger.info(`Cidades disponíveis: ${Object.keys(CITY_COORDINATES).join(', ')}`);
      process.exit(1);
    }
    
    // Validar raio
    if (options.radius <= 0 || options.radius > 50) {
      logger.error(`Raio inválido: ${options.radius}. Deve estar entre 0 e 50 km.`);
      process.exit(1);
    }
    
    // Validar tipo
    if (options.type !== 'all' && options.type !== 'atm' && options.type !== 'gasstation') {
      logger.error(`Tipo inválido: ${options.type}. Deve ser 'atm', 'gasstation' ou 'all'.`);
      process.exit(1);
    }
    
    const { lat, lng } = CITY_COORDINATES[options.city];
    logger.info(`Iniciando sincronização de POIs em ${options.city} (${lat}, ${lng}) com raio de ${options.radius}km`);
    
    if (options.type === 'all') {
      // Sincronizar todos os tipos
      await googleMapsService.syncRegionPOIs(lat, lng, options.radius);
    } else {
      // Sincronizar apenas um tipo específico
      await googleMapsService.fetchAndSavePOIs(lat, lng, options.radius, options.type);
    }
    
    logger.info('Sincronização concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    logger.error('Erro durante a sincronização:', error);
    process.exit(1);
  }
};

// Executar se for chamado diretamente
if (require.main === module) {
  syncPOIs();
}

module.exports = syncPOIs; 