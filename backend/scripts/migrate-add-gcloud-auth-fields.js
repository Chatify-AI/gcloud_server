/**
 * 安全迁移脚本：为 g_cloud_accounts 表添加认证相关字段
 *
 * 添加的字段：
 * - project_name: 项目名称
 * - access_token: OAuth2 访问令牌
 * - refresh_token: OAuth2 刷新令牌
 * - token_expiry: 令牌过期时间
 * - scopes: OAuth2 授权范围
 * - is_active: 账户是否激活
 */

const { sequelize } = require('../config/database');

async function migrate() {
  console.log('开始迁移：添加 GCloud 认证字段...');

  try {
    const queryInterface = sequelize.getQueryInterface();

    // 获取现有表结构
    const tableDesc = await queryInterface.describeTable('g_cloud_accounts');
    console.log('现有字段:', Object.keys(tableDesc));

    // 添加 project_name 字段
    if (!tableDesc.project_name) {
      console.log('添加 project_name 字段...');
      await queryInterface.addColumn('g_cloud_accounts', 'project_name', {
        type: require('sequelize').DataTypes.STRING(255),
        allowNull: true,
        after: 'project_id'
      });
      console.log('✅ project_name 字段已添加');
    } else {
      console.log('⏭️  project_name 字段已存在');
    }

    // 添加 access_token 字段
    if (!tableDesc.access_token) {
      console.log('添加 access_token 字段...');
      await queryInterface.addColumn('g_cloud_accounts', 'access_token', {
        type: require('sequelize').DataTypes.TEXT,
        allowNull: true
      });
      console.log('✅ access_token 字段已添加');
    } else {
      console.log('⏭️  access_token 字段已存在');
    }

    // 添加 refresh_token 字段
    if (!tableDesc.refresh_token) {
      console.log('添加 refresh_token 字段...');
      await queryInterface.addColumn('g_cloud_accounts', 'refresh_token', {
        type: require('sequelize').DataTypes.TEXT,
        allowNull: true
      });
      console.log('✅ refresh_token 字段已添加');
    } else {
      console.log('⏭️  refresh_token 字段已存在');
    }

    // 添加 token_expiry 字段
    if (!tableDesc.token_expiry) {
      console.log('添加 token_expiry 字段...');
      await queryInterface.addColumn('g_cloud_accounts', 'token_expiry', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true
      });
      console.log('✅ token_expiry 字段已添加');
    } else {
      console.log('⏭️  token_expiry 字段已存在');
    }

    // 添加 scopes 字段
    if (!tableDesc.scopes) {
      console.log('添加 scopes 字段...');
      await queryInterface.addColumn('g_cloud_accounts', 'scopes', {
        type: require('sequelize').DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON array of OAuth2 scopes'
      });
      console.log('✅ scopes 字段已添加');
    } else {
      console.log('⏭️  scopes 字段已存在');
    }

    // 添加 is_active 字段
    if (!tableDesc.is_active) {
      console.log('添加 is_active 字段...');
      await queryInterface.addColumn('g_cloud_accounts', 'is_active', {
        type: require('sequelize').DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
      console.log('✅ is_active 字段已添加');
    } else {
      console.log('⏭️  is_active 字段已存在');
    }

    console.log('\n✅ 迁移完成！');
    console.log('\n更新后的表结构:');
    const updatedTableDesc = await queryInterface.describeTable('g_cloud_accounts');
    console.log(Object.keys(updatedTableDesc));

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// 运行迁移
migrate()
  .then(() => {
    console.log('\n🎉 数据库迁移成功完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 数据库迁移失败:', error);
    process.exit(1);
  });
