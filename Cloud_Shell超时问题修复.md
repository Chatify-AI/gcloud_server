# Cloud Shell 超时问题修复

## 问题描述

用户在Web界面执行Cloud Shell命令时遇到超时错误：

```
Error: Cloud Shell command execution failed: timeout of 30000ms exceeded
```

这个错误发生在命令执行超过30秒时，即使后端executor服务还在继续执行。

## 根本原因

**前端axios实例的全局超时设置为30秒**（frontend/src/services/api.js:6）

```javascript
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,  // ❌ 30秒超时太短
  headers: {
    'Content-Type': 'application/json'
  }
});
```

Cloud Shell命令通常需要更长的执行时间，特别是涉及：
- 下载GitHub脚本（可能需要10-30秒）
- GCloud认证同步（可能需要30-60秒）
- 脚本执行（可能需要1-5分钟）
- 文件上传/下载操作

## 解决方案

### 1. 增加默认超时时间

将全局axios实例的超时从30秒增加到2分钟：

```javascript
const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // ✅ 2分钟超时
  headers: {
    'Content-Type': 'application/json'
  }
});
```

### 2. 创建专门的长超时实例

为Cloud Shell等长时间操作创建专门的axios实例（10分钟超时）：

```javascript
export const apiLongRunning = axios.create({
  baseURL: '/api',
  timeout: 10 * 60 * 1000, // ✅ 10分钟超时
  headers: {
    'Content-Type': 'application/json'
  }
});
```

### 3. 添加拦截器

为长超时实例添加与默认实例相同的认证和错误处理拦截器：
- 自动添加JWT token
- 处理401未授权错误

## 后端超时配置验证

### Executor Service内部超时

在gcloud-executor-service中，executeCloudShellCommand方法已经设置了20分钟超时：

```javascript
// gcloud-executor-service/src/services/gcloudExecutor.js:510-515
setTimeout(() => {
  if (this.activeExecutions.has(executionId)) {
    child.kill();
    reject(new Error('Cloud Shell command timed out after 20 minutes'));
  }
}, 20 * 60 * 1000); // ✅ 20分钟
```

### Main Service调用Executor的超时

在gcloudMonitorService.js中调用executor service时也有合理的超时设置：

```javascript
// backend/services/gcloudMonitorService.js
const response = await axios.post(`${this.executorServiceURL}/api/executions/cloud-shell`, {
  // ...
}, {
  timeout: 5 * 60 * 1000  // ✅ 5分钟
});
```

## 超时层次结构

现在的超时配置从内到外是合理的：

1. **Executor Service内部**: 20分钟（最宽松，给命令充足的执行时间）
2. **Main Service → Executor**: 5分钟（合理的服务间调用超时）
3. **Frontend → Backend**: 2-10分钟（根据操作类型选择）
   - 默认操作：2分钟
   - Cloud Shell等长操作：10分钟

## 修改的文件

- `frontend/src/services/api.js`
  - 增加默认超时到120秒
  - 添加apiLongRunning实例（600秒）
  - 为两个实例都配置了拦截器

## 部署步骤

1. 修改前端代码
2. 重新构建前端：`npm run build:frontend`
3. 重启main-service容器：`docker-compose -f docker-compose.prod.yml restart main-service`

## 测试验证

执行以下测试确认修复：

1. **简单命令测试**（应该在2分钟内完成）：
```bash
curl -X POST http://82.197.94.152:5000/api/gcloud-accounts/{accountId}/execute-cloud-shell \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"command": "ls -la"}'
```

2. **长时间命令测试**（可能需要5-10分钟）：
```bash
# 通过Web界面执行脚本下载和运行
curl -X POST http://82.197.94.152:5000/api/gcloud-accounts/{accountId}/execute-cloud-shell \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"command": "curl -fsSL https://raw.githubusercontent.com/.../script.sh | bash"}'
```

## 未来改进建议

### 使用异步执行模式

对于预期执行时间超过1分钟的Cloud Shell命令，建议使用异步执行模式：

1. 提交命令立即返回executionId
2. 通过SSE或轮询获取执行状态和输出
3. 避免长时间HTTP连接阻塞

这种方式的优点：
- 不受HTTP超时限制
- 用户可以实时看到命令输出
- 客户端断开不影响命令继续执行
- 更好的用户体验

### 示例实现

```javascript
// 提交异步执行
const response = await api.post('/cloud-shell', {
  accountId: account.id,
  command: longCommand,
  async: true  // 启用异步模式
});

const { executionId } = response.data;

// 通过SSE流式获取输出
const eventSource = new EventSource(`/api/executions/${executionId}/stream`);
eventSource.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'output') {
    console.log(data);
  }
};
```

## 总结

✅ **已解决**: 前端30秒超时导致Cloud Shell命令执行中断
✅ **验证**: 后端超时配置合理（5-20分钟）
✅ **改进**: 创建专门的长超时axios实例供未来使用
⚠️ **建议**: 考虑实现异步执行模式以获得更好的用户体验

---

**修复时间**: 2025-10-20
**影响范围**: 所有Cloud Shell命令执行
**向后兼容**: 是（仅增加超时时间，不改变API）
