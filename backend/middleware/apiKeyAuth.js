const { ApiKey } = require('../models');
const logger = require('../src/utils/logger');

// Rate limiting storage (in-memory for simplicity, could use Redis)
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

const apiKeyAuthMiddleware = async (req, res, next) => {
  try {
    // 获取API Key - 支持header和query参数
    const apiKeyHeader = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
    const apiKeyQuery = req.query.apiKey;
    const plainKey = apiKeyHeader || apiKeyQuery;

    if (!plainKey) {
      // 如果没有API Key，继续检查JWT
      return next();
    }

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
      // Reset rate limit window
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

    // 将API Key信息附加到请求对象
    req.apiKey = apiKey;
    req.isApiKeyAuth = true;

    // 跳过JWT认证
    req.skipJwtAuth = true;

    logger.info('API Key authentication successful', {
      apiKeyId: apiKey.id,
      apiKeyName: apiKey.name,
      endpoint: req.originalUrl
    });

    next();
  } catch (error) {
    logger.error('API Key authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
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

  // 读取操作一般不需要特殊权限
  if (method === 'GET') {
    return 'read:data';
  }

  return 'execute:commands'; // 默认权限
}

module.exports = { apiKeyAuthMiddleware };