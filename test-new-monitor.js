#!/usr/bin/env node

/**
 * 测试新的线程化监控系统
 */

const gcloudMonitorService = require('./backend/services/gcloudMonitorService');
const GCloudAccount = require('./backend/models/GCloudAccount');
const logger = require('./backend/src/utils/logger');

async function testNewMonitorSystem() {
  try {
    console.log('=== 测试新的线程化监控系统 ===\n');

    // 1. 检查监控服务状态
    console.log('1. 检查监控服务当前状态...');
    const initialStatus = gcloudMonitorService.getStatus();
    console.log('初始状态:', JSON.stringify(initialStatus, null, 2));

    // 2. 查找需要监控的账号
    console.log('\n2. 查找需要监控的账号...');
    const accounts = await GCloudAccount.findAll({
      where: {
        needMonitor: true,
        isActive: true
      }
    });
    console.log(`找到 ${accounts.length} 个需要监控的账号:`);
    accounts.forEach(account => {
      console.log(`  - ${account.email} (ID: ${account.id}, scriptCount: ${account.scriptExecutionCount})`);
    });

    if (accounts.length === 0) {
      console.log('没有找到需要监控的账号，创建一个测试账号...');

      // 创建测试账号
      const testAccount = await GCloudAccount.create({
        email: 'test-monitor@example.com',
        displayName: 'Test Monitor Account',
        projectId: 'test-project',
        isActive: true,
        needMonitor: true,
        scriptExecutionCount: 0
      });

      console.log(`创建测试账号: ${testAccount.email} (ID: ${testAccount.id})`);
      accounts.push(testAccount);
    }

    // 3. 启动监控服务
    console.log('\n3. 启动监控服务...');
    await gcloudMonitorService.start();

    // 4. 检查服务启动后的状态
    console.log('\n4. 检查服务启动后的状态...');
    const runningStatus = gcloudMonitorService.getStatus();
    console.log('运行状态:', JSON.stringify(runningStatus, null, 2));

    // 5. 等待一段时间观察监控活动
    console.log('\n5. 等待60秒观察监控活动...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    // 6. 检查监控统计
    console.log('\n6. 检查监控统计...');
    const stats = await gcloudMonitorService.getStats();
    console.log('监控统计:', JSON.stringify(stats, null, 2));

    // 7. 获取最近的监控日志
    console.log('\n7. 获取最近的监控日志...');
    const logs = await gcloudMonitorService.getLogs({ pageSize: 5 });
    console.log(`最近 ${logs.logs.length} 条日志:`);
    logs.logs.forEach(log => {
      console.log(`  - ${log.accountEmail}: ${log.monitorStatus} (${log.message || 'No message'})`);
    });

    // 8. 测试添加和移除账号
    console.log('\n8. 测试动态添加和移除账号...');
    if (accounts.length > 0) {
      const testAccount = accounts[0];
      console.log(`移除账号 ${testAccount.email} 从监控`);
      gcloudMonitorService.removeAccountFromMonitoring(testAccount.id);

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`重新添加账号 ${testAccount.email} 到监控`);
      await gcloudMonitorService.addAccountToMonitoring(testAccount);
    }

    // 9. 最终状态检查
    console.log('\n9. 最终状态检查...');
    const finalStatus = gcloudMonitorService.getStatus();
    console.log('最终状态:', JSON.stringify(finalStatus, null, 2));

    console.log('\n=== 测试完成 ===');
    console.log('注意: 监控服务仍在运行中，使用 gcloudMonitorService.stop() 停止服务');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
    logger.error('Monitor test error:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testNewMonitorSystem()
    .then(() => {
      console.log('\n测试脚本执行完毕，监控服务仍在后台运行');
      console.log('如需停止监控服务，请运行: gcloudMonitorService.stop()');
      // 不要自动退出，让监控服务继续运行
    })
    .catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testNewMonitorSystem };