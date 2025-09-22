const { sequelize } = require('../config/database');
const { QueryInterface } = require('sequelize');

async function addTestDetailsField() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Checking if testDetails field needs to be added...');

    // 获取表结构
    const tableDesc = await queryInterface.describeTable('gcloud_monitor_logs');

    // 添加 testDetails 字段（如果不存在）
    if (!tableDesc.test_details) {
      console.log('Adding test_details field...');
      await queryInterface.addColumn('gcloud_monitor_logs', 'test_details', {
        type: sequelize.Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON array containing detailed test results with timing information'
      });
      console.log('Successfully added test_details field');
    } else {
      console.log('test_details field already exists');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// 执行迁移
addTestDetailsField();