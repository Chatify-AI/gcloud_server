#!/usr/bin/env node

/**
 * 测试 OneAPI 消费记录查询功能
 */

const oneApiService = require('./backend/services/oneApiService');
const logger = require('./backend/src/utils/logger');

async function testConsumptionQuery() {
  try {
    console.log('=== 测试 OneAPI 消费记录查询功能 ===\n');

    // 测试渠道ID - 使用你提供的示例中的渠道329
    const testChannelId = 329;

    console.log(`1. 测试渠道 ${testChannelId} 的近1分钟消费记录...`);
    const consumption1min = await oneApiService.getChannelConsumption(testChannelId, 1);
    console.log('1分钟消费记录结果:', JSON.stringify(consumption1min, null, 2));

    console.log(`\n2. 测试渠道 ${testChannelId} 的近5分钟消费记录...`);
    const consumption5min = await oneApiService.getChannelConsumption(testChannelId, 5);
    console.log('5分钟消费记录结果:', JSON.stringify(consumption5min, null, 2));

    console.log(`\n3. 测试简化版本 - 检查是否有近期消费...`);
    const hasConsumption = await oneApiService.hasRecentConsumption(testChannelId, 1);
    console.log(`渠道 ${testChannelId} 近1分钟是否有消费:`, hasConsumption);

    // 测试一个可能不存在的渠道
    console.log(`\n4. 测试不存在的渠道 99999...`);
    const noConsumption = await oneApiService.getChannelConsumption(99999, 1);
    console.log('不存在渠道的结果:', JSON.stringify(noConsumption, null, 2));

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
    logger.error('Consumption test error:', error);
  }
}

// 运行测试
if (require.main === module) {
  testConsumptionQuery()
    .then(() => {
      console.log('所有测试执行完毕');
      process.exit(0);
    })
    .catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testConsumptionQuery };