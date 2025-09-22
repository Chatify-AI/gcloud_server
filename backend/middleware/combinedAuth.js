const jwt = require('jsonwebtoken');
const { Admin, ApiKey } = require('../models');
const logger = require('../src/utils/logger');

// Rate limiting storage for API keys
const rateLimitMap = new Map();

// Clean up old entries every minute
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, data] of rateLimitMap.entries()) {
    if (data.resetTime < oneHourAgo) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

const combinedAuthMiddleware = async (req, res, next) => {
  try {
    // 首先尝试API Key认证
    const apiKeyHeader = req.headers['x-api-key'];
    const authHeader = req.header('Authorization');

    // 检查是否是API Key (以 gck_ 开头)
    if (apiKeyHeader || (authHeader && authHeader.startsWith('Bearer gck_'))) {
      const plainKey = apiKeyHeader || authHeader.replace('Bearer ', '');

      // 验证API Key
      const apiKey = await ApiKey.verify(plainKey);

      if (!apiKey) {
        return res.status(401).json({ error: 'Invalid or expired API key' });
      }

      // 检查权限
      const requiredPermission = getRequiredPermission(req);
      if (requiredPermission && !apiKey.permissions.includes(requiredPermission)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Rate limiting
      const rateLimitKey = `apikey:${apiKey.id}`;
      const now = Date.now();
      let rateLimitData = rateLimitMap.get(rateLimitKey);

      if (!rateLimitData || rateLimitData.resetTime < now) {
        rateLimitData = {
          count: 0,
          resetTime: now + 60 * 60 * 1000 // 1 hour window
        };
      }

      rateLimitData.count++;

      if (rateLimitData.count > apiKey.rateLimit) {
        const minutesUntilReset = Math.ceil((rateLimitData.resetTime - now) / 60000);
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `You have exceeded the rate limit of ${apiKey.rateLimit} requests per hour`,
          minutesUntilReset
        });
      }

      rateLimitMap.set(rateLimitKey, rateLimitData);

      // 设置请求对象
      req.apiKey = apiKey;
      req.isApiKeyAuth = true;
      // 为了兼容，创建一个虚拟的admin对象
      req.admin = {
        id: `apikey:${apiKey.id}`,
        username: `apikey:${apiKey.name}`,
        email: `apikey-${apiKey.id}@api.local`
      };

      logger.info('API Key authentication successful', {
        apiKeyId: apiKey.id,
        apiKeyName: apiKey.name,
        endpoint: req.originalUrl
      });

      return next();
    }

    // 尝试JWT认证
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const admin = await Admin.findByPk(decoded.id);

      if (!admin) {
        throw new Error('Admin not found');
      }

      req.token = token;
      req.admin = admin;
      req.adminId = admin.id;
      req.isJwtAuth = true;

      return next();
    }

    // 没有提供认证信息
    throw new Error('No authentication provided');

  } catch (error) {
    logger.warn('Authentication failed:', error.message);
    res.status(401).json({ error: 'Please authenticate with JWT token or API key' });
  }
};

// 根据路由确定所需权限
function getRequiredPermission(req) {
  const path = req.path;
  const method = req.method;

  // 命令执行相关
  if (path.includes('/commands/execute') || path.includes('/cloud-shell')) {
    return 'execute:commands';
  }

  // 账号管理相关
  if (path.includes('/gcloud-accounts') && method !== 'GET') {
    return 'manage:accounts';
  }

  // API Key管理
  if (path.includes('/apikeys')) {
    return 'manage:apikeys';
  }

  // 读取操作
  if (method === 'GET') {
    return 'read:data';
  }

  return 'execute:commands';
}

module.exports = { combinedAuthMiddleware };