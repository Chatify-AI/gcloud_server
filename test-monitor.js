// 测试文件监听功能
const axios = require('axios');

const apiUrl = 'http://localhost:3000/api/oneapi/monitor/status';
const apiKey = process.env.ONEAPI_KEY || 't0bAXxyETOitEfEWuU37sWSqwJrE';
const headers = {
  'Authorization': `Bearer ${apiKey}`
};

async function checkMonitorStatus() {
  try {
    console.log('检查文件监听服务状态...');
    const response = await axios.get(apiUrl, { headers });
    console.log('监听服务状态:', response.data);

    // 获取处理日志
    const logsResponse = await axios.get('http://localhost:3000/api/oneapi/monitor/logs', { headers });
    console.log('处理日志:', logsResponse.data);

    // 获取统计信息
    const statsResponse = await axios.get('http://localhost:3000/api/oneapi/monitor/stats', { headers });
    console.log('统计信息:', statsResponse.data);
  } catch (error) {
    console.error('错误:', error.response ? error.response.data : error.message);
  }
}

checkMonitorStatus();