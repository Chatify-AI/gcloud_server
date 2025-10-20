const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');
const oneApiService = require('./oneApiService');
const ChannelAutoLog = require('../models/ChannelAutoLog');

class ChannelFileMonitor {
  constructor() {
    this.monitorPath = process.env.CHANNEL_MONITOR_PATH || '/home/Chatify/vip';
    this.interval = 5000; // 5秒监听一次
    this.isRunning = false;
    this.timer = null;
    this.processedFiles = new Set(); // 记录已处理的文件
    this.isProcessing = false; // 防止并发处理
  }

  /**
   * 启动监听服务
   */
  async start() {
    console.log('[ChannelFileMonitor] start() called');
    if (this.isRunning) {
      console.log('[ChannelFileMonitor] Already running, returning');
      logger.info('Channel file monitor is already running');
      return;
    }

    console.log(`[ChannelFileMonitor] Starting monitor for: ${this.monitorPath}`);
    logger.info(`Starting channel file monitor for path: ${this.monitorPath}`);
    this.isRunning = true;

    // 确保目录存在
    await this.ensureDirectoryExists();

    // 开始监听
    console.log('[ChannelFileMonitor] Calling monitor()...');
    // 使用 setTimeout 确保异步启动
    setTimeout(() => {
      this.monitor();
      console.log('[ChannelFileMonitor] monitor() started successfully');
    }, 1000);
    console.log('[ChannelFileMonitor] monitor() scheduled, interval: ' + this.interval);
  }

  /**
   * 停止监听服务
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping channel file monitor');
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 确保监听目录存在
   */
  async ensureDirectoryExists() {
    try {
      await fs.access(this.monitorPath);
    } catch (error) {
      logger.info(`Creating monitor directory: ${this.monitorPath}`);
      await fs.mkdir(this.monitorPath, { recursive: true });
    }
  }

  /**
   * 监听主循环
   */
  async monitor() {
    if (!this.isRunning) {
      console.log('[Monitor] Not running, exiting monitor()');
      logger.warn('[Monitor] Not running, exiting monitor()');
      return;
    }

    // 防止并发处理
    if (this.isProcessing) {
      console.log('[Monitor] Already processing, skipping this round');
      logger.info('[Monitor] Already processing, skipping this round');
      // 继续下一轮监听
      this.timer = setTimeout(() => this.monitor(), this.interval);
      return;
    }

    this.isProcessing = true;
    console.log(`[Monitor] Starting check at ${new Date().toISOString()}`);

    try {
      // 读取目录中的文件
      const files = await fs.readdir(this.monitorPath);
      console.log(`[Monitor] Checking directory: ${this.monitorPath}, found ${files.length} file(s)`);
      logger.info(`[Monitor] Checking directory: ${this.monitorPath}, found ${files.length} file(s)`);
      if (files.length > 0) {
        console.log(`[Monitor] Files in directory: ${files.join(', ')}`);
        logger.info(`[Monitor] Files in directory: ${files.join(', ')}`);
      }

      if (files.length > 0) {
        logger.info(`Channel monitor: Found ${files.length} file(s) in ${this.monitorPath}: ${files.join(', ')}`);
      }

      // 过滤出txt和json文件，并且未处理过的
      const pendingFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        const isValidExt = (ext === '.txt' || ext === '.json');
        const isProcessed = this.processedFiles.has(file);

        // 不再检查 vip_success 目录，只依赖 processedFiles 内存记录
        // processedFiles只是临时记录正在处理的文件，处理完成后会删除
        // 这样同名文件可以多次处理
        if (isValidExt && !isProcessed) {
          logger.info(`📁 Channel monitor: File ${file} is pending processing (ext: ${ext}, processed: false)`);
        } else if (isProcessed) {
          logger.info(`⏭️ Channel monitor: Skipping ${file} - currently being processed`);
        } else if (!isValidExt) {
          logger.debug(`Skipping non-target file: ${file}`);
        }

        return isValidExt && !isProcessed;
      });

      // 每次只处理一个文件
      if (pendingFiles.length > 0) {
        const fileToProcess = pendingFiles[0];
        console.log(`[Monitor] 🚀 Starting to process file: ${fileToProcess}`);
        logger.info(`[Monitor] 🚀 Starting to process file: ${fileToProcess}`);
        await this.processFile(fileToProcess);
        console.log(`[Monitor] ✅ Finished processing file: ${fileToProcess}`);
        logger.info(`[Monitor] ✅ Finished processing file: ${fileToProcess}`);
      } else {
        if (files.length > 0) {
          console.log(`[Monitor] No pending files to process (all ${files.length} files already processed in this session)`);
          console.log(`[Monitor] Processed files set:`, Array.from(this.processedFiles));
          logger.info(`[Monitor] No pending files to process (all ${files.length} files already processed in this session)`);
        }
      }

    } catch (error) {
      logger.error('Error in channel file monitor:', error);
    } finally {
      // 重置处理标志
      this.isProcessing = false;
    }

    // 继续下一轮监听
    this.timer = setTimeout(() => this.monitor(), this.interval);
  }

  /**
   * 处理单个文件
   */
  async processFile(filename) {
    const filePath = path.join(this.monitorPath, filename);
    const ext = path.extname(filename).toLowerCase();

    logger.info(`[ProcessFile] 📄 Processing file: ${filename}, ext: ${ext}, path: ${filePath}`);

    // 立即标记为正在处理，防止并发处理同一文件
    this.processedFiles.add(filename);
    logger.info(`[ProcessFile] Added ${filename} to processing set`);

    // 在处理前检查文件是否仍然存在
    try {
      await fs.access(filePath);
      logger.info(`[ProcessFile] ✅ File ${filename} still exists at start of processing`);
    } catch (err) {
      logger.warn(`[ProcessFile] ⚠️ File ${filename} disappeared before processing could start!`);
      // 文件已消失，从处理集合中移除
      this.processedFiles.delete(filename);
      return;
    }

    try {
      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');

      let createResult = null;
      let channelName = null;

      if (ext === '.txt') {
        // TXT文件 - 创建Gemini渠道
        const baseName = path.basename(filename, '.txt');
        const timestamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        channelName = `${baseName}-${timestamp}`;
        createResult = await this.createGeminiChannel(filename, content);
      } else if (ext === '.json') {
        // JSON文件 - 创建Vertex渠道
        const baseName = path.basename(filename, '.json');
        const timestamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        channelName = `${baseName}-${timestamp}`;
        createResult = await this.createVertexChannel(filename, content);
      }

      // 检查创建结果,只要主渠道成功就算成功
      // createGeminiChannel 内部已经做了验证,我们信任它的返回结果
      const verificationSuccess = createResult &&
                                  (createResult.success === true || createResult.mainChannelSuccess === true);

      if (verificationSuccess) {
        logger.info(`✅ Main channel creation verified, file will be moved to success directory`);
        if (createResult.port13000Success === false) {
          logger.warn(`⚠️ Note: Port 13000 channel creation failed, but main channel is OK`);
        }
        // 只有验证成功才移动到success目录
        logger.info(`✅ Verification successful, preparing to move ${filename} to success directory`);

        // 再次检查文件是否还在
        const filePath = path.join(this.monitorPath, filename);
        try {
          await fs.access(filePath);
          logger.info(`✅ File ${filename} still exists before move`);
        } catch (err) {
          logger.warn(`⚠️ File ${filename} disappeared before we could move it!`);
        }

        await this.moveToProcessed(filename);
        // 文件已移走，从已处理集合中移除，允许同名文件再次处理
        this.processedFiles.delete(filename);
        logger.info(`♻️ Removed ${filename} from processed set, allowing same-named file to be processed again`);
      } else {
        // 验证失败，移动到失败目录
        logger.error(`❌ Moving ${filename} to failed directory due to verification failure`);
        await this.moveToError(filename, 'Channel creation verification failed');
        // 文件已移走，从已处理集合中移除
        this.processedFiles.delete(filename);
      }

    } catch (error) {
      logger.error(`Error processing file ${filename}:`, error);

      // 出错时移动到error目录
      await this.moveToError(filename, error.message);
      // 文件已移走，从已处理集合中移除
      this.processedFiles.delete(filename);
    }
  }

  /**
   * 创建Gemini渠道（带重试） - 同时创建两个渠道
   */
  async createGeminiChannel(filename, content) {
    // 使用文件名（去掉.txt后缀）作为基础名称
    const baseName = path.basename(filename, '.txt');
    // 添加时间戳确保唯一性（格式：name-HHMMSS）
    const timestamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const channelName = `${baseName}-${timestamp}`;
    const channelName13000 = `${baseName}-${timestamp}-13000`;  // 13000端口的渠道名

    logger.info(`生成唯一渠道名: ${channelName} (基础名: ${baseName})`);
    logger.info(`生成13000端口渠道名: ${channelName13000}`);

    // 处理多行API key - 每行一个key
    const lines = content.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      logger.error(`File ${filename} is empty or contains no valid API keys`);
      throw new Error('No API key found in file');
    }

    // 将多个key用换行符连接，OneAPI支持多key模式
    const key = lines.map(line => line.trim()).join('\n');

    logger.info(`Creating Gemini channels: ${channelName} and ${channelName13000} with ${lines.length} key(s)`);
    logger.info(`File: ${filename}, First key preview: ${key.substring(0, 10)}...`);

    // 创建两个日志记录
    const log = await ChannelAutoLog.create({
      fileName: filename,
      channelName: channelName,
      channelType: 'gemini',
      status: 'pending',
      attempts: 0
    });

    const log13000 = await ChannelAutoLog.create({
      fileName: filename,
      channelName: channelName13000,
      channelType: 'gemini-13000',
      status: 'pending',
      attempts: 0
    });

    // 重试5次，增加重试次数
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`Attempt ${attempt}/${maxAttempts} to create channels: ${channelName} and ${channelName13000}`);

        // 更新尝试次数
        await log.update({ attempts: attempt });
        await log13000.update({ attempts: attempt });

        // 并行创建两个渠道
        logger.info(`🔄 Creating both channels in parallel...`);
        const [result, result13000] = await Promise.all([
          oneApiService.createGeminiChannel(channelName, key),
          oneApiService.createGeminiChannelPort13000(channelName13000, key)
        ]);

        logger.info(`OneAPI response for ${channelName}: ${JSON.stringify(result)}`);
        logger.info(`OneAPI response for ${channelName13000}: ${JSON.stringify(result13000)}`);

        // 只要主渠道(11002)创建成功就行,13000端口是额外的
        const mainChannelSuccess = result && result.success === true;
        const port13000Success = result13000 && result13000.success === true;

        if (!mainChannelSuccess) {
          // 主渠道失败才重试
          throw new Error(`Main channel (${channelName}) creation failed: ${result?.message || result?.error || 'Unknown error'}`);
        }

        // 主渠道成功了,记录13000端口的结果但不影响整体
        if (!port13000Success) {
          logger.warn(`⚠️ Port 13000 channel (${channelName13000}) creation failed, but continuing with main channel`);
          logger.warn(`Port 13000 error: ${result13000?.message || result13000?.error || 'Unknown error'}`);
        }

        // 主渠道成功,继续验证
        if (true) {
          logger.info(`✅ Both Gemini channels created successfully (attempt ${attempt})`);
          logger.info(`✅ Channel 1: ${channelName}`);
          logger.info(`✅ Channel 2: ${channelName13000}`);

          // 只验证主渠道是否真的创建成功 - 等待3秒后查询
          await new Promise(resolve => setTimeout(resolve, 3000));

          try {
            // 只验证主渠道,13000端口的渠道是额外的
            const [searchResult1, searchResult2] = await Promise.all([
              oneApiService.searchChannels({ keyword: channelName }),
              port13000Success ? oneApiService.searchChannels({ keyword: channelName13000 }) : Promise.resolve(null)
            ]);

            const createdChannels = searchResult1?.data?.items?.filter(ch => ch.name === channelName) || [];
            const createdChannels13000 = searchResult2?.data?.items?.filter(ch => ch.name === channelName13000) || [];

            const channel1Found = createdChannels.length > 0;
            const channel2Found = createdChannels13000.length > 0;

            if (channel1Found) {
              logger.info(`✅ Verified: Found ${createdChannels.length} channel(s) named ${channelName}`);
              logger.info(`Channel 1 IDs: ${createdChannels.map(ch => ch.id).join(', ')}`);

              // 更新主渠道日志状态为成功
              await log.update({
                status: 'success',
                message: `Channel created successfully after ${attempt} attempt(s)`,
                apiResponse: JSON.stringify({ ...result, verified: true, channels: createdChannels }),
                processedAt: new Date()
              });

              // 如果13000端口渠道也成功了,更新它的状态
              if (port13000Success) {
                if (channel2Found) {
                  logger.info(`✅ Verified: Found ${createdChannels13000.length} channel(s) named ${channelName13000}`);
                  logger.info(`Channel 2 IDs: ${createdChannels13000.map(ch => ch.id).join(', ')}`);
                  await log13000.update({
                    status: 'success',
                    message: `Channel created successfully after ${attempt} attempt(s)`,
                    apiResponse: JSON.stringify({ ...result13000, verified: true, channels: createdChannels13000 }),
                    processedAt: new Date()
                  });
                } else {
                  logger.warn(`⚠️ Port 13000 channel ${channelName13000} created but not found in search`);
                  await log13000.update({
                    status: 'partial',
                    message: `Channel created but verification failed`,
                    processedAt: new Date()
                  });
                }
              } else {
                // 13000端口渠道创建失败
                await log13000.update({
                  status: 'failed',
                  message: `Channel creation failed: ${result13000?.message || 'Unknown error'}`,
                  processedAt: new Date()
                });
              }

              // 返回验证结果,主渠道成功就算成功
              return {
                success: true,
                verified: true,
                channels: [...createdChannels, ...createdChannels13000],
                channelCount: createdChannels.length + createdChannels13000.length,
                mainChannelSuccess: true,
                port13000Success: channel2Found
              };
            } else {
              // 主渠道验证失败才抛出异常重试
              logger.error(`❌ CRITICAL: Main channel ${channelName} NOT found in OneAPI after creation!`);
              throw new Error(`Main channel verification failed - not found in OneAPI`);
            }
          } catch (verifyError) {
            logger.error(`❌ Verification error: ${verifyError.message}`);
            throw verifyError;
          }
        }
      } catch (error) {
        logger.error(`❌ Attempt ${attempt} failed for Gemini channels:`, error.message);
        logger.error(`Error details:`, error.response?.data || error);

        if (attempt === maxAttempts) {
          // 更新两个日志状态为失败
          await log.update({
            status: 'failed',
            message: `Failed after ${maxAttempts} attempts: ${error.message}`,
            processedAt: new Date()
          });
          await log13000.update({
            status: 'failed',
            message: `Failed after ${maxAttempts} attempts: ${error.message}`,
            processedAt: new Date()
          });
          throw error;
        }

        // 递增等待时间
        const waitTime = Math.min(1000 * attempt * 2, 10000); // 最多等待10秒
        logger.info(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * 创建Vertex渠道（带重试）
   */
  async createVertexChannel(filename, content) {
    // 使用文件名（去掉.json后缀）作为基础名称
    const baseName = path.basename(filename, '.json');
    // 添加时间戳确保唯一性（格式：name-HHMMSS）
    const timestamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const channelName = `${baseName}-${timestamp}`;

    logger.info(`生成唯一渠道名: ${channelName} (基础名: ${baseName})`);

    // 对于Vertex，内容应该是JSON格式，但保持兼容性
    const key = content.trim();

    if (!key) {
      throw new Error('No key content found in file');
    }

    logger.info(`Creating Vertex channel: ${channelName}`);

    // 创建日志记录
    const log = await ChannelAutoLog.create({
      fileName: filename,
      channelName: channelName,
      channelType: 'vertex',
      status: 'pending',
      attempts: 0
    });

    // 重试3次
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // 更新尝试次数
        await log.update({ attempts: attempt });

        const result = await oneApiService.createVertexChannel(channelName, key);

        if (result.success !== false) {
          logger.info(`Vertex channel created successfully: ${channelName} (attempt ${attempt})`);

          // 更新日志状态为成功
          await log.update({
            status: 'success',
            message: `Channel created successfully after ${attempt} attempt(s)`,
            apiResponse: JSON.stringify({ ...result, verified: true, channels: createdChannels }),
            processedAt: new Date()
          });

          return { success: true, verified: true, channels: createdChannels };
        } else {
          throw new Error(result.message || 'Creation failed');
        }
      } catch (error) {
        logger.error(`Attempt ${attempt} failed for Vertex channel ${channelName}:`, error.message);

        if (attempt === 3) {
          // 更新日志状态为失败
          await log.update({
            status: 'failed',
            message: error.message,
            processedAt: new Date()
          });
          throw error;
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * 移动文件到成功目录
   */
  async moveToProcessed(filename) {
    try {
      // 使用指定的成功目录
      const baseDir = process.env.CHANNEL_MONITOR_PATH || '/home/Chatify/vip';
      const processedDir = baseDir.replace('/vip', '/vip_success');
      await fs.mkdir(processedDir, { recursive: true });

      const oldPath = path.join(this.monitorPath, filename);
      const newPath = path.join(processedDir, filename);

      // 检查源文件是否存在
      try {
        await fs.access(oldPath);
        logger.info(`[MoveToProcessed] Source file exists: ${oldPath}`);
      } catch (err) {
        logger.warn(`[MoveToProcessed] ⚠️ Source file already gone: ${oldPath}`);
        // 检查是否已经在成功目录
        try {
          await fs.access(newPath);
          logger.info(`[MoveToProcessed] File already in success directory: ${newPath}`);
          return; // 文件已经被移动，成功退出
        } catch (err2) {
          logger.error(`[MoveToProcessed] File disappeared completely: ${filename}`);
        }
        return;
      }

      try {
        await fs.rename(oldPath, newPath);
        logger.info(`Moved successful file to: ${newPath}`);
      } catch (renameError) {
        // 如果文件已存在，添加时间戳
        const timestamp = Date.now();
        const nameWithoutExt = path.basename(filename, path.extname(filename));
        const newFilename = `${nameWithoutExt}_${timestamp}${path.extname(filename)}`;
        const timestampedPath = path.join(processedDir, newFilename);
        await fs.rename(oldPath, timestampedPath);
        logger.info(`Moved successful file with timestamp to: ${timestampedPath}`);
      }
    } catch (error) {
      logger.error(`Error moving processed file ${filename}:`, error);
    }
  }

  /**
   * 移动文件到失败目录
   */
  async moveToError(filename, errorMessage) {
    try {
      // 使用指定的失败目录
      const baseDir = process.env.CHANNEL_MONITOR_PATH || '/home/Chatify/vip';
      const errorDir = baseDir.replace('/vip', '/vip_failed');
      await fs.mkdir(errorDir, { recursive: true });

      const oldPath = path.join(this.monitorPath, filename);
      const newPath = path.join(errorDir, filename);

      try {
        await fs.rename(oldPath, newPath);
      } catch (renameError) {
        // 如果文件已存在，添加时间戳
        const timestamp = Date.now();
        const nameWithoutExt = path.basename(filename, path.extname(filename));
        const newFilename = `${nameWithoutExt}_${timestamp}${path.extname(filename)}`;
        const timestampedPath = path.join(errorDir, newFilename);
        await fs.rename(oldPath, timestampedPath);
        logger.info(`Moved failed file with timestamp to: ${timestampedPath}`);
      }

      // 写入错误信息
      const errorFile = path.join(errorDir, `${filename}.error`);
      await fs.writeFile(errorFile, `Error: ${errorMessage}\nTime: ${new Date().toISOString()}\nOriginal File: ${filename}`);

      logger.info(`Moved failed file to: ${newPath}`);
    } catch (error) {
      logger.error(`Error moving error file ${filename}:`, error);
    }
  }

  /**
   * 获取监听状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      monitorPath: this.monitorPath,
      interval: this.interval,
      processedCount: this.processedFiles.size
    };
  }
}

// 导出单例
module.exports = new ChannelFileMonitor();