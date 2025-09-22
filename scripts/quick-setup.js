#!/usr/bin/env node

const { sequelize } = require('../backend/config/database');
const { Admin } = require('../backend/models');

async function quickSetup() {
  console.log('Quick Setup - Creating default admin account...');

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const adminCount = await Admin.count();
    if (adminCount > 0) {
      console.log('Admin account already exists');
      process.exit(0);
    }

    // Create default admin
    const admin = await Admin.create({
      username: 'admin',
      password: 'admin123',
      role: 'super_admin'
    });

    console.log('✓ Admin account created:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('  ⚠ Please change the password after first login!');

  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

quickSetup();