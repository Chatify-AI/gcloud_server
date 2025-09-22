const axios = require('axios');
const logger = require('../src/utils/logger');

class OneApiService {
  constructor() {
    // OneAPI配置
    this.baseUrl = process.env.ONEAPI_BASE_URL || 'http://104.194.9.201:11002';
    this.apiKey = process.env.ONEAPI_KEY || 't0bAXxyETOitEfEWuU37sWSqwJrE';
  }

  /**
   * 获取请求headers
   */
  getHeaders() {
    return {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'New-API-User': '1'
    };
  }

  /**
   * 获取可用渠道列表
   */
  async getChannels(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        p: params.page || 1,
        page_size: params.pageSize || 10,
        id_sort: params.idSort || false,
        tag_mode: params.tagMode || false
      });

      // 只有明确传入status参数时才添加
      if (params.status !== undefined) {
        queryParams.append('status', params.status);
      }

      const response = await axios.get(
        `${this.baseUrl}/api/channel/?${queryParams}`,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get channels:', error.message);
      throw new Error(`获取渠道列表失败: ${error.message}`);
    }
  }

  /**
   * 搜索渠道
   */
  async searchChannels(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        keyword: params.keyword || '',
        group: params.group || '',
        model: params.model || '',
        id_sort: params.idSort || false,
        tag_mode: params.tagMode || false,
        p: params.page || 1,
        page_size: params.pageSize || 10
      });

      // 只有明确传入status参数时才添加
      if (params.status !== undefined) {
        queryParams.append('status', params.status);
      }

      const response = await axios.get(
        `${this.baseUrl}/api/channel/search?${queryParams}`,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to search channels:', error.message);
      throw new Error(`搜索渠道失败: ${error.message}`);
    }
  }

  /**
   * 延迟函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 测试渠道是否可用（带重试机制）
   */
  async testChannel(channelId, model = '', options = {}) {
    // 允许调用者自定义重试次数和延迟
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 10000; // 10秒
    const skipRetry = options.skipRetry || false; // 是否跳过重试
    const startTime = Date.now();

    for (let attempt = 1; attempt <= (skipRetry ? 1 : maxRetries); attempt++) {
      const attemptStart = Date.now();
      try {
        logger.info(`Testing channel ${channelId} with model ${model}, attempt ${attempt}/${maxRetries}`);

        const response = await axios.get(
          `${this.baseUrl}/api/channel/test/${channelId}?model=${model}`,
          {
            headers: this.getHeaders(),
            timeout: 30000 // 测试可能需要更长时间
          }
        );

        // 如果成功，直接返回（包含测试时间和完整响应）
        if (response.data.success) {
          const testDuration = Date.now() - startTime;
          const attemptDuration = Date.now() - attemptStart;
          logger.info(`Channel ${channelId} test succeeded on attempt ${attempt}, took ${testDuration}ms`);
          return {
            ...response.data,
            testDuration,
            attemptDuration,
            attempts: attempt,
            channelId,
            model,
            timestamp: new Date().toISOString()
          };
        }

        // 如果失败但还有重试机会
        if (attempt < maxRetries) {
          logger.warn(`Channel ${channelId} test failed on attempt ${attempt}, retrying in ${retryDelay/1000}s...`);
          logger.warn(`Failure details: ${JSON.stringify(response.data)}`);
          await this.sleep(retryDelay);
          continue;
        }

        // 最后一次尝试仍然失败（包含测试时间和详细信息）
        const testDuration = Date.now() - startTime;
        const attemptDuration = Date.now() - attemptStart;
        logger.error(`Channel ${channelId} failed after ${attempt} attempts, response: ${JSON.stringify(response.data)}`);
        return {
          ...response.data,
          testDuration,
          attemptDuration,
          attempts: attempt,
          channelId,
          model,
          timestamp: new Date().toISOString(),
          finalAttempt: true
        };

      } catch (error) {
        logger.error(`Failed to test channel ${channelId} on attempt ${attempt}:`, error.message);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          logger.info(`Retrying channel ${channelId} test in ${retryDelay/1000}s...`);
          await this.sleep(retryDelay);
          continue;
        }

        // 最后一次尝试失败，返回错误
        // 如果是网络错误，返回失败状态（包含测试时间和错误详情）
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          const testDuration = Date.now() - startTime;
          return {
            success: false,
            message: `Network error after ${attempt} attempts: ${error.message}`,
            errorCode: error.code,
            time: 0,
            testDuration,
            attempts: attempt,
            channelId,
            model,
            timestamp: new Date().toISOString(),
            networkError: true
          };
        }

        // 返回原始错误响应（包含完整信息）
        if (error.response && error.response.data) {
          const testDuration = Date.now() - startTime;
          logger.error(`Channel ${channelId} API error response: ${JSON.stringify(error.response.data)}`);
          return {
            ...error.response.data,
            testDuration,
            attempts: attempt,
            channelId,
            model,
            timestamp: new Date().toISOString(),
            httpStatus: error.response.status,
            httpStatusText: error.response.statusText
          };
        }

        const testDuration = Date.now() - startTime;
        return {
          success: false,
          message: `Failed after ${attempt} attempts: ${error.message}`,
          errorDetails: error.toString(),
          time: 0,
          testDuration,
          attempts: attempt,
          channelId,
          model,
          timestamp: new Date().toISOString()
        };
      }
    }
  }

  /**
   * 获取渠道详情
   */
  async getChannelDetail(channelId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/channel/${channelId}`,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Failed to get channel ${channelId} detail:`, error.message);
      throw new Error(`获取渠道详情失败: ${error.message}`);
    }
  }

  /**
   * 批量测试渠道
   */
  async batchTestChannels(channelIds, model = '') {
    const results = [];

    for (const channelId of channelIds) {
      try {
        const result = await this.testChannel(channelId, model);
        results.push({
          channelId,
          ...result
        });
      } catch (error) {
        results.push({
          channelId,
          success: false,
          message: error.message,
          time: 0
        });
      }
    }

    return results;
  }

  /**
   * 获取渠道统计信息
   */
  async getChannelStats() {
    try {
      const channels = await this.getChannels({ pageSize: 1000 });

      if (!channels.success || !channels.data) {
        throw new Error('Failed to get channels data');
      }

      const stats = {
        total: channels.data.total || 0,
        enabled: 0,
        disabled: 0,
        types: {},
        groups: {}
      };

      // 统计各种信息
      if (channels.data.items && Array.isArray(channels.data.items)) {
        channels.data.items.forEach(channel => {
          // 统计状态
          if (channel.status === 1) {
            stats.enabled++;
          } else {
            stats.disabled++;
          }

          // 统计类型
          const typeKey = `type_${channel.type}`;
          stats.types[typeKey] = (stats.types[typeKey] || 0) + 1;

          // 统计分组
          if (channel.group) {
            const groups = channel.group.split(',');
            groups.forEach(group => {
              stats.groups[group] = (stats.groups[group] || 0) + 1;
            });
          }
        });
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get channel stats:', error.message);
      throw new Error(`获取渠道统计信息失败: ${error.message}`);
    }
  }

  /**
   * 检查渠道最近的使用日志
   * @param {number} channelId - 渠道ID
   * @param {string} model - 模型名称，默认gemini-2.5-pro
   * @param {number} minutes - 检查最近多少分钟内的日志，默认1分钟
   * @param {number} limit - 返回记录条数限制，默认30条
   * @returns {Object} 包含是否有日志和日志详情
   */
  async checkChannelRecentLogs(channelId, model = 'gemini-2.5-pro', minutes = 1, limit = 30) {
    try {
      // 计算时间范围（Unix时间戳，秒）
      const now = Math.floor(Date.now() / 1000);
      const startTimestamp = now - (minutes * 60);

      const queryParams = new URLSearchParams({
        p: 1,
        page_size: limit,
        type: 2, // 日志类型
        channel: channelId,
        model_name: model,
        start_timestamp: startTimestamp,
        end_timestamp: now
      });

      logger.info(`Checking recent logs for channel ${channelId}, model ${model}, last ${minutes} minutes`);

      const response = await axios.get(
        `${this.baseUrl}/api/log/?${queryParams}`,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      const hasLogs = response.data?.data?.items && response.data.data.items.length > 0;
      const logCount = response.data?.data?.items?.length || 0;

      logger.info(`Channel ${channelId} recent logs check: found ${logCount} logs in last ${minutes} minute(s)`);

      return {
        success: true,
        hasLogs: hasLogs,
        logCount: logCount,
        logs: response.data?.data?.items || [],
        totalCount: response.data?.data?.total || 0,
        channelId: channelId,
        model: model,
        timeRange: {
          startTimestamp,
          endTimestamp: now,
          minutes
        }
      };
    } catch (error) {
      logger.error(`Failed to check recent logs for channel ${channelId}:`, error.message);
      return {
        success: false,
        hasLogs: false,
        logCount: 0,
        logs: [],
        error: error.message,
        channelId: channelId,
        model: model
      };
    }
  }

  /**
   * 综合测试渠道（包含API测试和日志检查）
   * 只要有一个条件满足就认为渠道正常
   * @param {number} channelId - 渠道ID
   * @param {string} model - 模型名称
   * @param {Object} options - 测试选项
   * @returns {Object} 综合测试结果
   */
  async comprehensiveTestChannel(channelId, model = 'gemini-2.5-pro', options = {}) {
    const results = {
      channelId,
      model,
      timestamp: new Date().toISOString(),
      apiTest: null,
      logCheck: null,
      overallSuccess: false,
      needsEnable: false,
      needsResetFailure: false,
      isQuotaError: false
    };

    try {
      // 并行执行API测试和日志检查
      const [apiTestResult, logCheckResult] = await Promise.all([
        this.testChannel(channelId, model, { ...options, skipRetry: true }),
        this.checkChannelRecentLogs(channelId, model, options.logMinutes || 1, options.logLimit || 30)
      ]);

      results.apiTest = apiTestResult;
      results.logCheck = logCheckResult;

      // 检查是否是配额错误（包含generate_content_free_tier_requests）
      const isQuotaError = apiTestResult.message &&
                           apiTestResult.message.includes('generate_content_free_tier_requests');

      // 检查是否是账单错误（需要直接禁用）
      const isBillingError = apiTestResult.message &&
                             apiTestResult.message.includes('This API method requires billing to be enabled');

      results.isQuotaError = isQuotaError;
      results.isBillingError = isBillingError;

      // 判断成功条件：
      // 1. API测试成功
      // 2. 有最近的日志
      // 3. API测试失败但不是配额错误或账单错误
      const apiSuccess = apiTestResult.success === true;
      const hasRecentLogs = logCheckResult.hasLogs === true;
      const apiFailedButNotCritical = !apiSuccess && !isQuotaError && !isBillingError;

      // 账单错误直接判定为失败，不管其他条件
      if (isBillingError) {
        results.overallSuccess = false;
        results.needsDisable = true;  // 标记需要直接禁用
      } else {
        results.overallSuccess = apiSuccess || hasRecentLogs || apiFailedButNotCritical;
      }

      if (results.overallSuccess) {
        results.needsEnable = true;
        results.needsResetFailure = true;
        logger.info(`Channel ${channelId} is healthy - API test: ${apiSuccess}, Has logs: ${hasRecentLogs}, Not critical error: ${apiFailedButNotCritical}`);
      } else if (isBillingError) {
        logger.error(`Channel ${channelId} has billing error - MUST BE DISABLED IMMEDIATELY`);
        logger.error(`Billing error details: ${apiTestResult.message}`);
      } else {
        logger.warn(`Channel ${channelId} appears unhealthy - API test failed with quota error and no recent logs`);
        logger.info(`Quota error details: ${apiTestResult.message}`);
      }

      return results;
    } catch (error) {
      logger.error(`Comprehensive test failed for channel ${channelId}:`, error.message);
      results.error = error.message;
      return results;
    }
  }

  /**
   * 创建Gemini渠道
   */
  async createGeminiChannel(name, key) {
    const fs = require('fs').promises;
    const path = require('path');
    const logDir = '/root/gcloud_server/logs/oneapi_requests';

    // 确保日志目录存在
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (e) {}

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `gemini_channel_${timestamp}.json`);

    try {
      const payload = {
        mode: "batch",
        channel: {
          type: 24,
          max_input_tokens: 0,
          other: "",
          models: "gemini-2.0-flash,gemini-2.0-flash-001,gemini-2.0-flash-lite-001,gemini-2.0-flash-preview-image-generation,gemini-2.5-flash,gemini-2.5-flash-lite-preview-06-17,gemini-2.5-flash-nothinking,gemini-2.5-flash-thinking,gemini-2.5-pro,gemini-2.5-pro-nothinking,gemini-2.5-pro-thinking,gemini-2.5-flash-lite,gemini-2.5-pro-thinking-*,gemini-2.5-flash-thinking-*,gemini-2.5-flash-lite-thinking-*",
          auto_ban: 0,
          failure_timeout_ban_limit: 12000,
          enable_timestamp_granularity: 0,
          enable_cloud_tools: 0,
          groups: ["default"],
          priority: 3,
          weight: 0,
          price: 0,
          multi_key_mode: "random",
          name: name,
          base_url: "",
          test_model: "",
          model_mapping: "",
          return_model_mapping: "",
          model_timeout_mapping: "",
          tag: "",
          status_code_mapping: "",
          setting: "{\n  \"channel_rate_limit\": {\n    \"ChannelRequestRateLimitEnabled\": true,\n    \"ChannelRequestRateLimitDurationMinutes\": 1,\n    \"ChannelRequestRateLimitCount\": 10000,\n    \"ChannelRequestRateLimitSuccessCount\": 120,\n    \"ChannelRequestRateLimitFailureCount\": 10000\n  }\n}",
          key: key,
          group: "default,Gemini"
        }
      };

      // 记录请求
      const logData = {
        timestamp: new Date().toISOString(),
        type: 'request',
        url: `${this.baseUrl}/api/channel/`,
        channelName: name,
        keyPreview: key.substring(0, 10) + '...',
        payload: payload
      };

      await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
      logger.info(`OneAPI request logged to: ${logFile}`);

      const response = await axios.post(
        `${this.baseUrl}/api/channel/`,
        payload,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      // 追加响应到日志
      const responseLog = {
        timestamp: new Date().toISOString(),
        type: 'response',
        status: response.status,
        statusText: response.statusText,
        data: response.data
      };

      const existingLog = JSON.parse(await fs.readFile(logFile, 'utf-8'));
      existingLog.response = responseLog;
      await fs.writeFile(logFile, JSON.stringify(existingLog, null, 2));

      logger.info(`OneAPI response: ${JSON.stringify(response.data)}`);

      return response.data;
    } catch (error) {
      // 记录错误
      try {
        const errorLog = {
          timestamp: new Date().toISOString(),
          type: 'error',
          error: {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            status: error.response?.status
          }
        };

        const existingLog = JSON.parse(await fs.readFile(logFile, 'utf-8').catch(() => '{}'));
        existingLog.error = errorLog;
        await fs.writeFile(logFile, JSON.stringify(existingLog, null, 2));
      } catch (logError) {
        logger.error('Failed to log error:', logError);
      }

      logger.error('Failed to create Gemini channel:', error.message);
      logger.error('Error details:', error.response?.data || error);
      throw new Error(`创建Gemini渠道失败: ${error.message}`);
    }
  }

  /**
   * 创建Vertex渠道
   */
  async createVertexChannel(name, key) {
    try {
      const payload = {
        mode: "single",
        channel: {
          type: 41,
          openai_organization: "",
          max_input_tokens: 0,
          models: "gemini-2.0-flash,gemini-2.0-flash-001,gemini-2.0-flash-lite-001,gemini-2.0-flash-preview-image-generation,gemini-2.5-flash,gemini-2.5-flash-lite-preview-06-17,gemini-2.5-flash-nothinking,gemini-2.5-flash-thinking,gemini-2.5-pro,gemini-2.5-pro-nothinking,gemini-2.5-pro-thinking,gemini-2.5-flash-lite,gemini-2.5-pro-thinking-*,gemini-2.5-flash-thinking-*,gemini-2.5-flash-lite-thinking-*",
          auto_ban: 0,
          failure_timeout_ban_limit: 12000,
          enable_timestamp_granularity: 0,
          enable_cloud_tools: 0,
          groups: ["default"],
          priority: 5,
          weight: 0,
          price: 0,
          multi_key_mode: "random",
          name: name,
          other: "{\"default\":\"global\",\"gemini-2.0-flash\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.0-flash-001\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.0-flash-lite\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.0-flash-lite-001\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.0-flash-preview-image-generation\":\"global\",\"gemini-2.5-flash\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.5-flash-lite\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.5-flash-lite-preview-06-17\":\"global\",\"gemini-2.5-flash-nothinking\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.5-flash-thinking\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.5-flash-thinking-*\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.5-pro\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.5-pro-nothinking\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.5-pro-thinking\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\",\"gemini-2.5-pro-thinking-*\":\"europe-central2,europe-north1,europe-southwest1,europe-west1,europe-west4,europe-west8,europe-west9,global,us-central1,us-east1,us-east4,us-east5,us-south1,us-west1,us-west4\"}",
          base_url: "",
          test_model: "",
          model_mapping: "",
          return_model_mapping: "",
          model_timeout_mapping: "",
          tag: "",
          status_code_mapping: "",
          setting: "",
          key: key,
          group: "default,vertex"
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/api/channel/`,
        payload,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to create Vertex channel:', error.message);
      throw new Error(`创建Vertex渠道失败: ${error.message}`);
    }
  }

  /**
   * 更新渠道状态
   */
  async updateChannelStatus(channelId, status) {
    try {
      const response = await axios.put(
        `${this.baseUrl}/api/channel/`,
        {
          id: channelId,
          status: status // 1=启用, 2=禁用
        },
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to update channel status:', error.message);
      throw new Error(`更新渠道状态失败: ${error.message}`);
    }
  }

  /**
   * 更新渠道的 auto_ban 设置并启用
   */
  async updateChannelWithAutoBan(channelId) {
    try {
      // 先获取渠道详情
      const channelDetail = await this.getChannelDetail(channelId);

      if (!channelDetail.success || !channelDetail.data) {
        throw new Error('Failed to get channel detail');
      }

      const channel = channelDetail.data;

      // 准备更新数据，保留所有原有设置，只修改 auto_ban 和 status
      const updateData = {
        id: channel.id,
        type: channel.type,
        name: channel.name,
        key: channel.key,
        models: channel.models,
        auto_ban: 1, // 启用自动禁用
        status: 1, // 启用渠道
        failure_timeout_ban_limit: channel.failure_timeout_ban_limit || 12000,
        enable_timestamp_granularity: channel.enable_timestamp_granularity || 0,
        enable_cloud_tools: channel.enable_cloud_tools || 0,
        groups: channel.groups || ["default"],
        priority: channel.priority || 3,
        weight: channel.weight || 0,
        price: channel.price || 0,
        multi_key_mode: channel.multi_key_mode || "random",
        base_url: channel.base_url || "",
        test_model: channel.test_model || "",
        model_mapping: channel.model_mapping || "",
        return_model_mapping: channel.return_model_mapping || "",
        model_timeout_mapping: channel.model_timeout_mapping || "",
        tag: channel.tag || "",
        status_code_mapping: channel.status_code_mapping || "",
        setting: channel.setting || "",
        group: channel.group || "default",
        other: channel.other || "",
        max_input_tokens: channel.max_input_tokens || 0,
        openai_organization: channel.openai_organization || ""
      };

      logger.info(`Updating channel ${channelId} with auto_ban=1 and status=1`);

      const response = await axios.put(
        `${this.baseUrl}/api/channel/`,
        updateData,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      if (response.data.success) {
        logger.info(`Successfully updated channel ${channelId} with auto_ban enabled and channel enabled`);
      } else {
        logger.warn(`Failed to update channel ${channelId}: ${response.data.message}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Failed to update channel ${channelId} with auto_ban:`, error.message);
      throw new Error(`更新渠道auto_ban失败: ${error.message}`);
    }
  }

  /**
   * 查询渠道近期消费记录
   * @param {number} channelId - 渠道ID
   * @param {number} minutes - 查询多少分钟内的记录，默认1分钟
   * @returns {Promise<{hasConsumption: boolean, records: Array, total: number}>}
   */
  async getChannelConsumption(channelId, minutes = 1) {
    try {
      const now = Date.now();
      const startTime = Math.floor((now - minutes * 60 * 1000) / 1000); // 转换为秒级时间戳
      const endTime = Math.floor(now / 1000);

      logger.info(`Checking consumption for channel ${channelId} from ${startTime} to ${endTime} (${minutes} minutes)`);

      const queryParams = new URLSearchParams({
        p: 1,
        page_size: 100,
        type: 2, // 消费类型
        channel: channelId,
        start_timestamp: startTime,
        end_timestamp: endTime,
        username: '',
        user_id: '',
        token_name: '',
        model_name: '',
        group: ''
      });

      const response = await axios.get(
        `${this.baseUrl}/api/log/?${queryParams}`,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      if (response.data) {
        // OneAPI 的返回格式可能是 {success: true, data: {...}} 或者直接是数据对象
        const dataObj = response.data.data || response.data;
        const records = dataObj.items || dataObj || [];
        const total = dataObj.total || records.length;
        const hasConsumption = Array.isArray(records) ? records.length > 0 : false;

        logger.info(`Channel ${channelId} consumption check: ${hasConsumption ? records.length : 0} records found in last ${minutes} minutes (total: ${total})`);

        return {
          hasConsumption,
          records: Array.isArray(records) ? records : [],
          total: hasConsumption ? records.length : 0,
          serverTotal: total, // 服务器返回的总数
          timeRange: {
            startTime,
            endTime,
            minutes
          },
          timestamp: new Date().toISOString()
        };
      }

      logger.warn(`No consumption data returned for channel ${channelId}`);
      return {
        hasConsumption: false,
        records: [],
        total: 0,
        timeRange: {
          startTime,
          endTime,
          minutes
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to get consumption for channel ${channelId}:`, error.message);

      // 返回默认值，不抛出异常，避免影响其他检查
      return {
        hasConsumption: false,
        records: [],
        total: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 检查渠道是否有近期消费（简化版本，只返回boolean）
   * @param {number} channelId - 渠道ID
   * @param {number} minutes - 查询多少分钟内的记录，默认1分钟
   * @returns {Promise<boolean>}
   */
  async hasRecentConsumption(channelId, minutes = 1) {
    try {
      const result = await this.getChannelConsumption(channelId, minutes);
      return result.hasConsumption;
    } catch (error) {
      logger.error(`Error checking recent consumption for channel ${channelId}:`, error.message);
      return false;
    }
  }
}

module.exports = new OneApiService();