const express = require('express');
const { CommandExecution, GCloudAccount } = require('../models');
const { combinedAuthMiddleware } = require('../middleware/combinedAuth');
const gcloudExecutor = require('../services/gcloudExecutorClient');
const logger = require('../src/utils/logger');

const router = express.Router();

// 注释掉认证中间件，让接口无需鉴权
// router.use(combinedAuthMiddleware);

// 执行gcloud命令
router.post('/execute', async (req, res) => {
  try {
    const { accountId, command, async = false } = req.body;

    if (!accountId || !command) {
      return res.status(400).json({ error: 'Account ID and command are required' });
    }

    const account = await GCloudAccount.findByPk(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // 记录账号使用
    await account.update({ lastUsed: new Date() });

    const result = await gcloudExecutor.executeCommand(
      req.admin?.username || 'anonymous',
      accountId,
      command,
      { async }
    );

    res.json(result);
  } catch (error) {
    logger.error('Error executing command:', error);
    res.status(500).json({ error: error.message });
  }
});

// 执行Cloud Shell命令
router.post('/cloud-shell', async (req, res) => {
  try {
    const { accountId, command, async = false } = req.body;

    if (!accountId || !command) {
      return res.status(400).json({ error: 'Account ID and command are required' });
    }

    const account = await GCloudAccount.findByPk(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // 记录账号使用
    await account.update({ lastUsed: new Date() });

    const result = await gcloudExecutor.executeCloudShellCommand(
      req.admin?.username || 'anonymous',
      accountId,
      command,
      { async }
    );

    res.json(result);
  } catch (error) {
    logger.error('Error executing Cloud Shell command:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取执行历史
router.get('/executions', async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      accountId,
      email,
      page = 1,
      pageSize = 20,
      showAll = false
    } = req.query;

    const currentPage = parseInt(page);
    const currentPageSize = showAll === 'true' ? undefined : parseInt(pageSize);

    const where = {};
    const includeWhere = {};

    if (accountId) {
      where.accountId = accountId;
    }

    // 邮箱筛选
    if (email && email.trim()) {
      const { Op } = require('sequelize');
      includeWhere.email = { [Op.like]: `%${email.trim()}%` };
    }

    const queryOptions = {
      where,
      include: [{
        model: GCloudAccount,
        as: 'account',
        attributes: ['email', 'displayName', 'projectId'],
        where: Object.keys(includeWhere).length > 0 ? includeWhere : undefined,
        required: Object.keys(includeWhere).length > 0 // INNER JOIN when filtering by email
      }],
      order: [['createdAt', 'DESC']]
    };

    let executions;
    let total;

    if (showAll === 'true') {
      // 获取所有数据，不分页
      executions = await CommandExecution.findAll(queryOptions);
      total = executions.length;
    } else {
      // 分页查询
      const offsetValue = (currentPage - 1) * currentPageSize;
      queryOptions.limit = currentPageSize;
      queryOptions.offset = offsetValue;

      const { count, rows } = await CommandExecution.findAndCountAll(queryOptions);
      executions = rows;
      total = count;
    }

    res.json({
      executions,
      total,
      pagination: {
        page: currentPage,
        pageSize: showAll === 'true' ? total : currentPageSize,
        totalPages: showAll === 'true' ? 1 : Math.ceil(total / currentPageSize),
        showAll: showAll === 'true'
      }
    });
  } catch (error) {
    logger.error('Error fetching executions:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// 获取执行详情
router.get('/executions/:id', async (req, res) => {
  try {
    const execution = await CommandExecution.findOne({
      where: { id: req.params.id },
      include: [{
        model: GCloudAccount,
        as: 'account',
        attributes: ['email', 'displayName', 'projectId']
      }]
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json({ execution });
  } catch (error) {
    logger.error('Error fetching execution:', error);
    res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

// 取消执行
router.post('/executions/:id/cancel', async (req, res) => {
  try {
    const execution = await CommandExecution.findByPk(req.params.id);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const cancelled = await gcloudExecutor.cancelExecution(req.params.id);

    if (cancelled) {
      res.json({ message: 'Execution cancelled successfully' });
    } else {
      res.status(400).json({ error: 'Execution is not running' });
    }
  } catch (error) {
    logger.error('Error cancelling execution:', error);
    res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

// 获取执行流输出
router.get('/executions/:id/stream', async (req, res) => {
  try {
    const execution = await CommandExecution.findByPk(req.params.id);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    await gcloudExecutor.streamExecution(
      req.params.id,
      (data) => {
        res.write(`data: ${JSON.stringify({ type: 'output', data })}\n\n`);
      },
      (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', data: error })}\n\n`);
      },
      () => {
        res.write(`data: ${JSON.stringify({ type: 'close' })}\n\n`);
        res.end();
      }
    );

  } catch (error) {
    logger.error('Error streaming execution:', error);
    res.status(500).json({ error: 'Failed to stream execution' });
  }
});

module.exports = router;