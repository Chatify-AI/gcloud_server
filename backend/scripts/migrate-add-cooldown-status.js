#!/usr/bin/env node

/**
 * 添加 all_failed_cooldown 状态到 monitor_status ENUM
 */

const { sequelize } = require('../config/database');

async function addCooldownStatus() {
  try {
    console.log('开始添加 all_failed_cooldown 状态到 monitor_status ENUM...');

    // 检查当前表结构
    const tableDesc = await sequelize.getQueryInterface().describeTable('gcloud_monitor_logs');
    console.log('当前 monitor_status 字段定义:', tableDesc.monitor_status);

    // 修改 ENUM 类型，添加新状态
    await sequelize.query(`
      ALTER TABLE gcloud_monitor_logs
      MODIFY COLUMN monitor_status ENUM(
        'started',
        'checking',
        'success',
        'failed',
        'script_executed',
        'skipped',
        'completed',
        'script_started',
        'disabled',
        'partial_failure',
        'all_failed_cooldown'
      ) DEFAULT 'started'
      COMMENT 'Status of the monitoring task'
    `);

    console.log('✅ 成功添加 all_failed_cooldown 状态');

    // 验证修改结果
    const updatedTableDesc = await sequelize.getQueryInterface().describeTable('gcloud_monitor_logs');
    console.log('更新后 monitor_status 字段定义:', updatedTableDesc.monitor_status);

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
}

// 运行迁移
if (require.main === module) {
  addCooldownStatus()
    .then(() => {
      console.log('迁移完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('迁移失败:', error);
      process.exit(1);
    });
}

module.exports = { addCooldownStatus };