require('dotenv').config();
const { sequelize } = require('../config/database');
const { QueryInterface, DataTypes } = require('sequelize');

async function addMonitorFields() {
  const queryInterface = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    console.log('Adding monitor fields to GCloudAccounts table...');

    // Check if columns already exist
    const tableDesc = await queryInterface.describeTable('g_cloud_accounts');

    if (!tableDesc.need_monitor) {
      await queryInterface.addColumn(
        'g_cloud_accounts',
        'need_monitor',
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: 'Whether this account needs monitoring'
        },
        { transaction }
      );
      console.log('Added need_monitor column');
    } else {
      console.log('need_monitor column already exists');
    }

    if (!tableDesc.script_execution_count) {
      await queryInterface.addColumn(
        'g_cloud_accounts',
        'script_execution_count',
        {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          comment: 'Number of times script has been executed'
        },
        { transaction }
      );
      console.log('Added script_execution_count column');
    } else {
      console.log('script_execution_count column already exists');
    }

    if (!tableDesc.last_monitor_time) {
      await queryInterface.addColumn(
        'g_cloud_accounts',
        'last_monitor_time',
        {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'Last time this account was monitored'
        },
        { transaction }
      );
      console.log('Added last_monitor_time column');
    } else {
      console.log('last_monitor_time column already exists');
    }

    await transaction.commit();
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

addMonitorFields();