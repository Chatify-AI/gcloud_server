const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../src/utils/logger');

// 本地 MySQL 配置
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: 'localhost',
  port: 3306,
  database: 'gcloud',
  username: 'gcloud',
  password: 'gcloud123',
  logging: (msg) => logger.debug(msg),
  define: {
    timestamps: true,
    underscored: true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('MySQL database connected successfully to Azure');

    // Sync database - alter existing tables if needed
    await sequelize.sync({ alter: false });
    logger.info('Database synced');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };