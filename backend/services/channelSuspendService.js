/**
 * 渠道Suspend服务
 * 专门处理渠道的suspend逻辑和错误检测
 */

const oneApiService = require('./oneApiService');
const logger = require('../src/utils/logger');

class ChannelSuspendService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查一次
    this.timer = null;
  }

  /**
   * 启动Suspend服务
   */
  async start() {
    if (this.isRunning) {
      logger.info('Channel Suspend Service is already running');
      return;
    }

    logger.info('🔴 Channel Suspend Service starting...');
    this.isRunning = true;

    // 开始检查循环
    this.runCheckLoop().catch(error => {
      logger.error('🔴 Channel Suspend Service crashed:', error);
      this.isRunning = false;
    });

    logger.info('🔴 Channel Suspend Service started (5-minute intervals)');
  }

  /**
   * 停止服务
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Channel Suspend Service');
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 检查循环
   */
  async runCheckLoop() {
    while (this.isRunning) {
      try {
        logger.info('🔍 Starting channel suspend check cycle');
        const startTime = Date.now();

        await this.checkAndSuspendChannels();

        const cycleTime = Date.now() - startTime;
        logger.info(`Channel suspend check completed in ${(cycleTime/1000).toFixed(1)}s`);

      } catch (err) {
        logger.error('🔴 Channel suspend check error:', err);
      }

      // 等待下一次检查
      if (this.isRunning) {
        await new Promise(resolve => {
          this.timer = setTimeout(resolve, this.checkInterval);
        });
      }
    }
  }

  /**
   * 检查并suspend有问题的渠道
   */
  async checkAndSuspendChannels() {
    try {
      // 获取所有启用的、非suspend的渠道
      const allChannelsResult = await oneApiService.getAllChannels();
      if (!allChannelsResult.success || !allChannelsResult.data?.items) {
        logger.error('Failed to get channels for suspend check');
        return;
      }

      const allChannels = allChannelsResult.data.items;

      // 筛选需要检查的渠道：启用状态且未suspend
      const channelsToCheck = allChannels.filter(channel =>
        channel.status === 1 &&
        channel.name &&
        !channel.name.includes('suspend')
      );

      logger.info(`Found ${channelsToCheck.length} channels to check for suspend`);

      if (channelsToCheck.length === 0) {
        return;
      }

      let suspendedCount = 0;
      const BATCH_SIZE = 10; // 每批检查10个渠道

      for (let i = 0; i < channelsToCheck.length; i += BATCH_SIZE) {
        const batch = channelsToCheck.slice(i, i + BATCH_SIZE);

        const testPromises = batch.map(channel => this.testAndSuspendChannel(channel));
        const results = await Promise.all(testPromises);

        suspendedCount += results.filter(result => result?.suspended).length;

        // 批次间稍作延迟
        if (i + BATCH_SIZE < channelsToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      logger.info(`Suspend check completed: ${suspendedCount} channels suspended`);

    } catch (error) {
      logger.error('Error in checkAndSuspendChannels:', error);
    }
  }

  /**
   * 测试单个渠道并在需要时suspend
   */
  async testAndSuspendChannel(channel) {
    try {
      logger.debug(`🔍 Testing channel ${channel.id} (${channel.name})`);

      // 测试渠道
      const testResult = await oneApiService.testChannel(channel.id, 'gemini-2.5-pro', {
        maxRetries: 1,
        retryDelay: 5000,
        skipRetry: true
      });

      if (testResult.success) {
        logger.debug(`✅ Channel ${channel.id} test successful`);
        return { channelId: channel.id, suspended: false };
      }

      // 检查是否需要suspend
      const shouldSuspend = this.shouldSuspendChannel(testResult.message);

      if (shouldSuspend) {
        logger.info(`🔴 Channel ${channel.id} needs suspend: ${testResult.message?.substring(0, 100)}...`);

        const suspended = await this.suspendChannel(channel, testResult.message);
        return { channelId: channel.id, suspended, reason: testResult.message };
      }

      return { channelId: channel.id, suspended: false };

    } catch (error) {
      logger.error(`Error testing channel ${channel.id}:`, error);
      return { channelId: channel.id, suspended: false, error: error.message };
    }
  }

  /**
   * 判断是否应该suspend渠道
   */
  shouldSuspendChannel(errorMessage) {
    if (!errorMessage) return false;

    return (
      errorMessage.includes('You exceeded your current quota') ||
      errorMessage.includes('check your plan and billing details') ||
      errorMessage.includes('Quota exceeded for quota metric') ||
      errorMessage.includes('has been suspended') ||
      errorMessage.includes('Consumer') && errorMessage.includes('has been suspended') ||
      errorMessage.includes('generate_content_free_tier_requests') ||
      errorMessage.includes('generativelanguage.googleapis.com/generate_content_free_tier_requests') ||
      errorMessage.includes('setup request header failed') ||
      errorMessage.includes('failed to exchange JWT for access token') ||
      errorMessage.includes('account not found') ||
      errorMessage.includes('Invalid grant')
    );
  }

  /**
   * Suspend渠道
   */
  async suspendChannel(channel, errorMessage) {
    try {
      const axios = require('axios');

      // 获取渠道最新详情
      const channelDetail = await oneApiService.getChannelDetail(channel.id);
      if (!channelDetail.success || !channelDetail.data) {
        logger.error(`Failed to get channel ${channel.id} detail for suspend`);
        return false;
      }

      const channelData = channelDetail.data;

      // 准备更新数据
      const updateData = {
        id: channelData.id,
        type: channelData.type,
        name: `${channelData.name}-suspend`,
        status: 2, // 立即禁用
        auto_ban: 1,
        base_url: channelData.base_url || '',
        other: channelData.other || '',
        models: channelData.models || [],
        model_mapping: channelData.model_mapping || '',
        groups: channelData.groups || [],
        key: channelData.key || '',
        openai_organization: channelData.openai_organization || '',
        test_model: channelData.test_model || '',
        priority: channelData.priority || 0
      };

      const response = await axios.put(
        `${oneApiService.baseUrl}/api/channel/`,
        updateData,
        {
          headers: oneApiService.getHeaders(),
          timeout: 10000
        }
      );

      if (response.data.success) {
        logger.info(`✅ Successfully suspended channel ${channel.id}: ${updateData.name}`);
        return true;
      } else {
        logger.error(`Failed to suspend channel ${channel.id}: ${response.data.message}`);
        return false;
      }

    } catch (error) {
      logger.error(`Error suspending channel ${channel.id}:`, error);
      return false;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      intervalMinutes: this.checkInterval / (60 * 1000)
    };
  }
}

// 导出单例
module.exports = new ChannelSuspendService();