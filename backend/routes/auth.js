const express = require('express');
const jwt = require('jsonwebtoken');
const { User, GCloudAccount } = require('../models');
const googleAuth = require('../services/googleAuth');
const logger = require('../src/utils/logger');

const router = express.Router();

router.get('/google/url', async (req, res) => {
  try {
    const state = req.query.state || null;
    const authUrl = googleAuth.generateAuthUrl(state);
    res.json({ authUrl });
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

router.post('/google/callback', async (req, res) => {
  try {
    const { code, userId } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const tokens = await googleAuth.getTokensFromCode(code);

    const userInfo = await googleAuth.getUserInfo(tokens.access_token);

    let user;
    if (userId) {
      user = await User.findByPk(userId);
    } else {
      [user] = await User.findOrCreate({
        where: { email: userInfo.email },
        defaults: {
          email: userInfo.email,
          googleId: userInfo.id,
          name: userInfo.name,
          profilePicture: userInfo.picture
        }
      });

      await user.update({ lastLogin: new Date() });
    }

    const projects = await googleAuth.getProjectInfo(tokens.access_token);
    const defaultProject = projects[0] || {};

    const [account, created] = await GCloudAccount.findOrCreate({
      where: {
        userId: user.id,
        email: userInfo.email
      },
      defaults: {
        userId: user.id,
        email: userInfo.email,
        projectId: defaultProject.projectId || null,
        projectName: defaultProject.name || null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date),
        scopes: googleAuth.scopes,
        isActive: true,
        lastUsed: new Date()
      }
    });

    if (!created) {
      await account.update({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || account.refreshToken,
        tokenExpiry: new Date(tokens.expiry_date),
        isActive: true,
        lastUsed: new Date()
      });
    }

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        role: user.role
      },
      account: {
        id: account.id,
        email: account.email,
        projectId: account.projectId,
        projectName: account.projectName
      },
      message: created ? 'New account added successfully' : 'Account updated successfully'
    });

  } catch (error) {
    logger.error('Error in OAuth callback:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.update({ lastLogin: new Date() });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;