const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExecutionHistory = sequelize.define('ExecutionHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // 执行ID（关联到CommandExecution表，可选）
  executionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // 账号信息
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'g_cloud_accounts',
      key: 'id'
    }
  },
  accountEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  accountDisplayName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // 命令信息
  commandType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'shell' // 'shell', 'gcloud', 'cloud-shell'
  },
  command: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // 执行信息
  executedBy: {
    type: DataTypes.STRING,
    defaultValue: 'public-api' // 'public-api', 'admin', 'api-key', 'shell-api'
  },
  executedFrom: {
    type: DataTypes.STRING,
    allowNull: true // IP地址或来源
  },
  // 执行状态
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending' // 'pending', 'running', 'completed', 'failed', 'cancelled'
  },
  // 执行结果
  output: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // 时间信息
  startedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  executionTime: {
    type: DataTypes.INTEGER, // 毫秒
    allowNull: true
  },
  // 额外信息
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('metadata');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('metadata', JSON.stringify(value));
    }
  },
  // 是否异步执行
  isAsync: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // API请求信息（用于审计）
  requestHeaders: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('requestHeaders');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('requestHeaders', JSON.stringify(value));
    }
  }
}, {
  tableName: 'execution_history',
  timestamps: true,
  indexes: [
    { fields: ['account_id'] },
    { fields: ['execution_id'] },
    { fields: ['command_type'] },
    { fields: ['status'] },
    { fields: ['executed_by'] },
    { fields: ['started_at'] },
    { fields: ['account_email'] }
  ]
});

// 关联定义
ExecutionHistory.associate = (models) => {
  ExecutionHistory.belongsTo(models.GCloudAccount, {
    foreignKey: 'accountId',
    as: 'account'
  });
};

module.exports = ExecutionHistory;