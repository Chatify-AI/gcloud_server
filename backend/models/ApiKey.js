const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

const ApiKey = sequelize.define('ApiKey', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Friendly name for the API key'
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'The actual API key (hashed)'
  },
  plainKey: {
    type: DataTypes.VIRTUAL,
    comment: 'Plain text key (only available when created)'
  },
  description: {
    type: DataTypes.TEXT,
    comment: 'Description of what this key is used for'
  },
  permissions: {
    type: DataTypes.TEXT,
    defaultValue: JSON.stringify(['execute:commands']),
    get() {
      const value = this.getDataValue('permissions');
      return value ? JSON.parse(value) : [];
    },
    set(value) {
      this.setDataValue('permissions', JSON.stringify(value));
    },
    comment: 'Array of permissions for this key'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this key is active'
  },
  lastUsed: {
    type: DataTypes.DATE,
    comment: 'Last time this key was used'
  },
  expiresAt: {
    type: DataTypes.DATE,
    comment: 'When this key expires (null = never)'
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of times this key has been used'
  },
  rateLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    comment: 'Max requests per hour'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Username who created this key'
  }
}, {
  hooks: {
    beforeCreate: (apiKey) => {
      // Generate a random API key
      const plainKey = 'gck_' + crypto.randomBytes(32).toString('hex');
      apiKey.plainKey = plainKey;
      // Hash it for storage
      apiKey.key = crypto.createHash('sha256').update(plainKey).digest('hex');
    }
  }
});

// Static method to verify API key
ApiKey.verify = async function(plainKey) {
  const hashedKey = crypto.createHash('sha256').update(plainKey).digest('hex');
  const apiKey = await this.findOne({
    where: {
      key: hashedKey,
      isActive: true
    }
  });

  if (!apiKey) {
    return null;
  }

  // Check if expired
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return null;
  }

  // Update usage
  await apiKey.update({
    lastUsed: new Date(),
    usageCount: apiKey.usageCount + 1
  });

  return apiKey;
};

module.exports = ApiKey;