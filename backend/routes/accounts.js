const express = require('express');
const { GCloudAccount, CommandExecution } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const googleAuth = require('../services/googleAuth');
const logger = require('../src/utils/logger');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 50,
      search = '',
      showAll = false
    } = req.query;

    const currentPage = parseInt(page);
    const currentPageSize = showAll === 'true' ? undefined : parseInt(pageSize);

    // 构建搜索条件
    const whereCondition = { userId: req.userId };
    if (search && search.trim()) {
      const { Op } = require('sequelize');
      const searchTerm = search.trim();
      whereCondition[Op.and] = [
        { userId: req.userId },
        {
          [Op.or]: [
            { email: { [Op.like]: `%${searchTerm}%` } },
            { projectId: { [Op.like]: `%${searchTerm}%` } },
            { projectName: { [Op.like]: `%${searchTerm}%` } }
          ]
        }
      ];
      delete whereCondition.userId; // 避免重复条件
    }

    const queryOptions = {
      where: whereCondition,
      attributes: ['id', 'email', 'projectId', 'projectName', 'isActive', 'lastUsed', 'createdAt'],
      order: [['createdAt', 'DESC']]
    };

    let accounts;
    let totalCount;

    if (showAll === 'true') {
      // 获取所有数据，不分页
      accounts = await GCloudAccount.findAll(queryOptions);
      totalCount = accounts.length;
    } else {
      // 分页查询
      const offset = (currentPage - 1) * currentPageSize;
      queryOptions.limit = currentPageSize;
      queryOptions.offset = offset;

      const { count, rows } = await GCloudAccount.findAndCountAll(queryOptions);
      accounts = rows;
      totalCount = count;
    }

    res.json({
      accounts,
      pagination: {
        page: currentPage,
        pageSize: showAll === 'true' ? totalCount : currentPageSize,
        total: totalCount,
        totalPages: showAll === 'true' ? 1 : Math.ceil(totalCount / currentPageSize),
        showAll: showAll === 'true'
      }
    });
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

// 获取账号的消费数据
router.get('/:id/consumption', async (req, res) => {
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

    // 调用channel-stats-service获取该邮箱的消费数据
    const axios = require('axios');
    const channelStatsServiceUrl = process.env.CHANNEL_STATS_SERVICE_URL || 'http://localhost:4000';

    try {
      const response = await axios.get(`${channelStatsServiceUrl}/api/account-consumption/${encodeURIComponent(account.email)}`, {
        timeout: 10000
      });

      if (response.data && response.data.success) {
        res.json({
          success: true,
          accountId: account.id,
          email: account.email,
          consumption: response.data.consumption
        });
      } else {
        res.json({
          success: false,
          accountId: account.id,
          email: account.email,
          message: response.data?.message || 'No consumption data found'
        });
      }
    } catch (serviceError) {
      logger.error(`Error fetching consumption for ${account.email}:`, serviceError.message);
      res.json({
        success: false,
        accountId: account.id,
        email: account.email,
        error: serviceError.message
      });
    }
  } catch (error) {
    logger.error('Error in consumption endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch consumption data' });
  }
});

// 批量获取多个账号的消费数据
router.post('/batch-consumption', async (req, res) => {
  try {
    const { accountIds } = req.body;

    if (!accountIds || !Array.isArray(accountIds)) {
      return res.status(400).json({ error: 'accountIds array is required' });
    }

    const accounts = await GCloudAccount.findAll({
      where: {
        id: accountIds,
        userId: req.userId
      },
      attributes: ['id', 'email']
    });

    const axios = require('axios');
    const channelStatsServiceUrl = process.env.CHANNEL_STATS_SERVICE_URL || 'http://localhost:4000';

    // 并发获取所有账号的消费数据
    const consumptionPromises = accounts.map(async (account) => {
      try {
        const response = await axios.get(`${channelStatsServiceUrl}/api/account-consumption/${encodeURIComponent(account.email)}`, {
          timeout: 10000
        });

        return {
          accountId: account.id,
          email: account.email,
          success: true,
          consumption: response.data?.success ? response.data.consumption : null,
          message: response.data?.message
        };
      } catch (error) {
        logger.error(`Error fetching consumption for ${account.email}:`, error.message);
        return {
          accountId: account.id,
          email: account.email,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(consumptionPromises);

    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    logger.error('Error in batch consumption endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch batch consumption data' });
  }
});

module.exports = router;