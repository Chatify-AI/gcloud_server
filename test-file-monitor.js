const channelFileMonitor = require('./backend/services/channelFileMonitor');

async function testMonitor() {
  console.log('Testing channel file monitor...');

  // 查看目录内容
  const fs = require('fs').promises;
  const path = '/home/Chatify/vip';

  try {
    const files = await fs.readdir(path);
    console.log(`\nFiles in ${path}:`);
    files.forEach(f => console.log(`  - ${f}`));

    // 检查处理状态
    console.log('\nProcessed files:', Array.from(channelFileMonitor.processedFiles));
    console.log('Is running:', channelFileMonitor.isRunning);
    console.log('Is processing:', channelFileMonitor.isProcessing);

    // 手动触发一次监听
    console.log('\n--- Manually triggering monitor() ---');
    await channelFileMonitor.monitor();

  } catch (error) {
    console.error('Error:', error);
  }
}

testMonitor();