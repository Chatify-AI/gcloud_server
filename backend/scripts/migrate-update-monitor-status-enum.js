const { sequelize } = require('../config/database');
const { QueryInterface } = require('sequelize');

async function updateMonitorStatusEnum() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Updating monitor_status ENUM type...');

    // MySQL syntax for altering ENUM column
    await queryInterface.sequelize.query(`
      ALTER TABLE gcloud_monitor_logs
      MODIFY COLUMN monitor_status ENUM('started', 'checking', 'success', 'failed', 'script_executed', 'skipped', 'completed', 'script_started', 'disabled', 'partial_failure')
      DEFAULT 'started'
    `);

    console.log('✅ Successfully updated monitor_status ENUM type');
  } catch (error) {
    console.error('❌ Error updating monitor_status ENUM:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the migration
updateMonitorStatusEnum().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});