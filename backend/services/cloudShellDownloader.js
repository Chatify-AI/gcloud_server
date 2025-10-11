const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Cloud Shell文件下载服务
 * 用于当FTP上传失败时，从Cloud Shell下载密钥文件到本地vip目录
 */
class CloudShellDownloader {
  constructor() {
    this.vipDir = process.env.VIP_DIR || path.join(__dirname, '../../vip');
    this.downloadTimeout = 120000; // 2分钟超时
  }

  /**
   * 从Cloud Shell下载文件
   * @param {Object} account - GCloud账户对象
   * @param {string} remoteDir - Cloud Shell中的远程目录路径
   * @param {Array<string>} fileNames - 要下载的文件名数组
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFromCloudShell(account, remoteDir, fileNames) {
    if (!account || !account.configDir || !fileNames || fileNames.length === 0) {
      logger.error('Invalid parameters for Cloud Shell download');
      return { success: false, downloaded: [], failed: fileNames || [] };
    }

    logger.info(`Starting Cloud Shell download for account ${account.email}`);
    logger.info(`Remote directory: ${remoteDir}, Files: ${fileNames.join(', ')}`);

    // 确保本地vip目录存在
    try {
      await fs.mkdir(this.vipDir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create vip directory: ${error.message}`);
      return { success: false, downloaded: [], failed: fileNames };
    }

    const results = {
      success: false,
      downloaded: [],
      failed: [],
      errors: []
    };

    // 逐个下载文件
    for (const fileName of fileNames) {
      try {
        const remotePath = `${remoteDir}/${fileName}`.replace(/\/+/g, '/');
        const localPath = path.join(this.vipDir, fileName);

        logger.info(`Downloading ${fileName} from Cloud Shell for ${account.email}...`);
        logger.info(`Remote path: cloudshell:${remotePath}`);
        logger.info(`Local path: ${localPath}`);

        // 使用gcloud cloud-shell scp命令下载文件（参考现有实现）
        // 格式：CLOUDSDK_CONFIG="..." gcloud cloud-shell scp --authorize-session cloudshell:path localpath
        const projectFlag = account.projectId ? `--project="${account.projectId}"` : '';
        const command = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell scp --authorize-session ${projectFlag} "cloudshell:${remotePath}" "${localPath}"`;

        logger.debug(`Executing command: ${command}`);

        const { stdout, stderr } = await execAsync(command, {
          timeout: this.downloadTimeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          env: {
            ...process.env,
            CLOUDSDK_CONFIG: account.configDir
          }
        });

        // 检查文件是否成功下载
        try {
          await fs.access(localPath);
          const stats = await fs.stat(localPath);

          if (stats.size > 0) {
            results.downloaded.push(fileName);
            logger.info(`Successfully downloaded ${fileName} (${stats.size} bytes)`);
          } else {
            throw new Error('Downloaded file is empty');
          }
        } catch (checkError) {
          throw new Error(`File verification failed: ${checkError.message}`);
        }

      } catch (error) {
        results.failed.push(fileName);
        results.errors.push({
          fileName,
          error: error.message
        });
        logger.error(`Failed to download ${fileName}: ${error.message}`);
      }
    }

    results.success = results.downloaded.length > 0;

    logger.info(`Cloud Shell download completed: ${results.downloaded.length} succeeded, ${results.failed.length} failed`);

    return results;
  }

  /**
   * 解析脚本输出中的下载信息
   * @param {string} scriptOutput - 脚本输出
   * @returns {Object|null} 解析的下载信息
   */
  parseDownloadInfo(scriptOutput) {
    if (!scriptOutput) return null;

    try {
      // 查找DOWNLOAD_INFO标记
      const startMarker = '=== DOWNLOAD_INFO_START ===';
      const endMarker = '=== DOWNLOAD_INFO_END ===';

      const startIndex = scriptOutput.indexOf(startMarker);
      const endIndex = scriptOutput.indexOf(endMarker);

      if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        return null;
      }

      // 提取标记之间的内容
      const infoSection = scriptOutput.substring(startIndex + startMarker.length, endIndex);

      // 解析信息
      const lines = infoSection.split('\n').map(line => line.trim()).filter(line => line);

      const info = {
        keysDir: null,
        failedCount: 0,
        failedFiles: []
      };

      for (const line of lines) {
        // 移除日志前缀（如果有）
        const cleanLine = line.replace(/\[.*?\]\s*\[INFO\]\s*/g, '');

        if (cleanLine.startsWith('KEYS_DIR=')) {
          info.keysDir = cleanLine.substring('KEYS_DIR='.length).trim();
        } else if (cleanLine.startsWith('FAILED_COUNT=')) {
          info.failedCount = parseInt(cleanLine.substring('FAILED_COUNT='.length).trim()) || 0;
        } else if (cleanLine.startsWith('FAILED_FILE=')) {
          info.failedFiles.push(cleanLine.substring('FAILED_FILE='.length).trim());
        }
      }

      // 验证解析结果
      if (info.keysDir && info.failedFiles.length > 0) {
        logger.info(`Parsed download info: ${info.failedFiles.length} files need download from ${info.keysDir}`);
        return info;
      }

      return null;
    } catch (error) {
      logger.error(`Error parsing download info: ${error.message}`);
      return null;
    }
  }

  /**
   * 处理FTP失败后的文件下载
   * @param {Object} account - GCloud账户对象
   * @param {string} scriptOutput - 脚本输出
   * @returns {Promise<Object>} 下载结果
   */
  async handleFtpFailure(account, scriptOutput) {
    logger.info(`Checking for FTP failure and download requirements for account ${account.email}`);

    // 解析下载信息
    const downloadInfo = this.parseDownloadInfo(scriptOutput);

    if (!downloadInfo) {
      logger.info('No download info found in script output');
      return { success: false, reason: 'no_download_info' };
    }

    logger.info(`FTP upload failed for ${downloadInfo.failedFiles.length} files, attempting Cloud Shell download`);

    // 从Cloud Shell下载文件
    const downloadResult = await this.downloadFromCloudShell(
      account,
      downloadInfo.keysDir,
      downloadInfo.failedFiles
    );

    if (downloadResult.success) {
      logger.info(`Successfully recovered ${downloadResult.downloaded.length} files from Cloud Shell`);
    } else {
      logger.error(`Failed to recover files from Cloud Shell: ${downloadResult.failed.length} files failed`);
    }

    return downloadResult;
  }
}

module.exports = new CloudShellDownloader();
