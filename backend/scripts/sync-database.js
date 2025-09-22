require('dotenv').config();
const { sequelize } = require('../config/database');
const { Admin, GCloudAccount, CommandExecution } = require('../models');

async function syncDatabase() {
  try {
    console.log('Starting database synchronization...');

    // Use alter: true to update schema without losing data
    // NEVER use force: true in production as it drops all tables!
    await sequelize.sync({ alter: true });

    console.log('Database synchronized successfully!');

    // Check if admin account exists before creating
    const existingAdmin = await Admin.findOne({ where: { username: 'admin' } });

    if (!existingAdmin) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);

      await Admin.create({
        username: 'admin',
        password: hashedPassword,
        role: 'super_admin'
      });

      console.log('Default admin account created (username: admin, password: admin123)');
    } else {
      console.log('Admin account already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error synchronizing database:', error);
    process.exit(1);
  }
}

syncDatabase();