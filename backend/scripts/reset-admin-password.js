const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');
const { Admin } = require('../models');

async function resetAdminPassword() {
  try {
    // Generate new hash for admin123
    const newHash = await bcrypt.hash('admin123', 10);
    console.log('New hash generated for admin123');

    // Update the admin password directly
    const result = await sequelize.query(
      `UPDATE admins SET password = :password WHERE username = 'admin'`,
      {
        replacements: { password: newHash },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    console.log('Admin password updated successfully');

    // Verify the update worked
    const admin = await Admin.findOne({ where: { username: 'admin' } });
    if (admin) {
      const isValid = await admin.validatePassword('admin123');
      console.log('Password verification:', isValid ? 'SUCCESS' : 'FAILED');
    } else {
      console.log('Admin user not found');
    }

  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await sequelize.close();
  }
}

resetAdminPassword();