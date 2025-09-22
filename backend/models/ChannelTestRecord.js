const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChannelTestRecord = sequelize.define('ChannelTestRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  channelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'channel_id',
    comment: 'OneAPI渠道ID'
  },
  channelName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'channel_name',
    comment: '渠道名称（邮箱）'
  },
  accountEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'account_email',
    comment: '关联的GCloud账号邮箱'
  },
  failureCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'failure_count',
    comment: '连续失败次数'
  },
  lastTestTime: {
    type: DataTypes.DATE,
    field: 'last_test_time',
    comment: '最后测试时间'
  },
  lastTestStatus: {
    type: DataTypes.ENUM('success', 'failed', 'quota_exceeded'),
    field: 'last_test_status',
    comment: '最后测试状态'
  },
  lastTestMessage: {
    type: DataTypes.TEXT,
    field: 'last_test_message',
    comment: '最后测试结果信息'
  },
  isDisabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_disabled',
    comment: '是否已禁用'
  },
  disabledAt: {
    type: DataTypes.DATE,
    field: 'disabled_at',
    comment: '禁用时间'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'channel_test_records',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['channel_id']
    },
    {
      fields: ['account_email']
    },
    {
      fields: ['failure_count']
    },
    {
      fields: ['last_test_status']
    }
  ]
});

module.exports = ChannelTestRecord;