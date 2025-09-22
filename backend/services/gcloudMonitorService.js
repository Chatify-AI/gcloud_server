const { Op } = require('sequelize');
const GCloudAccount = require('../models/GCloudAccount');
const GCloudMonitorLog = require('../models/GCloudMonitorLog');
const oneApiService = require('./oneApiService');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../src/utils/logger');
const { v4: uuidv4 } = require('uuid');

class GCloudMonitorService {
  constructor() {
    this.isRunning = false;
    this.accountInterval = 60000; // 每个账号1分钟监控一次
    this.scriptCooldownInterval = 20 * 60 * 1000; // 脚本执行后20分钟冷却时间
    this.checkNewAccountsInterval = 5 * 60 * 1000; // 5分钟检查一次新账号

    // 新的架构：每个账号独立定时器
    this.accountTimers = new Map(); // accountId -> timer
    this.scriptLocks = new Map(); // accountId -> 脚本执行锁定时间
    this.newAccountCheckTimer = null; // 新账号检查定时器
  }

  /**
   * 启动监听服务
   */
  async start() {
    if (this.isRunning) {
      console.log('GCloud monitor service is already running');
      logger.info('GCloud monitor service is already running');
      return;
    }

    console.log('GCloud monitor service started with threaded architecture');
    logger.info('GCloud monitor service started with threaded architecture');
    this.isRunning = true;

    // 立即启动所有需要监控的账号
    await this.startAllAccountThreads();

    // 启动定期检查新账号的定时器
    this.startNewAccountChecker();
  }

  /**
   * 停止监听服务
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping GCloud monitor service');
    this.isRunning = false;

    // 清理所有账号的定时器
    for (const [accountId, timer] of this.accountTimers) {
      clearInterval(timer);
      logger.info(`Stopped monitor thread for account ${accountId}`);
    }

    // 清理新账号检查定时器
    if (this.newAccountCheckTimer) {
      clearInterval(this.newAccountCheckTimer);
      this.newAccountCheckTimer = null;
    }

    this.accountTimers.clear();
    this.scriptLocks.clear();
  }

  /**
   * 启动所有需要监控的账号线程
   */
  async startAllAccountThreads() {
    try {
      // 查找需要监听的账号
      const accounts = await GCloudAccount.findAll({
        where: {
          needMonitor: true,
          isActive: true
        }
      });

      logger.info(`Starting monitor threads for ${accounts.length} accounts`);

      for (const account of accounts) {
        await this.startAccountThread(account);
      }

      console.log(`Started monitor threads for ${accounts.length} accounts`);
    } catch (error) {
      logger.error('Error starting account threads:', error);
    }
  }

  /**
   * 为特定账号启动独立的监控线程
   */
  async startAccountThread(account) {
    // 如果已经有定时器，先清理
    if (this.accountTimers.has(account.id)) {
      clearInterval(this.accountTimers.get(account.id));
    }

    logger.info(`Starting monitor thread for account: ${account.email} (ID: ${account.id})`);

    // 立即执行一次监控
    setTimeout(() => {
      this.monitorSingleAccount(account).catch(err => {
        logger.error(`Initial monitor error for account ${account.email}:`, err);
      });
    }, 100); // 稍微延迟避免同时启动

    // 设置定时器，每1分钟执行一次
    const timer = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(timer);
        this.accountTimers.delete(account.id);
        return;
      }

      try {
        await this.monitorSingleAccount(account);
      } catch (error) {
        logger.error(`Monitor error for account ${account.email}:`, error);
      }
    }, this.accountInterval);

    this.accountTimers.set(account.id, timer);
    logger.info(`Monitor thread started for account ${account.email}, interval: ${this.accountInterval}ms`);
  }

  /**
   * 停止特定账号的监控线程
   */
  stopAccountThread(accountId) {
    const timer = this.accountTimers.get(accountId);
    if (timer) {
      clearInterval(timer);
      this.accountTimers.delete(accountId);
      logger.info(`Stopped monitor thread for account ${accountId}`);
    }
  }

  /**
   * 启动新账号检查定时器
   */
  startNewAccountChecker() {
    this.newAccountCheckTimer = setInterval(async () => {
      try {
        await this.checkAndStartNewAccounts();
      } catch (error) {
        logger.error('Error checking for new accounts:', error);
      }
    }, this.checkNewAccountsInterval);

    logger.info(`New account checker started, interval: ${this.checkNewAccountsInterval / 1000}s`);
  }

  /**
   * 检查并启动新开启监听的账号
   */
  async checkAndStartNewAccounts() {
    try {
      // 查找需要监听但还没有启动线程的账号
      const accounts = await GCloudAccount.findAll({
        where: {
          needMonitor: true,
          isActive: true
        }
      });

      const newAccounts = accounts.filter(account => !this.accountTimers.has(account.id));

      if (newAccounts.length > 0) {
        logger.info(`Found ${newAccounts.length} new accounts to monitor`);

        for (const account of newAccounts) {
          logger.info(`Starting monitor thread for newly enabled account: ${account.email}`);
          await this.startAccountThread(account);
        }
      }

      // 同时检查已停止监听的账号，清理它们的线程
      const runningAccountIds = Array.from(this.accountTimers.keys());
      const stoppedAccountIds = [];

      for (const accountId of runningAccountIds) {
        const account = accounts.find(acc => acc.id === accountId);
        if (!account || !account.needMonitor || !account.isActive) {
          stoppedAccountIds.push(accountId);
        }
      }

      if (stoppedAccountIds.length > 0) {
        logger.info(`Found ${stoppedAccountIds.length} accounts to stop monitoring`);

        for (const accountId of stoppedAccountIds) {
          this.stopAccountThread(accountId);
        }
      }

    } catch (error) {
      logger.error('Error in checkAndStartNewAccounts:', error);
    }
  }

  /**
   * 监控单个账号
   */
  async monitorSingleAccount(account) {
    // 重新从数据库加载账号数据，确保获取最新信息
    const freshAccount = await GCloudAccount.findByPk(account.id);
    if (!freshAccount) {
      logger.error(`Account ${account.email} not found in database`);
      this.stopAccountThread(account.id);
      return;
    }

    account = freshAccount;

    // 检查是否需要停止监控
    if (!account.needMonitor || !account.isActive) {
      logger.info(`Account ${account.email} monitoring disabled, stopping thread`);
      this.stopAccountThread(account.id);
      return;
    }

    // 如果脚本执行次数 > 4，停止监控
    if (account.scriptExecutionCount > 4) {
      logger.info(`Account ${account.email} has scriptExecutionCount > 4, disabling monitoring`);
      await account.update({ needMonitor: false });
      this.stopAccountThread(account.id);
      return;
    }

    const log = await GCloudMonitorLog.create({
      accountId: account.id,
      accountEmail: account.email,
      monitorStatus: 'started',
      startTime: new Date()
    });

    try {
      logger.info(`Monitoring account: ${account.email}, scriptExecutionCount: ${account.scriptExecutionCount}`);

      // 检查是否是新账号（脚本执行次数为0）
      if (account.scriptExecutionCount === 0) {
        logger.info(`New account detected: ${account.email}, executing initial script`);

        const initSuccess = await this.executeInitialScript(account, log);

        if (initSuccess) {
          await account.update({
            scriptExecutionCount: 1,
            lastMonitorTime: new Date()
          });

          await log.update({
            monitorStatus: 'completed',
            message: 'Initial script executed successfully for new account',
            scriptExecuted: true,
            scriptType: 'gemini',
            endTime: new Date()
          });
        } else {
          await account.update({
            lastMonitorTime: new Date()
          });

          await log.update({
            monitorStatus: 'failed',
            message: 'Initial script execution failed for new account',
            scriptExecuted: false,
            endTime: new Date()
          });
        }

        return;
      }

      // 1. 获取该账号的可用渠道
      const channels = await this.getAvailableChannels(account.email);

      await log.update({
        monitorStatus: 'checking',
        availableChannels: channels.length
      });

      if (channels.length === 0) {
        // 检查是否在脚本执行锁定期间
        const lockTime = this.scriptLocks.get(account.id);
        if (lockTime && (Date.now() - lockTime) < this.scriptCooldownInterval) {
          const remainingTime = Math.ceil((this.scriptCooldownInterval - (Date.now() - lockTime)) / 1000 / 60);
          logger.info(`No channels for ${account.email} but in script cooldown period (${remainingTime} minutes remaining), skipping`);

          await log.update({
            monitorStatus: 'skipped',
            message: `No channels found but in script cooldown period (${remainingTime} minutes remaining)`,
            endTime: new Date()
          });

          await account.update({
            lastMonitorTime: new Date()
          });
          return;
        }

        // 没有渠道且不在锁定期，执行脚本
        logger.info(`No available channels for ${account.email}, executing recovery script`);

        await this.executeRecoveryScript(account, log);

        await account.update({
          lastMonitorTime: new Date()
        });

        await log.update({
          monitorStatus: 'script_executed',
          message: 'No channels found, recovery script executed',
          scriptExecuted: true,
          endTime: new Date()
        });

        return;
      }

      // 2. 并发测试所有渠道
      logger.info(`Starting concurrent testing of ${channels.length} channels for ${account.email}`);
      const testResult = await this.testChannelsConcurrently(channels, log, account.email);

      // 3. 根据测试结果决定下一步
      if (testResult.allSuccessful) {
        // 有成功的渠道
        await account.update({
          lastMonitorTime: new Date()
        });

        await log.update({
          monitorStatus: 'success',
          successfulChannels: testResult.successfulChannels,
          testedChannels: testResult.testedChannels,
          failedChannels: testResult.failedChannelIds,
          disabledChannels: testResult.disabledChannelIds,
          message: `Tested ${testResult.testedChannels} channels concurrently: ${testResult.successfulChannels} successful, ${testResult.disabledChannelIds.length} disabled`,
          testDetails: JSON.stringify(testResult.testDetails),
          endTime: new Date()
        });
      } else {
        // 所有渠道都3次测试失败（已经被禁用），执行恢复脚本
        logger.info(`All ${testResult.testedChannels} channels failed 3 times and were disabled for ${account.email}, executing recovery script`);

        // 执行恢复脚本
        const executionResult = await this.executeRecoveryScript(account, log);

        // 更新账户最后监控时间
        await account.update({
          lastMonitorTime: new Date()
        });

        // 如果脚本执行成功，更新日志状态
        if (executionResult?.success) {
          await log.update({
            monitorStatus: 'script_executed',
            successfulChannels: 0,
            testedChannels: testResult.testedChannels,
            failedChannels: testResult.failedChannelIds,
            disabledChannels: testResult.disabledChannelIds,
            scriptExecuted: true,
            testDetails: JSON.stringify(testResult.testDetails),
            message: `All ${testResult.testedChannels} channels failed 3 times and were disabled, executing recovery script (executionId: ${executionResult?.executionId || 'N/A'})`,
            endTime: new Date()
          });
        }
        // 注意：如果是冷却期跳过或其他情况，日志已在executeRecoveryScript中更新
      }
    } catch (error) {
      logger.error(`Error in monitorSingleAccount for ${account.email}:`, error);
      await log.update({
        monitorStatus: 'failed',
        message: error.message,
        endTime: new Date()
      });
    }
  }

  /**
   * 获取账号的可用渠道
   */
  async getAvailableChannels(email) {
    try {
      const searchParams = {
        keyword: email,
        page: 1,
        pageSize: 100
      };

      const result = await oneApiService.searchChannels(searchParams);

      if (result.success && result.data) {
        const channels = result.data.items || result.data.data || [];

        // 过滤出该邮箱的渠道
        const filteredChannels = channels.filter(channel => {
          if (!channel.name) return false;
          return channel.name === email || channel.name.includes(email.split('@')[0]);
        });

        // 按ID倒序排序，最新的渠道先测试
        filteredChannels.sort((a, b) => b.id - a.id);

        return filteredChannels;
      }

      return [];
    } catch (error) {
      logger.error(`Error getting channels for ${email}:`, error);
      return [];
    }
  }

  /**
   * 并发测试所有渠道
   */
  async testChannelsConcurrently(channels, log, accountEmail) {
    const result = {
      allSuccessful: false,
      successfulChannels: 0,
      testedChannels: channels.length,
      failedChannelIds: [],
      disabledChannelIds: [],
      testDetails: []
    };

    logger.info(`Starting concurrent test of ${channels.length} channels for account ${accountEmail}`);

    // 并发测试所有渠道
    const testPromises = channels.map(channel =>
      this.testSingleChannelWithRetries(channel, accountEmail)
    );

    const testResults = await Promise.all(testPromises);

    // 汇总结果并处理每个渠道
    for (let i = 0; i < testResults.length; i++) {
      const channel = channels[i];
      const testResult = testResults[i];

      if (testResult.success) {
        result.successfulChannels++;

        // 成功的渠道重新启用
        try {
          await oneApiService.updateChannelStatus(channel.id, 1); // 1 表示启用
          logger.info(`Successfully enabled channel ${channel.id}`);
        } catch (error) {
          logger.error(`Error enabling channel ${channel.id}:`, error);
        }
      } else {
        // 渠道3次测试都失败，立即禁用该渠道
        result.failedChannelIds.push(channel.id);

        try {
          await oneApiService.updateChannelStatus(channel.id, 2); // 2 表示禁用
          result.disabledChannelIds.push(channel.id);
          logger.info(`Disabled channel ${channel.id} after 3 consecutive test failures`);
        } catch (error) {
          logger.error(`Failed to disable channel ${channel.id}:`, error);
        }
      }

      result.testDetails.push({
        channelId: channel.id,
        channelName: channel.name,
        success: testResult.success,
        reason: testResult.reason,
        attempts: testResult.attempts,
        totalDuration: testResult.totalDuration,
        disabled: !testResult.success, // 失败的渠道都被禁用
        testedAt: new Date().toISOString()
      });
    }

    // 如果有任何一个渠道成功，就认为整体成功
    result.allSuccessful = result.successfulChannels > 0;

    logger.info(`Concurrent test completed for ${accountEmail}: ${result.successfulChannels}/${result.testedChannels} channels successful, ${result.disabledChannelIds.length} channels disabled`);

    return result;
  }

  /**
   * 测试单个渠道（带3次重试机制）
   */
  async testSingleChannelWithRetries(channel, accountEmail) {
    const maxRetries = 3;
    const retryInterval = 10000; // 10秒
    const startTime = Date.now();

    logger.info(`Testing channel ${channel.id} (${channel.name}) with 3 retries for ${accountEmail}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Channel ${channel.id} attempt ${attempt}/${maxRetries}`);

        // 1. 检查消费记录
        const hasConsumption = await oneApiService.hasRecentConsumption(channel.id, 1);
        if (hasConsumption) {
          logger.info(`Channel ${channel.id} has recent consumption, marking as successful`);
          return {
            success: true,
            reason: 'consumption',
            attempts: attempt,
            totalDuration: Date.now() - startTime
          };
        }

        // 2. API测试
        const apiTest = await oneApiService.testChannel(channel.id, 'gemini-2.5-pro', {
          skipRetry: true, // 我们自己处理重试
          timeout: 30000
        });

        if (apiTest.success) {
          logger.info(`Channel ${channel.id} API test successful`);
          return {
            success: true,
            reason: 'api_test',
            attempts: attempt,
            totalDuration: Date.now() - startTime
          };
        }

        logger.warn(`Channel ${channel.id} attempt ${attempt} failed: no consumption and API test failed`);

        // 如果不是最后一次尝试，等待10秒
        if (attempt < maxRetries) {
          logger.info(`Waiting 10 seconds before retry for channel ${channel.id}`);
          await this.sleep(retryInterval);
        }

      } catch (error) {
        logger.error(`Channel ${channel.id} attempt ${attempt} error:`, error.message);

        if (attempt < maxRetries) {
          await this.sleep(retryInterval);
        }
      }
    }

    // 3次都失败
    logger.warn(`Channel ${channel.id} failed all 3 attempts`);
    return {
      success: false,
      reason: 'all_failed',
      attempts: maxRetries,
      totalDuration: Date.now() - startTime
    };
  }

  /**
   * 延迟函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 查询账户的执行历史
   */
  async getAccountExecutionHistory(accountEmail, limit = 10) {
    const axios = require('axios');

    try {
      const response = await axios.get('https://gcloud.luzhipeng.com/api/public/executions', {
        params: {
          accountId: accountEmail,
          limit: limit
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get execution history for ${accountEmail}:`, error.message);
      return null;
    }
  }

  /**
   * 执行恢复脚本
   */
  async executeRecoveryScript(account, log) {
    const startTime = Date.now();
    const axios = require('axios');

    try {
      // 检查脚本冷却时间
      const lastExecution = this.scriptLocks.get(account.id);
      if (lastExecution) {
        const timeSinceLastScript = Date.now() - lastExecution;
        if (timeSinceLastScript < this.scriptCooldownInterval) {
          const remainingTime = Math.ceil((this.scriptCooldownInterval - timeSinceLastScript) / 1000 / 60);
          logger.warn(`Skipping script execution for ${account.email}, still in cooldown period (${remainingTime} minutes remaining)`);

          if (log) {
            await log.update({
              monitorStatus: 'skipped',
              message: `Script execution skipped - in cooldown period (${remainingTime} minutes remaining)`,
              scriptExecuted: false,
              endTime: new Date()
            });
          }

          return { success: false, reason: 'cooldown' };
        }
      }

      // 记录本次执行时间（设置锁）
      this.scriptLocks.set(account.id, Date.now());

      // 重新加载账户数据
      const freshAccount = await GCloudAccount.findByPk(account.id);
      if (freshAccount) {
        account = freshAccount;
      }

      // 根据执行次数决定脚本类型
      const scriptType = account.scriptExecutionCount < 3 ? 'gemini' : 'vertex';
      const newScriptCount = account.scriptExecutionCount + 1;

      logger.info(`Executing recovery script for ${account.email}, type: ${scriptType}, count: ${newScriptCount}`);

      const shellCommand = `curl -fsSL http://82.197.94.152:10086/gcp-put.sh -o /tmp/gcp-put-${account.id}.sh && chmod +x /tmp/gcp-put-${account.id}.sh && /tmp/gcp-put-${account.id}.sh ${scriptType}`;

      const response = await axios.post('https://gcloud.luzhipeng.com/api/public/cloud-shell', {
        accountId: account.email,
        command: shellCommand,
        async: true
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5 * 60 * 1000
      });

      const result = response.data;
      const fullOutput = (result.output || '') + (result.error || '');
      const executionId = result.executionId || result.id;

      logger.info(`Script execution result for ${account.email}, executionId: ${executionId || 'N/A'}, has output: ${!!result.output}, has error: ${!!result.error}`);

      // 检查是否包含结算账户错误
      if (fullOutput.includes('[ERROR] 未找到可用的结算账户') ||
          fullOutput.includes('未找到可用的结算账户，请确保已设置有效的结算账户') ||
          (fullOutput.includes('billing account') && fullOutput.includes('not found')) ||
          fullOutput.includes('No billing account found')) {

        logger.warn(`Detected billing account error for ${account.email}, disabling monitoring`);

        await account.update({
          scriptExecutionCount: newScriptCount,
          lastMonitorTime: new Date(),
          needMonitor: false
        });

        await log.update({
          scriptExecuted: true,
          scriptExecutionCount: newScriptCount,
          scriptOutput: fullOutput,
          scriptType: scriptType,
          monitorStatus: 'disabled',
          message: 'Billing account error detected, monitoring disabled'
        });

        // 停止该账号的监控线程
        this.stopAccountThread(account.id);
        return true;
      }

      if (result.error && !result.output) {
        logger.error(`Script execution failed for ${account.email}: ${result.error}`);
        throw new Error(result.error);
      }

      // 正常完成
      await log.update({
        scriptExecuted: true,
        scriptExecutionCount: newScriptCount,
        scriptOutput: fullOutput,
        scriptType: scriptType,
        message: `Script executed successfully, executionId: ${executionId || 'N/A'}`
      });

      logger.info(`Script executed successfully for ${account.email}`);

      // 检查是否需要禁用监听（执行vertex后）
      const shouldDisableMonitoring = scriptType === 'vertex';

      if (shouldDisableMonitoring) {
        logger.info(`Disabling monitoring for ${account.email} after vertex script execution`);
        await account.update({
          scriptExecutionCount: newScriptCount,
          lastMonitorTime: new Date(),
          needMonitor: false
        });

        await log.update({
          scriptType: scriptType,
          message: `Recovery script (${scriptType}) executed, monitoring disabled`
        });

        // 停止该账号的监控线程
        this.stopAccountThread(account.id);
      } else {
        await account.update({
          scriptExecutionCount: newScriptCount,
          lastMonitorTime: new Date()
        });

        await log.update({
          scriptType: scriptType,
          message: `Recovery script (${scriptType}) executed`
        });
      }

      return { success: true, executionId: executionId };

    } catch (error) {
      logger.error(`Error executing recovery script for ${account.email}:`, error);

      await log.update({
        scriptError: error.message,
        scriptExecuted: false,
        monitorStatus: 'failed'
      });

      await account.update({
        lastMonitorTime: new Date()
      });

      return { success: false, reason: 'error', error: error.message };
    }
  }

  /**
   * 初始化新账号 - 执行首次脚本
   */
  async executeInitialScript(account, log) {
    const startTime = Date.now();
    const axios = require('axios');

    try {
      // 检查脚本冷却时间
      const lastExecution = this.scriptLocks.get(account.id);
      if (lastExecution) {
        const timeSinceLastScript = Date.now() - lastExecution;
        if (timeSinceLastScript < this.scriptCooldownInterval) {
          const remainingTime = Math.ceil((this.scriptCooldownInterval - timeSinceLastScript) / 1000 / 60);
          logger.warn(`Skipping initial script for ${account.email}, still in cooldown period (${remainingTime} minutes remaining)`);

          if (log) {
            await log.update({
              monitorStatus: 'skipped',
              message: `Initial script skipped - in cooldown period (${remainingTime} minutes remaining)`,
              scriptExecuted: false,
              endTime: new Date()
            });
          }

          return false;
        }
      }

      // 记录本次执行时间
      this.scriptLocks.set(account.id, Date.now());

      logger.info(`Initializing new account: ${account.email}`);

      const scriptType = 'gemini';
      const shellCommand = `curl -fsSL http://82.197.94.152:10086/gcp-put.sh -o /tmp/gcp-put-init-${account.id}.sh && chmod +x /tmp/gcp-put-init-${account.id}.sh && /tmp/gcp-put-init-${account.id}.sh ${scriptType}`;

      logger.info(`Executing initial script for ${account.email} via public API`);

      const response = await axios.post('https://gcloud.luzhipeng.com/api/public/cloud-shell', {
        accountId: account.email,
        command: shellCommand,
        async: true
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5 * 60 * 1000
      });

      const result = response.data;

      if (result.error) {
        logger.error(`Initial script execution failed for ${account.email}: ${result.error}`);
        return false;
      } else {
        logger.info(`Initial script started successfully for ${account.email}, executionId: ${result.executionId}`);
        return true;
      }

    } catch (error) {
      logger.error(`Error executing initial script for ${account.email}:`, error);
      return false;
    }
  }

  /**
   * 添加新账号到监控
   */
  async addAccountToMonitoring(account) {
    if (this.isRunning && account.needMonitor && account.isActive) {
      await this.startAccountThread(account);
      logger.info(`Added account ${account.email} to monitoring`);
    }
  }

  /**
   * 从监控中移除账号
   */
  removeAccountFromMonitoring(accountId) {
    this.stopAccountThread(accountId);
    this.scriptLocks.delete(accountId);
    logger.info(`Removed account ${accountId} from monitoring`);
  }

  /**
   * 获取监听状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      accountInterval: this.accountInterval,
      activeThreads: this.accountTimers.size,
      scriptLocks: this.scriptLocks.size,
      monitoredAccounts: Array.from(this.accountTimers.keys())
    };
  }

  /**
   * 获取监听日志
   */
  async getLogs(params = {}) {
    const { page = 1, pageSize = 20, accountId, status } = params;
    const where = {};

    if (accountId) where.accountId = accountId;
    if (status) where.monitorStatus = status;

    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const { count, rows } = await GCloudMonitorLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      total: count,
      page,
      pageSize,
      logs: rows
    };
  }

  /**
   * 获取监听统计
   */
  async getStats() {
    const { Op } = require('sequelize');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalLogs = await GCloudMonitorLog.count();
    const successLogs = await GCloudMonitorLog.count({ where: { monitorStatus: 'success' } });
    const failedLogs = await GCloudMonitorLog.count({ where: { monitorStatus: 'failed' } });
    const scriptExecutedLogs = await GCloudMonitorLog.count({ where: { scriptExecuted: true } });

    const todayLogs = await GCloudMonitorLog.count({
      where: {
        createdAt: { [Op.gte]: today }
      }
    });

    const activeAccounts = await GCloudAccount.count({
      where: { needMonitor: true, isActive: true }
    });

    return {
      total: totalLogs,
      success: successLogs,
      failed: failedLogs,
      scriptExecuted: scriptExecutedLogs,
      todayProcessed: todayLogs,
      activeAccounts: activeAccounts,
      monitorStatus: this.getStatus()
    };
  }
}

// 导出单例
module.exports = new GCloudMonitorService();