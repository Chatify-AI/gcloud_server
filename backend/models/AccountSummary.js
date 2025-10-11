const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountSummary = sequelize.define('AccountSummary', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '账户邮箱'
  },
  consumptionAmount: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0,
    comment: '消费金额'
  },
  scriptExecutionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '脚本执行次数'
  },
  accountCreatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '账号创建时间'
  },
  lastMonitorTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后监听时间'
  },
  lastSyncTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后同步时间'
  }
}, {
  tableName: 'account_summaries',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['email']
    }
  ]
});

module.exports = AccountSummary;