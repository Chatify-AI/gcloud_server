#!/usr/bin/env node

/**
 * 全局渠道监控测试脚本
 * 用于分析渠道状态和测试suspend逻辑
 */

require('dotenv').config();
const oneApiService = require('../services/oneApiService');
const globalChannelMonitorService = require('../services/globalChannelMonitorService');
const logger = require('../src/utils/logger');

async function analyzeChannels() {
  try {
    console.log('🔍 开始分析渠道状态...');

    // 获取所有渠道
    const allChannelsResult = await oneApiService.getAllChannels();
    if (!allChannelsResult.success || !allChannelsResult.data?.items) {
      console.error('❌ 无法获取渠道列表');
      return;
    }

    const allChannels = allChannelsResult.data.items;
    console.log(`📊 总渠道数: ${allChannels.length}`);

    // 统计分析
    let stats = {
      total: allChannels.length,
      enabled: 0,
      disabled: 0,
      suspended: 0,
      hasQuotaError: 0,
      hasConsumerSuspended: 0,
      needsGlobalTesting: 0
    };

    // 获取监控账户邮箱
    const monitoredEmails = await globalChannelMonitorService.getMonitoredAccountEmails();
    console.log(`📧 监控邮箱数: ${monitoredEmails.length}`);
    console.log(`📧 监控邮箱: ${monitoredEmails.join(', ')}`);

    // 分析每个渠道
    const needsTestingChannels = [];
    const suspendedChannels = [];
    const problemChannels = [];

    for (const channel of allChannels) {
      // 基本状态统计
      if (channel.status === 1) stats.enabled++;
      else if (channel.status === 2) stats.disabled++;

      // suspend标记统计
      if (channel.name && channel.name.includes('suspend')) {
        stats.suspended++;
        suspendedChannels.push({
          id: channel.id,
          name: channel.name,
          status: channel.status
        });
        continue;
      }

      // 检查是否在监控范围内
      let isMonitored = false;
      if (channel.name && monitoredEmails.length > 0) {
        isMonitored = monitoredEmails.some(email => {
          if (channel.name.startsWith(email)) {
            const afterEmail = channel.name.substring(email.length);
            return afterEmail === '' || afterEmail.startsWith('-');
          }
          return false;
        });
      }

      // 如果不在监控范围内且为启用状态，则需要全局测试
      if (!isMonitored && channel.status === 1) {
        stats.needsGlobalTesting++;
        needsTestingChannels.push({
          id: channel.id,
          name: channel.name,
          status: channel.status
        });
      }
    }

    // 显示统计结果
    console.log('\n📈 渠道统计:');
    console.log(`├── 总数: ${stats.total}`);
    console.log(`├── 启用: ${stats.enabled}`);
    console.log(`├── 禁用: ${stats.disabled}`);
    console.log(`├── 已suspend: ${stats.suspended}`);
    console.log(`└── 需要全局测试: ${stats.needsGlobalTesting}`);

    // 显示需要测试的渠道样例
    console.log('\n🎯 需要全局测试的渠道样例 (前10个):');
    needsTestingChannels.slice(0, 10).forEach((channel, index) => {
      console.log(`${index + 1}. ID: ${channel.id}, Name: ${channel.name}`);
    });

    // 显示已suspend的渠道样例
    console.log('\n⛔ 已suspend的渠道样例 (前10个):');
    suspendedChannels.slice(0, 10).forEach((channel, index) => {
      console.log(`${index + 1}. ID: ${channel.id}, Name: ${channel.name}, Status: ${channel.status}`);
    });

    return {
      stats,
      needsTestingChannels,
      suspendedChannels,
      monitoredEmails
    };

  } catch (error) {
    console.error('❌ 分析过程中出错:', error);
    return null;
  }
}

async function testSingleChannel(channelId) {
  try {
    console.log(`\n🧪 测试渠道 ${channelId}...`);

    // 获取渠道详情
    const channelDetail = await oneApiService.getChannelDetail(channelId);
    if (!channelDetail.success) {
      console.log(`❌ 无法获取渠道 ${channelId} 详情`);
      return null;
    }

    const channel = channelDetail.data;
    console.log(`📋 渠道信息: ID=${channel.id}, Name=${channel.name}, Status=${channel.status}`);

    // 测试渠道
    const testResult = await oneApiService.testChannel(channelId, 'gemini-2.5-pro', {
      maxRetries: 1,
      retryDelay: 5000,
      skipRetry: true
    });

    console.log(`🔍 测试结果:`, {
      success: testResult.success,
      message: testResult.message?.substring(0, 200) + (testResult.message?.length > 200 ? '...' : '')
    });

    // 检查是否需要suspend
    if (!testResult.success && testResult.message) {
      const shouldSuspend =
        testResult.message.includes('You exceeded your current quota') ||
        testResult.message.includes('check your plan and billing details') ||
        testResult.message.includes('has been suspended') ||
        testResult.message.includes('Consumer') && testResult.message.includes('has been suspended') ||
        testResult.message.includes('generate_content_free_tier_requests') ||
        testResult.message.includes('generativelanguage.googleapis.com/generate_content_free_tier_requests');

      console.log(`⚖️  需要suspend: ${shouldSuspend}`);

      if (shouldSuspend) {
        console.log(`🔴 此渠道应该被添加suspend标记并禁用`);
      }
    }

    return {
      channel,
      testResult,
      shouldSuspend: !testResult.success && testResult.message && (
        testResult.message.includes('You exceeded your current quota') ||
        testResult.message.includes('check your plan and billing details') ||
        testResult.message.includes('has been suspended') ||
        testResult.message.includes('generate_content_free_tier_requests')
      )
    };

  } catch (error) {
    console.error(`❌ 测试渠道 ${channelId} 时出错:`, error);
    return null;
  }
}

async function main() {
  console.log('🚀 全局渠道监控测试脚本启动');
  console.log('=' .repeat(50));

  // 分析渠道状态
  const analysis = await analyzeChannels();
  if (!analysis) {
    process.exit(1);
  }

  // 如果有需要测试的渠道，测试前几个
  if (analysis.needsTestingChannels.length > 0) {
    console.log('\n🧪 测试前5个需要全局测试的渠道...');
    console.log('=' .repeat(50));

    const testCount = Math.min(5, analysis.needsTestingChannels.length);
    const testResults = [];

    for (let i = 0; i < testCount; i++) {
      const channel = analysis.needsTestingChannels[i];
      const result = await testSingleChannel(channel.id);
      if (result) {
        testResults.push(result);
      }

      // 避免请求过快
      if (i < testCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 总结测试结果
    console.log('\n📋 测试结果总结:');
    console.log('=' .repeat(50));
    const needsSuspend = testResults.filter(r => r.shouldSuspend);
    console.log(`🔴 需要suspend的渠道: ${needsSuspend.length}/${testResults.length}`);

    if (needsSuspend.length > 0) {
      console.log('\n需要suspend的渠道列表:');
      needsSuspend.forEach((result, index) => {
        console.log(`${index + 1}. ID: ${result.channel.id}, Name: ${result.channel.name}`);
        console.log(`   错误: ${result.testResult.message?.substring(0, 100)}...`);
      });
    }
  }

  console.log('\n✅ 测试完成');
}

// 运行脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  analyzeChannels,
  testSingleChannel
};