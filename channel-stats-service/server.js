/**
 * 独立渠道统计服务器
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { connectDB } = require('./config/database');
const channelStatsService = require('./channelStatsService');

// Make fetch available globally for compatibility
if (!global.fetch) {
    global.fetch = fetch;
}

const app = express();
const PORT = process.env.PORT || 4000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（前端）
app.use(express.static(path.join(__dirname, 'public')));

// API 路由

/**
 * 获取渠道统计概览 - 流式版本
 */
app.get('/api/stats/overview-stream', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 10;

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 发送初始连接事件
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      message: '连接已建立，开始分析...'
    })}\n\n`);

    const result = await channelStatsService.getChannelStatsStream(false, hours, (progress) => {
      // 发送进度更新
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    });

    // 发送最终结果
    if (result.success) {
      res.write(`data: ${JSON.stringify({
        type: 'result',
        message: '分析完成',
        data: result.data
      })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: result.message || '分析失败'
      })}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error('Error in /api/stats/overview-stream:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: `服务器错误: ${error.message}`
    })}\n\n`);
    res.end();
  }
});

/**
 * 获取渠道统计概览 - 传统版本
 */
app.get('/api/stats/overview', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 10;
    const result = await channelStatsService.getChannelStats(false, hours);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/stats/overview:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 获取单个账户详情
 */
app.get('/api/stats/account/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const result = await channelStatsService.getAccountDetails(email, false);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/stats/account/:email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 清除统计缓存（已废弃，但保留接口兼容性）
 */
app.post('/api/stats/clear-cache', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Cache system has been disabled, all requests now fetch fresh data'
    });
  } catch (error) {
    console.error('Error in /api/stats/clear-cache:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 获取服务状态
 */
app.get('/api/stats/status', async (req, res) => {
  try {
    const status = channelStatsService.getStatus();
    const databaseService = require('./services/databaseService');
    const dbSummary = await databaseService.getStatisticsSummary();

    res.json({
      success: true,
      data: {
        ...status,
        database: dbSummary
      }
    });
  } catch (error) {
    console.error('Error in /api/stats/status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 获取数据库中的统计数据
 */
app.get('/api/stats/database', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const databaseService = require('./services/databaseService');
    const result = await databaseService.getAllStatistics(limit, offset);

    res.json(result);
  } catch (error) {
    console.error('Error in /api/stats/database:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 根据邮箱获取数据库统计数据
 */
app.get('/api/stats/database/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const databaseService = require('./services/databaseService');
    const result = await databaseService.getStatisticsByEmail(email);

    res.json(result);
  } catch (error) {
    console.error('Error in /api/stats/database/:email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 批量删除渠道 - 流式版本
 */
app.post('/api/stats/batch-delete-stream', async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的邮箱列表'
      });
    }

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 发送初始连接事件
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      message: '开始批量删除渠道...'
    })}\n\n`);

    // 先获取要删除的渠道数据
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      message: '正在获取渠道数据...'
    })}\n\n`);

    const allChannelsResult = await require('./oneApiService').getAllChannelsStream((fetchProgress) => {
      res.write(`data: ${JSON.stringify({
        type: 'fetch_progress',
        message: fetchProgress.message,
        fetchInfo: fetchProgress
      })}\n\n`);
    });

    if (!allChannelsResult.success || !allChannelsResult.data?.items) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: '获取渠道数据失败'
      })}\n\n`);
      res.end();
      return;
    }

    const allChannels = allChannelsResult.data.items;
    const emailRegex = /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

    // 根据邮箱筛选要删除的渠道
    const channelsToDelete = [];
    for (const email of emails) {
      const emailChannels = allChannels.filter(channel => {
        if (!channel.name) return false;
        const emailMatch = channel.name.match(emailRegex);
        return emailMatch && emailMatch[1] === email;
      });
      channelsToDelete.push(...emailChannels);
    }

    res.write(`data: ${JSON.stringify({
      type: 'channels_found',
      message: `找到 ${channelsToDelete.length} 个渠道需要删除`,
      totalChannels: channelsToDelete.length,
      emails: emails
    })}\n\n`);

    if (channelsToDelete.length === 0) {
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        message: '没有找到需要删除的渠道',
        result: { successCount: 0, failCount: 0, errors: [] }
      })}\n\n`);
      res.end();
      return;
    }

    // 开始删除
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    const oneApiService = require('./oneApiService');

    for (let i = 0; i < channelsToDelete.length; i++) {
      const channel = channelsToDelete[i];

      try {
        const response = await fetch(`${oneApiService.baseUrl}/api/channel/${channel.id}`, {
          method: 'DELETE',
          headers: oneApiService.getHeaders()
        });

        if (response.ok) {
          successCount++;
          res.write(`data: ${JSON.stringify({
            type: 'delete_success',
            message: `删除成功: ${channel.name}`,
            progress: Math.round(((i + 1) / channelsToDelete.length) * 100),
            current: i + 1,
            total: channelsToDelete.length,
            successCount,
            failCount
          })}\n\n`);
        } else {
          failCount++;
          const errorText = await response.text();
          const errorMsg = `${channel.name}: ${errorText}`;
          errors.push(errorMsg);

          res.write(`data: ${JSON.stringify({
            type: 'delete_error',
            message: `删除失败: ${channel.name}`,
            error: errorText,
            progress: Math.round(((i + 1) / channelsToDelete.length) * 100),
            current: i + 1,
            total: channelsToDelete.length,
            successCount,
            failCount
          })}\n\n`);
        }
      } catch (error) {
        failCount++;
        const errorMsg = `${channel.name}: ${error.message}`;
        errors.push(errorMsg);

        res.write(`data: ${JSON.stringify({
          type: 'delete_error',
          message: `删除异常: ${channel.name}`,
          error: error.message,
          progress: Math.round(((i + 1) / channelsToDelete.length) * 100),
          current: i + 1,
          total: channelsToDelete.length,
          successCount,
          failCount
        })}\n\n`);
      }

      // 添加小延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 发送最终结果
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      message: `删除完成! 成功: ${successCount}, 失败: ${failCount}`,
      result: {
        successCount,
        failCount,
        errors: errors.slice(0, 10), // 只返回前10个错误
        totalErrors: errors.length
      }
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('Error in /api/stats/batch-delete-stream:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: `服务器错误: ${error.message}`
    })}\n\n`);
    res.end();
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Channel Stats Service is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

/**
 * 根路径返回前端页面
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
const startServer = async () => {
  try {
    // 首先连接数据库
    await connectDB();

    // 启动服务器
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`📊 Channel Stats Service running on port ${PORT}`);
      console.log(`🌐 Web interface: http://localhost:${PORT}`);
      console.log(`🔧 API base: http://localhost:${PORT}/api/stats`);
      console.log(`💾 Database connected and ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();