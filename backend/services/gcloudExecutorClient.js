const axios = require('axios');
const logger = require('../src/utils/logger');

class GCloudExecutorClient {
  constructor() {
    this.baseURL = process.env.EXECUTOR_SERVICE_URL || 'http://localhost:3002';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10 * 60 * 1000, // 10 minutes for Cloud Shell commands (increased from 30s)
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error(`Executor service request failed: ${error.message}`, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status
        });
        return Promise.reject(error);
      }
    );

    // Store active SSE connections for cleanup
    this.activeStreams = new Map();
  }

  /**
   * Execute a gcloud command with a specific account
   */
  async executeCommand(adminUsername, accountId, command, options = {}) {
    try {
      const response = await this.client.post('/api/executions/gcloud', {
        adminUsername,
        accountId,
        command,
        async: options.async || false
      });

      return response.data;
    } catch (error) {
      throw new Error(`GCloud command execution failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Execute a Cloud Shell command
   */
  async executeCloudShellCommand(adminUsername, accountId, shellCommand, options = {}) {
    try {
      const response = await this.client.post('/api/executions/cloud-shell', {
        adminUsername,
        accountId,
        command: shellCommand,
        async: options.async || false,
        syncAuth: options.syncAuth !== false
      });

      return response.data;
    } catch (error) {
      throw new Error(`Cloud Shell command execution failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId) {
    try {
      const response = await this.client.get(`/api/executions/${executionId}`);
      return response.data.execution;
    } catch (error) {
      throw new Error(`Failed to get execution status: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId) {
    try {
      const response = await this.client.post(`/api/executions/${executionId}/cancel`);
      return true;
    } catch (error) {
      if (error.response?.status === 400) {
        return false; // Execution is not running
      }
      throw new Error(`Failed to cancel execution: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Stream execution output using EventSource (SSE)
   */
  async streamExecution(executionId, onData, onError, onClose) {
    try {
      // For Node.js, we need to use a different approach since EventSource is a browser API
      const { EventSource } = await import('eventsource');

      const eventSource = new EventSource(`${this.baseURL}/api/executions/${executionId}/stream`);

      // Store for potential cleanup
      this.activeStreams.set(executionId, eventSource);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'output':
              if (onData) onData(data.data);
              break;
            case 'error':
              if (onError) onError(data.data);
              break;
            case 'status':
              // Handle status updates
              logger.info(`Execution ${executionId} status: ${data.status}`);
              break;
            case 'close':
              eventSource.close();
              this.activeStreams.delete(executionId);
              if (onClose) onClose();
              break;
          }
        } catch (parseError) {
          logger.error('Failed to parse SSE data:', parseError);
          if (onError) onError('Failed to parse server response');
        }
      };

      eventSource.onerror = (error) => {
        logger.error('SSE connection error:', error);
        eventSource.close();
        this.activeStreams.delete(executionId);
        if (onError) onError('Connection to executor service lost');
        if (onClose) onClose();
      };

      // Return a function to close the stream
      return () => {
        eventSource.close();
        this.activeStreams.delete(executionId);
      };
    } catch (error) {
      throw new Error(`Failed to stream execution: ${error.message}`);
    }
  }

  /**
   * List projects for an account
   */
  async listProjects(accountId) {
    try {
      const response = await this.client.get(`/api/executions/accounts/${accountId}/projects`);
      return response.data.projects;
    } catch (error) {
      throw new Error(`Failed to list projects: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get account configuration
   */
  async getAccountConfig(accountId) {
    try {
      const response = await this.client.get(`/api/executions/accounts/${accountId}/config`);
      return response.data.config;
    } catch (error) {
      throw new Error(`Failed to get account config: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Clean up all active streams (useful for shutdown)
   */
  cleanup() {
    for (const [executionId, eventSource] of this.activeStreams) {
      eventSource.close();
      logger.info(`Closed SSE stream for execution ${executionId}`);
    }
    this.activeStreams.clear();
  }

  /**
   * Health check for the executor service
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(`Executor service health check failed: ${error.message}`);
    }
  }
}

module.exports = new GCloudExecutorClient();