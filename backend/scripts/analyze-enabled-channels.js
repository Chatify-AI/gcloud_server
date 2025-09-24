#!/usr/bin/env node

/**
 * 分析启用渠道的脚本
 */

require('dotenv').config();
const oneApiService = require('../services/oneApiService');
const globalChannelMonitorService = require('../services/globalChannelMonitorService');

async function analyzeEnabledChannels() {
  try {
    console.log('🔍 分析所有启用渠道...');

    // 获取所有渠道
    const allChannelsResult = await oneApiService.getAllChannels();
    if (!allChannelsResult.success) {
      console.error('❌ 无法获取渠道列表');
      return;
    }

    const allChannels = allChannelsResult.data.items;

    // 获取监控邮箱
    const monitoredEmails = await globalChannelMonitorService.getMonitoredAccountEmails();
    console.log(`📧 监控邮箱: ${monitoredEmails.join(', ')}`);

    // 筛选启用的渠道
    const enabledChannels = allChannels.filter(ch => ch.status === 1);
    console.log(`\n✅ 启用渠道总数: ${enabledChannels.length}`);

    if (enabledChannels.length === 0) {
      console.log('没有启用的渠道');
      return;
    }

    console.log('\n📋 所有启用渠道详情:');
    console.log('=' .repeat(80));

    let monitoredCount = 0;
    let globalCount = 0;

    enabledChannels.forEach((channel, index) => {
      // 检查是否被监控
      let isMonitored = false;
      let matchedEmail = '';

      if (channel.name && monitoredEmails.length > 0) {
        for (const email of monitoredEmails) {
          if (channel.name.startsWith(email)) {
            const afterEmail = channel.name.substring(email.length);
            if (afterEmail === '' || afterEmail.startsWith('-')) {
              isMonitored = true;
              matchedEmail = email;
              break;
            }
          }
        }
      }

      if (isMonitored) {
        monitoredCount++;
      } else {
        globalCount++;
      }

      console.log(`${index + 1}. 渠道 ID: ${channel.id}`);
      console.log(`   名称: ${channel.name}`);
      console.log(`   状态: ${channel.status === 1 ? '启用' : '禁用'}`);
      console.log(`   监控状态: ${isMonitored ? `✅ GCloud监控 (${matchedEmail})` : '🌍 全局监控'}`);
      console.log('   ' + '-'.repeat(70));
    });

    console.log('\n📊 分类统计:');
    console.log(`├── GCloud监控渠道: ${monitoredCount}`);
    console.log(`└── 全局监控渠道: ${globalCount}`);

    // 如果有全局监控渠道，显示详情
    if (globalCount > 0) {
      console.log('\n🌍 需要全局监控的启用渠道:');
      const globalChannels = enabledChannels.filter(channel => {
        if (!channel.name || monitoredEmails.length === 0) return true;

        return !monitoredEmails.some(email => {
          if (channel.name.startsWith(email)) {
            const afterEmail = channel.name.substring(email.length);
            return afterEmail === '' || afterEmail.startsWith('-');
          }
          return false;
        });
      });

      globalChannels.forEach((channel, index) => {
        console.log(`${index + 1}. ID: ${channel.id}, Name: ${channel.name}`);
      });
    }

  } catch (error) {
    console.error('❌ 分析过程中出错:', error);
  }
}

async function main() {
  console.log('🚀 启用渠道分析脚本');
  console.log('=' .repeat(50));

  await analyzeEnabledChannels();

  console.log('\n✅ 分析完成');
}

if (require.main === module) {
  main().catch(console.error);
}