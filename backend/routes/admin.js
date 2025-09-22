const express = require('express');
const jwt = require('jsonwebtoken');
const { Admin } = require('../models');
const logger = require('../src/utils/logger');

const router = express.Router();

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ where: { username } });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await admin.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await admin.update({ lastLogin: new Date() });

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    });

  } catch (error) {
    logger.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 创建初始管理员（仅在没有管理员时可用）
router.post('/setup', async (req, res) => {
  try {
    const adminCount = await Admin.count();

    if (adminCount > 0) {
      return res.status(403).json({ error: 'Admin already exists' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const admin = await Admin.create({
      username,
      password,
      role: 'super_admin'
    });

    logger.info(`Initial admin created: ${username}`);

    res.json({
      success: true,
      message: 'Admin account created successfully',
      admin: {
        username: admin.username,
        role: admin.role
      }
    });

  } catch (error) {
    logger.error('Admin setup error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// 检查是否需要初始化
router.get('/check-setup', async (req, res) => {
  try {
    const adminCount = await Admin.count();
    res.json({ needsSetup: adminCount === 0 });
  } catch (error) {
    logger.error('Setup check error:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

module.exports = router;