const express = require('express');
const { CommandExecution, GCloudAccount } = require('../models');
const { combinedAuthMiddleware } = require('../middleware/combinedAuth');
const gcloudExecutor = require('../services/gcloudExecutor');
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
    const { limit = 20, offset = 0, accountId } = req.query;

    const where = {};
    if (accountId) {
      where.accountId = accountId;
    }

    const executions = await CommandExecution.findAll({
      where,
      include: [{
        model: GCloudAccount,
        as: 'account',
        attributes: ['email', 'displayName', 'projectId']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await CommandExecution.count({ where });

    res.json({ executions, total });
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