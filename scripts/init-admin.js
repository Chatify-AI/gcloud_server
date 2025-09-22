#!/usr/bin/env node

const readline = require('readline');
const { sequelize } = require('../backend/config/database');
const { Admin } = require('../backend/models');
const bcrypt = require('bcrypt');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function init() {
  console.log('=================================');
  console.log('   GCloud Manager Admin Setup');
  console.log('=================================');
  console.log('');

  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✓ Database connected');

    // Sync models
    await sequelize.sync();
    console.log('✓ Database synced');

    // Check if admin exists
    const adminCount = await Admin.count();
    if (adminCount > 0) {
      console.log('');
      console.log('⚠ Admin account already exists!');
      const reset = await question('Do you want to reset admin password? (yes/no): ');

      if (reset.toLowerCase() !== 'yes') {
        console.log('Setup cancelled');
        process.exit(0);
      }

      const username = await question('Enter admin username to reset: ');
      const admin = await Admin.findOne({ where: { username } });

      if (!admin) {
        console.log('❌ Admin not found');
        process.exit(1);
      }

      const password = await question('Enter new password (min 6 characters): ');
      if (password.length < 6) {
        console.log('❌ Password must be at least 6 characters');
        process.exit(1);
      }

      admin.password = password;
      await admin.save();

      console.log('');
      console.log('✓ Password reset successfully!');
      console.log('');
      console.log('You can now login with:');
      console.log(`  Username: ${username}`);
      console.log(`  Password: [your new password]`);

    } else {
      // Create new admin
      console.log('Creating first admin account...');
      console.log('');

      const username = await question('Enter admin username: ');
      const password = await question('Enter password (min 6 characters): ');

      if (username.length < 3) {
        console.log('❌ Username must be at least 3 characters');
        process.exit(1);
      }

      if (password.length < 6) {
        console.log('❌ Password must be at least 6 characters');
        process.exit(1);
      }

      const admin = await Admin.create({
        username,
        password,
        role: 'super_admin'
      });

      console.log('');
      console.log('✓ Admin account created successfully!');
      console.log('');
      console.log('=================================');
      console.log('Admin Details:');
      console.log(`  Username: ${admin.username}`);
      console.log(`  Role: ${admin.role}`);
      console.log('=================================');
      console.log('');
      console.log('You can now login to the web interface');
      console.log('Default admin has full access to all features');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run init
init();