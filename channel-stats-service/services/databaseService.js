const ChannelStatistics = require('../models/ChannelStatistics');

class DatabaseService {

  /**
   * 保存或更新渠道统计数据
   */
  async saveChannelStatistics(accountsData, metadata) {
    try {
      console.log(`📊 Saving ${accountsData.length} account statistics to database...`);

      const savedRecords = [];
      const errors = [];

      for (const account of accountsData) {
        try {
          // 使用 upsert 进行插入或更新
          const [record, created] = await ChannelStatistics.upsert({
            email: account.email,
            totalChannels: account.totalChannels,
            totalUsedQuota: account.totalUsedQuota,
            totalAmount: account.totalAmount,
            enabledChannels: account.enabledChannels,
            disabledChannels: account.disabledChannels,
            suspendedChannels: account.suspendedChannels,
            oldestChannelTime: account.oldestChannelTime ? new Date(account.oldestChannelTime) : null,
            newestChannelTime: account.newestChannelTime ? new Date(account.newestChannelTime) : null,
            hoursParameter: metadata.hoursParameter,
            eligibleChannelsCount: metadata.eligibleChannelsCount,
            processingTimeMs: metadata.processingTimeMs,
            channelDetails: account.channels, // 存储渠道详细信息
            lastUpdated: new Date()
          });

          savedRecords.push({
            email: account.email,
            action: created ? 'created' : 'updated',
            totalChannels: account.totalChannels,
            totalAmount: account.totalAmount
          });

          console.log(`📊 ${created ? 'Created' : 'Updated'} record for ${account.email}: ${account.totalChannels} channels, $${account.totalAmount.toFixed(2)}`);

        } catch (error) {
          const errorInfo = {
            email: account.email,
            error: error.message
          };
          errors.push(errorInfo);
          console.error(`❌ Failed to save statistics for ${account.email}:`, error.message);
        }
      }

      const result = {
        success: true,
        savedCount: savedRecords.length,
        errorCount: errors.length,
        savedRecords,
        errors,
        timestamp: new Date().toISOString()
      };

      console.log(`📊 Database save completed: ${savedRecords.length} saved, ${errors.length} errors`);
      return result;

    } catch (error) {
      console.error('❌ Database save operation failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 获取所有统计数据
   */
  async getAllStatistics(limit = 100, offset = 0) {
    try {
      const { count, rows } = await ChannelStatistics.findAndCountAll({
        limit,
        offset,
        order: [['totalAmount', 'DESC'], ['lastUpdated', 'DESC']],
        attributes: { exclude: ['channelDetails'] } // 排除详细信息以提高性能
      });

      return {
        success: true,
        data: {
          total: count,
          records: rows,
          limit,
          offset
        }
      };
    } catch (error) {
      console.error('❌ Failed to get all statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 根据邮箱获取统计数据
   */
  async getStatisticsByEmail(email) {
    try {
      const record = await ChannelStatistics.findOne({
        where: { email }
      });

      if (!record) {
        return {
          success: false,
          message: `No statistics found for email: ${email}`
        };
      }

      return {
        success: true,
        data: record
      };
    } catch (error) {
      console.error(`❌ Failed to get statistics for ${email}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除指定邮箱的统计数据
   */
  async deleteStatisticsByEmail(email) {
    try {
      const deletedCount = await ChannelStatistics.destroy({
        where: { email }
      });

      return {
        success: true,
        deletedCount,
        message: deletedCount > 0 ? `Deleted statistics for ${email}` : `No statistics found for ${email}`
      };
    } catch (error) {
      console.error(`❌ Failed to delete statistics for ${email}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取统计汇总信息
   */
  async getStatisticsSummary() {
    try {
      const [totalRecords, totalAmount, totalChannels] = await Promise.all([
        ChannelStatistics.count(),
        ChannelStatistics.sum('totalAmount'),
        ChannelStatistics.sum('totalChannels')
      ]);

      return {
        success: true,
        data: {
          totalRecords,
          totalAmount: totalAmount || 0,
          totalChannels: totalChannels || 0,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Failed to get statistics summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清理旧的统计数据（保留最近N天）
   */
  async cleanupOldStatistics(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await ChannelStatistics.destroy({
        where: {
          lastUpdated: {
            [require('sequelize').Op.lt]: cutoffDate
          }
        }
      });

      console.log(`📊 Cleaned up ${deletedCount} old statistics records (older than ${daysToKeep} days)`);
      return {
        success: true,
        deletedCount,
        cutoffDate: cutoffDate.toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to cleanup old statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new DatabaseService();