module.exports = {
  apps: [{
    name: 'gcloud-executor-service',
    script: 'src/app.js',
    cwd: '/root/gcloud_server/gcloud-executor-service',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      EXECUTOR_PORT: 3002,
      LOG_LEVEL: 'info'
    },
    env_development: {
      NODE_ENV: 'development',
      EXECUTOR_PORT: 3002,
      LOG_LEVEL: 'debug'
    },
    error_file: './logs/gcloud-executor-error.log',
    out_file: './logs/gcloud-executor.log',
    log_file: './logs/gcloud-executor-combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
};