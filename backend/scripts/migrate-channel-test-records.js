const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const ChannelTestRecord = require('../models/ChannelTestRecord');

async function migrate() {
  try {
    console.log('Starting migration for ChannelTestRecord table...');

    // 检查表是否存在 (MySQL语法)
    const results = await sequelize.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'gcloud' AND TABLE_NAME = 'channel_test_records'",
      { type: QueryTypes.SELECT }
    );

    if (results.length === 0) {
      console.log('Creating channel_test_records table...');

      // 使用 sync 创建表
      await ChannelTestRecord.sync({ alter: true });

      console.log('✅ Table channel_test_records created successfully');
    } else {
      console.log('Table channel_test_records already exists, updating structure...');

      // 如果表已存在，使用 alter 更新结构
      await ChannelTestRecord.sync({ alter: true });

      console.log('✅ Table channel_test_records updated successfully');
    }

    // 验证表结构 (MySQL语法)
    const tableInfo = await sequelize.query(
      "DESCRIBE channel_test_records",
      { type: QueryTypes.SELECT }
    );

    console.log('\nTable structure:');
    tableInfo.forEach(column => {
      console.log(`  - ${column.Field} (${column.Type})`);
    });

    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();