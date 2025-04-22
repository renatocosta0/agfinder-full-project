const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require('../config/database')[env];
const logger = require('../utils/logger');

// Create Sequelize instance
const sequelize = new Sequelize(config.url, config);

// Initialize models object
const db = {};

// Primeiro carrega o modelo User para garantir que será criado antes
const userModel = require(path.join(__dirname, 'user.js'))(sequelize, Sequelize.DataTypes);
db[userModel.name] = userModel;

// Depois importa os demais modelos
fs.readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js') && file !== 'user.js';
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Set up model associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Add Sequelize and sequelize instance to db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db; 