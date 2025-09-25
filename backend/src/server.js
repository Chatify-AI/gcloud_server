require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const { connectDB } = require('../config/database');
const logger = require('./utils/logger');
const gcloudExecutor = require('../services/gcloudExecutorClient');
const channelFileMonitor = require('../services/channelFileMonitor');
const gcloudMonitorService = require('../services/gcloudMonitorService');

const adminRoutes = require('../routes/admin');
const gcloudAccountRoutes = require('../routes/gcloud-accounts');
const commandRoutes = require('../routes/commands');
const apiKeyRoutes = require('../routes/apikeys');
const publicRoutes = require('../routes/public');
const historyRoutes = require('../routes/history');
const oneapiRoutes = require('../routes/oneapi');
const { authMiddleware } = require('../middleware/auth');

const app = express();

// Trust proxy - needed for rate limiting and getting real client IPs
app.set('trust proxy', true);

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
});

app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// Dynamic CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, check against a whitelist
    if (process.env.CORS_ORIGIN === '*') {
      callback(null, true);
    } else if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration for storing temporary auth data
const SQLiteStore = require('connect-sqlite3')(session);
const sessionDir = path.join(__dirname, '../data');
require('fs').mkdirSync(sessionDir, { recursive: true });

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: sessionDir
  }),
  secret: process.env.SESSION_SECRET || 'gcloud-manager-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true, // Changed to true to ensure session is created
  cookie: {
    secure: false, // Changed to false for development
    httpOnly: true,
    maxAge: 1000 * 60 * 30 // 30 minutes
  }
}));

// 暂时禁用限流
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
//   message: 'Too many requests from this IP, please try again later.',
//   skip: (req) => {
//     const ip = req.ip || req.connection.remoteAddress;
//     return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
//   }
// });

// app.use('/api/', limiter);

app.use('/api/admin', adminRoutes);
app.use('/api/gcloud-accounts', gcloudAccountRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/apikeys', apiKeyRoutes);
app.use('/api/public', publicRoutes);  // 公开接口，无需认证
app.use('/api/history', historyRoutes);  // 执行历史记录接口
app.use('/api/oneapi', oneapiRoutes);  // OneAPI渠道管理接口
app.use('/api/channel-test-records', require('../routes/channelTestRecords'));  // 渠道测试记录接口

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const jwt = require('jsonwebtoken');
    const { Admin } = require('../models');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findByPk(decoded.id);

    if (!admin) {
      return next(new Error('Authentication error'));
    }

    socket.adminId = admin.id;
    socket.admin = admin;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Admin ${socket.admin.username} connected via WebSocket`);

  socket.join(`admin:${socket.adminId}`);

  socket.on('execute-command', async (data) => {
    try {
      const { accountId, command } = data;

      const { GCloudAccount } = require('../models');
      const account = await GCloudAccount.findByPk(accountId);

      if (!account) {
        socket.emit('command-error', { error: 'Account not found' });
        return;
      }

      const result = await gcloudExecutor.executeCommand(
        socket.admin.username,
        accountId,
        command,
        { async: true }
      );

      socket.emit('command-started', { executionId: result.executionId });

      await gcloudExecutor.streamExecution(
        result.executionId,
        (output) => {
          socket.emit('command-output', {
            executionId: result.executionId,
            output
          });
        },
        (error) => {
          socket.emit('command-error', {
            executionId: result.executionId,
            error
          });
        },
        () => {
          socket.emit('command-complete', {
            executionId: result.executionId
          });
        }
      );

    } catch (error) {
      logger.error('WebSocket command execution error:', error);
      socket.emit('command-error', { error: error.message });
    }
  });

  socket.on('cloud-shell-command', async (data) => {
    try {
      const { accountId, command } = data;

      const { GCloudAccount } = require('../models');
      const account = await GCloudAccount.findByPk(accountId);

      if (!account) {
        socket.emit('command-error', { error: 'Account not found' });
        return;
      }

      socket.emit('command-output', {
        output: `Executing in Cloud Shell: ${command}\n`
      });

      const result = await gcloudExecutor.executeCloudShellCommand(
        socket.admin.username,
        accountId,
        command
      );

      socket.emit('command-output', {
        executionId: result.executionId,
        output: result.output
      });

      socket.emit('command-complete', {
        executionId: result.executionId
      });

    } catch (error) {
      logger.error('Cloud Shell command error:', error);
      socket.emit('command-error', { error: error.message });
    }
  });

  socket.on('cancel-command', async (data) => {
    try {
      const { executionId } = data;
      const cancelled = await gcloudExecutor.cancelExecution(executionId);

      if (cancelled) {
        socket.emit('command-cancelled', { executionId });
      } else {
        socket.emit('command-error', {
          executionId,
          error: 'Command not running'
        });
      }
    } catch (error) {
      logger.error('Cancel command error:', error);
      socket.emit('command-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Admin ${socket.admin.username} disconnected`);
  });
});

const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

    server.listen(PORT, HOST, () => {
      logger.info(`Server running on ${HOST}:${PORT}`);
      logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      logger.info(`Access the server at http://<your-server-ip>:${PORT}`);

      // 启动文件监听服务
      console.log('About to start channel file monitor...');
      channelFileMonitor.start().then(() => {
        console.log('✅ Channel file monitor started successfully for /home/Chatify/vip');
        logger.info('✅ Channel file monitor started successfully for /home/Chatify/vip');
      }).catch(err => {
        console.error('❌ Failed to start channel file monitor:', err);
        logger.error('❌ Failed to start channel file monitor:', err);
      });

      // 启动GCloud账号监听服务
      gcloudMonitorService.start();
      console.log('GCloud monitor service started');
      logger.info('GCloud monitor service started');

      // 启动全局渠道监控服务（监控非监听账号的渠道）
      console.log('🌍 ENABLE_GLOBAL_CHANNEL_MONITOR:', process.env.ENABLE_GLOBAL_CHANNEL_MONITOR);
      if (process.env.ENABLE_GLOBAL_CHANNEL_MONITOR !== 'false') {
        console.log('🌍 Loading global channel monitor service...');
        try {
          const globalChannelMonitorService = require('../services/globalChannelMonitorService');
          console.log('🌍 Service loaded, calling start()...');
          globalChannelMonitorService.start();
          console.log('🌍 Global channel monitor service started (30-second interval between cycles)');
          logger.info('🌍 Global channel monitor service started (30-second interval between cycles)');
        } catch (error) {
          console.error('🌍 Failed to start global channel monitor service:', error);
          logger.error('🌍 Failed to start global channel monitor service:', error);
        }
      } else {
        console.log('🌍 Global channel monitor service is DISABLED by environment variable');
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});