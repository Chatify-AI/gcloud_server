const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChannelStatistics = sequelize.define('ChannelStatistics', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true, // 邮箱唯一标识
    comment: '邮箱地址'
  },
  totalChannels: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '总渠道数'
  },
  totalUsedQuota: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: '总使用配额'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: '总金额'
  },
  enabledChannels: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '启用渠道数'
  },
  disabledChannels: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '禁用渠道数'
  },
  suspendedChannels: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '暂停渠道数'
  },
  oldestChannelTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最早渠道创建时间'
  },
  newestChannelTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最新渠道创建时间'
  },
  hoursParameter: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
    comment: '统计参数(小时)'
  },
  eligibleChannelsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '符合条件的渠道数'
  },
  processingTimeMs: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '处理时间(毫秒)'
  },
  channelDetails: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '渠道详细信息JSON'
  },
  lastUpdated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '最后更新时间'
  }
}, {
  tableName: 'channel_statistics',
  comment: '渠道统计数据表'
});

module.exports = ChannelStatistics;