#!/usr/bin/env node

/**
 * 检查generate_content_free_tier_requests错误是否被正确suspend的脚本
 */

require('dotenv').config();
const oneApiService = require('../services/oneApiService');

async function checkGenerateContentErrors() {
  try {
    console.log('🔍 检查包含generate_content_free_tier_requests错误的渠道状态...');

    // 获取所有渠道
    const allChannelsResult = await oneApiService.getAllChannels();
    if (!allChannelsResult.success) {
      console.error('❌ 无法获取渠道列表');
      return;
    }

    const allChannels = allChannelsResult.data.items;
    console.log(`📊 总渠道数: ${allChannels.length}`);

    // 测试一些非suspended的渠道，看看错误信息
    const nonSuspendedChannels = allChannels.filter(ch =>
      ch.name && !ch.name.includes('suspend') && ch.status === 1
    ).slice(0, 5); // 只测试前5个

    console.log(`🧪 测试 ${nonSuspendedChannels.length} 个启用的非suspended渠道...`);

    for (const channel of nonSuspendedChannels) {
      console.log(`\n测试渠道 ${channel.id} (${channel.name})...`);

      const testResult = await oneApiService.testChannel(channel.id, 'gemini-2.5-pro', {
        maxRetries: 1,
        retryDelay: 3000,
        skipRetry: true
      });

      if (!testResult.success && testResult.message) {
        console.log(`❌ 测试失败: ${testResult.message}`);

        // 检查是否包含generate_content错误
        if (testResult.message.includes('generate_content_free_tier_requests')) {
          console.log('🔴 发现generate_content_free_tier_requests错误！');
          console.log(`   渠道名称: ${channel.name}`);
          console.log(`   是否已suspend: ${channel.name.includes('suspend')}`);
          console.log(`   渠道状态: ${channel.status} (1=启用, 2=禁用)`);
        }

        // 检查其他quota相关错误
        if (testResult.message.includes('You exceeded your current quota')) {
          console.log('🔴 发现quota exceeded错误！');
        }

        if (testResult.message.includes('has been suspended')) {
          console.log('🔴 发现account suspended错误！');
        }
      } else if (testResult.success) {
        console.log('✅ 测试成功');
      }

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 统计已suspend的渠道中包含generate_content错误的
    const suspendedChannels = allChannels.filter(ch =>
      ch.name && ch.name.includes('suspend')
    );

    console.log(`\n📊 已suspend渠道统计: ${suspendedChannels.length} 个`);

  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
  }
}

async function main() {
  console.log('🚀 Generate Content 错误检查脚本');
  console.log('=' .repeat(50));

  await checkGenerateContentErrors();

  console.log('\n✅ 检查完成');
}

if (require.main === module) {
  main().catch(console.error);
}