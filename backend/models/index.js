const { sequelize } = require('../config/database');
const Admin = require('./Admin');
const GCloudAccount = require('./GCloudAccount');
const CommandExecution = require('./CommandExecution');
const ApiKey = require('./ApiKey');
const ExecutionHistory = require('./ExecutionHistory');
const ChannelAutoLog = require('./ChannelAutoLog');
const GCloudMonitorLog = require('./GCloudMonitorLog');
const AccountSummary = require('./AccountSummary');

// GCloudAccount和CommandExecution的关系
GCloudAccount.hasMany(CommandExecution, {
  foreignKey: 'accountId',
  as: 'executions'
});

CommandExecution.belongsTo(GCloudAccount, {
  foreignKey: 'accountId',
  as: 'account'
});

// GCloudAccount和ExecutionHistory的关系
GCloudAccount.hasMany(ExecutionHistory, {
  foreignKey: 'accountId',
  as: 'executionHistory'
});

ExecutionHistory.belongsTo(GCloudAccount, {
  foreignKey: 'accountId',
  as: 'account'
});

module.exports = {
  sequelize,
  Admin,
  GCloudAccount,
  CommandExecution,
  ApiKey,
  ExecutionHistory,
  ChannelAutoLog,
  GCloudMonitorLog,
  AccountSummary
};