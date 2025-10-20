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
    logger.info('MySQL database connected successfully to Azure');

    // Sync database - skip AccountSummary as it's managed by SQL init script
    // and has schema mismatch with the model
    const models = Object.values(sequelize.models).filter(
      model => model.name !== 'AccountSummary'
    );

    for (const model of models) {
      await model.sync({ alter: false });
      logger.debug(`Synced model: ${model.name}`);
    }

    logger.info('Database synced (AccountSummary skipped)');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };