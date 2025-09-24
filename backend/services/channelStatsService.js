/**
 * 渠道统计服务
 * 用于分析渠道使用情况和配额统计
 */

const oneApiService = require('./oneApiService');
const logger = require('../src/utils/logger');

class ChannelStatsService {
  constructor() {
    this.cachedStats = null;
    this.lastUpdateTime = null;
    this.updateInterval = 30 * 60 * 1000; // 30分钟更新一次缓存
  }

  /**
   * 获取渠道统计数据
   */
  async getChannelStats(forceRefresh = false) {
    try {
      // 检查是否需要刷新缓存
      if (!forceRefresh && this.cachedStats && this.lastUpdateTime) {
        const timeSinceUpdate = Date.now() - this.lastUpdateTime;
        if (timeSinceUpdate < this.updateInterval) {
          logger.info(`📊 Using cached stats, refreshed ${Math.round(timeSinceUpdate / 60000)} minutes ago`);
          return {
            success: true,
            data: this.cachedStats,
            cached: true,
            lastUpdate: this.lastUpdateTime
          };
        }
      }

      logger.info('📊 Starting channel statistics analysis...');
      const startTime = Date.now();

      // 获取所有渠道
      const allChannelsResult = await oneApiService.getAllChannels();
      if (!allChannelsResult.success || !allChannelsResult.data?.items) {
        logger.error('Failed to get channels for statistics');
        return {
          success: false,
          message: 'Failed to get channels'
        };
      }

      const allChannels = allChannelsResult.data.items;
      logger.info(`📊 Analyzing ${allChannels.length} channels...`);

      // 计算10小时前的时间戳
      const tenHoursAgo = Date.now() - (10 * 60 * 60 * 1000);
      logger.info(`📊 Analyzing channels created before: ${new Date(tenHoursAgo).toISOString()}`);

      // 筛选10小时前创建的渠道
      const eligibleChannels = allChannels.filter(channel => {
        if (!channel.created_time) return false;

        // created_time是Unix时间戳（秒）
        const channelCreatedTime = channel.created_time * 1000; // 转换为毫秒
        return channelCreatedTime <= tenHoursAgo;
      });

      logger.info(`📊 Found ${eligibleChannels.length} channels created before 10 hours ago`);

      // 按邮箱分组统计
      const accountStats = {};
      const emailRegex = /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

      for (const channel of eligibleChannels) {
        if (!channel.name) continue;

        // 提取邮箱部分
        const emailMatch = channel.name.match(emailRegex);
        if (!emailMatch) {
          logger.debug(`Channel ${channel.id} name "${channel.name}" doesn't match email pattern`);
          continue;
        }

        const email = emailMatch[1];

        // 初始化账户统计
        if (!accountStats[email]) {
          accountStats[email] = {
            email: email,
            channels: [],
            totalChannels: 0,
            totalUsedQuota: 0,
            totalAmount: 0,
            enabledChannels: 0,
            disabledChannels: 0,
            suspendedChannels: 0,
            oldestChannelTime: null,
            newestChannelTime: null
          };
        }

        const account = accountStats[email];

        // 添加渠道信息
        const channelInfo = {
          id: channel.id,
          name: channel.name,
          status: channel.status,
          usedQuota: channel.used_quota || 0,
          amount: (channel.used_quota || 0) / 500000,
          createdTime: channel.created_time * 1000,
          createdTimeFormatted: new Date(channel.created_time * 1000).toISOString(),
          isSuspended: channel.name.includes('suspend')
        };

        account.channels.push(channelInfo);

        // 统计计数
        account.totalChannels++;
        account.totalUsedQuota += channelInfo.usedQuota;
        account.totalAmount += channelInfo.amount;

        if (channelInfo.isSuspended) {
          account.suspendedChannels++;
        } else if (channel.status === 1) {
          account.enabledChannels++;
        } else if (channel.status === 2) {
          account.disabledChannels++;
        }

        // 更新时间范围
        if (!account.oldestChannelTime || channelInfo.createdTime < account.oldestChannelTime) {
          account.oldestChannelTime = channelInfo.createdTime;
        }
        if (!account.newestChannelTime || channelInfo.createdTime > account.newestChannelTime) {
          account.newestChannelTime = channelInfo.createdTime;
        }
      }

      // 转换为数组并排序
      const accountStatsArray = Object.values(accountStats)
        .map(account => {
          // 格式化时间
          account.oldestChannelTimeFormatted = account.oldestChannelTime
            ? new Date(account.oldestChannelTime).toISOString()
            : null;
          account.newestChannelTimeFormatted = account.newestChannelTime
            ? new Date(account.newestChannelTime).toISOString()
            : null;

          // 按创建时间排序渠道
          account.channels.sort((a, b) => a.createdTime - b.createdTime);

          return account;
        })
        .sort((a, b) => b.totalAmount - a.totalAmount); // 按总金额降序排序

      // 计算总体统计
      const totalStats = {
        totalAccounts: accountStatsArray.length,
        totalChannels: accountStatsArray.reduce((sum, acc) => sum + acc.totalChannels, 0),
        totalUsedQuota: accountStatsArray.reduce((sum, acc) => sum + acc.totalUsedQuota, 0),
        totalAmount: accountStatsArray.reduce((sum, acc) => sum + acc.totalAmount, 0),
        totalEnabled: accountStatsArray.reduce((sum, acc) => sum + acc.enabledChannels, 0),
        totalDisabled: accountStatsArray.reduce((sum, acc) => sum + acc.disabledChannels, 0),
        totalSuspended: accountStatsArray.reduce((sum, acc) => sum + acc.suspendedChannels, 0)
      };

      const processingTime = Date.now() - startTime;

      const result = {
        success: true,
        data: {
          totalStats,
          accounts: accountStatsArray,
          metadata: {
            totalChannelsAnalyzed: allChannels.length,
            eligibleChannelsCount: eligibleChannels.length,
            tenHoursAgoTimestamp: tenHoursAgo,
            tenHoursAgoFormatted: new Date(tenHoursAgo).toISOString(),
            processingTimeMs: processingTime,
            generatedAt: new Date().toISOString()
          }
        },
        cached: false
      };

      // 缓存结果
      this.cachedStats = result.data;
      this.lastUpdateTime = Date.now();

      logger.info(`📊 Statistics generated: ${totalStats.totalAccounts} accounts, ${totalStats.totalChannels} channels, $${totalStats.totalAmount.toFixed(2)} total amount (${processingTime}ms)`);

      return result;

    } catch (error) {
      logger.error('Error generating channel statistics:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取单个邮箱的详细统计
   */
  async getAccountDetails(email, forceRefresh = false) {
    try {
      const statsResult = await this.getChannelStats(forceRefresh);
      if (!statsResult.success) {
        return statsResult;
      }

      const account = statsResult.data.accounts.find(acc => acc.email === email);
      if (!account) {
        return {
          success: false,
          message: `Account not found: ${email}`
        };
      }

      return {
        success: true,
        data: account
      };

    } catch (error) {
      logger.error(`Error getting account details for ${email}:`, error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cachedStats = null;
    this.lastUpdateTime = null;
    logger.info('📊 Channel statistics cache cleared');
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      hasCachedData: this.cachedStats !== null,
      lastUpdateTime: this.lastUpdateTime,
      lastUpdateFormatted: this.lastUpdateTime ? new Date(this.lastUpdateTime).toISOString() : null,
      cacheAgeMinutes: this.lastUpdateTime ? Math.round((Date.now() - this.lastUpdateTime) / 60000) : null,
      updateIntervalMinutes: this.updateInterval / 60000
    };
  }
}

// 导出单例
module.exports = new ChannelStatsService();