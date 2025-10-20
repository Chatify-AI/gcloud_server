const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../src/utils/logger');

// 本地 MySQL 配置
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'gcloud',
  username: process.env.DB_USER || 'gcloud',
  password: process.env.DB_PASSWORD || 'gcloud123',
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
    logger.info('MySQL database connected successfully');

    // Skip Sequelize sync in production - tables are managed by SQL init scripts
    // This prevents schema/index mismatch errors between models and SQL definitions
    if (process.env.NODE_ENV === 'production') {
      logger.info('Skipping database sync (production mode - tables managed by SQL scripts)');
    } else {
      // In development, sync without altering existing tables
      await sequelize.sync({ alter: false });
      logger.info('Database synced (development mode)');
    }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };