const { DataTypes } = require('sequelize');
const sequelize = require('../config/database').sequelize;

const ChannelAutoLog = sequelize.define('ChannelAutoLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '处理的文件名'
  },
  channelName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '创建的渠道名称'
  },
  channelType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '渠道类型: gemini 或 vertex'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    comment: '处理状态: pending, success, failed'
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '尝试次数'
  },
  message: {
    type: DataTypes.TEXT,
    comment: '处理消息或错误信息'
  },
  apiResponse: {
    type: DataTypes.TEXT,
    comment: 'API响应内容'
  },
  processedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '处理时间'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'channel_auto_logs',
  timestamps: true,
  underscored: true,  // 使用下划线命名
  indexes: [
    {
      fields: ['file_name']
    },
    {
      fields: ['channel_type']
    },
    {
      fields: ['status']
    },
    {
      fields: ['processed_at']
    }
  ]
});

// 同步模型
ChannelAutoLog.sync({ alter: true }).then(() => {
  console.log('ChannelAutoLog model synced');
}).catch(err => {
  console.error('Error syncing ChannelAutoLog model:', err);
});

module.exports = ChannelAutoLog;