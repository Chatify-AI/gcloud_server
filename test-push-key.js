const axios = require('axios');
const mysql = require('mysql2/promise');

async function testPushKey() {
  // 连接数据库
  const connection = await mysql.createConnection({
    host: 'chatify-database.mysql.database.azure.com',
    user: 'database',
    password: 'sk-chatify-MoLu154!',
    database: 'vertex_ai_pool_1',
    port: 3306
  });

  console.log('✅ MySQL连接成功！\n');

  // 获取一条key
  const [rows] = await connection.execute(
    'SELECT id, name, `key` FROM channels WHERE name LIKE ? LIMIT 1',
    ['%martinezwilliametrcu1387@gmail.com%']
  );

  if (rows.length === 0) {
    console.log('❌ 没有找到测试数据');
    await connection.end();
    return;
  }

  const testData = rows[0];
  console.log(`📋 测试数据:`);
  console.log(`   ID: ${testData.id}`);
  console.log(`   Name: ${testData.name}`);
  console.log(`   Key: ${testData.key}\n`);

  // 测试推送
  console.log('🚀 开始推送到远程服务器...\n');

  try {
    const response = await axios.post('http://104.243.32.237:10000/api/add', testData.key, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✅ 推送成功！`);
    console.log(`   状态码: ${response.status}`);
    console.log(`   响应数据:`, response.data);

  } catch (error) {
    console.log(`❌ 推送失败！`);
    console.log(`   错误信息: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   响应数据:`, error.response.data);
    }
  }

  await connection.end();
}

testPushKey().catch(error => {
  console.error('❌ 脚本错误:', error.message);
  process.exit(1);
});
