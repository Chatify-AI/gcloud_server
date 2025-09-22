const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GCloudMonitorLog = sequelize.define('GCloudMonitorLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'ID of the GCloud account being monitored'
  },
  accountEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Email of the GCloud account'
  },
  monitorStatus: {
    type: DataTypes.ENUM('started', 'checking', 'success', 'failed', 'script_executed', 'skipped', 'completed', 'script_started', 'disabled', 'partial_failure', 'all_failed_cooldown'),
    defaultValue: 'started',
    comment: 'Status of the monitoring task'
  },
  availableChannels: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of available channels found'
  },
  testedChannels: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of channels tested'
  },
  successfulChannels: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of successful channels'
  },
  failedChannels: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON array of failed channel IDs',
    get() {
      const rawValue = this.getDataValue('failedChannels');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('failedChannels', JSON.stringify(value));
    }
  },
  disabledChannels: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON array of disabled channel IDs',
    get() {
      const rawValue = this.getDataValue('disabledChannels');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('disabledChannels', JSON.stringify(value));
    }
  },
  scriptExecuted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the recovery script was executed'
  },
  scriptType: {
    type: DataTypes.ENUM('gemini', 'vertex'),
    allowNull: true,
    comment: 'Type of script executed'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Additional message or error details'
  },
  startTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'When the monitoring started'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the monitoring ended'
  },
  testDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON array containing detailed test results with timing information',
    get() {
      const rawValue = this.getDataValue('testDetails');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('testDetails', typeof value === 'string' ? value : JSON.stringify(value));
    }
  }
}, {
  tableName: 'gcloud_monitor_logs',
  underscored: true,
  timestamps: true
});

module.exports = GCloudMonitorLog;