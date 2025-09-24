const { Sequelize } = require('sequelize');

// 使用与主项目相同的 MySQL 配置
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: 'localhost',
  port: 3306,
  database: 'gcloud',
  username: 'gcloud',
  password: 'gcloud123',
  logging: false, // 禁用日志以减少输出
  define: {
    timestamps: true,
    underscored: true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('📊 Channel Stats Service connected to MySQL database');

    // 同步数据库 - 安全模式，只创建新表
    await sequelize.sync({ alter: true });
    console.log('📊 Database synced for Channel Stats Service');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };