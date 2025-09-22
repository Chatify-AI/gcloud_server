#!/usr/bin/env node

/**
 * 测试查询账户的执行历史
 */

const axios = require('axios');
const logger = require('./backend/src/utils/logger');

async function testExecutionHistory() {
  try {
    console.log('=== 测试查询账户执行历史 ===\n');

    // 测试账户
    const testAccounts = [
      'trangkhang6287x@gmail.com',
      'ht773058@gmail.com',
      'khanhdoanyiedl@gmail.com',
      'kimloan9130b@gmail.com'
    ];

    for (const accountEmail of testAccounts) {
      console.log(`\n查询账户 ${accountEmail} 的执行历史...`);

      try {
        const response = await axios.get('https://gcloud.luzhipeng.com/api/public/executions', {
          params: {
            accountId: accountEmail,
            limit: 5
          },
          timeout: 10000
        });

        const result = response.data;
        console.log('API响应结构:', JSON.stringify(result, null, 2));

        const executions = result.executions || result.results || result;
        if (Array.isArray(executions)) {
          console.log(`找到 ${executions.length} 条执行记录:`);

          executions.forEach((exec, index) => {
            console.log(`  ${index + 1}. ID: ${exec.id}`);
            console.log(`     命令: ${exec.command ? exec.command.substring(0, 50) + '...' : 'N/A'}`);
            console.log(`     状态: ${exec.status}`);
            console.log(`     创建时间: ${exec.createdAt}`);
            console.log(`     完成时间: ${exec.finishedAt || 'N/A'}`);
            console.log('');
          });
        } else {
          console.log('响应不是数组格式，无法解析执行记录');
        }

      } catch (error) {
        console.error(`  查询失败: ${error.message}`);
      }
    }

    console.log('=== 测试完成 ===');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
    logger.error('Execution history test error:', error);
  }
}

// 运行测试
if (require.main === module) {
  testExecutionHistory()
    .then(() => {
      console.log('所有测试执行完毕');
      process.exit(0);
    })
    .catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testExecutionHistory };