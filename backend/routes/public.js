const express = require('express');
const { GCloudAccount, CommandExecution, ExecutionHistory } = require('../models');
const gcloudExecutor = require('../services/gcloudExecutorClient');
const logger = require('../src/utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// 公开接口 - 无需认证

// 获取可用的 GCloud 账号列表（简化版）
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await GCloudAccount.findAll({
      attributes: ['id', 'email', 'displayName', 'projectId', 'isActive'],
      where: { isActive: true },
      order: [['lastUsed', 'DESC']]
    });

    res.json({ accounts });
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// 执行 gcloud 命令（无需认证）
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

    if (!account.isActive) {
      return res.status(400).json({ error: 'Account is not active' });
    }

    // 记录账号使用
    await account.update({ lastUsed: new Date() });

    const result = await gcloudExecutor.executeCommand(
      'public-api',
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

// 执行 Cloud Shell 命令（无需认证）
router.post('/cloud-shell', async (req, res) => {
  let history = null;
  try {
    const { accountId, command, async = false } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!accountId || !command) {
      return res.status(400).json({ error: 'Account ID and command are required' });
    }

    // 支持通过ID、用户名或邮箱查找账户
    let account;

    // 首先尝试作为ID查找
    if (!isNaN(accountId)) {
      account = await GCloudAccount.findByPk(accountId);
    }

    // 如果没找到，尝试通过邮箱查找（只有当accountId是字符串时）
    if (!account && typeof accountId === 'string') {
      // 如果包含@符号，作为完整邮箱查找
      if (accountId.includes('@')) {
        account = await GCloudAccount.findOne({
          where: { email: accountId }
        });
      } else {
        // 否则尝试作为用户名查找（自动补充@gmail.com）
        const emailToFind = `${accountId}@gmail.com`;

        account = await GCloudAccount.findOne({
          where: {
            email: emailToFind
          }
        });

        // 如果还是没找到，尝试精确匹配displayName
        if (!account) {
          account = await GCloudAccount.findOne({
            where: { displayName: accountId }
          });
        }
      }
    }

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.isActive) {
      return res.status(400).json({ error: 'Account is not active' });
    }

    // 创建执行历史记录
    history = await ExecutionHistory.create({
      accountId: account.id,
      accountEmail: account.email,
      accountDisplayName: account.displayName,
      commandType: 'cloud-shell',
      command: command,
      executedBy: 'public-api',
      executedFrom: clientIp,
      status: 'running',
      isAsync: async,
      requestHeaders: {
        'user-agent': req.headers['user-agent'],
        'origin': req.headers['origin'],
        'referer': req.headers['referer']
      },
      metadata: {
        originalAccountId: accountId  // 保存原始输入
      }
    });

    // 记录账号使用
    await account.update({ lastUsed: new Date() });

    const startTime = Date.now();

    // 使用实际的账户ID，而不是用户输入的accountId
    // 公共API默认启用授权同步，确保命令执行前账户已授权
    const result = await gcloudExecutor.executeCloudShellCommand(
      'public-api',
      account.id,  // 使用数据库中的实际ID
      command,
      {
        async,
        syncAuth: true  // 启用授权同步，确保Cloud Shell有正确的授权
      }
    );

    const executionTime = Date.now() - startTime;

    // 更新执行历史记录
    if (async) {
      // 异步执行：只更新executionId，状态保持为running
      await history.update({
        executionId: result.executionId,
        status: 'running',
        executionTime: executionTime
      });
    } else {
      // 同步执行：更新完整的结果
      await history.update({
        executionId: result.executionId,
        status: result.error ? 'failed' : 'completed',
        output: result.output,
        error: result.error,
        completedAt: new Date(),
        executionTime: executionTime
      });

      // 检查输出中是否包含结算账户错误
      const fullOutput = (result.output || '') + (result.error || '');

      if (fullOutput.includes('[ERROR] 未找到可用的结算账户') ||
          fullOutput.includes('未找到可用的结算账户，请确保已设置有效的结算账户') ||
          (fullOutput.includes('billing account') && fullOutput.includes('not found')) ||
          fullOutput.includes('No billing account found')) {

        logger.warn(`Detected billing account error for ${account.email} in cloud-shell execution, disabling monitoring`);

        // 自动禁用该账号的监听
        try {
          await account.update({
            needMonitor: false,
            lastMonitorTime: new Date()
          });

          logger.info(`Successfully disabled monitoring for ${account.email} due to billing account error`);

          // 记录到监控日志
          const { GCloudMonitorLog } = require('../models');
          await GCloudMonitorLog.create({
            accountId: account.id,
            accountEmail: account.email,
            monitorStatus: 'disabled',
            message: 'Monitoring disabled due to billing account error (detected in public API)',
            metadata: {
              reason: 'billing_error',
              errorMessage: '[ERROR] 未找到可用的结算账户，请确保已设置有效的结算账户',
              disabledAt: new Date(),
              executionId: result.executionId
            }
          });
        } catch (updateError) {
          logger.error(`Failed to disable monitoring for ${account.email}:`, updateError);
        }
      }
    }

    res.json(result);
  } catch (error) {
    logger.error('Error executing Cloud Shell command:', error);

    // 更新执行历史记录为失败状态
    if (history) {
      await history.update({
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// 获取执行状态（无需认证）
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

// 获取最近的执行历史（无需认证）
router.get('/executions', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const executions = await CommandExecution.findAll({
      include: [{
        model: GCloudAccount,
        as: 'account',
        attributes: ['email', 'displayName']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await CommandExecution.count();

    res.json({ executions, total });
  } catch (error) {
    logger.error('Error fetching executions:', error);
    res.status(500).json({ error: 'Failed to fetch executions' });
  }
});

// 取消执行（无需认证）
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

// 获取执行流输出（无需认证）
router.get('/executions/:id/stream', async (req, res) => {
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

// 执行纯Shell命令（无需认证，不依赖gcloud账号）
router.post('/shell', async (req, res) => {
  let history = null;
  try {
    const { command, async = false, timeout = 30000 } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // 创建执行历史记录（Shell命令不需要账号）
    history = await ExecutionHistory.create({
      accountId: null,
      accountEmail: null,
      accountDisplayName: null,
      commandType: 'shell',
      command: command,
      executedBy: 'shell-api',
      executedFrom: clientIp,
      status: 'running',
      isAsync: async,
      requestHeaders: {
        'user-agent': req.headers['user-agent'],
        'origin': req.headers['origin'],
        'referer': req.headers['referer']
      }
    });

    // 直接执行shell命令，不依赖gcloud账号
    const { spawn } = require('child_process');
    const { v4: uuidv4 } = require('uuid');

    const executionId = uuidv4();
    const startTime = Date.now();

    if (async) {
      // 异步执行
      const execution = await CommandExecution.create({
        id: executionId,
        executedBy: 'shell-api',
        accountId: null, // shell命令不需要账号
        command: command,
        status: 'running',
        output: '',
        error: '',
        startedAt: new Date()
      });

      // 在后台执行
      setTimeout(() => {
        const child = spawn('bash', ['-c', command], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: timeout
        });

        let output = '';
        let error = '';

        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        child.stderr.on('data', (data) => {
          error += data.toString();
        });

        child.on('close', async (code) => {
          const endTime = Date.now();
          await execution.update({
            status: code === 0 ? 'completed' : 'failed',
            output: output,
            error: error,
            completedAt: new Date(),
            executionTime: endTime - startTime
          });

          // 更新执行历史记录
          await history.update({
            executionId: executionId,
            status: code === 0 ? 'completed' : 'failed',
            output: output,
            error: error,
            completedAt: new Date(),
            executionTime: endTime - startTime
          });
        });

        child.on('error', async (err) => {
          const endTime = Date.now();
          await execution.update({
            status: 'failed',
            error: err.message,
            completedAt: new Date(),
            executionTime: endTime - startTime
          });

          // 更新执行历史记录
          await history.update({
            executionId: executionId,
            status: 'failed',
            error: err.message,
            completedAt: new Date(),
            executionTime: endTime - startTime
          });
        });
      }, 100);

      res.json({
        executionId: executionId,
        message: 'Shell command started',
        status: 'running'
      });

    } else {
      // 同步执行
      const child = spawn('bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', async (code) => {
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // 记录到数据库
        await CommandExecution.create({
          id: executionId,
          executedBy: 'shell-api',
          accountId: null,
          command: command,
          status: code === 0 ? 'completed' : 'failed',
          output: output,
          error: error,
          startedAt: new Date(startTime),
          completedAt: new Date(endTime),
          executionTime: executionTime
        });

        // 更新执行历史记录
        await history.update({
          executionId: executionId,
          status: code === 0 ? 'completed' : 'failed',
          output: output,
          error: error,
          completedAt: new Date(),
          executionTime: executionTime
        });

        res.json({
          executionId: executionId,
          status: code === 0 ? 'completed' : 'failed',
          output: output,
          error: error,
          executionTime: executionTime
        });
      });

      child.on('error', async (err) => {
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        await CommandExecution.create({
          id: executionId,
          executedBy: 'shell-api',
          accountId: null,
          command: command,
          status: 'failed',
          error: err.message,
          startedAt: new Date(startTime),
          completedAt: new Date(endTime),
          executionTime: executionTime
        });

        // 更新执行历史记录
        await history.update({
          executionId: executionId,
          status: 'failed',
          error: err.message,
          completedAt: new Date(),
          executionTime: executionTime
        });

        res.status(500).json({
          executionId: executionId,
          status: 'failed',
          error: err.message,
          executionTime: executionTime
        });
      });
    }

  } catch (error) {
    logger.error('Error executing shell command:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;