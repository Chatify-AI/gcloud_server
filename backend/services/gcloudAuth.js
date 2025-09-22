const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const crypto = require('crypto');
const pty = require('node-pty');

const execPromise = util.promisify(exec);

// Google Cloud configurations directory for isolated account management
const GCLOUD_CONFIG_DIR = path.join(process.env.HOME || '/root', '.config', 'gcloud-manager');

class GCloudAuthService {
  constructor() {
    this.initializeConfigDir();
    // Store active auth sessions
    this.activeAuthSessions = new Map();
  }

  /**
   * Initialize gcloud configuration directory
   */
  async initializeConfigDir() {
    try {
      await fs.mkdir(GCLOUD_CONFIG_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating config directory:', error);
    }
  }

  /**
   * Generate OAuth2 authorization URL using gcloud auth login
   * This generates the REAL gcloud login URL and keeps the session alive
   */
  async generateGCloudAuthUrl() {
    try {
      // Generate a unique configuration name for this account
      const configName = `account-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const configDir = path.join(GCLOUD_CONFIG_DIR, configName);
      await fs.mkdir(configDir, { recursive: true });

      // Create a pseudo terminal for gcloud auth login
      const ptyProcess = pty.spawn('gcloud', ['auth', 'login', '--no-launch-browser'], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: { ...process.env, CLOUDSDK_CONFIG: configDir }
      });

      let output = '';
      let authUrl = '';
      let authId = `auth_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      return new Promise((resolve, reject) => {
        let timeoutId;

        ptyProcess.onData((data) => {
          output += data;
          console.log('GCloud output:', data); // Debug log

          // Look for the Google OAuth URL in the output
          if (!authUrl) {
            // Pattern 1: URL after "Go to the following link"
            const linkMatch = output.match(/https:\/\/accounts\.google\.com\/o\/oauth2\/auth\?[^\s\r\n]+/i);
            if (linkMatch) {
              authUrl = linkMatch[0].trim();

              // Store the session
              this.activeAuthSessions.set(authId, {
                ptyProcess,
                configDir,
                configName,
                timestamp: Date.now()
              });

              console.log('Session created with authId:', authId);
              console.log('Active sessions after creation:', Array.from(this.activeAuthSessions.keys()));

              // Clear timeout since we found the URL
              if (timeoutId) clearTimeout(timeoutId);

              resolve({
                authUrl,
                authId,
                configName,
                configDir,
                instructions: 'Open this URL in your browser, authorize access, and copy the verification code that appears'
              });
            }
          }
        });

        ptyProcess.onExit((code) => {
          console.log(`PTY process exited with code ${code}`);
          if (!authUrl) {
            reject(new Error('Failed to generate auth URL - process exited'));
          }
        });

        // Set a timeout
        timeoutId = setTimeout(() => {
          if (!authUrl) {
            ptyProcess.kill();
            this.activeAuthSessions.delete(authId);
            reject(new Error('Timeout generating auth URL'));
          }
        }, 10000); // 10 seconds timeout
      });
    } catch (error) {
      console.error('Error generating gcloud auth URL:', error);
      throw error;
    }
  }

  /**
   * Complete gcloud authentication with verification code
   * Uses the existing session to input the code
   */
  async completeGCloudAuth(authId, verificationCode) {
    try {
      console.log('Completing auth with authId:', authId);
      console.log('Active sessions:', Array.from(this.activeAuthSessions.keys()));

      const session = this.activeAuthSessions.get(authId);

      if (!session) {
        console.error('Session not found. Available sessions:', Array.from(this.activeAuthSessions.keys()));
        throw new Error('Authentication session not found or expired');
      }

      const { ptyProcess, configDir, configName } = session;

      // Send the verification code to the waiting gcloud process
      ptyProcess.write(verificationCode + '\n');

      // Wait for the process to complete
      return new Promise((resolve, reject) => {
        let output = '';
        let timeoutId;

        const dataHandler = (data) => {
          output += data;
          console.log('Auth completion output:', data); // Debug log

          // Check for success patterns
          if (output.includes('You are now logged in as') ||
              output.includes('Your current project is') ||
              output.includes('Updated property')) {

            clearTimeout(timeoutId);

            // Get account info after successful auth
            execPromise(
              `CLOUDSDK_CONFIG="${configDir}" gcloud config get-value account 2>/dev/null`,
              { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
            ).then(({ stdout: accountInfo }) => {
              const email = accountInfo.trim();

              // Get access token
              return execPromise(
                `CLOUDSDK_CONFIG="${configDir}" gcloud auth print-access-token 2>/dev/null`,
                { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
              ).then(({ stdout: accessToken }) => {
                // Get project info if available
                return execPromise(
                  `CLOUDSDK_CONFIG="${configDir}" gcloud config get-value project 2>/dev/null`,
                  { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
                ).catch(() => ({ stdout: '' })).then(({ stdout: projectId }) => {
                  // Clean up session
                  this.activeAuthSessions.delete(authId);
                  ptyProcess.kill();

                  resolve({
                    email,
                    accessToken: accessToken.trim(),
                    projectId: projectId.trim() || null,
                    configDir,
                    configName
                  });
                });
              });
            }).catch(error => {
              reject(new Error(`Failed to get account info: ${error.message}`));
            });
          }

          // Check for error patterns
          if (output.includes('ERROR:') || output.includes('invalid_grant')) {
            clearTimeout(timeoutId);
            this.activeAuthSessions.delete(authId);
            ptyProcess.kill();

            const errorMatch = output.match(/ERROR:\s*(.+)/);
            const errorMessage = errorMatch ? errorMatch[1] : 'Authentication failed';
            reject(new Error(errorMessage));
          }
        };

        ptyProcess.onData(dataHandler);

        // Set timeout for completion
        timeoutId = setTimeout(() => {
          ptyProcess.removeListener('data', dataHandler);
          this.activeAuthSessions.delete(authId);
          ptyProcess.kill();
          reject(new Error('Authentication timeout - verification code may be invalid'));
        }, 30000); // 30 seconds timeout
      });
    } catch (error) {
      console.error('Error completing gcloud auth:', error);
      // Clean up session on error
      if (this.activeAuthSessions.has(authId)) {
        const session = this.activeAuthSessions.get(authId);
        if (session && session.ptyProcess) {
          session.ptyProcess.kill();
        }
        this.activeAuthSessions.delete(authId);
      }
      throw error;
    }
  }

  /**
   * Clean up old sessions periodically
   */
  cleanupOldSessions() {
    const now = Date.now();
    for (const [authId, session] of this.activeAuthSessions.entries()) {
      // Clean up sessions older than 10 minutes
      if (now - session.timestamp > 10 * 60 * 1000) {
        if (session.ptyProcess) {
          session.ptyProcess.kill();
        }
        this.activeAuthSessions.delete(authId);
      }
    }
  }

  /**
   * List all authenticated gcloud accounts
   */
  async listGCloudAccounts() {
    try {
      const configs = await fs.readdir(GCLOUD_CONFIG_DIR).catch(() => []);
      const accounts = [];

      for (const configName of configs) {
        const configDir = path.join(GCLOUD_CONFIG_DIR, configName);

        try {
          const stat = await fs.stat(configDir);
          if (stat.isDirectory()) {
            // Get account info for this configuration
            const { stdout: authList } = await execPromise(
              `CLOUDSDK_CONFIG="${configDir}" gcloud auth list --format=json 2>/dev/null`,
              { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
            ).catch(() => ({ stdout: '[]' }));

            try {
              const authAccounts = JSON.parse(authList);
              for (const account of authAccounts) {
                if (account.account) {
                  // Get project for this config
                  const { stdout: projectId } = await execPromise(
                    `CLOUDSDK_CONFIG="${configDir}" gcloud config get-value project 2>/dev/null`,
                    { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
                  ).catch(() => ({ stdout: '' }));

                  accounts.push({
                    configName,
                    configDir,
                    email: account.account,
                    isActive: account.status === 'ACTIVE',
                    projectId: projectId.trim() || null
                  });
                }
              }
            } catch (parseError) {
              // Skip if JSON parsing fails
            }
          }
        } catch (error) {
          // Skip invalid configs
        }
      }

      return accounts;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Set a project for a specific account configuration
   */
  async setProject(configDir, projectId) {
    try {
      await execPromise(
        `CLOUDSDK_CONFIG="${configDir}" gcloud config set project "${projectId}"`,
        { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
      );

      return { success: true, projectId };
    } catch (error) {
      console.error('Error setting project:', error);
      throw error;
    }
  }

  /**
   * Refresh access token for a specific account
   */
  async refreshAccessToken(configDir) {
    try {
      const { stdout: accessToken } = await execPromise(
        `CLOUDSDK_CONFIG="${configDir}" gcloud auth print-access-token 2>/dev/null`,
        { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
      );

      return accessToken.trim();
    } catch (error) {
      // Try to re-authenticate if token refresh fails
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token. Account may need re-authentication.');
    }
  }

  /**
   * Revoke authentication for a specific account
   */
  async revokeAuth(configDir) {
    try {
      // Get the account email first
      const { stdout: email } = await execPromise(
        `CLOUDSDK_CONFIG="${configDir}" gcloud config get-value account 2>/dev/null`,
        { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
      );

      if (email && email.trim()) {
        // Revoke the account
        await execPromise(
          `CLOUDSDK_CONFIG="${configDir}" gcloud auth revoke "${email.trim()}" --quiet 2>/dev/null`,
          { env: { ...process.env, CLOUDSDK_CONFIG: configDir } }
        ).catch(() => {});
      }

      // Remove the configuration directory
      await fs.rm(configDir, { recursive: true, force: true });

      return { success: true };
    } catch (error) {
      console.error('Error revoking auth:', error);
      throw error;
    }
  }

  /**
   * Execute a gcloud command with a specific account
   */
  async executeCommand(configDir, command) {
    try {
      const { stdout, stderr } = await execPromise(
        `CLOUDSDK_CONFIG="${configDir}" gcloud ${command}`,
        {
          env: { ...process.env, CLOUDSDK_CONFIG: configDir },
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
        }
      );

      return {
        stdout: stdout || '',
        stderr: stderr || '',
        success: true
      };
    } catch (error) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance and set up cleanup
const gcloudAuthService = new GCloudAuthService();

// Clean up old sessions every 5 minutes
setInterval(() => {
  gcloudAuthService.cleanupOldSessions();
}, 5 * 60 * 1000);

module.exports = gcloudAuthService;