# Channel Key推送功能说明

## 功能概述

在删除GCloud账户时，自动将该账户在Azure MySQL数据库中对应的所有channel keys推送到远程服务器进行备份保存。

## 技术架构

### 1. 数据源
- **数据库**: Azure MySQL (chatify-database.mysql.database.azure.com)
- **数据库名**: vertex_ai_pool_1
- **表名**: channels
- **关键字段**: id, name, key

### 2. 推送目标
- **API端点**: http://104.243.32.237:10000/api/add
- **请求方式**: POST
- **Content-Type**: application/json
- **请求体**: 直接传递key字符串

### 3. 核心服务

#### ChannelKeyService (`backend/services/channelKeyService.js`)

**主要方法**:

1. **getChannelKeysByEmail(accountEmail)**
   - 从MySQL数据库查询匹配邮箱的所有channels
   - 匹配规则: `name LIKE '%{email}%'`
   - 返回: channels数组（包含id, name, key）

2. **pushKeyWithRetry(key, channelId, channelName)**
   - 推送单个key到远程服务器
   - 自动重试3次（失败时）
   - 重试间隔: 1秒、2秒、3秒（递增）
   - 返回: 推送结果对象

3. **pushAccountKeys(accountEmail, progressCallback)**
   - 批量推送账户的所有keys
   - 串行处理（避免并发压力）
   - 实时进度回调
   - 推送间隔: 200ms
   - 返回: 汇总结果

## 集成到删除流程

### 执行顺序

```
账户删除流程:
1. 数据同步（AccountSummary表）
2. 推送Channel Keys ⬅️ 新增步骤
3. 删除OneAPI渠道
4. 删除GCloud账户
5. 撤销认证
```

### SSE事件类型

**新增的事件类型**:
- `keys_pushing`: 开始推送keys
- `keys_start`: keys推送开始
- `keys_progress`: keys推送进度更新
- `keys_completed`: keys推送完成
- `keys_pushed`: 账户keys推送总结
- `keys_push_failed`: keys推送失败（继续删除流程）

### 代码位置

- **服务**: `/root/gcloud_server/backend/services/channelKeyService.js`
- **路由集成**: `/root/gcloud_server/backend/routes/gcloud-accounts.js` (第857-894行)

## 错误处理

### 重试机制
- **最大重试次数**: 3次
- **重试策略**: 指数退避（1s, 2s, 3s）
- **失败处理**: 记录日志，继续处理下一个key

### 容错设计
- Key推送失败不影响后续的渠道删除流程
- 推送错误会记录到日志并通过SSE通知前端
- 数据库连接失败会抛出异常但不中断整体删除流程

## 测试

### 测试脚本

1. **测试MySQL连接**: `node test-mysql-connection.js`
2. **测试单个key推送**: `node test-push-key.js`
3. **测试完整服务**: `node test-channel-key-service.js`

### 测试结果示例

```bash
✅ 测试完成！

📋 结果汇总:
   总渠道数: 6
   成功推送: 6
   失败数量: 0

详细结果:
   1. ✅ Channel 4150 - martinezwilliametrcu1387@gmail.com-075237_suspend
   2. ✅ Channel 4151 - martinezwilliametrcu1387@gmail.com-075237_suspend
   ...
```

## 性能考虑

### 优化措施
- **串行处理**: 避免并发请求过多导致API限流
- **请求间隔**: 每个key推送后等待200ms
- **超时设置**: 每个请求超时时间10秒
- **连接池**: MySQL使用连接池避免频繁建立连接

### 预期性能
- 单个key推送: ~200-500ms
- 100个keys推送: ~20-50秒
- 重试开销: 失败时额外1-6秒

## 数据库配置

```javascript
{
  host: 'chatify-database.mysql.database.azure.com',
  user: 'database',
  password: 'sk-chatify-MoLu154!',
  database: 'vertex_ai_pool_1',
  port: 3306
}
```

## API响应格式

### 成功响应 (200)
```json
{
  "added": 1,
  "group": "",
  "ids": [262342]
}
```

### 失败响应
- 状态码: 非200
- 会触发自动重试（最多3次）

## 日志记录

### 日志级别
- **INFO**: 连接成功、推送成功、完成汇总
- **WARN**: 重试警告、推送失败
- **ERROR**: 数据库连接失败、API错误

### 日志示例
```
info: Starting to push keys for account: test@gmail.com
info: Found 6 channels for email: test@gmail.com
info: Pushing key for channel 4150 (attempt 1/3)
info: ✅ Successfully pushed key for channel 4150
info: Completed pushing keys: 6 success, 0 failed
```

## 前端显示

删除流程中会实时显示：
- "开始推送channel keys..."
- "Keys推送进度: 3/6 (50%)"
- "Keys推送完成 (6成功, 0失败)"

## 注意事项

1. **数据匹配**: 使用邮箱模糊匹配，可能匹配到多个channel
2. **网络依赖**: 依赖Azure MySQL和远程API的网络连通性
3. **顺序保证**: 推送完keys后才会删除渠道，确保数据不丢失
4. **失败继续**: 即使key推送失败，删除流程仍会继续执行

## 未来改进建议

1. **批量推送**: 改为批量API调用提高性能
2. **断点续传**: 推送失败时记录位置，支持重新推送
3. **推送验证**: 推送后验证远程服务器是否真的接收到
4. **备份日志**: 将推送结果保存到本地文件作为备份
