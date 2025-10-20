const oneApiService = require('./oneApiService');
const gcloudMonitorService = require('./gcloudMonitorService');
const logger = require('../src/utils/logger');

class GlobalChannelMonitorService {
  constructor() {
    this.isRunning = false;
    this.minInterval = 30 * 1000; // 最小间隔30秒
    this.maxInterval = 5 * 60 * 1000; // 最大间隔5分钟
    this.targetTestInterval = 60 * 1000; // 目标：每个渠道测试间隔1分钟
    this.lastCycleChannelCount = 0; // 上次循环测试的渠道数量
    this.timer = null;
    this.testingChannels = new Set(); // 正在测试的渠道
  }

  /**
   * 启动全局渠道监控
   */
  async start() {
    if (this.isRunning) {
      logger.info('Global channel monitor service is already running');
      return;
    }

    logger.info('🌍 Global channel monitor service starting...');
    this.isRunning = true;

    // 开始监控循环（不等待，让它异步运行）
    this.runMonitorLoop().catch(error => {
      logger.error('🌍 Global channel monitor service crashed:', error);
      this.isRunning = false;
    });

    logger.info('🌍 Global channel monitor service started (30s interval between cycles)');
  }

  /**
   * 监控循环
   */
  async runMonitorLoop() {
    while (this.isRunning) {
      try {
        logger.info('Starting global channel monitoring cycle');
        const startTime = Date.now();

        // 执行监控并记录测试的渠道数量
        const testedCount = await this.monitor();

        const cycleTime = Date.now() - startTime;

        // 计算动态间隔
        const dynamicInterval = this.calculateDynamicInterval(testedCount);

        logger.info(`Global channel monitoring cycle completed. Tested ${testedCount} channels in ${(cycleTime/1000).toFixed(1)}s`);
      } catch (err) {
        logger.error('🌍 Global channel monitor cycle error:', err);
        logger.error('🌍 Error stack:', err.stack);
      }

      // 使用固定1分钟间隔等待下一轮
      if (this.isRunning) {
        const waitInterval = 60 * 1000; // 固定等待1分钟
        logger.info(`Next cycle in 60s`);
        await new Promise(resolve => {
          this.timer = setTimeout(resolve, waitInterval);
        });
      }
    }
  }

  /**
   * 计算动态间隔时间
   * 目标：确保每个渠道的测试间隔约为1分钟
   */
  calculateDynamicInterval(channelCount) {
    if (channelCount === 0) {
      return this.minInterval; // 没有渠道时使用最小间隔
    }

    // 计算理想间隔：如果有N个渠道，间隔应该是 60秒 - N秒（测试时间）
    // 但不能小于最小间隔，也不能大于最大间隔
    const idealInterval = Math.max(
      this.targetTestInterval - (channelCount * 1000), // 假设每个渠道测试约1秒
      this.minInterval
    );

    const finalInterval = Math.min(idealInterval, this.maxInterval);

    logger.debug(`Dynamic interval calculation: ${channelCount} channels -> ${(finalInterval/1000).toFixed(0)}s wait`);

    return finalInterval;
  }

  /**
   * 停止监控
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping global channel monitor service');
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.testingChannels.clear();
  }

  /**
   * 主监控循环
   */
  async monitor() {
    if (!this.isRunning) {
      return 0;
    }

    let testedCount = 0;

    try {
      // 获取所有渠道（使用新的getAllChannels方法）
      const allChannelsResult = await oneApiService.getAllChannels();

      if (!allChannelsResult.success || !allChannelsResult.data?.items) {
        logger.error('Failed to get all channels for global monitoring');
        return 0;
      }

      const allChannels = allChannelsResult.data.items;

      // 获取正在监听的账号邮箱列表
      const monitoredEmails = await this.getMonitoredAccountEmails();
      logger.debug(`🌍 Monitored emails (${monitoredEmails.length}): ${monitoredEmails.join(', ')}`);
      if (allChannels.length > 0) {
        logger.debug(`🌍 Sample channel names: ${allChannels.slice(0, 5).map(ch => `${ch.id}(${ch.name})`).join(', ')}`);
      }

      // 过滤出不在监听范围内的渠道
      const nonMonitoredChannels = allChannels.filter(channel => {
        if (!channel.name) {
          logger.debug(`Skipping channel ${channel.id} - no name`);
          return false;
        }

        // 跳过名称包含 suspend 的渠道（已经测试失败的）
        if (channel.name.includes('suspend')) {
          logger.debug(`📌 Skipping suspended channel ${channel.id} (${channel.name})`);
          return false;
        }

        // 包括启用(status=1)和禁用(status=2)的渠道，因为禁用的可能已经恢复
        // 只排除其他状态的渠道
        if (channel.status !== 1 && channel.status !== 2) {
          logger.debug(`🚫 Skipping channel ${channel.id} (${channel.name}) with unknown status: ${channel.status}`);
          return false;
        }

        // 精确匹配监听邮箱的过滤逻辑
        const isMonitored = monitoredEmails.some(monitoredEmail => {
          // 渠道名称格式：email-timestamp，需要提取邮箱部分
          const channelName = channel.name;

          // 检查渠道名称是否以监听的邮箱开头（后面可能跟着时间戳）
          if (channelName.startsWith(monitoredEmail)) {
            // 确保后面跟的是时间戳分隔符（-）或者就是完整邮箱
            const afterEmail = channelName.substring(monitoredEmail.length);
            if (afterEmail === '' || afterEmail.startsWith('-')) {
              logger.debug(`📋 Channel ${channel.id} (${channel.name}) matches monitored email: ${monitoredEmail}`);
              return true;
            }
          }

          return false;
        });

        if (!isMonitored) {
          logger.debug(`✅ Channel ${channel.id} (${channel.name}) is not monitored - will test`);
        }

        return !isMonitored;
      });

      // 统计各种状态的渠道
      const statusStats = {
        total: allChannels.length,
        monitored: allChannels.length - nonMonitoredChannels.length,
        suspended: 0,
        disabled: 0,
        nonMonitored: nonMonitoredChannels.length
      };

      allChannels.forEach(channel => {
        if (channel.name && channel.name.includes('suspend')) statusStats.suspended++;
        if (channel.status === 2) statusStats.disabled++;
      });

      logger.info(`Channel statistics: ${statusStats.total} total, ${statusStats.monitored} monitored, ${statusStats.suspended} suspended, ${statusStats.disabled} disabled, ${statusStats.nonMonitored} available for global testing`);

      if (statusStats.nonMonitored > 0) {
        logger.debug(`Sample non-monitored channels: ${nonMonitoredChannels.slice(0, 3).map(ch => `${ch.id}(${ch.name})`).join(', ')}`);
      }

      // 过滤掉正在测试中的渠道
      const availableChannels = nonMonitoredChannels.filter(channel =>
        !this.testingChannels.has(channel.id)
      );

      if (availableChannels.length === 0) {
        logger.info(`No channels available for testing. Non-monitored: ${nonMonitoredChannels.length}, Testing in progress: ${this.testingChannels.size}`);
        if (this.testingChannels.size > 0) {
          logger.debug(`Channels currently being tested: ${Array.from(this.testingChannels).join(', ')}`);
        }
        if (nonMonitoredChannels.length > 0 && this.testingChannels.size === 0) {
          logger.warn('Strange: have non-monitored channels but none available for testing after filtering');
        }
        return 0;
      }

      logger.info(`${availableChannels.length} channels ready for testing (${nonMonitoredChannels.length - availableChannels.length} already testing)`);

      // 并发测试渠道（每批20个）
      testedCount = await this.testChannelsConcurrently(availableChannels);

      // 记录本次循环测试的渠道数量
      this.lastCycleChannelCount = testedCount;

    } catch (error) {
      logger.error('Error in global channel monitor:', error);
    }

    return testedCount;
  }

  /**
   * 获取正在监听的账号邮箱列表
   */
  async getMonitoredAccountEmails() {
    try {
      const GCloudAccount = require('../models/GCloudAccount');
      const accounts = await GCloudAccount.findAll({
        where: {
          needMonitor: true,
          isActive: true
        },
        attributes: ['email']
      });

      return accounts.map(a => a.email);
    } catch (error) {
      logger.error('Error getting monitored account emails:', error);
      return [];
    }
  }

  /**
   * 并发测试多个渠道（每批20个）
   */
  async testChannelsConcurrently(channels) {
    if (!channels || channels.length === 0) {
      return 0;
    }

    const BATCH_SIZE = 50;
    let totalTested = 0;

    logger.info(`Starting concurrent testing of ${channels.length} channels in batches of ${BATCH_SIZE}`);

    // 分批处理
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const batch = channels.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(channels.length / BATCH_SIZE);

      logger.info(`Processing batch ${batchNumber}/${totalBatches} with ${batch.length} channels`);

      // 标记这批渠道为正在测试
      batch.forEach(channel => {
        this.testingChannels.add(channel.id);
      });

      try {
        // 并发测试这一批渠道
        const testPromises = batch.map(channel => this.testSingleChannel(channel));
        const results = await Promise.all(testPromises);

        // 统计成功的测试
        const successCount = results.filter(result => result.success).length;
        totalTested += batch.length;

        logger.info(`Batch ${batchNumber}/${totalBatches} completed: ${successCount}/${batch.length} successful`);

        // 如果不是最后一批，稍微等待一下避免过于频繁的请求
        if (i + BATCH_SIZE < channels.length) {
          await this.sleep(1000); // 批次间等待1秒
        }

      } finally {
        // 清理这批渠道的测试状态
        batch.forEach(channel => {
          this.testingChannels.delete(channel.id);
        });
      }
    }

    logger.info(`Concurrent testing completed: ${totalTested} channels processed`);
    return totalTested;
  }

  /**
   * 测试单个渠道
   */
  async testSingleChannel(channel) {
    const startTime = Date.now();

    try {
      logger.info(`🌍 Global testing channel ${channel.id} (${channel.name}) with gemini-2.5-pro`);

      const axios = require('axios');

      // 先获取渠道详情
      const channelDetail = await oneApiService.getChannelDetail(channel.id);
      if (!channelDetail.success || !channelDetail.data) {
        logger.error(`Failed to get channel ${channel.id} detail`);
        return { success: false, channelId: channel.id, reason: 'get_detail_failed', duration: Date.now() - startTime };
      }

      const channelData = channelDetail.data;

      // 准备更新数据，启用 auto_ban
      const updateData = {
        id: channelData.id,
        type: channelData.type,
        name: channelData.name,
        key: channelData.key,
        models: channelData.models,
        auto_ban: 1, // 启用自动禁用
        status: channelData.status, // 保持原状态不变
        failure_timeout_ban_limit: channelData.failure_timeout_ban_limit || 13000,
        priority: channelData.priority || 0,
        other: channelData.other || '',
        test_model: channelData.test_model || ''
      };

      // 启用 auto_ban
      const updateResponse = await axios.put(
        `${oneApiService.baseUrl}/api/channel/`,
        updateData,
        {
          headers: oneApiService.getHeaders(),
          timeout: 10000
        }
      );

      if (!updateResponse.data.success) {
        logger.error(`Failed to enable auto_ban for channel ${channel.id}: ${updateResponse.data.message}`);
        return { success: false, channelId: channel.id, reason: 'auto_ban_failed', duration: Date.now() - startTime };
      }

      // 使用 gemini-2.5-pro 模型测试（不重试）
      const testResult = await oneApiService.testChannel(channel.id, 'gemini-2.5-pro', {
        maxRetries: 1,
        retryDelay: 5000,
        skipRetry: true
      });

      if (testResult.success) {
        logger.info(`✅ Channel ${channel.id} test successful, enabling with priority 1`);

        // 测试成功，启用渠道并设置优先级为1
        updateData.status = 1; // 启用渠道
        updateData.priority = 1; // 设置优先级为1

        try {
          const enableResponse = await axios.put(
            `${oneApiService.baseUrl}/api/channel/`,
            updateData,
            {
              headers: oneApiService.getHeaders(),
              timeout: 10000
            }
          );

          if (enableResponse.data.success) {
            logger.info(`✅ Successfully enabled channel ${channel.id} with auto_ban and priority 1`);
          } else {
            logger.error(`Failed to enable channel ${channel.id}: ${enableResponse.data.message}`);
          }
        } catch (enableError) {
          logger.error(`Error enabling channel ${channel.id}:`, enableError.message);
        }

        return { success: true, channelId: channel.id, reason: 'test_passed', duration: Date.now() - startTime };
      } else {
        // 测试失败，处理失败情况
        return await this.handleChannelTestFailure(channel, channelData, updateData, testResult, startTime);
      }
    } catch (error) {
      logger.error(`Error testing channel ${channel.id}:`, error.message);
      return { success: false, channelId: channel.id, reason: 'exception', error: error.message, duration: Date.now() - startTime };
    }
  }

  /**
   * 处理渠道测试失败的情况
   */
  async handleChannelTestFailure(channel, channelData, updateData, testResult, startTime) {
    const axios = require('axios');

    try {
      logger.info(`Channel ${channel.id} test failed: ${testResult.message}`);

      // 检查是否需要添加 suspend（特定错误类型）
      const quotaExceeded = testResult.message && testResult.message.includes('You exceeded your current quota');
      const quotaMetric = testResult.message && testResult.message.includes('Quota exceeded for quota metric');
      const billingDetails = testResult.message && testResult.message.includes('check your plan and billing details');
      const quotaAndBilling = testResult.message && testResult.message.includes('You exceeded your current quota, please check your plan and billing details');
      const generateContent = testResult.message && testResult.message.includes('generate_content_free_tier_requests');
      const generativeLanguage = testResult.message && testResult.message.includes('generativelanguage.googleapis.com/generate_content_free_tier_requests');
      const generateRequests = testResult.message && testResult.message.includes('generate_requests_per_model');
      const generativeLanguageRequests = testResult.message && testResult.message.includes('generativelanguage.googleapis.com/generate_requests_per_model');
      const hasSuspended = testResult.message && testResult.message.includes('has been suspended');
      const consumerSuspended = testResult.message && testResult.message.includes('Consumer') && testResult.message.includes('has been suspended');

      logger.info(`🌍 Channel ${channel.id} suspend check: quotaExceeded=${quotaExceeded}, quotaMetric=${quotaMetric}, billingDetails=${billingDetails}, quotaAndBilling=${quotaAndBilling}, generateContent=${generateContent}, generativeLanguage=${generativeLanguage}, generateRequests=${generateRequests}, generativeLanguageRequests=${generativeLanguageRequests}, hasSuspended=${hasSuspended}, consumerSuspended=${consumerSuspended}`);

      const shouldSuspend = testResult.message && (
        testResult.message.includes('setup request header failed') ||
        testResult.message.includes('failed to exchange JWT for access token') ||
        testResult.message.includes('account not found') ||
        testResult.message.includes('Invalid grant') ||
        hasSuspended ||
        consumerSuspended ||
        quotaMetric ||
        quotaExceeded ||
        billingDetails ||
        quotaAndBilling ||
        generateContent ||
        generativeLanguage ||
        generateRequests ||
        generativeLanguageRequests
      );

      logger.debug(`Channel ${channel.id} shouldSuspend=${shouldSuspend}, channelData.name="${channelData.name}", includes suspend=${channelData.name.includes('suspend')}`);

      if (shouldSuspend && !channelData.name.includes('suspend')) {
        logger.info(`🔴 Global monitoring: Channel ${channel.id} has quota/auth error, adding suspend to name`);

        // 更新渠道名称，添加 suspend
        updateData.name = `${channelData.name}-suspend`;
        updateData.auto_ban = 1; // 确保自动禁用是开启的
        updateData.status = 2; // 立即禁用渠道，因为quota错误是永久性问题

        logger.info(`Channel ${channel.id} will be disabled immediately due to quota/auth error`);

        const suspendResponse = await axios.put(
          `${oneApiService.baseUrl}/api/channel/`,
          updateData,
          {
            headers: oneApiService.getHeaders(),
            timeout: 10000
          }
        );

        if (suspendResponse.data.success) {
          logger.info(`✅ Channel ${channel.id} suspended and disabled: ${updateData.name}, status=${updateData.status}`);
          return { success: false, channelId: channel.id, reason: 'suspended', duration: Date.now() - startTime };
        } else {
          logger.error(`Failed to add suspend to channel ${channel.id} name: ${suspendResponse.data.message}`);
        }
      } else {
        // 其他类型的失败，直接禁用渠道
        logger.info(`Channel ${channel.id} general test failure, disabling channel`);
        updateData.status = 2; // 禁用渠道

        const disableResponse = await axios.put(
          `${oneApiService.baseUrl}/api/channel/`,
          updateData,
          {
            headers: oneApiService.getHeaders(),
            timeout: 10000
          }
        );

        if (disableResponse.data.success) {
          logger.info(`✅ Successfully disabled channel ${channel.id}`);
          return { success: false, channelId: channel.id, reason: 'disabled', duration: Date.now() - startTime };
        } else {
          logger.error(`Failed to disable channel ${channel.id}: ${disableResponse.data.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error handling channel ${channel.id} test failure:`, error.message);
    }

    return { success: false, channelId: channel.id, reason: 'handle_failure_error', duration: Date.now() - startTime };
  }

  /**
   * 延迟函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.interval,
      intervalSeconds: this.interval / 1000,
      testingChannels: this.testingChannels.size
    };
  }
}

// 导出单例
module.exports = new GlobalChannelMonitorService();