const { sequelize } = require('../config/database');
const AccountSummary = require('../models/AccountSummary');
const logger = require('../src/utils/logger');

async function migrateAccountSummary() {
  try {
    logger.info('Starting AccountSummary table migration...');

    // 检查表是否已存在（MySQL语法）
    const [results] = await sequelize.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'account_summaries';"
    );

    if (results.length > 0) {
      logger.info('AccountSummary table already exists, skipping creation...');
      return;
    }

    // 创建表
    await AccountSummary.sync({ alter: true });

    logger.info('AccountSummary table created successfully');

    // 验证表结构（MySQL语法）
    const tableDesc = await sequelize.query(
      "DESCRIBE account_summaries;"
    );

    logger.info('AccountSummary table structure:', tableDesc[0]);

  } catch (error) {
    logger.error('Error migrating AccountSummary table:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateAccountSummary()
    .then(() => {
      logger.info('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateAccountSummary;