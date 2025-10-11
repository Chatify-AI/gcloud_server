const channelKeyService = require('./backend/services/channelKeyService');

async function testChannelKeyService() {
  console.log('🧪 测试ChannelKeyService\n');

  const testEmail = 'martinezwilliametrcu1387@gmail.com';

  try {
    console.log(`📧 测试邮箱: ${testEmail}\n`);

    const result = await channelKeyService.pushAccountKeys(testEmail, (event) => {
      console.log(`📊 进度事件:`, event);
    });

    console.log('\n✅ 测试完成！\n');
    console.log('📋 结果汇总:');
    console.log(`   总渠道数: ${result.totalChannels}`);
    console.log(`   成功推送: ${result.pushedCount}`);
    console.log(`   失败数量: ${result.failedCount}`);
    console.log('\n详细结果:');
    result.results.forEach((r, i) => {
      const status = r.success ? '✅' : '❌';
      console.log(`   ${i + 1}. ${status} Channel ${r.channelId} - ${r.channelName.substring(0, 50)}`);
      if (!r.success) {
        console.log(`      错误: ${r.error}`);
      }
    });

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testChannelKeyService();
