/**
 * 独立渠道统计服务
 * 用于分析渠道使用情况和配额统计
 */

const oneApiService = require('./oneApiService');
const databaseService = require('./services/databaseService');

class ChannelStatsService {
  constructor() {
    // 移除缓存机制，每次都重新获取数据
  }

  /**
   * 获取渠道统计数据 - 流式版本
   */
  async getChannelStatsStream(unused = false, hours = 10, onProgress = null) {
    try {
      // 移除缓存检查，每次都重新获取数据

      console.log('📊 Starting fresh channel statistics analysis (no cache)...');
      const startTime = Date.now();

      if (onProgress) {
        onProgress({
          type: 'start',
          message: '开始分析渠道数据...'
        });
      }

      // 获取所有渠道
      if (onProgress) {
        onProgress({
          type: 'progress',
          message: '正在获取所有渠道数据...',
          step: 1,
          totalSteps: 5
        });
      }

      const allChannelsResult = await oneApiService.getAllChannelsStream((fetchProgress) => {
        if (onProgress) {
          // 转发获取进度到主进度回调
          onProgress({
            type: 'fetch_progress',
            message: fetchProgress.message,
            step: 1,
            totalSteps: 5,
            fetchInfo: fetchProgress
          });
        }
      });
      if (!allChannelsResult.success || !allChannelsResult.data?.items) {
        console.error('Failed to get channels for statistics');
        return {
          success: false,
          message: 'Failed to get channels'
        };
      }

      const allChannels = allChannelsResult.data.items;
      console.log(`📊 Analyzing ${allChannels.length} channels...`);

      if (onProgress) {
        onProgress({
          type: 'progress',
          message: `获取到 ${allChannels.length} 个渠道，开始筛选分析...`,
          step: 2,
          totalSteps: 5,
          data: { totalChannels: allChannels.length }
        });
      }

      // 计算指定小时前的时间戳
      const hoursAgo = Date.now() - (hours * 60 * 60 * 1000);
      console.log(`📊 Analyzing channels created before: ${new Date(hoursAgo).toISOString()} (${hours} hours ago)`);

      if (onProgress) {
        onProgress({
          type: 'progress',
          message: `筛选${hours}小时前创建的渠道 (${new Date(hoursAgo).toLocaleString()})...`,
          step: 3,
          totalSteps: 5
        });
      }

      // 筛选指定小时前创建的渠道
      const eligibleChannels = allChannels.filter(channel => {
        if (!channel.created_time) return false;

        // created_time是Unix时间戳（秒）
        const channelCreatedTime = channel.created_time * 1000; // 转换为毫秒
        return channelCreatedTime <= hoursAgo;
      });

      console.log(`📊 Found ${eligibleChannels.length} channels created before ${hours} hours ago`);

      if (onProgress) {
        onProgress({
          type: 'progress',
          message: `找到 ${eligibleChannels.length} 个符合条件的渠道，开始按邮箱分组统计...`,
          step: 4,
          totalSteps: 5,
          data: { eligibleChannels: eligibleChannels.length }
        });
      }

      // 按邮箱分组统计
      const accountStats = {};
      const emailRegex = /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

      for (const channel of eligibleChannels) {
        if (!channel.name) continue;

        // 提取邮箱部分
        const emailMatch = channel.name.match(emailRegex);
        if (!emailMatch) {
          continue;
        }

        const email = emailMatch[1];

        // 检查是否有同邮箱的渠道在指定时间后创建（需要包含进来）
        const hasRecentChannels = allChannels.some(otherChannel => {
          if (!otherChannel.name || !otherChannel.created_time) return false;

          const otherEmailMatch = otherChannel.name.match(emailRegex);
          if (!otherEmailMatch || otherEmailMatch[1] !== email) return false;

          const otherChannelCreatedTime = otherChannel.created_time * 1000;
          return otherChannelCreatedTime > hoursAgo;
        });

        // 如果有指定时间后的渠道，把该邮箱的所有渠道都包含进来
        if (hasRecentChannels && !accountStats[email]) {
          // 获取该邮箱的所有渠道
          const emailAllChannels = allChannels.filter(ch => {
            if (!ch.name) return false;
            const match = ch.name.match(emailRegex);
            return match && match[1] === email;
          });

          // 添加到待统计列表
          for (const emailChannel of emailAllChannels) {
            if (!eligibleChannels.find(ec => ec.id === emailChannel.id)) {
              eligibleChannels.push(emailChannel);
            }
          }
        }

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

        // 检查是否已经添加过这个渠道
        if (account.channels.find(ch => ch.id === channel.id)) {
          continue;
        }

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

      if (onProgress) {
        onProgress({
          type: 'progress',
          message: '正在生成最终统计结果...',
          step: 5,
          totalSteps: 5
        });
      }

      const result = {
        success: true,
        data: {
          totalStats,
          accounts: accountStatsArray,
          metadata: {
            totalChannelsAnalyzed: allChannels.length,
            eligibleChannelsCount: eligibleChannels.length,
            hoursParameter: hours,
            tenHoursAgoTimestamp: hoursAgo,
            tenHoursAgoFormatted: new Date(hoursAgo).toISOString(),
            processingTimeMs: processingTime,
            generatedAt: new Date().toISOString()
          }
        },
        cached: false
      };

      // 移除缓存保存逻辑

      console.log(`📊 Statistics generated: ${totalStats.totalAccounts} accounts, ${totalStats.totalChannels} channels, $${totalStats.totalAmount.toFixed(2)} total amount (${processingTime}ms)`);

      if (onProgress) {
        onProgress({
          type: 'progress',
          message: '正在保存统计数据到数据库...',
          step: 5,
          totalSteps: 6
        });
      }

      // 保存统计结果到数据库
      const saveResult = await databaseService.saveChannelStatistics(
        accountStatsArray,
        result.data.metadata
      );

      if (onProgress) {
        if (saveResult.success) {
          onProgress({
            type: 'database_saved',
            message: `数据库保存完成！保存 ${saveResult.savedCount} 条记录${saveResult.errorCount > 0 ? `，${saveResult.errorCount} 条失败` : ''}`,
            saveResult
          });
        } else {
          onProgress({
            type: 'database_error',
            message: `数据库保存失败: ${saveResult.error}`,
            saveResult
          });
        }

        onProgress({
          type: 'complete',
          message: `分析完成！${totalStats.totalAccounts}个账户，${totalStats.totalChannels}个渠道，总金额$${totalStats.totalAmount.toFixed(2)}`,
          data: {
            totalAccounts: totalStats.totalAccounts,
            totalChannels: totalStats.totalChannels,
            totalAmount: totalStats.totalAmount,
            processingTime,
            databaseSave: saveResult
          }
        });
      }

      // 将数据库保存结果添加到返回结果中
      result.databaseSave = saveResult;
      return result;

    } catch (error) {
      console.error('Error generating channel statistics:', error);
      if (onProgress) {
        onProgress({
          type: 'error',
          message: `分析失败: ${error.message}`,
          error: error.message
        });
      }
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取渠道统计数据 - 兼容非流式版本
   */
  async getChannelStats(unused = false, hours = 10) {
    return this.getChannelStatsStream(false, hours, null);
  }

  /**
   * 获取单个邮箱的详细统计
   */
  async getAccountDetails(email, unused = false) {
    try {
      const statsResult = await this.getChannelStats(false);
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
      console.error(`Error getting account details for ${email}:`, error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      message: 'Channel statistics service running without cache',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new ChannelStatsService();