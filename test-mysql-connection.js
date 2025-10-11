const mysql = require('mysql2/promise');

async function testConnection() {
  const connection = await mysql.createConnection({
    host: 'chatify-database.mysql.database.azure.com',
    user: 'database',
    password: 'sk-chatify-MoLu154!',
    database: 'vertex_ai_pool_1',
    port: 3306
  });

  console.log('✅ MySQL连接成功！');

  // 测试查询：获取几条channels数据
  const [rows] = await connection.execute(
    'SELECT id, name, `key` FROM channels LIMIT 5'
  );

  console.log(`\n找到 ${rows.length} 条记录：\n`);
  rows.forEach((row, index) => {
    console.log(`${index + 1}. ID: ${row.id}, Name: ${row.name}`);
    console.log(`   Key (前50字符): ${row.key.substring(0, 50)}...`);
    console.log('');
  });

  await connection.end();
}

testConnection().catch(error => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});
