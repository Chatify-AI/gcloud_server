const express = require('express');
const { ExecutionHistory, GCloudAccount, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../src/utils/logger');

const router = express.Router();

// 获取执行历史记录（无需认证的公开接口）
router.get('/public', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      accountEmail,
      commandType,
      status,
      startDate,
      endDate,
      search
    } = req.query;

    // 构建查询条件
    const where = {};

    if (accountEmail) {
      where.accountEmail = accountEmail;
    }

    if (commandType) {
      where.commandType = commandType;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) {
        where.startedAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.startedAt[Op.lte] = new Date(endDate);
      }
    }

    if (search) {
      where[Op.or] = [
        { command: { [Op.like]: `%${search}%` } },
        { output: { [Op.like]: `%${search}%` } },
        { accountEmail: { [Op.like]: `%${search}%` } }
      ];
    }

    // 查询执行历史
    const histories = await ExecutionHistory.findAll({
      where,
      include: [{
        model: GCloudAccount,
        as: 'account',
        attributes: ['email', 'displayName', 'projectId']
      }],
      order: [['startedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // 获取总数
    const total = await ExecutionHistory.count({ where });

    res.json({
      data: histories,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching execution history:', error);
    res.status(500).json({ error: 'Failed to fetch execution history' });
  }
});

// 获取执行历史统计（无需认证的公开接口）
router.get('/public/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 构建日期条件
    const dateWhere = {};
    if (startDate || endDate) {
      dateWhere.startedAt = {};
      if (startDate) {
        dateWhere.startedAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        dateWhere.startedAt[Op.lte] = new Date(endDate);
      }
    }

    // 统计各种类型的命令数量
    const commandTypeStats = await ExecutionHistory.findAll({
      where: dateWhere,
      attributes: [
        'commandType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['commandType']
    });

    // 统计各种状态的数量
    const statusStats = await ExecutionHistory.findAll({
      where: dateWhere,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // 统计每个账号的执行数量
    const accountStats = await ExecutionHistory.findAll({
      where: { ...dateWhere, accountEmail: { [Op.not]: null } },
      attributes: [
        'accountEmail',
        'accountDisplayName',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['accountEmail', 'accountDisplayName'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10
    });

    // 统计执行来源
    const executedByStats = await ExecutionHistory.findAll({
      where: dateWhere,
      attributes: [
        'executedBy',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['executedBy']
    });

    // 统计平均执行时间
    const avgExecutionTime = await ExecutionHistory.findOne({
      where: { ...dateWhere, executionTime: { [Op.not]: null } },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('executionTime')), 'avgTime'],
        [sequelize.fn('MAX', sequelize.col('executionTime')), 'maxTime'],
        [sequelize.fn('MIN', sequelize.col('executionTime')), 'minTime']
      ]
    });

    res.json({
      commandTypeStats,
      statusStats,
      accountStats,
      executedByStats,
      executionTimeStats: avgExecutionTime
    });
  } catch (error) {
    logger.error('Error fetching execution stats:', error);
    res.status(500).json({ error: 'Failed to fetch execution stats' });
  }
});

// 获取单个执行历史详情（无需认证的公开接口）
router.get('/public/:id', async (req, res) => {
  try {
    const history = await ExecutionHistory.findByPk(req.params.id, {
      include: [{
        model: GCloudAccount,
        as: 'account',
        attributes: ['email', 'displayName', 'projectId']
      }]
    });

    if (!history) {
      return res.status(404).json({ error: 'Execution history not found' });
    }

    res.json(history);
  } catch (error) {
    logger.error('Error fetching execution history detail:', error);
    res.status(500).json({ error: 'Failed to fetch execution history detail' });
  }
});

// 删除旧的执行历史（需要认证的管理接口）
router.delete('/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deleted = await ExecutionHistory.destroy({
      where: {
        startedAt: {
          [Op.lt]: cutoffDate
        }
      }
    });

    res.json({
      message: `Deleted ${deleted} execution history records older than ${days} days`,
      deleted
    });
  } catch (error) {
    logger.error('Error cleaning up execution history:', error);
    res.status(500).json({ error: 'Failed to clean up execution history' });
  }
});

// 获取最近执行的命令（用于快速重复执行）
router.get('/public/recent-commands', async (req, res) => {
  try {
    const { accountEmail, commandType, limit = 10 } = req.query;

    const where = { status: 'completed' };

    if (accountEmail) {
      where.accountEmail = accountEmail;
    }

    if (commandType) {
      where.commandType = commandType;
    }

    // 获取最近成功执行的唯一命令
    const recentCommands = await ExecutionHistory.findAll({
      where,
      attributes: [
        'command',
        'commandType',
        'accountEmail',
        [sequelize.fn('MAX', sequelize.col('startedAt')), 'lastExecuted'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'executionCount']
      ],
      group: ['command', 'commandType', 'accountEmail'],
      order: [[sequelize.fn('MAX', sequelize.col('startedAt')), 'DESC']],
      limit: parseInt(limit)
    });

    res.json(recentCommands);
  } catch (error) {
    logger.error('Error fetching recent commands:', error);
    res.status(500).json({ error: 'Failed to fetch recent commands' });
  }
});

module.exports = router;