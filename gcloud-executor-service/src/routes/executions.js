const express = require('express');
const gcloudExecutor = require('../services/gcloudExecutor');
const logger = require('../utils/logger');
const { CommandExecution } = require('../models');

const router = express.Router();

// 执行gcloud命令
router.post('/gcloud', async (req, res) => {
  try {
    const { accountId, command, async = false, adminUsername = 'executor-service' } = req.body;

    if (!accountId || !command) {
      return res.status(400).json({ error: 'Account ID and command are required' });
    }

    logger.info(`Executing gcloud command: ${command}`, { accountId, async });

    const result = await gcloudExecutor.executeCommand(
      adminUsername,
      accountId,
      command,
      { async }
    );

    res.json(result);
  } catch (error) {
    logger.error('Error executing gcloud command:', error);
    res.status(500).json({ error: error.message });
  }
});

// 执行Cloud Shell命令
router.post('/cloud-shell', async (req, res) => {
  try {
    const { accountId, command, async = false, adminUsername = 'executor-service', syncAuth = true } = req.body;

    if (!accountId || !command) {
      return res.status(400).json({ error: 'Account ID and command are required' });
    }

    logger.info(`Executing cloud shell command: ${command}`, { accountId, async });

    const result = await gcloudExecutor.executeCloudShellCommand(
      adminUsername,
      accountId,
      command,
      { async, syncAuth }
    );

    res.json(result);
  } catch (error) {
    logger.error('Error executing Cloud Shell command:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取执行状态
router.get('/:id', async (req, res) => {
  try {
    const execution = await gcloudExecutor.getExecutionStatus(req.params.id);
    res.json({ execution });
  } catch (error) {
    logger.error('Error fetching execution:', error);
    res.status(404).json({ error: error.message });
  }
});

// 取消执行
router.post('/:id/cancel', async (req, res) => {
  try {
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

// 获取执行流输出 (SSE)
router.get('/:id/stream', async (req, res) => {
  try {
    const execution = await CommandExecution.findByPk(req.params.id);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial data if execution is completed
    if (execution.status === 'completed' || execution.status === 'failed') {
      if (execution.output) {
        res.write(`data: ${JSON.stringify({ type: 'output', data: execution.output })}\\n\\n`);
      }
      if (execution.error) {
        res.write(`data: ${JSON.stringify({ type: 'error', data: execution.error })}\\n\\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'status', status: execution.status })}\\n\\n`);
      res.write(`data: ${JSON.stringify({ type: 'close' })}\\n\\n`);
      res.end();
      return;
    }

    await gcloudExecutor.streamExecution(
      req.params.id,
      (data) => {
        res.write(`data: ${JSON.stringify({ type: 'output', data })}\\n\\n`);
      },
      (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', data: error })}\\n\\n`);
      },
      () => {
        res.write(`data: ${JSON.stringify({ type: 'close' })}\\n\\n`);
        res.end();
      }
    );

  } catch (error) {
    logger.error('Error streaming execution:', error);
    res.status(500).json({ error: 'Failed to stream execution' });
  }
});

// 获取账户项目列表
router.get('/accounts/:accountId/projects', async (req, res) => {
  try {
    const projects = await gcloudExecutor.listProjects(req.params.accountId);
    res.json({ projects });
  } catch (error) {
    logger.error('Error listing projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取账户配置
router.get('/accounts/:accountId/config', async (req, res) => {
  try {
    const config = await gcloudExecutor.getAccountConfig(req.params.accountId);
    res.json({ config });
  } catch (error) {
    logger.error('Error getting account config:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;