const express = require('express');
const { GCloudAccount } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const gcloudAuth = require('../services/gcloudAuth');
const gcloudExecutor = require('../services/gcloudExecutorClient');
const logger = require('../src/utils/logger');
const gcloudMonitorService = require('../services/gcloudMonitorService');

const router = express.Router();

// Temporary storage for pending authentications (in production, use Redis)
const pendingAuths = new Map();

// Clean up old pending auths every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingAuths.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) { // 30 minutes
      pendingAuths.delete(key);
    }
  }
}, 30 * 60 * 1000);

// 需要管理员权限
router.use(authMiddleware);

// 获取所有Google Cloud账号（支持分页和搜索）
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
    const whereCondition = {};
    if (search && search.trim()) {
      const { Op } = require('sequelize');
      const searchTerm = search.trim();
      whereCondition[Op.or] = [
        { email: { [Op.like]: `%${searchTerm}%` } },
        { displayName: { [Op.like]: `%${searchTerm}%` } },
        { projectId: { [Op.like]: `%${searchTerm}%` } },
        { projectName: { [Op.like]: `%${searchTerm}%` } }
      ];
    }

    const queryOptions = {
      attributes: [
        'id', 'email', 'displayName', 'projectId', 'projectName',
        'isActive', 'lastUsed', 'createdAt', 'configDir', 'configName',
        'needMonitor', 'scriptExecutionCount', 'lastMonitorTime'
      ],
      where: whereCondition,
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
    logger.error('Error fetching GCloud accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// 生成gcloud auth login URL - 使用真实的gcloud CLI
router.get('/auth-url', async (req, res) => {
  try {
    const authData = await gcloudAuth.generateGCloudAuthUrl();

    // authData already contains authId from the service
    // Store additional info in our local map for fallback
    pendingAuths.set(authData.authId, {
      configDir: authData.configDir,
      configName: authData.configName,
      timestamp: Date.now()
    });

    // Also try to store in session if available
    if (req.session) {
      req.session.pendingAuthConfig = {
        configDir: authData.configDir,
        configName: authData.configName
      };
      req.session.authId = authData.authId;
    }

    res.json({
      authUrl: authData.authUrl,
      authId: authData.authId, // Use auth ID from the service
      instructions: authData.instructions
    });
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL. Make sure gcloud CLI is installed.' });
  }
});

// 完成gcloud authentication并添加账号
router.post('/add', async (req, res) => {
  try {
    const { code: verificationCode, authId } = req.body;

    console.log('Add account request - authId:', authId, 'code:', verificationCode ? 'provided' : 'missing');

    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    if (!authId) {
      return res.status(400).json({
        error: 'Authentication session ID is required',
        hint: 'Make sure to include the authId from the auth-url response'
      });
    }

    // Complete the gcloud authentication using the session ID
    const authResult = await gcloudAuth.completeGCloudAuth(authId, verificationCode);

    // Check if account already exists
    const existingAccount = await GCloudAccount.findOne({
      where: { email: authResult.email }
    });

    if (existingAccount) {
      // Update existing account with new config
      await existingAccount.update({
        accessToken: authResult.accessToken,
        projectId: authResult.projectId || existingAccount.projectId,
        configDir: authResult.configDir,
        configName: authResult.configName,
        isActive: true,
        lastUsed: new Date()
      });

      logger.info(`GCloud account updated: ${authResult.email}`);

      res.json({
        success: true,
        message: 'Account updated successfully',
        account: {
          id: existingAccount.id,
          email: existingAccount.email,
          displayName: existingAccount.displayName,
          projectId: existingAccount.projectId,
          configDir: existingAccount.configDir
        }
      });
    } else {
      // Create new account with monitoring enabled
      const newAccount = await GCloudAccount.create({
        email: authResult.email,
        displayName: authResult.email.split('@')[0],
        projectId: authResult.projectId,
        accessToken: authResult.accessToken,
        configDir: authResult.configDir,
        configName: authResult.configName,
        isActive: true,
        lastUsed: new Date(),
        needMonitor: true,  // 自动启用监听
        scriptExecutionCount: 0,
        lastMonitorTime: null
      });

      logger.info(`New GCloud account added: ${authResult.email}`);

      // 不再立即执行初始化脚本，让监控服务自动检测并执行
      // 监控服务会检测 scriptExecutionCount === 0 的新账号并自动执行初始脚本

      res.json({
        success: true,
        message: 'Account added successfully, initialization will start automatically',
        account: {
          id: newAccount.id,
          email: newAccount.email,
          displayName: newAccount.displayName,
          projectId: newAccount.projectId,
          configDir: newAccount.configDir
        }
      });
    }

  } catch (error) {
    logger.error('Error adding account:', error);
    res.status(500).json({ error: error.message || 'Failed to add account' });
  }
});

// 获取账号的项目列表
router.get('/:id/projects', async (req, res) => {
  try {
    const { id } = req.params;
    const projects = await gcloudExecutor.listProjects(id);
    res.json({ projects });
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// 更新账号信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId, projectName, isActive } = req.body;

    const account = await GCloudAccount.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Update project in gcloud config if configDir exists
    if (account.configDir && projectId && projectId !== account.projectId) {
      await gcloudAuth.setProject(account.configDir, projectId);
    }

    await account.update({
      projectId,
      projectName,
      isActive
    });

    logger.info(`GCloud account updated: ${account.email}`);

    res.json({
      success: true,
      message: 'Account updated successfully',
      account: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        projectId: account.projectId,
        projectName: account.projectName,
        isActive: account.isActive
      }
    });
  } catch (error) {
    logger.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// 刷新账号token
router.post('/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;

    const account = await GCloudAccount.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.configDir) {
      return res.status(400).json({ error: 'Account needs re-authentication' });
    }

    // Refresh the access token using gcloud
    const newAccessToken = await gcloudAuth.refreshAccessToken(account.configDir);

    await account.update({
      accessToken: newAccessToken,
      lastUsed: new Date()
    });

    logger.info(`Token refreshed for account: ${account.email}`);

    res.json({
      success: true,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    logger.error('Error refreshing token:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh token' });
  }
});

// 更新账号执行次数 (PATCH)
router.patch('/:id/execution-count', async (req, res) => {
  try {
    const { id } = req.params;
    const { scriptExecutionCount } = req.body;

    const account = await GCloudAccount.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.update({
      scriptExecutionCount: parseInt(scriptExecutionCount) || 0
    });

    logger.info(`Updated execution count for account ${account.email}: ${scriptExecutionCount}`);

    res.json({
      success: true,
      message: `Execution count updated to ${scriptExecutionCount}`,
      account: {
        id: account.id,
        email: account.email,
        scriptExecutionCount: account.scriptExecutionCount
      }
    });
  } catch (error) {
    logger.error('Error updating execution count:', error);
    res.status(500).json({ error: 'Failed to update execution count' });
  }
});

// 更新账号执行次数 (PUT) - 兼容性端点
router.put('/:id/execution-count', async (req, res) => {
  try {
    const { id } = req.params;
    const { scriptExecutionCount } = req.body;

    const account = await GCloudAccount.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.update({
      scriptExecutionCount: parseInt(scriptExecutionCount) || 0
    });

    logger.info(`Updated execution count for account ${account.email}: ${scriptExecutionCount}`);

    res.json({
      success: true,
      message: `Execution count updated to ${scriptExecutionCount}`,
      account: {
        id: account.id,
        email: account.email,
        scriptExecutionCount: account.scriptExecutionCount
      }
    });
  } catch (error) {
    logger.error('Error updating execution count:', error);
    res.status(500).json({ error: 'Failed to update execution count' });
  }
});

// 更新账号监听状态 (PATCH)
router.patch('/:id/monitor', async (req, res) => {
  try {
    const { id } = req.params;
    const { needMonitor } = req.body;

    const account = await GCloudAccount.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.update({
      needMonitor: needMonitor
    });

    logger.info(`Updated monitor status for account ${account.email}: ${needMonitor}`);

    res.json({
      success: true,
      message: `Monitor ${needMonitor ? 'enabled' : 'disabled'} for account ${account.email}`,
      account: {
        id: account.id,
        email: account.email,
        needMonitor: account.needMonitor
      }
    });
  } catch (error) {
    logger.error('Error updating monitor status:', error);
    res.status(500).json({ error: 'Failed to update monitor status' });
  }
});

// 更新账号监听状态 (PUT) - 兼容性端点
router.put('/:id/monitor', async (req, res) => {
  try {
    const { id } = req.params;
    const { needMonitor } = req.body;

    const account = await GCloudAccount.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.update({
      needMonitor: needMonitor
    });

    logger.info(`Updated monitor status for account ${account.email}: ${needMonitor}`);

    res.json({
      success: true,
      message: `Monitor ${needMonitor ? 'enabled' : 'disabled'} for account ${account.email}`,
      account: {
        id: account.id,
        email: account.email,
        needMonitor: account.needMonitor
      }
    });
  } catch (error) {
    logger.error('Error updating monitor status:', error);
    res.status(500).json({ error: 'Failed to update monitor status' });
  }
});

// 删除账号
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const account = await GCloudAccount.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Revoke authentication if configDir exists
    if (account.configDir) {
      try {
        await gcloudAuth.revokeAuth(account.configDir);
      } catch (error) {
        logger.warn('Error revoking auth:', error);
      }
    }

    await account.destroy();

    logger.info(`GCloud account deleted: ${account.email}`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// 获取账号配置信息
router.get('/:id/config', async (req, res) => {
  try {
    const { id } = req.params;
    const config = await gcloudExecutor.getAccountConfig(id);
    res.json({ config });
  } catch (error) {
    logger.error('Error fetching account config:', error);
    res.status(500).json({ error: 'Failed to fetch account configuration' });
  }
});

// 获取账号的监听历史记录
router.get('/:id/monitor-logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const logs = await gcloudMonitorService.getLogs({
      accountId: id,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    res.json(logs);
  } catch (error) {
    logger.error('Error fetching monitor logs:', error);
    res.status(500).json({ error: 'Failed to fetch monitor logs' });
  }
});

// 获取账号的消费数据
router.get('/:id/consumption', async (req, res) => {
  try {
    const { id } = req.params;

    const account = await GCloudAccount.findByPk(id);
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
          accountId: id,
          email: account.email,
          consumption: response.data.consumption
        });
      } else {
        res.json({
          success: false,
          accountId: id,
          email: account.email,
          message: response.data?.message || 'No consumption data found'
        });
      }
    } catch (serviceError) {
      logger.error(`Error fetching consumption for ${account.email}:`, serviceError.message);
      res.json({
        success: false,
        accountId: id,
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
      where: { id: accountIds },
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