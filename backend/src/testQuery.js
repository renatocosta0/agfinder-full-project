const { Sequelize } = require('sequelize');
const logger = require('./utils/logger');

// Configurações de conexão com o banco
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: 'localhost', // Usando o host local
  port: 5432, // Porta padrão do PostgreSQL
  username: 'postgres',
  password: 'postgres',
  database: 'agfinder',
  logging: console.log,
});

// Modelo PointOfInterest definido manualmente
const PointOfInterest = sequelize.define('PointOfInterest', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  poi_type: Sequelize.STRING,
  google_place_id: Sequelize.STRING,
  name: Sequelize.STRING,
  address: Sequelize.STRING,
  latitude: Sequelize.FLOAT,
  longitude: Sequelize.FLOAT,
  created_at: Sequelize.DATE,
  updated_at: Sequelize.DATE
}, {
  tableName: 'points_of_interest',
  timestamps: false
});

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

async function testQuery() {
  try {
    // Testar conexão
    await sequelize.authenticate();
    console.log('Conexão com o banco estabelecida com sucesso.');
    
    // Parâmetros de teste
    const lat = -23.550520;
    const lng = -46.633308;
    const radius = 5;
    const type = 'atm';
    
    // Build where clause
    const where = { poi_type: type };
    
    // Calculate distance using haversine formula (km)
    const distanceQuery = haversineDistanceQuery(lat, lng);
    
    console.log('Executando teste de consulta...');
    
    // Contar POIs na região
    const countQuery = `
      SELECT COUNT(*) AS total FROM "points_of_interest" 
      WHERE ${distanceQuery} <= ${radius}
      ${type ? ` AND poi_type = '${type}'` : ''}
    `;
    
    console.log('Consulta de contagem:', countQuery);
    
    // Execute a query e ler o resultado
    const countResult = await sequelize.query(countQuery, {
      type: sequelize.QueryTypes.SELECT,
      plain: true,
    });
    
    console.log('Resultado da contagem:', countResult);
    
    // Testar a consulta principal com a condição de distância no WHERE
    const pois = await PointOfInterest.findAll({
      where: {
        ...where,
        ...sequelize.literal(`${distanceQuery} <= ${radius}`),
      },
      attributes: [
        'id',
        'poi_type',
        'name',
        'latitude',
        'longitude',
        [sequelize.literal(distanceQuery), 'distance'],
      ],
      limit: 5,
    });
    
    console.log(`Encontrados ${pois.length} POIs`);
    
    if (pois.length > 0) {
      console.log('Primeiro POI encontrado:', {
        id: pois[0].id,
        name: pois[0].name,
        distance: pois[0].getDataValue('distance')
      });
    }
    
    console.log('Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('Erro durante o teste:', error);
  } finally {
    // Fechar conexão
    await sequelize.close();
  }
}

// Executar o teste
testQuery(); 