const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const axios = require('axios');
const logger = require('../src/utils/logger');

/**
 * GCloud 授权管理器
 * 处理各种授权问题和自动修复
 */
class GCloudAuthManager {
  constructor() {
    this.authCache = new Map();
    this.authCheckInterval = 5 * 60 * 1000; // 5分钟检查一次
  }

  /**
   * 检查并修复账户授权
   */
  async ensureAuthenticated(account) {
    try {
      // 1. 尝试检查现有授权
      const isAuthenticated = await this.checkAuthentication(account);

      if (isAuthenticated) {
        logger.info(`Account ${account.email} is already authenticated`);
        return true;
      }

      logger.info(`Account ${account.email} needs authentication, attempting to fix...`);

      // 2. 尝试多种授权方法
      const authMethods = [
        () => this.syncLocalAuth(account),
        () => this.useServiceAccount(account),
        () => this.refreshOAuthToken(account),
        () => this.useApplicationDefaultCredentials(account)
      ];

      for (const method of authMethods) {
        try {
          const success = await method();
          if (success) {
            logger.info(`Successfully authenticated ${account.email}`);
            return true;
          }
        } catch (error) {
          logger.warn(`Auth method failed: ${error.message}`);
        }
      }

      throw new Error('All authentication methods failed');
    } catch (error) {
      logger.error(`Failed to ensure authentication for ${account.email}:`, error);
      return false;
    }
  }

  /**
   * 检查账户是否已授权
   */
  async checkAuthentication(account) {
    try {
      const cmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud auth list --format=json 2>/dev/null`;
      const { stdout } = await execPromise(cmd);

      const authList = JSON.parse(stdout || '[]');
      const activeAccount = authList.find(a => a.status === 'ACTIVE' && a.account === account.email);

      return !!activeAccount;
    } catch (error) {
      logger.debug(`Auth check failed for ${account.email}: ${error.message}`);
      return false;
    }
  }

  /**
   * 方法1: 同步本地授权文件到 Cloud Shell
   */
  async syncLocalAuth(account) {
    try {
      logger.info(`Syncing local auth files for ${account.email}`);

      const files = [
        { local: `${account.configDir}/credentials.db`, remote: '~/.config/gcloud/credentials.db' },
        { local: `${account.configDir}/configurations/config_default`, remote: '~/.config/gcloud/configurations/config_default' },
        { local: `${account.configDir}/application_default_credentials.json`, remote: '~/.config/gcloud/application_default_credentials.json' }
      ];

      // 创建远程目录
      await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="mkdir -p ~/.config/gcloud/configurations"`,
        { timeout: 30000 }
      );

      // 同步文件
      for (const file of files) {
        try {
          const fileExists = await fs.access(file.local).then(() => true).catch(() => false);
          if (fileExists) {
            await execPromise(
              `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell scp --authorize-session "${file.local}" "cloudshell:${file.remote}"`,
              { timeout: 30000 }
            );
            logger.info(`Synced ${file.local} to Cloud Shell`);
          }
        } catch (error) {
          logger.warn(`Failed to sync ${file.local}: ${error.message}`);
        }
      }

      // 激活账户
      await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="gcloud config set account ${account.email}"`,
        { timeout: 30000 }
      );

      return true;
    } catch (error) {
      logger.error(`Local auth sync failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 方法2: 使用服务账号密钥
   */
  async useServiceAccount(account) {
    try {
      if (!account.serviceAccountKey) {
        logger.debug(`No service account key for ${account.email}`);
        return false;
      }

      logger.info(`Using service account for ${account.email}`);

      const keyPath = `/tmp/sa-key-${account.id}.json`;
      await fs.writeFile(keyPath, account.serviceAccountKey);

      // 上传密钥到 Cloud Shell
      await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell scp --authorize-session "${keyPath}" "cloudshell:/tmp/sa-key.json"`,
        { timeout: 30000 }
      );

      // 激活服务账号
      await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="gcloud auth activate-service-account --key-file=/tmp/sa-key.json && rm /tmp/sa-key.json"`,
        { timeout: 30000 }
      );

      // 清理本地临时文件
      await fs.unlink(keyPath).catch(() => {});

      return true;
    } catch (error) {
      logger.error(`Service account activation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 方法3: 刷新 OAuth 令牌
   */
  async refreshOAuthToken(account) {
    try {
      logger.info(`Refreshing OAuth token for ${account.email}`);

      // 尝试使用 gcloud 命令刷新
      const { stdout: newToken } = await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud auth print-access-token --refresh`,
        { timeout: 30000 }
      );

      if (newToken) {
        // 缓存新令牌
        this.authCache.set(account.id, {
          token: newToken.trim(),
          expiry: Date.now() + 3600000 // 1小时
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error(`OAuth refresh failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 方法4: 使用应用默认凭据 (ADC)
   */
  async useApplicationDefaultCredentials(account) {
    try {
      const adcPath = `${account.configDir}/application_default_credentials.json`;
      const adcExists = await fs.access(adcPath).then(() => true).catch(() => false);

      if (!adcExists) {
        logger.debug(`No ADC file for ${account.email}`);
        return false;
      }

      logger.info(`Using ADC for ${account.email}`);

      // 上传 ADC 到 Cloud Shell
      await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell scp --authorize-session "${adcPath}" "cloudshell:~/.config/gcloud/application_default_credentials.json"`,
        { timeout: 30000 }
      );

      // 设置环境变量
      await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/application_default_credentials.json"`,
        { timeout: 30000 }
      );

      return true;
    } catch (error) {
      logger.error(`ADC setup failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取缓存的访问令牌
   */
  getCachedToken(accountId) {
    const cached = this.authCache.get(accountId);

    if (cached && cached.expiry > Date.now()) {
      return cached.token;
    }

    return null;
  }

  /**
   * 预热授权 - 提前准备授权
   */
  async preheatAuth(accounts) {
    logger.info(`Preheating auth for ${accounts.length} accounts`);

    const promises = accounts.map(account =>
      this.ensureAuthenticated(account).catch(error => {
        logger.error(`Failed to preheat auth for ${account.email}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * 定期检查并修复授权
   */
  startAuthMonitor(accounts) {
    setInterval(() => {
      this.preheatAuth(accounts);
    }, this.authCheckInterval);
  }
}

module.exports = new GCloudAuthManager();