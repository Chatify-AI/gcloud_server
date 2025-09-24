#!/usr/bin/env node

/**
 * 完整分析所有渠道的脚本 - 包括禁用的渠道
 */

require('dotenv').config();
const oneApiService = require('../services/oneApiService');
const globalChannelMonitorService = require('../services/globalChannelMonitorService');

async function analyzeAllChannels() {
  try {
    console.log('🔍 分析所有渠道状态（包括禁用渠道）...');

    // 获取所有渠道
    const allChannelsResult = await oneApiService.getAllChannels();
    if (!allChannelsResult.success) {
      console.error('❌ 无法获取渠道列表');
      return;
    }

    const allChannels = allChannelsResult.data.items;

    // 获取监控邮箱
    const monitoredEmails = await globalChannelMonitorService.getMonitoredAccountEmails();
    console.log(`📧 监控邮箱数: ${monitoredEmails.length}`);

    // 详细分析
    let stats = {
      total: allChannels.length,
      enabled: 0,
      disabled: 0,
      suspended: 0,
      monitoredEnabled: 0,
      monitoredDisabled: 0,
      globalEnabled: 0,
      globalDisabled: 0,
      globalNonSuspended: 0
    };

    const globalChannels = [];

    console.log('\n🔍 详细分析中...');

    for (const channel of allChannels) {
      // 基本状态统计
      if (channel.status === 1) stats.enabled++;
      else if (channel.status === 2) stats.disabled++;

      // suspend统计
      const isSuspended = channel.name && channel.name.includes('suspend');
      if (isSuspended) {
        stats.suspended++;
        continue; // suspend的渠道不需要再测试
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

      if (isMonitored) {
        if (channel.status === 1) stats.monitoredEnabled++;
        else stats.monitoredDisabled++;
      } else {
        // 这些是全局监控应该处理的渠道
        if (channel.status === 1) stats.globalEnabled++;
        else stats.globalDisabled++;
        stats.globalNonSuspended++;

        globalChannels.push({
          id: channel.id,
          name: channel.name,
          status: channel.status,
          statusText: channel.status === 1 ? '启用' : '禁用'
        });
      }
    }

    // 显示统计结果
    console.log('\n📈 完整渠道统计:');
    console.log(`├── 总数: ${stats.total}`);
    console.log(`├── 启用: ${stats.enabled}`);
    console.log(`├── 禁用: ${stats.disabled}`);
    console.log(`├── 已suspend: ${stats.suspended}`);
    console.log(`│`);
    console.log(`├── GCloud监控 (启用): ${stats.monitoredEnabled}`);
    console.log(`├── GCloud监控 (禁用): ${stats.monitoredDisabled}`);
    console.log(`│`);
    console.log(`├── 🌍 全局监控应处理 (启用): ${stats.globalEnabled}`);
    console.log(`├── 🌍 全局监控应处理 (禁用): ${stats.globalDisabled}`);
    console.log(`└── 🌍 全局监控总数: ${stats.globalNonSuspended}`);

    console.log(`\n🔍 全局监控实际应该处理 ${stats.globalNonSuspended} 个渠道！`);

    // 显示全局监控渠道样例
    if (globalChannels.length > 0) {
      console.log('\n🌍 全局监控应处理的渠道样例 (前20个):');
      globalChannels.slice(0, 20).forEach((channel, index) => {
        console.log(`${index + 1}. ID: ${channel.id}, Name: ${channel.name}, Status: ${channel.statusText}`);
      });

      if (globalChannels.length > 20) {
        console.log(`... 还有 ${globalChannels.length - 20} 个渠道`);
      }

      // 按状态分组显示
      const enabledGlobal = globalChannels.filter(ch => ch.status === 1);
      const disabledGlobal = globalChannels.filter(ch => ch.status === 2);

      console.log(`\n📊 全局监控渠道分布:`);
      console.log(`├── 启用: ${enabledGlobal.length} 个`);
      console.log(`└── 禁用: ${disabledGlobal.length} 个`);

      if (disabledGlobal.length > 0) {
        console.log(`\n⚠️  注意: 有 ${disabledGlobal.length} 个禁用的渠道需要测试，它们可能已经恢复正常！`);
      }
    }

    return {
      stats,
      globalChannels,
      monitoredEmails
    };

  } catch (error) {
    console.error('❌ 分析过程中出错:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 完整渠道分析脚本');
  console.log('=' .repeat(50));

  const analysis = await analyzeAllChannels();

  if (analysis && analysis.globalChannels.length > 0) {
    console.log('\n💡 建议:');
    console.log('1. 全局监控应该测试所有非suspend的渠道（包括禁用的）');
    console.log('2. 禁用的渠道如果测试成功，应该重新启用');
    console.log('3. 启用的渠道如果测试失败，应该suspend');
    console.log(`4. 总共需要处理 ${analysis.globalChannels.length} 个渠道`);
  }

  console.log('\n✅ 分析完成');
}

if (require.main === module) {
  main().catch(console.error);
}