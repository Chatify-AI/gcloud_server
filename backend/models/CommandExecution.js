const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommandExecution = sequelize.define('CommandExecution', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  executedBy: {
    type: DataTypes.STRING,
    allowNull: false
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: true, // 允许null，用于shell命令
    references: {
      model: 'g_cloud_accounts',
      key: 'id'
    }
  },
  command: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending'
  },
  output: {
    type: DataTypes.TEXT
  },
  error: {
    type: DataTypes.TEXT
  },
  startedAt: {
    type: DataTypes.DATE
  },
  completedAt: {
    type: DataTypes.DATE
  },
  executionTime: {
    type: DataTypes.INTEGER
  }
});

module.exports = CommandExecution;