const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// 数据库连接配置
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'gcloud',
  username: process.env.DB_USER || 'gcloud',
  password: process.env.DB_PASSWORD || 'gcloud123',
  define: {
    // 使用下划线格式的表名和字段名
    underscored: true,
    freezeTableName: false // 允许Sequelize对表名进行复数化
  },
  logging: (msg) => {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(msg);
    }
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection
};