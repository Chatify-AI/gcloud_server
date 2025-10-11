const express = require('express');
const { GCloudAccount, AccountSummary } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const gcloudAuth = require('../services/gcloudAuth');
const gcloudExecutor = require('../services/gcloudExecutorClient');
const logger = require('../src/utils/logger');
const gcloudMonitorService = require('../services/gcloudMonitorService');
const oneApiService = require('../services/oneApiService');
const channelKeyService = require('../services/channelKeyService');

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

// 获取所有Google Cloud账号（去掉分页，总是返回全部数据，支持搜索和时间筛选）
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      createdFrom = '',
      createdTo = ''
    } = req.query;

    // 构建搜索条件
    const { Op } = require('sequelize');
    const conditions = [];

    // 添加搜索条件
    if (search && search.trim()) {
      const searchTerm = search.trim();
      conditions.push({
        [Op.or]: [
          { email: { [Op.like]: `%${searchTerm}%` } },
          { displayName: { [Op.like]: `%${searchTerm}%` } },
          { projectId: { [Op.like]: `%${searchTerm}%` } },
          { projectName: { [Op.like]: `%${searchTerm}%` } }
        ]
      });
    }

    // 添加创建时间筛选条件
    if (createdFrom || createdTo) {
      const dateCondition = {};

      if (createdFrom) {
        const fromDate = new Date(createdFrom);
        if (!isNaN(fromDate.getTime())) {
          dateCondition[Op.gte] = fromDate;
        }
      }

      if (createdTo) {
        const toDate = new Date(createdTo);
        if (!isNaN(toDate.getTime())) {
          // 将结束日期设置为当天的23:59:59
          toDate.setHours(23, 59, 59, 999);
          dateCondition[Op.lte] = toDate;
        }
      }

      if (Object.keys(dateCondition).length > 0) {
        conditions.push({ createdAt: dateCondition });
      }
    }

    // 构建最终的where条件
    const whereCondition = conditions.length > 0 ? { [Op.and]: conditions } : {};

    const queryOptions = {
      attributes: [
        'id', 'email', 'displayName', 'projectId', 'projectName',
        'isActive', 'lastUsed', 'createdAt', 'configDir', 'configName',
        'needMonitor', 'scriptExecutionCount', 'lastMonitorTime'
      ],
      where: whereCondition,
      order: [['createdAt', 'DESC']]
    };

    // 直接获取所有数据，不分页
    const accounts = await GCloudAccount.findAll(queryOptions);
    const totalCount = accounts.length;

    res.json({
      accounts,
      pagination: {
        page: 1,
        pageSize: totalCount,
        total: totalCount,
        totalPages: 1,
        showAll: true
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

// 批量同步账号数据到AccountSummary表
router.post('/batch-sync', async (req, res) => {
  try {
    const { accountsData } = req.body;

    if (!accountsData || !Array.isArray(accountsData)) {
      return res.status(400).json({ error: 'accountsData array is required' });
    }

    const batchSize = 50; // 每批处理50条
    const syncResults = [];
    let totalProcessed = 0;

    logger.info(`Starting batch sync for ${accountsData.length} accounts in batches of ${batchSize}`);

    // 分批处理
    for (let i = 0; i < accountsData.length; i += batchSize) {
      const batch = accountsData.slice(i, i + batchSize);
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}: accounts ${i + 1} to ${Math.min(i + batchSize, accountsData.length)}`);

      // 准备批量插入/更新的数据
      const bulkData = [];
      const batchResults = [];

      for (const accountData of batch) {
        try {
          const { id, email, consumptionAmount, scriptExecutionCount, createdAt, lastMonitorTime } = accountData;

          if (!email) {
            batchResults.push({
              accountId: id,
              success: false,
              error: 'Email is required'
            });
            continue;
          }

          bulkData.push({
            email: email,
            consumptionAmount: parseFloat(consumptionAmount) || 0,
            scriptExecutionCount: parseInt(scriptExecutionCount) || 0,
            accountCreatedAt: createdAt ? new Date(createdAt) : null,
            lastMonitorTime: lastMonitorTime ? new Date(lastMonitorTime) : null,
            lastSyncTime: new Date()
          });

          batchResults.push({
            accountId: id,
            email: email,
            success: true,
            consumptionAmount: parseFloat(consumptionAmount) || 0,
            scriptExecutionCount: parseInt(scriptExecutionCount) || 0
          });

        } catch (error) {
          logger.error(`Error preparing account data ${accountData.email || accountData.id}:`, error);
          batchResults.push({
            accountId: accountData.id,
            email: accountData.email,
            success: false,
            error: error.message
          });
        }
      }

      // 批量插入/更新数据库
      if (bulkData.length > 0) {
        try {
          await AccountSummary.bulkCreate(bulkData, {
            updateOnDuplicate: ['consumptionAmount', 'scriptExecutionCount', 'accountCreatedAt', 'lastMonitorTime', 'lastSyncTime'],
            validate: true
          });

          logger.info(`Successfully synced batch: ${bulkData.length} accounts`);
        } catch (bulkError) {
          logger.error('Error in bulk sync:', bulkError);
          // 如果批量操作失败，标记所有为失败
          batchResults.forEach(result => {
            if (result.success) {
              result.success = false;
              result.error = `Bulk operation failed: ${bulkError.message}`;
            }
          });
        }
      }

      syncResults.push(...batchResults);
      totalProcessed += batch.length;

      logger.info(`Batch completed. Processed ${totalProcessed}/${accountsData.length} accounts`);
    }

    const successCount = syncResults.filter(r => r.success).length;
    const failedCount = syncResults.filter(r => !r.success).length;

    logger.info(`Batch sync completed: ${successCount} success, ${failedCount} failed`);

    res.json({
      success: true,
      message: `Synced ${successCount}/${accountsData.length} accounts (${failedCount} failed)`,
      results: syncResults,
      summary: {
        total: accountsData.length,
        success: successCount,
        failed: failedCount,
        batchSize: batchSize,
        batchesProcessed: Math.ceil(accountsData.length / batchSize)
      }
    });

  } catch (error) {
    logger.error('Error in batch sync:', error);
    res.status(500).json({ error: 'Failed to sync accounts' });
  }
});

// 批量删除渠道并删除对应的GCloud账户（流式处理）
router.post('/batch-delete-channels', async (req, res) => {
  try {
    const { accountIds } = req.body;

    if (!accountIds || !Array.isArray(accountIds)) {
      return res.status(400).json({ error: 'accountIds array is required' });
    }

    const accounts = await GCloudAccount.findAll({
      where: { id: accountIds },
      attributes: ['id', 'email', 'configDir']
    });

    if (accounts.length === 0) {
      return res.status(404).json({ error: 'No accounts found' });
    }

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 发送进度事件
    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 发送初始状态
    sendProgress({
      type: 'start',
      total: accounts.length,
      message: `开始删除 ${accounts.length} 个账户的渠道和账户`
    });

    const deleteResults = {
      totalAccounts: accounts.length,
      deletedChannels: 0,
      deletedAccounts: 0,
      failedChannels: [],
      failedAccounts: [],
      progress: []
    };

    let processedCount = 0;
    const concurrency = 10; // 并发数量

    // 处理单个账户的函数
    const processAccount = async (account) => {
      const accountProgress = {
        accountId: account.id,
        email: account.email,
        channelsDeleted: 0,
        channelsFailed: 0,
        accountDeleted: false,
        channels: []
      };

      // 发送开始处理的消息
      sendProgress({
        type: 'processing',
        accountId: account.id,
        email: account.email,
        message: `正在处理账户: ${account.email}`
      });

      try {
        logger.info(`Starting deletion process for account: ${account.email}`);

        // 0. 先同步数据到AccountSummary表
        try {
          // 获取消费数据
          let consumptionAmount = 0;
          try {
            const axios = require('axios');
            const channelStatsServiceUrl = process.env.CHANNEL_STATS_SERVICE_URL || 'http://localhost:4000';
            const response = await axios.get(`${channelStatsServiceUrl}/api/account-consumption/${encodeURIComponent(account.email)}`, {
              timeout: 10000
            });

            if (response.data && response.data.success && response.data.consumption) {
              consumptionAmount = parseFloat(response.data.consumption.totalAmount) || 0;
            }
          } catch (consumptionError) {
            logger.warn(`Failed to get consumption for ${account.email}:`, consumptionError.message);
          }

          // 同步到AccountSummary表
          await AccountSummary.upsert({
            email: account.email,
            consumptionAmount: consumptionAmount,
            scriptExecutionCount: account.scriptExecutionCount,
            accountCreatedAt: account.createdAt,
            lastMonitorTime: account.lastMonitorTime,
            lastSyncTime: new Date()
          });

          sendProgress({
            type: 'data_synced',
            accountId: account.id,
            email: account.email,
            consumptionAmount: consumptionAmount,
            message: `账户 ${account.email}: 数据已同步，消费金额 $${consumptionAmount.toFixed(4)}`
          });

          logger.info(`Synced data for ${account.email} before deletion: consumption=${consumptionAmount}, executions=${account.scriptExecutionCount}`);

        } catch (syncError) {
          logger.error(`Error syncing data for ${account.email}:`, syncError);
          sendProgress({
            type: 'sync_failed',
            accountId: account.id,
            email: account.email,
            error: syncError.message,
            message: `账户 ${account.email}: 数据同步失败，继续删除操作`
          });
        }

        // 0.5. 推送该账户的所有channel keys到远程服务器
        try {
          sendProgress({
            type: 'keys_pushing',
            accountId: account.id,
            email: account.email,
            message: `账户 ${account.email}: 开始推送channel keys...`
          });

          const pushResult = await channelKeyService.pushAccountKeys(account.email, (event) => {
            // 转发key推送进度事件到前端
            sendProgress({
              ...event,
              accountId: account.id
            });
          });

          sendProgress({
            type: 'keys_pushed',
            accountId: account.id,
            email: account.email,
            pushedCount: pushResult.pushedCount,
            failedCount: pushResult.failedCount,
            message: `账户 ${account.email}: Keys推送完成 (${pushResult.pushedCount}成功, ${pushResult.failedCount}失败)`
          });

          logger.info(`Pushed ${pushResult.pushedCount} keys for ${account.email}, ${pushResult.failedCount} failed`);

        } catch (keyPushError) {
          logger.error(`Error pushing keys for ${account.email}:`, keyPushError);
          sendProgress({
            type: 'keys_push_failed',
            accountId: account.id,
            email: account.email,
            error: keyPushError.message,
            message: `账户 ${account.email}: Keys推送失败，继续删除操作`
          });
        }

        // 1. 删除该账户的所有渠道
        try {
          const channelResult = await oneApiService.deleteAccountChannels(account.email);

          accountProgress.channelsDeleted = channelResult.deleted.length;
          accountProgress.channelsFailed = channelResult.failed.length;
          accountProgress.channels = [
            ...channelResult.deleted.map(c => ({ ...c, status: 'deleted' })),
            ...channelResult.failed.map(c => ({ ...c, status: 'failed' }))
          ];

          deleteResults.deletedChannels += channelResult.deleted.length;
          deleteResults.failedChannels.push(...channelResult.failed);

          // 发送渠道删除结果
          sendProgress({
            type: 'channels_processed',
            accountId: account.id,
            email: account.email,
            channelsDeleted: channelResult.deleted.length,
            channelsFailed: channelResult.failed.length,
            message: `账户 ${account.email}: 删除了 ${channelResult.deleted.length} 个渠道，${channelResult.failed.length} 个失败`
          });

        } catch (channelError) {
          logger.error(`Error deleting channels for ${account.email}:`, channelError);
          accountProgress.channelsFailed = 1;
          deleteResults.failedChannels.push({
            accountEmail: account.email,
            error: channelError.message
          });
        }

        // 2. 删除GCloud账户
        try {
          // 撤销认证（如果有configDir）
          if (account.configDir) {
            try {
              await gcloudAuth.revokeAuth(account.configDir);
            } catch (authError) {
              logger.warn(`Error revoking auth for ${account.email}:`, authError);
            }
          }

          // 删除数据库记录
          await account.destroy();

          accountProgress.accountDeleted = true;
          deleteResults.deletedAccounts++;

          logger.info(`Successfully deleted GCloud account: ${account.email}`);

          // 发送账户删除成功
          sendProgress({
            type: 'account_deleted',
            accountId: account.id,
            email: account.email,
            success: true,
            message: `账户 ${account.email} 删除成功`
          });

        } catch (accountError) {
          logger.error(`Failed to delete GCloud account ${account.email}:`, accountError);
          accountProgress.accountDeleted = false;
          deleteResults.failedAccounts.push({
            id: account.id,
            email: account.email,
            error: accountError.message
          });

          // 发送账户删除失败
          sendProgress({
            type: 'account_delete_failed',
            accountId: account.id,
            email: account.email,
            success: false,
            error: accountError.message,
            message: `账户 ${account.email} 删除失败: ${accountError.message}`
          });
        }

      } catch (error) {
        logger.error(`Error processing account ${account.email}:`, error);
        accountProgress.channelsFailed++;
        deleteResults.failedChannels.push({
          accountEmail: account.email,
          error: error.message
        });

        // 发送处理失败
        sendProgress({
          type: 'account_failed',
          accountId: account.id,
          email: account.email,
          error: error.message,
          message: `处理账户 ${account.email} 时出错: ${error.message}`
        });
      }

      deleteResults.progress.push(accountProgress);
      processedCount++;

      // 发送单个账户处理完成
      sendProgress({
        type: 'account_completed',
        current: processedCount,
        total: accounts.length,
        accountId: account.id,
        email: account.email,
        channelsDeleted: accountProgress.channelsDeleted,
        channelsFailed: accountProgress.channelsFailed,
        accountDeleted: accountProgress.accountDeleted,
        progress: Math.round((processedCount / accounts.length) * 100)
      });

      return accountProgress;
    };

    // 并发处理，每批10个
    for (let i = 0; i < accounts.length; i += concurrency) {
      const batch = accounts.slice(i, i + concurrency);

      logger.info(`Processing batch ${Math.floor(i / concurrency) + 1}: ${batch.length} accounts`);

      // 并发处理这一批账户
      await Promise.allSettled(batch.map(account => processAccount(account)));

      // 批次间短暂间隔
      if (i + concurrency < accounts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 发送最终结果
    sendProgress({
      type: 'completed',
      success: true,
      summary: {
        totalAccounts: deleteResults.totalAccounts,
        deletedChannels: deleteResults.deletedChannels,
        deletedAccounts: deleteResults.deletedAccounts,
        failedChannels: deleteResults.failedChannels.length,
        failedAccounts: deleteResults.failedAccounts.length
      },
      message: `删除完成: ${deleteResults.deletedChannels} 个渠道，${deleteResults.deletedAccounts} 个账户`,
      results: deleteResults
    });

    // 结束SSE连接
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.error('Error in batch delete channels:', error);

    // 如果还没有设置响应头，发送错误响应
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to delete channels and accounts' });
    } else {
      // 如果已经开始SSE，发送错误事件
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message,
        message: '批量删除过程中出现严重错误'
      })}\n\n`);
      res.end();
    }
  }
});

// 获取AccountSummary列表
router.get('/summaries', async (req, res) => {
  try {
    const summaries = await AccountSummary.findAll({
      order: [['accountCreatedAt', 'DESC']]
    });

    res.json({
      success: true,
      summaries: summaries
    });
  } catch (error) {
    logger.error('Error fetching account summaries:', error);
    res.status(500).json({ error: 'Failed to fetch account summaries' });
  }
});

module.exports = router;