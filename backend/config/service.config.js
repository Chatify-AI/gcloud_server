/**
 * 服务配置文件
 * 统一管理所有外部服务的配置
 */

module.exports = {
  // OneAPI 服务配置
  oneApi: {
    baseUrl: process.env.ONEAPI_BASE_URL || 'http://104.194.9.201:11002',
    apiKey: process.env.ONEAPI_KEY || 't0bAXxyETOitEfEWuU37sWSqwJrE',
  },

  // 执行器服务配置
  executor: {
    serviceUrl: process.env.EXECUTOR_SERVICE_URL || 'http://localhost:3002',
  },

  // 文件监听服务配置
  channelMonitor: {
    monitorPath: process.env.CHANNEL_MONITOR_PATH || '/home/Chatify/vip',
    interval: parseInt(process.env.CHANNEL_MONITOR_INTERVAL) || 5000, // 毫秒
  },

  // GCloud 脚本配置
  gcloudScript: {
    // GitHub 脚本下载URL（主URL）
    scriptDownloadUrl: process.env.GCLOUD_SCRIPT_URL || 'https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh',
    // 备用脚本下载URL（可选，如果不设置则不使用容错）
    scriptBackupUrl: process.env.GCLOUD_SCRIPT_BACKUP_URL || '',  // 默认为空，可配置为 http://82.197.94.152:10086/gcp-put.sh
    // 脚本超时时间（毫秒）
    scriptTimeout: parseInt(process.env.GCLOUD_SCRIPT_TIMEOUT) || 180000, // 3分钟
    // 脚本执行冷却时间（毫秒）
    scriptCooldown: parseInt(process.env.GCLOUD_SCRIPT_COOLDOWN) || 1200000, // 20分钟
  },

  // FTP 配置
  ftp: {
    host: process.env.FTP_HOST || 'ftp-service',
    port: parseInt(process.env.FTP_PORT) || 21,
    username: process.env.FTP_USERNAME || 'chatify',
    password: process.env.FTP_PASSWORD || 'chatify123',
    uploadPath: process.env.FTP_UPLOAD_PATH || '/vip',
  }
};
