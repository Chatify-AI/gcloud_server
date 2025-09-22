const { spawn, exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const util = require('util');
const logger = require('../src/utils/logger');
const { CommandExecution, GCloudAccount } = require('../models');
const gcloudAuth = require('./gcloudAuth');

const execPromise = util.promisify(exec);

class GCloudExecutor {
  constructor() {
    this.activeExecutions = new Map();
  }

  /**
   * Execute a gcloud command with a specific account
   */
  async executeCommand(adminUsername, accountId, command, options = {}) {
    const executionId = uuidv4();

    const execution = await CommandExecution.create({
      id: executionId,
      executedBy: adminUsername,
      accountId,
      command,
      status: 'pending'
    });

    const account = await GCloudAccount.findByPk(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // Check if account has configDir (new gcloud auth method)
    if (!account.configDir) {
      throw new Error('Account not properly configured. Please re-authenticate.');
    }

    if (options.async) {
      this._executeAsync(execution, account, command);
      return { executionId, status: 'started' };
    } else {
      return await this._executeSync(execution, account, command);
    }
  }

  async _executeSync(execution, account, command) {
    return new Promise(async (resolve, reject) => {
      try {
        await execution.update({
          status: 'running',
          startedAt: new Date()
        });

        // Build the full gcloud command with the account's configuration
        const fullCommand = `CLOUDSDK_CONFIG="${account.configDir}" gcloud ${command}`;

        // Add project flag if account has a project set
        const projectFlag = account.projectId ? ` --project="${account.projectId}"` : '';
        const finalCommand = fullCommand + projectFlag;

        const child = spawn('sh', ['-c', finalCommand], {
          env: {
            ...process.env,
            CLOUDSDK_CONFIG: account.configDir
          }
        });

        let output = '';
        let error = '';

        this.activeExecutions.set(execution.id, child);

        child.stdout.on('data', (data) => {
          output += data.toString();
        });

        child.stderr.on('data', (data) => {
          const errorStr = data.toString();
          // Filter out non-error warnings
          if (!errorStr.includes('WARNING:') && !errorStr.includes('Updated property')) {
            error += errorStr;
          }
        });

        child.on('close', async (code) => {
          this.activeExecutions.delete(execution.id);

          const completedAt = new Date();
          const executionTime = completedAt - execution.startedAt;

          await execution.update({
            status: code === 0 ? 'completed' : 'failed',
            output,
            error,
            completedAt,
            executionTime
          });

          if (code === 0) {
            resolve({
              executionId: execution.id,
              status: 'completed',
              output,
              executionTime
            });
          } else {
            reject(new Error(`Command failed: ${error || 'Unknown error'}`));
          }
        });

      } catch (error) {
        await execution.update({
          status: 'failed',
          error: error.message,
          completedAt: new Date()
        });
        reject(error);
      }
    });
  }

  async _executeAsync(execution, account, command) {
    try {
      await execution.update({
        status: 'running',
        startedAt: new Date()
      });

      // Build the full gcloud command with the account's configuration
      const fullCommand = `CLOUDSDK_CONFIG="${account.configDir}" gcloud ${command}`;

      // Add project flag if account has a project set
      const projectFlag = account.projectId ? ` --project="${account.projectId}"` : '';
      const finalCommand = fullCommand + projectFlag;

      const child = spawn('sh', ['-c', finalCommand], {
        env: {
          ...process.env,
          CLOUDSDK_CONFIG: account.configDir
        }
      });

      let output = '';
      let error = '';

      this.activeExecutions.set(execution.id, child);

      child.stdout.on('data', async (data) => {
        output += data.toString();
        // Update periodically, not on every data chunk for performance
        if (output.length % 1000 === 0) {
          await execution.update({ output });
        }
      });

      child.stderr.on('data', async (data) => {
        const errorStr = data.toString();
        if (!errorStr.includes('WARNING:') && !errorStr.includes('Updated property')) {
          error += errorStr;
          if (error.length % 1000 === 0) {
            await execution.update({ error });
          }
        }
      });

      child.on('close', async (code) => {
        this.activeExecutions.delete(execution.id);

        const completedAt = new Date();
        const executionTime = completedAt - execution.startedAt;

        await execution.update({
          status: code === 0 ? 'completed' : 'failed',
          output,
          error,
          completedAt,
          executionTime
        });
      });

    } catch (error) {
      await execution.update({
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      });
    }
  }

  async getExecutionStatus(executionId) {
    const execution = await CommandExecution.findByPk(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }
    return execution;
  }

  async streamExecution(executionId, onData, onError, onClose) {
    const execution = await CommandExecution.findByPk(executionId, {
      include: ['account']
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status === 'completed' || execution.status === 'failed') {
      onData(execution.output || '');
      onClose();
      return;
    }

    const child = this.activeExecutions.get(executionId);
    if (!child) {
      throw new Error('Execution not running');
    }

    child.stdout.on('data', (data) => {
      onData(data.toString());
    });

    child.stderr.on('data', (data) => {
      const errorStr = data.toString();
      if (!errorStr.includes('WARNING:') && !errorStr.includes('Updated property')) {
        onError(errorStr);
      }
    });

    child.on('close', () => {
      onClose();
    });
  }

  async cancelExecution(executionId) {
    const child = this.activeExecutions.get(executionId);
    if (child) {
      child.kill('SIGTERM');
      // Give it a moment to terminate gracefully, then force kill if needed
      setTimeout(() => {
        if (this.activeExecutions.has(executionId)) {
          child.kill('SIGKILL');
        }
      }, 5000);

      this.activeExecutions.delete(executionId);

      await CommandExecution.update(
        {
          status: 'cancelled',
          completedAt: new Date()
        },
        { where: { id: executionId } }
      );

      return true;
    }
    return false;
  }

  /**
   * Execute a command in Cloud Shell
   * Cloud Shell provides a managed VM with gcloud pre-installed
   */
  /**
   * Sync gcloud auth files to Cloud Shell
   */
  async syncAuthToCloudShell(account) {
    try {
      logger.info(`Syncing auth files to Cloud Shell for ${account.email}`);

      // 构建 scp 命令，将本地的授权文件同步到 Cloud Shell
      const localAuthPath = `${account.configDir}/credentials.db`;
      const localConfigPath = `${account.configDir}/configurations/config_default`;
      const localADCPath = `${account.configDir}/application_default_credentials.json`;

      // 创建远程目录
      const mkdirCommand = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session ${account.projectId ? `--project="${account.projectId}"` : ''} --command="mkdir -p ~/.config/gcloud/configurations ~/.config/gcloud"`;

      await execPromise(mkdirCommand);

      // 同步文件的命令数组
      const syncCommands = [];

      // 检查本地文件是否存在并添加同步命令
      const fs = require('fs');

      if (fs.existsSync(localAuthPath)) {
        syncCommands.push(
          `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell scp --authorize-session ${account.projectId ? `--project="${account.projectId}"` : ''} "${localAuthPath}" cloudshell:~/.config/gcloud/credentials.db`
        );
      }

      if (fs.existsSync(localConfigPath)) {
        syncCommands.push(
          `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell scp --authorize-session ${account.projectId ? `--project="${account.projectId}"` : ''} "${localConfigPath}" cloudshell:~/.config/gcloud/configurations/config_default`
        );
      }

      if (fs.existsSync(localADCPath)) {
        syncCommands.push(
          `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell scp --authorize-session ${account.projectId ? `--project="${account.projectId}"` : ''} "${localADCPath}" cloudshell:~/.config/gcloud/application_default_credentials.json`
        );
      }

      // 执行同步命令
      for (const cmd of syncCommands) {
        try {
          await execPromise(cmd, { timeout: 30000 });
          logger.info(`Successfully synced auth file: ${cmd.split(' ').pop()}`);
        } catch (error) {
          logger.warn(`Failed to sync auth file: ${error.message}`);
        }
      }

      // 设置账户配置
      const setAccountCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session ${account.projectId ? `--project="${account.projectId}"` : ''} --command="gcloud config set account ${account.email} && ${account.projectId ? `gcloud config set project ${account.projectId}` : 'true'}"`;

      await execPromise(setAccountCmd, { timeout: 30000 });

      logger.info(`Auth sync completed for ${account.email}`);
      return true;
    } catch (error) {
      logger.error(`Failed to sync auth to Cloud Shell: ${error.message}`);
      return false;
    }
  }

  async executeCloudShellCommand(adminUsername, accountId, shellCommand, options = {}) {
    const account = await GCloudAccount.findByPk(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (!account.configDir) {
      throw new Error('Account not properly configured. Please re-authenticate.');
    }

    // 如果开启了授权同步选项，先同步授权文件并确保授权成功
    if (options.syncAuth !== false) {
      try {
        logger.info(`Ensuring authentication for ${account.email} before executing command`);

        // 1. 先同步授权文件
        await this.syncAuthToCloudShell(account);

        // 2. 验证授权状态
        const authCheckResult = await this.verifyCloudShellAuth(account);

        if (!authCheckResult.authenticated) {
          logger.warn(`Account ${account.email} not authenticated in Cloud Shell, attempting to fix...`);

          // 3. 尝试多种授权方法
          const authFixed = await this.ensureCloudShellAuth(account);

          if (!authFixed) {
            throw new Error(`Failed to authenticate account ${account.email} in Cloud Shell`);
          }
        }

        logger.info(`Authentication verified for ${account.email}`);
      } catch (error) {
        logger.error(`Auth sync/verification failed: ${error.message}`);

        // 如果是公共API调用，授权失败应该抛出错误
        if (adminUsername === 'public-api') {
          throw new Error(`Authentication required: ${error.message}`);
        }

        // 其他情况记录警告但继续执行
        logger.warn(`Continuing despite auth failure for non-public API call`);
      }
    }

    const executionId = uuidv4();
    const execution = await CommandExecution.create({
      id: executionId,
      executedBy: adminUsername,
      accountId,
      command: `cloud-shell ssh --command="${shellCommand}"`,
      status: options.async ? 'pending' : 'running',
      startedAt: new Date()
    });

    // 如果是异步模式，立即返回executionId，后台执行命令
    if (options.async) {
      this._executeCloudShellAsync(execution, account, shellCommand);
      return {
        executionId,
        status: 'started',
        message: 'Command execution started in background'
      };
    }

    // 同步模式，等待执行完成
    return new Promise((resolve, reject) => {
      let output = '';
      let error = '';

      // Build cloud-shell ssh command - 在Cloud Shell中先设置账户和确保授权
      // 将多个命令组合，确保在Cloud Shell环境中先设置账户
      const cloudShellCommands = `
        mkdir -p ~/.config/gcloud
        gcloud config set account ${account.email} 2>/dev/null
        ${account.projectId ? `gcloud config set project ${account.projectId} 2>/dev/null` : 'true'}
        gcloud auth list 2>/dev/null | grep -q "^\\*.*${account.email}" || gcloud auth login ${account.email} --brief --quiet 2>/dev/null || true
        ${shellCommand}
      `.trim().replace(/\n\s+/g, ' && ');

      let gcloudCommand = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session`;

      if (account.projectId) {
        gcloudCommand += ` --project="${account.projectId}"`;
      }

      gcloudCommand += ` --command="${cloudShellCommands.replace(/"/g, '\\"')}"`;

      const child = spawn('sh', ['-c', gcloudCommand], {
        env: {
          ...process.env,
          CLOUDSDK_CONFIG: account.configDir
        }
      });

      this.activeExecutions.set(executionId, child);

      child.stdout.on('data', async (data) => {
        output += data.toString();

        // 检测结算账户错误
        if (output.includes('[ERROR] 未找到可用的结算账户，请确保已设置有效的结算账户') ||
            output.includes('billing account') && output.includes('not found') ||
            output.includes('No billing account found')) {

          logger.warn(`Detected billing account error for ${account.email}, disabling monitoring`);

          // 自动禁用该账号的监听
          try {
            await account.update({
              needMonitor: false,
              lastMonitorTime: new Date()
            });

            logger.info(`Successfully disabled monitoring for ${account.email} due to billing account error`);

            // 记录到监控日志
            const { GCloudMonitorLog } = require('../models');
            await GCloudMonitorLog.create({
              accountId: account.id,
              accountEmail: account.email,
              monitorStatus: 'disabled',
              message: 'Monitoring disabled due to billing account error',
              metadata: {
                reason: 'billing_error',
                errorMessage: '[ERROR] 未找到可用的结算账户，请确保已设置有效的结算账户',
                disabledAt: new Date()
              }
            });
          } catch (updateError) {
            logger.error(`Failed to disable monitoring for ${account.email}:`, updateError);
          }
        }

        // 同步模式也要实时更新输出
        await execution.update({
          output: output
        });
      });

      child.stderr.on('data', async (data) => {
        const errorStr = data.toString();
        if (!errorStr.includes('WARNING:') &&
            !errorStr.includes('Updated property') &&
            !errorStr.includes('Connecting to Cloud Shell')) {
          error += errorStr;

          // 同步模式也要实时更新错误
          await execution.update({
            error: error
          });
        }
      });

      child.on('close', async (code) => {
        this.activeExecutions.delete(executionId);

        const completedAt = new Date();
        const executionTime = completedAt - execution.startedAt;

        await execution.update({
          status: code === 0 ? 'completed' : 'failed',
          output,
          error,
          completedAt,
          executionTime
        });

        if (code === 0) {
          resolve({
            executionId,
            output,
            executionTime
          });
        } else {
          reject(new Error(error || 'Cloud Shell command execution failed'));
        }
      });

      // Add timeout for cloud shell commands (they can hang)
      setTimeout(() => {
        if (this.activeExecutions.has(executionId)) {
          child.kill();
          reject(new Error('Cloud Shell command timed out after 20 minutes'));
        }
      }, 20 * 60 * 1000); // 20 minutes
    });
  }

  /**
   * Execute Cloud Shell command asynchronously in the background
   */
  async _executeCloudShellAsync(execution, account, shellCommand) {
    return new Promise((resolve) => {
      let output = '';
      let error = '';

      // Update status to running
      execution.update({ status: 'running' });

      // Build cloud-shell ssh command - 在Cloud Shell中先设置账户和确保授权
      // 将多个命令组合，确保在Cloud Shell环境中先设置账户
      const cloudShellCommands = `
        mkdir -p ~/.config/gcloud
        gcloud config set account ${account.email} 2>/dev/null
        ${account.projectId ? `gcloud config set project ${account.projectId} 2>/dev/null` : 'true'}
        gcloud auth list 2>/dev/null | grep -q "^\\*.*${account.email}" || gcloud auth login ${account.email} --brief --quiet 2>/dev/null || true
        ${shellCommand}
      `.trim().replace(/\n\s+/g, ' && ');

      let gcloudCommand = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session`;

      if (account.projectId) {
        gcloudCommand += ` --project="${account.projectId}"`;
      }

      gcloudCommand += ` --command="${cloudShellCommands.replace(/"/g, '\\"')}"`;

      const child = spawn('sh', ['-c', gcloudCommand], {
        env: {
          ...process.env,
          CLOUDSDK_CONFIG: account.configDir
        }
      });

      this.activeExecutions.set(execution.id, child);

      child.stdout.on('data', async (data) => {
        output += data.toString();

        // 检测结算账户错误
        if (output.includes('[ERROR] 未找到可用的结算账户，请确保已设置有效的结算账户') ||
            output.includes('billing account') && output.includes('not found') ||
            output.includes('No billing account found')) {

          logger.warn(`Detected billing account error for ${account.email} in async execution, disabling monitoring`);

          // 自动禁用该账号的监听
          try {
            await account.update({
              needMonitor: false,
              lastMonitorTime: new Date()
            });

            logger.info(`Successfully disabled monitoring for ${account.email} due to billing account error (async)`);

            // 记录到监控日志
            const { GCloudMonitorLog } = require('../models');
            await GCloudMonitorLog.create({
              accountId: account.id,
              accountEmail: account.email,
              monitorStatus: 'disabled',
              message: 'Monitoring disabled due to billing account error (async execution)',
              metadata: {
                reason: 'billing_error',
                errorMessage: '[ERROR] 未找到可用的结算账户，请确保已设置有效的结算账户',
                disabledAt: new Date(),
                executionId: execution.id
              }
            });
          } catch (updateError) {
            logger.error(`Failed to disable monitoring for ${account.email} (async):`, updateError);
          }
        }

        // 实时更新输出到CommandExecution记录
        await execution.update({
          output: output
        });

        // 实时更新输出到ExecutionHistory（每次有新输出时）
        const { ExecutionHistory } = require('../models');
        const historyRecord = await ExecutionHistory.findOne({
          where: { executionId: execution.id }
        });

        if (historyRecord) {
          await historyRecord.update({
            output: output,
            metadata: {
              ...historyRecord.metadata,
              lastOutputUpdate: new Date().toISOString(),
              outputLength: output.length
            }
          });
        }
      });

      child.stderr.on('data', async (data) => {
        const errorStr = data.toString();
        if (!errorStr.includes('WARNING:') &&
            !errorStr.includes('Updated property') &&
            !errorStr.includes('Connecting to Cloud Shell')) {
          error += errorStr;

          // 实时更新错误信息到CommandExecution记录
          await execution.update({
            error: error
          });

          // 实时更新错误信息到ExecutionHistory
          const { ExecutionHistory } = require('../models');
          const historyRecord = await ExecutionHistory.findOne({
            where: { executionId: execution.id }
          });

          if (historyRecord) {
            await historyRecord.update({
              error: error,
              metadata: {
                ...historyRecord.metadata,
                lastErrorUpdate: new Date().toISOString()
              }
            });
          }
        }
      });

      child.on('close', async (code) => {
        this.activeExecutions.delete(execution.id);

        const completedAt = new Date();
        const executionTime = completedAt - execution.startedAt;

        await execution.update({
          status: code === 0 ? 'completed' : 'failed',
          output,
          error,
          completedAt,
          executionTime
        });

        // 检查输出中是否包含结算账户错误（异步执行完成时）
        const fullOutput = output + error;

        if (fullOutput.includes('[ERROR] 未找到可用的结算账户') ||
            fullOutput.includes('未找到可用的结算账户，请确保已设置有效的结算账户') ||
            (fullOutput.includes('billing account') && fullOutput.includes('not found')) ||
            fullOutput.includes('No billing account found')) {

          logger.warn(`Detected billing account error for ${account.email} in async execution completion, disabling monitoring`);

          try {
            await account.update({
              needMonitor: false,
              lastMonitorTime: new Date()
            });

            logger.info(`Successfully disabled monitoring for ${account.email} due to billing account error (async completion)`);

            // 记录到监控日志
            const { GCloudMonitorLog } = require('../models');
            await GCloudMonitorLog.create({
              accountId: account.id,
              accountEmail: account.email,
              monitorStatus: 'disabled',
              message: 'Monitoring disabled due to billing account error (async execution)',
              metadata: {
                reason: 'billing_error',
                errorMessage: '[ERROR] 未找到可用的结算账户，请确保已设置有效的结算账户',
                disabledAt: new Date(),
                executionId: execution.id
              }
            });
          } catch (updateError) {
            logger.error(`Failed to disable monitoring for ${account.email} (async):`, updateError);
          }
        }

        // 同时更新ExecutionHistory记录（如果存在）
        const { ExecutionHistory } = require('../models');
        const historyRecord = await ExecutionHistory.findOne({
          where: { executionId: execution.id }
        });

        if (historyRecord) {
          await historyRecord.update({
            status: code === 0 ? 'completed' : 'failed',
            output,
            error,
            completedAt,
            executionTime
          });
          logger.info(`Updated ExecutionHistory for async command: ${execution.id}`);
        }

        logger.info(`Cloud Shell async command completed: ${execution.id}`, {
          executionId: execution.id,
          status: code === 0 ? 'completed' : 'failed',
          executionTime
        });
      });

      // Add timeout for cloud shell commands (they can hang)
      setTimeout(async () => {
        if (this.activeExecutions.has(execution.id)) {
          child.kill();
          const timeoutError = 'Cloud Shell command timed out after 20 minutes';
          const completedAt = new Date();
          const executionTime = completedAt - execution.startedAt;

          await execution.update({
            status: 'failed',
            error: timeoutError,
            completedAt,
            executionTime
          });

          // 同时更新ExecutionHistory记录（如果存在）
          const { ExecutionHistory } = require('../models');
          const historyRecord = await ExecutionHistory.findOne({
            where: { executionId: execution.id }
          });

          if (historyRecord) {
            await historyRecord.update({
              status: 'failed',
              error: timeoutError,
              completedAt,
              executionTime
            });
            logger.info(`Updated ExecutionHistory for timed out command: ${execution.id}`);
          }
        }
      }, 20 * 60 * 1000); // 20 minutes

      // Immediately resolve since this is async
      resolve();
    });
  }

  /**
   * List all available projects for an account
   */
  async listProjects(accountId) {
    const account = await GCloudAccount.findByPk(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (!account.configDir) {
      throw new Error('Account not properly configured');
    }

    try {
      const { stdout } = await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud projects list --format=json`,
        {
          env: {
            ...process.env,
            CLOUDSDK_CONFIG: account.configDir
          }
        }
      );

      return JSON.parse(stdout || '[]');
    } catch (error) {
      console.error('Error listing projects:', error);
      throw new Error('Failed to list projects');
    }
  }

  /**
   * Get current active configuration for an account
   */
  async getAccountConfig(accountId) {
    const account = await GCloudAccount.findByPk(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (!account.configDir) {
      return {
        account: account.email,
        project: null,
        region: null,
        zone: null
      };
    }

    try {
      const { stdout } = await execPromise(
        `CLOUDSDK_CONFIG="${account.configDir}" gcloud config list --format=json`,
        {
          env: {
            ...process.env,
            CLOUDSDK_CONFIG: account.configDir
          }
        }
      );

      const config = JSON.parse(stdout || '{}');
      return {
        account: config.core?.account || account.email,
        project: config.core?.project || null,
        region: config.compute?.region || null,
        zone: config.compute?.zone || null
      };
    } catch (error) {
      console.error('Error getting account config:', error);
      return {
        account: account.email,
        project: null,
        region: null,
        zone: null
      };
    }
  }

  /**
   * 验证 Cloud Shell 中的授权状态
   */
  async verifyCloudShellAuth(account) {
    try {
      logger.info(`Verifying Cloud Shell auth for ${account.email}`);

      // 执行一个简单的命令来检查授权状态
      const checkCommand = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="gcloud auth list --filter='status:ACTIVE' --format='value(account)'" 2>/dev/null`;

      const { stdout } = await execPromise(checkCommand, {
        timeout: 30000
      });

      const activeAccounts = stdout.trim().split('\n').filter(Boolean);
      const isAuthenticated = activeAccounts.includes(account.email);

      logger.info(`Auth verification for ${account.email}: ${isAuthenticated ? 'authenticated' : 'not authenticated'}`);

      return {
        authenticated: isAuthenticated,
        activeAccounts
      };
    } catch (error) {
      logger.error(`Failed to verify Cloud Shell auth: ${error.message}`);
      return {
        authenticated: false,
        error: error.message
      };
    }
  }

  /**
   * 确保 Cloud Shell 已授权（尝试多种方法）
   */
  async ensureCloudShellAuth(account) {
    try {
      logger.info(`Attempting to ensure Cloud Shell auth for ${account.email}`);

      // 方法1: 尝试刷新访问令牌
      try {
        logger.info(`Method 1: Refreshing access token...`);
        const refreshCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud auth print-access-token --refresh 2>/dev/null`;
        const { stdout: newToken } = await execPromise(refreshCmd, { timeout: 30000 });

        if (newToken && newToken.trim()) {
          logger.info(`Successfully refreshed access token`);

          // 将新令牌写入配置
          const fs = require('fs');
          const tokenPath = `${account.configDir}/access_token`;
          fs.writeFileSync(tokenPath, newToken.trim());

          // 再次同步到 Cloud Shell
          await this.syncAuthToCloudShell(account);
          return true;
        }
      } catch (error) {
        logger.warn(`Token refresh failed: ${error.message}`);
      }

      // 方法2: 尝试使用应用默认凭据
      try {
        logger.info(`Method 2: Using application default credentials...`);
        const fs = require('fs');
        const adcPath = `${account.configDir}/application_default_credentials.json`;

        if (fs.existsSync(adcPath)) {
          // 上传 ADC 到 Cloud Shell
          const scpCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell scp --authorize-session "${adcPath}" "cloudshell:~/.config/gcloud/application_default_credentials.json"`;
          await execPromise(scpCmd, { timeout: 30000 });

          // 激活 ADC
          const activateCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="gcloud auth application-default login --credential-file-override=~/.config/gcloud/application_default_credentials.json"`;
          await execPromise(activateCmd, { timeout: 30000 });

          logger.info(`Successfully set up application default credentials`);
          return true;
        }
      } catch (error) {
        logger.warn(`ADC setup failed: ${error.message}`);
      }

      // 方法3: 尝试重新激活账户
      try {
        logger.info(`Method 3: Re-activating account...`);
        const activateCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="gcloud config set account ${account.email} && gcloud auth activate-refresh ${account.email} 2>/dev/null || true"`;
        await execPromise(activateCmd, { timeout: 30000 });

        // 验证激活是否成功
        const verifyResult = await this.verifyCloudShellAuth(account);
        if (verifyResult.authenticated) {
          logger.info(`Successfully re-activated account`);
          return true;
        }
      } catch (error) {
        logger.warn(`Account re-activation failed: ${error.message}`);
      }

      // 方法4: 完整重新同步所有授权文件
      try {
        logger.info(`Method 4: Full auth file resync...`);

        // 创建授权文件备份
        const backupCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="cp -r ~/.config/gcloud ~/.config/gcloud-backup-$(date +%s) 2>/dev/null || true"`;
        await execPromise(backupCmd, { timeout: 30000 });

        // 重新同步所有文件
        await this.syncAuthToCloudShell(account);

        // 设置正确的文件权限
        const chmodCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud cloud-shell ssh --authorize-session --command="chmod 600 ~/.config/gcloud/credentials.db 2>/dev/null || true"`;
        await execPromise(chmodCmd, { timeout: 30000 });

        // 再次验证
        const verifyResult = await this.verifyCloudShellAuth(account);
        if (verifyResult.authenticated) {
          logger.info(`Successfully resynced auth files`);
          return true;
        }
      } catch (error) {
        logger.warn(`Full resync failed: ${error.message}`);
      }

      logger.error(`All authentication methods failed for ${account.email}`);
      return false;

    } catch (error) {
      logger.error(`Failed to ensure Cloud Shell auth: ${error.message}`);
      return false;
    }
  }

  /**
   * 预检查和修复授权（在执行命令前调用）
   */
  async precheckAndFixAuth(account) {
    try {
      // 1. 检查本地授权文件是否存在
      const fs = require('fs');
      const requiredFiles = [
        `${account.configDir}/credentials.db`,
        `${account.configDir}/configurations/config_default`
      ];

      const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

      if (missingFiles.length > 0) {
        logger.warn(`Missing auth files for ${account.email}: ${missingFiles.join(', ')}`);

        // 尝试刷新授权
        try {
          const refreshCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud auth login ${account.email} --brief --quiet 2>/dev/null`;
          await execPromise(refreshCmd, { timeout: 60000 });
          logger.info(`Refreshed auth for ${account.email}`);
        } catch (error) {
          logger.error(`Failed to refresh auth: ${error.message}`);
          throw error;
        }
      }

      // 2. 检查授权是否过期
      try {
        const tokenCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud auth print-access-token 2>/dev/null`;
        const { stdout: token } = await execPromise(tokenCmd, { timeout: 10000 });

        if (!token || token.trim().length < 10) {
          logger.warn(`Access token invalid or expired for ${account.email}`);

          // 刷新令牌
          const refreshCmd = `CLOUDSDK_CONFIG="${account.configDir}" gcloud auth print-access-token --refresh 2>/dev/null`;
          const { stdout: newToken } = await execPromise(refreshCmd, { timeout: 30000 });

          if (newToken && newToken.trim()) {
            logger.info(`Successfully refreshed token for ${account.email}`);
          }
        }
      } catch (error) {
        logger.warn(`Token check failed: ${error.message}`);
      }

      return true;
    } catch (error) {
      logger.error(`Precheck failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = new GCloudExecutor();