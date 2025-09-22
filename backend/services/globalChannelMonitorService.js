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

    logger.info('Global channel monitor service started (30s interval between cycles)');
    this.isRunning = true;

    // 开始监控循环
    this.runMonitorLoop();
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
        logger.info(`Next cycle in ${(dynamicInterval/1000).toFixed(0)}s to maintain ~1min interval per channel`);
      } catch (err) {
        logger.error('Global channel monitor error:', err);
      }

      // 使用动态间隔等待下一轮
      if (this.isRunning) {
        const waitInterval = this.calculateDynamicInterval(this.lastCycleChannelCount);
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
      // 获取所有渠道
      const allChannelsResult = await oneApiService.getChannels({
        pageSize: 1000
      });

      if (!allChannelsResult.success || !allChannelsResult.data?.items) {
        logger.error('Failed to get channels for global monitoring');
        return 0;
      }

      const allChannels = allChannelsResult.data.items;

      // 获取正在监听的账号邮箱列表
      const monitoredEmails = await this.getMonitoredAccountEmails();

      // 过滤出不在监听范围内的渠道
      const nonMonitoredChannels = allChannels.filter(channel => {
        if (!channel.name) return false;

        // 跳过名称包含 suspend 的渠道（已经测试失败的）
        if (channel.name.includes('suspend')) {
          logger.debug(`📌 Skipping suspended channel ${channel.id} (${channel.name})`);
          return false;
        }

        // 检查渠道名称是否包含任何监听的邮箱
        const isMonitored = monitoredEmails.some(email => {
          const emailUsername = email.split('@')[0];
          return channel.name.includes(email) || channel.name.includes(emailUsername);
        });

        return !isMonitored;
      });

      logger.info(`Found ${nonMonitoredChannels.length} non-monitored channels out of ${allChannels.length} total channels`);

      // 测试每个非监听渠道
      for (const channel of nonMonitoredChannels) {
        if (this.testingChannels.has(channel.id)) {
          logger.debug(`Channel ${channel.id} is already being tested, skipping`);
          continue;
        }

        try {
          this.testingChannels.add(channel.id);
          await this.testChannel(channel);
          testedCount++;
        } catch (error) {
          logger.error(`Error testing channel ${channel.id}:`, error);
        } finally {
          this.testingChannels.delete(channel.id);
        }
      }

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
   * 测试单个渠道
   */
  async testChannel(channel) {
    logger.info(`Testing non-monitored channel ${channel.id} (${channel.name}) with gemini-2.5-flash`);

    try {
      const axios = require('axios');

      // 先获取渠道详情
      const channelDetail = await oneApiService.getChannelDetail(channel.id);
      if (!channelDetail.success || !channelDetail.data) {
        logger.error(`Failed to get channel ${channel.id} detail`);
        return;
      }

      const channelData = channelDetail.data;

      // 先启用 auto_ban，让渠道在测试期间更安全
      logger.info(`Enabling auto_ban for channel ${channel.id} before testing`);

      // 准备更新数据，只修改 auto_ban，保持原状态
      const updateData = {
        id: channelData.id,
        type: channelData.type,
        name: channelData.name,
        key: channelData.key,
        models: channelData.models,
        auto_ban: 1, // 启用自动禁用
        status: channelData.status, // 保持原状态不变
        failure_timeout_ban_limit: channelData.failure_timeout_ban_limit || 12000,
        priority: channelData.priority || 0,
        other: channelData.other || '',
        test_model: channelData.test_model || ''
      };

      // 使用 axios 直接更新渠道设置 auto_ban
      const updateResponse = await axios.put(
        `${oneApiService.baseUrl}/api/channel/`,
        updateData,
        {
          headers: oneApiService.getHeaders()
        }
      );

      if (!updateResponse.data.success) {
        logger.error(`Failed to enable auto_ban for channel ${channel.id}: ${updateResponse.data.message}`);
        return;
      }

      logger.info(`Auto_ban enabled for channel ${channel.id}, now testing...`);

      // 使用 gemini-2.5-flash 模型测试
      const testResult = await oneApiService.testChannel(channel.id, 'gemini-2.5-flash', {
        maxRetries: 1,
        retryDelay: 5000,
        skipRetry: true
      });

      if (testResult.success) {
        logger.info(`Channel ${channel.id} test successful, enabling channel with priority 1`);

        // 测试成功，再次更新启用渠道并设置优先级为1
        updateData.status = 1; // 启用渠道
        updateData.priority = 1; // 设置优先级为1
        const enableResponse = await axios.put(
          `${oneApiService.baseUrl}/api/channel/`,
          updateData,
          {
            headers: oneApiService.getHeaders()
          }
        );

        if (enableResponse.data.success) {
          logger.info(`✅ Successfully enabled channel ${channel.id} with auto_ban and priority 1`);
        } else {
          logger.error(`Failed to enable channel ${channel.id}: ${enableResponse.data.message}`);
        }
      } else {
        // 测试失败，记录失败信息
        logger.info(`Channel ${channel.id} test failed: ${testResult.message}`);

        // 检查是否需要添加 suspend（特定错误类型）
        const shouldSuspend = testResult.message && (
          testResult.message.includes('setup request header failed') ||
          testResult.message.includes('failed to exchange JWT for access token') ||
          testResult.message.includes('account not found') ||
          testResult.message.includes('Invalid grant') ||
          testResult.message.includes('has been suspended') ||
          testResult.message.includes('Quota exceeded for quota metric')
        );

        if (shouldSuspend && !channelData.name.includes('suspend')) {
          logger.info(`Channel ${channel.id} has authentication error, adding suspend to name`);
          try {
            // 更新渠道名称，添加 suspend，并确保 auto_ban 是开启的
            updateData.name = `${channelData.name}-suspend`;
            updateData.auto_ban = 1; // 确保自动禁用是开启的

            // 如果渠道当前是启用状态，保持启用但开启 auto_ban
            if (channelData.status === 1) {
              updateData.status = 1; // 保持启用状态
              logger.info(`Channel ${channel.id} is enabled, keeping it enabled with auto_ban on`);
            }

            const suspendResponse = await axios.put(
              `${oneApiService.baseUrl}/api/channel/`,
              updateData,
              {
                headers: oneApiService.getHeaders()
              }
            );

            if (suspendResponse.data.success) {
              logger.info(`✅ Added suspend to channel ${channel.id} name: ${updateData.name}, auto_ban is on`);
            } else {
              logger.error(`Failed to add suspend to channel ${channel.id} name: ${suspendResponse.data.message}`);
            }
          } catch (suspendError) {
            logger.error(`Error adding suspend to channel ${channel.id}:`, suspendError.message);
          }
        }
      }
    } catch (error) {
      logger.error(`Error testing channel ${channel.id}:`, error);
    }
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