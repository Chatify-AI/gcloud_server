const express = require('express');
const router = express.Router();
const oneApiService = require('../services/oneApiService');
const { combinedAuthMiddleware } = require('../middleware/combinedAuth');
const channelFileMonitor = require('../services/channelFileMonitor');
const ChannelAutoLog = require('../models/ChannelAutoLog');
const logger = require('../src/utils/logger');

// 应用组合认证中间件（支持JWT和API Key）
router.use(combinedAuthMiddleware);

/**
 * 获取渠道列表
 * GET /api/oneapi/channels
 */
router.get('/channels', async (req, res) => {
  try {
    const params = {
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 10,
      status: req.query.status || 'enabled',
      idSort: req.query.idSort === 'true',
      tagMode: req.query.tagMode === 'true'
    };

    const result = await oneApiService.getChannels(params);

    res.json(result);
  } catch (error) {
    logger.error('Failed to get channels:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 搜索渠道
 * GET /api/oneapi/channels/search
 */
router.get('/channels/search', async (req, res) => {
  try {
    const params = {
      keyword: req.query.keyword || '',
      group: req.query.group || '',
      model: req.query.model || '',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 10,
      status: req.query.status || 'enabled',
      idSort: req.query.idSort === 'true',
      tagMode: req.query.tagMode === 'true'
    };

    const result = await oneApiService.searchChannels(params);

    res.json(result);
  } catch (error) {
    logger.error('Failed to search channels:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 测试单个渠道
 * POST /api/oneapi/channels/test
 */
router.post('/channels/test', async (req, res) => {
  try {
    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({
        success: false,
        message: 'channelId is required'
      });
    }

    // 固定使用 gemini-2.5-pro 模型进行测试
    const result = await oneApiService.testChannel(channelId, 'gemini-2.5-pro');

    res.json(result);
  } catch (error) {
    logger.error('Failed to test channel:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 批量测试渠道
 * POST /api/oneapi/channels/batch-test
 */
router.post('/channels/batch-test', async (req, res) => {
  try {
    const { channelIds } = req.body;

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'channelIds array is required'
      });
    }

    // 固定使用 gemini-2.5-pro 模型进行测试
    const results = await oneApiService.batchTestChannels(channelIds, 'gemini-2.5-pro');

    res.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error('Failed to batch test channels:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取渠道详情
 * GET /api/oneapi/channels/:id
 */
router.get('/channels/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await oneApiService.getChannelDetail(id);

    res.json(result);
  } catch (error) {
    logger.error('Failed to get channel detail:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取渠道统计信息
 * GET /api/oneapi/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await oneApiService.getChannelStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get channel stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 创建Gemini渠道
 * POST /api/oneapi/channels/gemini
 */
router.post('/channels/gemini', async (req, res) => {
  try {
    const { name, key } = req.body;

    if (!name || !key) {
      return res.status(400).json({
        success: false,
        message: 'name and key are required'
      });
    }

    const result = await oneApiService.createGeminiChannel(name, key);

    res.json({
      success: true,
      message: 'Gemini渠道创建成功',
      data: result
    });
  } catch (error) {
    logger.error('Failed to create Gemini channel:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 创建Vertex渠道
 * POST /api/oneapi/channels/vertex
 */
router.post('/channels/vertex', async (req, res) => {
  try {
    const { name, key } = req.body;

    if (!name || !key) {
      return res.status(400).json({
        success: false,
        message: 'name and key are required'
      });
    }

    const result = await oneApiService.createVertexChannel(name, key);

    res.json({
      success: true,
      message: 'Vertex渠道创建成功',
      data: result
    });
  } catch (error) {
    logger.error('Failed to create Vertex channel:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取文件监听服务状态
 * GET /api/oneapi/monitor/status
 */
router.get('/monitor/status', async (req, res) => {
  try {
    const status = channelFileMonitor.getStatus();

    res.json(status);
  } catch (error) {
    logger.error('Failed to get monitor status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 启动文件监听服务
 * POST /api/oneapi/monitor/start
 */
router.post('/monitor/start', async (req, res) => {
  try {
    await channelFileMonitor.start();

    res.json({
      success: true,
      message: '文件监听服务已启动'
    });
  } catch (error) {
    logger.error('Failed to start monitor:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 停止文件监听服务
 * POST /api/oneapi/monitor/stop
 */
router.post('/monitor/stop', async (req, res) => {
  try {
    channelFileMonitor.stop();

    res.json({
      success: true,
      message: '文件监听服务已停止'
    });
  } catch (error) {
    logger.error('Failed to stop monitor:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取自动处理日志
 * GET /api/oneapi/monitor/logs
 */
router.get('/monitor/logs', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, channelType } = req.query;

    const where = {};
    if (status) where.status = status;
    if (channelType) where.channelType = channelType;

    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const { count, rows } = await ChannelAutoLog.findAndCountAll({
      where,
      order: [['processedAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        total: count,
        page: parseInt(page),
        pageSize: limit,
        logs: rows
      }
    });
  } catch (error) {
    logger.error('Failed to get monitor logs:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取自动处理统计
 * GET /api/oneapi/monitor/stats
 */
router.get('/monitor/stats', async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalLogs = await ChannelAutoLog.count();
    const successLogs = await ChannelAutoLog.count({ where: { status: 'success' } });
    const failedLogs = await ChannelAutoLog.count({ where: { status: 'failed' } });
    const todayLogs = await ChannelAutoLog.count({
      where: {
        processedAt: { [Op.gte]: today }
      }
    });

    const geminiCount = await ChannelAutoLog.count({ where: { channelType: 'gemini', status: 'success' } });
    const vertexCount = await ChannelAutoLog.count({ where: { channelType: 'vertex', status: 'success' } });

    res.json({
      success: true,
      stats: {
        total: totalLogs,
        success: successLogs,
        failed: failedLogs,
        todayProcessed: todayLogs,
        byType: {
          gemini: geminiCount,
          vertex: vertexCount
        },
        monitorStatus: channelFileMonitor.getStatus()
      }
    });
  } catch (error) {
    logger.error('Failed to get monitor stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;