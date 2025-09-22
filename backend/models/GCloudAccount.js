const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GCloudAccount = sequelize.define('GCloudAccount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  displayName: {
    type: DataTypes.STRING
  },
  projectId: {
    type: DataTypes.STRING
  },
  projectName: {
    type: DataTypes.STRING
  },
  accessToken: {
    type: DataTypes.TEXT
  },
  refreshToken: {
    type: DataTypes.TEXT
  },
  tokenExpiry: {
    type: DataTypes.DATE
  },
  scopes: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('scopes');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('scopes', JSON.stringify(value));
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastUsed: {
    type: DataTypes.DATE
  },
  configDir: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Path to gcloud configuration directory for this account'
  },
  configName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Name of the gcloud configuration'
  },
  needMonitor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this account needs monitoring'
  },
  scriptExecutionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of times script has been executed for this account'
  },
  lastMonitorTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time this account was monitored'
  }
});

module.exports = GCloudAccount;