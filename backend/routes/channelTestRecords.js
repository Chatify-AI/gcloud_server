const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ChannelTestRecord = require('../models/ChannelTestRecord');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../src/utils/logger');

// 获取渠道测试记录列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      accountEmail,
      channelId,
      status,
      minFailures
    } = req.query;

    const where = {};

    if (accountEmail) {
      where.accountEmail = { [Op.like]: `%${accountEmail}%` };
    }

    if (channelId) {
      where.channelId = channelId;
    }

    if (status) {
      where.lastTestStatus = status;
    }

    if (minFailures) {
      where.failureCount = { [Op.gte]: parseInt(minFailures) };
    }

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);

    const { count, rows } = await ChannelTestRecord.findAndCountAll({
      where,
      order: [
        ['failure_count', 'DESC'],
        ['last_test_time', 'DESC']
      ],
      offset,
      limit
    });

    res.json({
      success: true,
      data: {
        records: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(count / parseInt(pageSize))
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching channel test records:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取单个渠道测试记录
router.get('/:channelId', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.params;

    const record = await ChannelTestRecord.findOne({
      where: { channelId }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    logger.error('Error fetching channel test record:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 重置渠道测试记录
router.post('/:channelId/reset', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.params;

    const record = await ChannelTestRecord.findOne({
      where: { channelId }
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    await record.update({
      failureCount: 0,
      lastTestStatus: null,
      lastTestMessage: 'Manually reset',
      isDisabled: false
    });

    res.json({
      success: true,
      message: 'Channel test record reset successfully',
      data: record
    });
  } catch (error) {
    logger.error('Error resetting channel test record:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除渠道测试记录
router.delete('/:channelId', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.params;

    const deleted = await ChannelTestRecord.destroy({
      where: { channelId }
    });

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    res.json({
      success: true,
      message: 'Channel test record deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting channel test record:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取统计数据
router.get('/stats/summary', authMiddleware, async (req, res) => {
  try {
    const totalRecords = await ChannelTestRecord.count();

    const failedChannels = await ChannelTestRecord.count({
      where: { lastTestStatus: 'failed' }
    });

    const disabledChannels = await ChannelTestRecord.count({
      where: { isDisabled: true }
    });

    const highFailureChannels = await ChannelTestRecord.count({
      where: { failureCount: { [Op.gte]: 2 } }
    });

    // 按账号统计
    const accountStats = await ChannelTestRecord.findAll({
      attributes: [
        'accountEmail',
        [ChannelTestRecord.sequelize.fn('COUNT', '*'), 'totalChannels'],
        [ChannelTestRecord.sequelize.fn('SUM', ChannelTestRecord.sequelize.literal('CASE WHEN failure_count >= 2 THEN 1 ELSE 0 END')), 'highFailureCount']
      ],
      group: ['accountEmail'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalRecords,
          failedChannels,
          disabledChannels,
          highFailureChannels
        },
        accountStats
      }
    });
  } catch (error) {
    logger.error('Error fetching channel test stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;