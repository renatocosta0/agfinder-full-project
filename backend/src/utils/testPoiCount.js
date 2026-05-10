const { PointOfInterest, sequelize } = require('../models');
const logger = require('./logger');

// Coordenadas de Luanda
const TEST_LAT = -8.8383;
const TEST_LNG = 13.2344;
const TEST_RADIUS = 50; // 50km

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

async function testPoiCounts() {
  try {
    logger.info('=== TESTE DE CONTAGEM DE POIS ===');
    
    // Calcular a distância usando a fórmula haversine
    const distanceQuery = haversineDistanceQuery(TEST_LAT, TEST_LNG);
    
    // Query para contar POIs por tipo dentro do raio
    const countQuery = `
      SELECT poi_type, COUNT(*) as total 
      FROM points_of_interest 
      WHERE ${distanceQuery} <= ${TEST_RADIUS}
      GROUP BY poi_type
    `;
    
    logger.info(`Executando query: ${countQuery}`);
    
    // Executar a query
    const countResults = await sequelize.query(countQuery, {
      type: sequelize.QueryTypes.SELECT
    });
    
    logger.info('Resultados da contagem:');
    logger.info(JSON.stringify(countResults));
    
    // Total geral
    const totalPois = countResults.reduce((sum, item) => sum + parseInt(item.total, 10), 0);
    logger.info(`Total geral de POIs: ${totalPois}`);
    
    // Testar paginação
    for (const type of ['atm', 'gasstation']) {
      logger.info(`\nTestando paginação para ${type}:`);
      
      const whereCondition = `${distanceQuery} <= ${TEST_RADIUS} AND poi_type = '${type}'`;
      
      // Contar total para este tipo
      const typeTotal = countResults.find(item => item.poi_type === type);
      logger.info(`Total de ${type} segundo a contagem: ${typeTotal ? typeTotal.total : 0}`);
      
      // Testar consulta paginada
      for (let page = 1; page <= 5; page++) {
        const limit = 20;
        const offset = (page - 1) * limit;
        
        // Consulta paginada
        const pagedQuery = `
          SELECT id, poi_type, name, ${distanceQuery} as distance
          FROM points_of_interest
          WHERE ${whereCondition}
          ORDER BY ${distanceQuery} ASC
          LIMIT ${limit} OFFSET ${offset}
        `;
        
        const pageResults = await sequelize.query(pagedQuery, {
          type: sequelize.QueryTypes.SELECT
        });
        
        logger.info(`Página ${page}: ${pageResults.length} resultados`);
        
        if (pageResults.length === 0) {
          logger.info(`Não há mais resultados para ${type} após a página ${page-1}`);
          break;
        }
        
        // Mostrar primeiro e último resultado
        if (pageResults.length > 0) {
          logger.info(`  Primeiro: ${JSON.stringify(pageResults[0])}`);
          logger.info(`  Último: ${JSON.stringify(pageResults[pageResults.length - 1])}`);
        }
      }
    }
    
    logger.info('\n=== TESTE CONCLUÍDO ===');
  } catch (error) {
    logger.error('Erro durante o teste:', error);
  } finally {
    // Encerrar conexão com o banco
    await sequelize.close();
  }
}

// Executar o teste
testPoiCounts(); 