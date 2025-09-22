#!/usr/bin/env node

const oneApiService = require('./backend/services/oneApiService');
const logger = require('./backend/src/utils/logger');

async function testComprehensiveChannel() {
  console.log('=== Testing Comprehensive Channel Check ===\n');

  // 测试渠道ID 215
  const channelId = 215;
  const model = 'gemini-2.5-pro';

  try {
    console.log(`Testing channel ${channelId} with model ${model}...`);
    console.log('-------------------------------------------');

    // 1. 测试日志检查功能
    console.log('\n1. Testing log check functionality:');
    const logResult = await oneApiService.checkChannelRecentLogs(channelId, model, 1, 30);
    console.log(`   - Has recent logs: ${logResult.hasLogs}`);
    console.log(`   - Log count: ${logResult.logCount}`);
    console.log(`   - Total logs in DB: ${logResult.totalCount}`);
    if (logResult.hasLogs && logResult.logs.length > 0) {
      console.log(`   - Latest log: ${new Date(logResult.logs[0].created_at * 1000).toISOString()}`);
      console.log(`   - Model used: ${logResult.logs[0].model_name}`);
    }

    // 2. 测试API功能
    console.log('\n2. Testing API channel test:');
    const apiResult = await oneApiService.testChannel(channelId, model, {
      skipRetry: true
    });
    console.log(`   - API test success: ${apiResult.success}`);
    console.log(`   - Response time: ${apiResult.time || 0}ms`);
    if (!apiResult.success) {
      console.log(`   - Error: ${apiResult.message}`);
    }

    // 3. 综合测试
    console.log('\n3. Testing comprehensive channel check:');
    const comprehensiveResult = await oneApiService.comprehensiveTestChannel(
      channelId,
      model,
      {
        maxRetries: 1,
        retryDelay: 5000,
        logMinutes: 1,
        logLimit: 30
      }
    );

    console.log(`   - Overall success: ${comprehensiveResult.overallSuccess}`);
    console.log(`   - API test result: ${comprehensiveResult.apiTest?.success}`);
    console.log(`   - Has recent logs: ${comprehensiveResult.logCheck?.hasLogs}`);
    console.log(`   - Needs enable: ${comprehensiveResult.needsEnable}`);
    console.log(`   - Needs reset failure: ${comprehensiveResult.needsResetFailure}`);

    console.log('\n=== Test Results Summary ===');
    console.log(`Channel ${channelId} status:`);
    if (comprehensiveResult.overallSuccess) {
      console.log('✅ Channel is HEALTHY');
      if (comprehensiveResult.apiTest?.success && comprehensiveResult.logCheck?.hasLogs) {
        console.log('   - Both API test and logs are good');
      } else if (comprehensiveResult.apiTest?.success) {
        console.log('   - API test passed (no recent logs)');
      } else if (comprehensiveResult.logCheck?.hasLogs) {
        console.log('   - Has recent logs (API test failed)');
      }
    } else {
      console.log('❌ Channel is UNHEALTHY');
      console.log('   - Both API test failed AND no recent logs');
    }

  } catch (error) {
    console.error('Error during testing:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testComprehensiveChannel()
  .then(() => {
    console.log('\n=== Test completed ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });