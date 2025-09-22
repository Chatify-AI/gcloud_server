const express = require('express');
const { GCloudAccount, CommandExecution } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const googleAuth = require('../services/googleAuth');
const logger = require('../src/utils/logger');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const accounts = await GCloudAccount.findAll({
      where: { userId: req.userId },
      attributes: ['id', 'email', 'projectId', 'projectName', 'isActive', 'lastUsed', 'createdAt']
    });

    res.json({ accounts });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const account = await GCloudAccount.findOne({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ account });
  } catch (error) {
    logger.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

router.post('/add', async (req, res) => {
  try {
    const authUrl = googleAuth.generateAuthUrl(req.userId);
    res.json({ authUrl });
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { projectId, projectName, isActive } = req.body;

    const account = await GCloudAccount.findOne({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.update({
      projectId,
      projectName,
      isActive
    });

    res.json({ message: 'Account updated successfully', account });
  } catch (error) {
    logger.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const account = await GCloudAccount.findOne({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await CommandExecution.destroy({
      where: { accountId: account.id }
    });

    await account.destroy();

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

router.post('/:id/refresh', async (req, res) => {
  try {
    const account = await GCloudAccount.findOne({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const newTokens = await googleAuth.refreshAccessToken(account.refreshToken);

    await account.update({
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || account.refreshToken,
      tokenExpiry: new Date(newTokens.expiry_date)
    });

    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    logger.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

router.get('/:id/projects', async (req, res) => {
  try {
    const account = await GCloudAccount.findOne({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const projects = await googleAuth.getProjectInfo(account.accessToken);

    res.json({ projects });
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

module.exports = router;