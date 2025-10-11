const mysql = require('mysql2/promise');
const axios = require('axios');
const logger = require('../src/utils/logger');

class ChannelKeyService {
  constructor() {
    this.dbConfig = {
      host: 'chatify-database.mysql.database.azure.com',
      user: 'database',
      password: 'sk-chatify-MoLu154!',
      database: 'vertex_ai_pool_1',
      port: 3306
    };
    this.pushApiUrl = 'http://104.243.32.237:10000/api/add';
    this.maxRetries = 3;
  }

  /**
   * 创建数据库连接
   */
  async createConnection() {
    try {
      const connection = await mysql.createConnection(this.dbConfig);
      logger.info('🔌 [ChannelKeyService] Connected to Azure MySQL database');
      return connection;
    } catch (error) {
      logger.error('❌ [ChannelKeyService] Failed to connect to MySQL:', error.message);
      throw new Error(`数据库连接失败: ${error.message}`);
    }
  }

  /**
   * 根据邮箱获取所有对应的channel keys
   * @param {string} accountEmail - 账户邮箱
   * @returns {Promise<Array>} - 返回key数组
   */
  async getChannelKeysByEmail(accountEmail) {
    const connection = await this.createConnection();

    try {
      logger.info(`🔍 [ChannelKeyService] Searching channels for email: ${accountEmail}`);

      // 查询所有匹配邮箱的channels
      const [rows] = await connection.execute(
        'SELECT id, name, `key` FROM channels WHERE name LIKE ?',
        [`%${accountEmail}%`]
      );

      logger.info(`📊 [ChannelKeyService] Found ${rows.length} channels for email: ${accountEmail}`);
      if (rows.length > 0) {
        logger.info(`   Channel IDs: [${rows.map(r => r.id).join(', ')}]`);
      }

      await connection.end();
      return rows;
    } catch (error) {
      await connection.end();
      logger.error(`❌ [ChannelKeyService] Error fetching channels for ${accountEmail}:`, error.message);
      throw new Error(`获取渠道keys失败: ${error.message}`);
    }
  }

  /**
   * 推送单个key到远程服务器（带重试）
   * @param {string} key - API key
   * @param {number} channelId - 渠道ID
   * @param {string} channelName - 渠道名称
   * @returns {Promise<Object>} - 推送结果
   */
  async pushKeyWithRetry(key, channelId, channelName) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`🚀 [ChannelKeyService] Pushing key for channel ${channelId} (attempt ${attempt}/${this.maxRetries})`);
        logger.info(`   Channel: ${channelName}`);
        logger.info(`   Key preview: ${key.substring(0, 20)}...`);

        const response = await axios.post(this.pushApiUrl, key, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        if (response.status === 200) {
          logger.info(`✅ [ChannelKeyService] Successfully pushed key for channel ${channelId}`);
          logger.info(`   Response: ${JSON.stringify(response.data)}`);
          return {
            success: true,
            channelId,
            channelName,
            attempt,
            response: response.data
          };
        } else {
          throw new Error(`Unexpected status code: ${response.status}`);
        }

      } catch (error) {
        lastError = error;
        logger.warn(`⚠️  [ChannelKeyService] Attempt ${attempt} failed for channel ${channelId}: ${error.message}`);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < this.maxRetries) {
          const waitTime = Math.min(1000 * attempt, 3000); // 最多等3秒
          logger.info(`   Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // 所有重试都失败了
    logger.error(`❌ [ChannelKeyService] Failed to push key for channel ${channelId} after ${this.maxRetries} attempts`);
    logger.error(`   Error: ${lastError.message}`);
    return {
      success: false,
      channelId,
      channelName,
      attempts: this.maxRetries,
      error: lastError.message
    };
  }

  /**
   * 批量推送账户的所有keys
   * @param {string} accountEmail - 账户邮箱
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Object>} - 推送结果汇总
   */
  async pushAccountKeys(accountEmail, progressCallback = null) {
    logger.info(`🎯 [ChannelKeyService] ==================== START PUSH KEYS ====================`);
    logger.info(`   Account Email: ${accountEmail}`);

    try {
      // 1. 获取所有channels
      const channels = await this.getChannelKeysByEmail(accountEmail);

      if (channels.length === 0) {
        logger.info(`⚠️  [ChannelKeyService] No channels found for account: ${accountEmail}`);
        logger.info(`🎯 [ChannelKeyService] ==================== END PUSH KEYS ====================`);
        return {
          success: true,
          accountEmail,
          totalChannels: 0,
          pushedCount: 0,
          failedCount: 0,
          results: []
        };
      }

      // 发送开始进度
      if (progressCallback) {
        progressCallback({
          type: 'keys_start',
          accountEmail,
          totalKeys: channels.length,
          message: `开始推送 ${channels.length} 个keys`
        });
      }

      const results = {
        success: true,
        accountEmail,
        totalChannels: channels.length,
        pushedCount: 0,
        failedCount: 0,
        results: []
      };

      // 2. 逐个推送keys（串行处理，避免并发压力）
      for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];

        // 发送进度更新
        if (progressCallback) {
          progressCallback({
            type: 'keys_progress',
            accountEmail,
            current: i + 1,
            total: channels.length,
            channelId: channel.id,
            channelName: channel.name,
            progress: Math.round(((i + 1) / channels.length) * 100)
          });
        }

        const result = await this.pushKeyWithRetry(
          channel.key,
          channel.id,
          channel.name
        );

        results.results.push(result);

        if (result.success) {
          results.pushedCount++;
        } else {
          results.failedCount++;
        }

        // 推送之间稍微延迟，避免过快
        if (i < channels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // 发送完成进度
      if (progressCallback) {
        progressCallback({
          type: 'keys_completed',
          accountEmail,
          pushedCount: results.pushedCount,
          failedCount: results.failedCount,
          message: `Keys推送完成: ${results.pushedCount}成功, ${results.failedCount}失败`
        });
      }

      logger.info(`✅ [ChannelKeyService] Completed pushing keys for ${accountEmail}`);
      logger.info(`   Success: ${results.pushedCount}, Failed: ${results.failedCount}`);
      logger.info(`🎯 [ChannelKeyService] ==================== END PUSH KEYS ====================`);

      return results;

    } catch (error) {
      logger.error(`❌ [ChannelKeyService] Error pushing keys for ${accountEmail}:`, error.message);
      logger.error(`🎯 [ChannelKeyService] ==================== END PUSH KEYS (ERROR) ====================`);
      throw error;
    }
  }
}

module.exports = new ChannelKeyService();
