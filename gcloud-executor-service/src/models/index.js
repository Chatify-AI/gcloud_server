const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Define models
const CommandExecution = sequelize.define('CommandExecution', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
  },
  executedBy: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  command: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  output: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending',
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  executionTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'command_executions',
  timestamps: true,
});

const GCloudAccount = sequelize.define('GCloudAccount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
  },
  displayName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  configDir: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  configName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  projectId: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  needMonitor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  scriptExecutionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lastMonitorTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastUsed: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'g_cloud_accounts',
  timestamps: true,
});

const ExecutionHistory = sequelize.define('ExecutionHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  executionId: {
    type: DataTypes.STRING(36),
    unique: true,
    allowNull: false,
  },
  command: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  output: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending',
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  executionTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'execution_histories',
  timestamps: true,
});

const GCloudMonitorLog = sequelize.define('GCloudMonitorLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  accountEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  monitorStatus: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'gcloud_monitor_logs',
  timestamps: true,
});

// Define associations
CommandExecution.belongsTo(GCloudAccount, {
  foreignKey: 'accountId',
  as: 'account'
});

GCloudAccount.hasMany(CommandExecution, {
  foreignKey: 'accountId',
  as: 'executions'
});

module.exports = {
  sequelize,
  CommandExecution,
  GCloudAccount,
  ExecutionHistory,
  GCloudMonitorLog
};