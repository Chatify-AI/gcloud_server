/**
 * 渠道统计API路由
 */

const express = require('express');
const router = express.Router();
const channelStatsService = require('../services/channelStatsService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * 获取渠道统计概览
 */
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await channelStatsService.getChannelStats(forceRefresh);

    res.json(result);
  } catch (error) {
    console.error('Error in /overview:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 获取单个账户详情
 */
router.get('/account/:email', authMiddleware, async (req, res) => {
  try {
    const { email } = req.params;
    const forceRefresh = req.query.refresh === 'true';

    const result = await channelStatsService.getAccountDetails(email, forceRefresh);

    res.json(result);
  } catch (error) {
    console.error('Error in /account/:email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 清除统计缓存
 */
router.post('/clear-cache', authMiddleware, async (req, res) => {
  try {
    channelStatsService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Error in /clear-cache:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 获取服务状态
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = channelStatsService.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error in /status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;