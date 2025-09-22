const express = require('express');
const { ApiKey } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../src/utils/logger');

const router = express.Router();

// 需要管理员权限
router.use(authMiddleware);

// 获取所有API Keys
router.get('/', async (req, res) => {
  try {
    const apiKeys = await ApiKey.findAll({
      attributes: { exclude: ['key'] }, // 不返回哈希值
      order: [['createdAt', 'DESC']]
    });

    res.json({ apiKeys });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// 创建新的API Key
router.post('/generate', async (req, res) => {
  try {
    const { name, description, permissions, expiresAt, rateLimit } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    const apiKey = await ApiKey.create({
      name,
      description,
      permissions: permissions || ['execute:commands'],
      expiresAt,
      rateLimit: rateLimit || 100,
      createdBy: req.admin.username
    });

    // 返回完整的key只在创建时
    res.json({
      apiKey: {
        ...apiKey.toJSON(),
        plainKey: apiKey.plainKey
      },
      message: 'API key created successfully. Please save the key securely as it won\'t be shown again.'
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// 更新API Key状态
router.patch('/:id', async (req, res) => {
  try {
    const { isActive, name, description, rateLimit } = req.body;
    const apiKey = await ApiKey.findByPk(req.params.id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const updates = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (rateLimit) updates.rateLimit = rateLimit;

    await apiKey.update(updates);

    res.json({
      apiKey: {
        ...apiKey.toJSON(),
        key: undefined // 不返回哈希值
      },
      message: 'API key updated successfully'
    });
  } catch (error) {
    logger.error('Error updating API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// 删除API Key
router.delete('/:id', async (req, res) => {
  try {
    const apiKey = await ApiKey.findByPk(req.params.id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await apiKey.destroy();

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// 获取API Key使用统计
router.get('/:id/stats', async (req, res) => {
  try {
    const apiKey = await ApiKey.findByPk(req.params.id, {
      attributes: { exclude: ['key'] }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({
      stats: {
        name: apiKey.name,
        usageCount: apiKey.usageCount,
        lastUsed: apiKey.lastUsed,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        expiresAt: apiKey.expiresAt
      }
    });
  } catch (error) {
    logger.error('Error fetching API key stats:', error);
    res.status(500).json({ error: 'Failed to fetch API key stats' });
  }
});

module.exports = router;