# 日志查看指南 - ChannelKeyService

## 快速查看命令

### 1. 查看最近的ChannelKeyService日志
```bash
./check-recent-logs.sh
```

### 2. 实时监控ChannelKeyService日志
```bash
./watch-channel-key-logs.sh
```
按 Ctrl+C 停止

### 3. 查看PM2完整日志
```bash
pm2 logs gcloud-manager
```

## 日志标记说明

### 关键标记

#### 🎯 开始/结束标记
```
🎯 [ChannelKeyService] ==================== START PUSH KEYS ====================
🎯 [ChannelKeyService] ==================== END PUSH KEYS ====================
🎯 [ChannelKeyService] ==================== END PUSH KEYS (ERROR) ====================
```

#### 🔌 数据库连接
```
🔌 [ChannelKeyService] Connected to Azure MySQL database
❌ [ChannelKeyService] Failed to connect to MySQL
```

#### 🔍 搜索渠道
```
🔍 [ChannelKeyService] Searching channels for email: xxx@gmail.com
📊 [ChannelKeyService] Found 6 channels for email: xxx@gmail.com
   Channel IDs: [4150, 4151, 4152, ...]
```

#### 🚀 推送Key
```
🚀 [ChannelKeyService] Pushing key for channel 4150 (attempt 1/3)
   Channel: xxx@gmail.com-075237_suspend
   Key preview: AIzaSyBcYJb2vFpk4wwvu...
✅ [ChannelKeyService] Successfully pushed key for channel 4150
   Response: {"added":1,"group":"","ids":[262342]}
```

#### ⚠️ 重试/失败
```
⚠️  [ChannelKeyService] Attempt 1 failed for channel 4150: Connection timeout
   Waiting 1000ms before retry...
❌ [ChannelKeyService] Failed to push key for channel 4150 after 3 attempts
   Error: Connection timeout
```

#### ✅ 完成汇总
```
✅ [ChannelKeyService] Completed pushing keys for xxx@gmail.com
   Success: 6, Failed: 0
```

## 手动过滤命令

### 只看开始/结束标记
```bash
pm2 logs gcloud-manager --lines 100 --nostream | grep "PUSH KEYS"
```

### 只看成功的推送
```bash
pm2 logs gcloud-manager --lines 100 --nostream | grep "Successfully pushed"
```

### 只看失败的推送
```bash
pm2 logs gcloud-manager --lines 100 --nostream | grep -E "❌|Failed|Error"
```

### 查看特定邮箱的日志
```bash
pm2 logs gcloud-manager --lines 200 --nostream | grep "xxx@gmail.com"
```

### 查看渠道数量统计
```bash
pm2 logs gcloud-manager --lines 200 --nostream | grep "Found.*channels"
```

### 查看推送成功率
```bash
pm2 logs gcloud-manager --lines 200 --nostream | grep "Completed pushing keys"
```

## 日志示例（完整流程）

```
🎯 [ChannelKeyService] ==================== START PUSH KEYS ====================
   Account Email: test@gmail.com

🔌 [ChannelKeyService] Connected to Azure MySQL database

🔍 [ChannelKeyService] Searching channels for email: test@gmail.com

📊 [ChannelKeyService] Found 3 channels for email: test@gmail.com
   Channel IDs: [4150, 4151, 4152]

🚀 [ChannelKeyService] Pushing key for channel 4150 (attempt 1/3)
   Channel: test@gmail.com-075237
   Key preview: AIzaSyBcYJb2vFpk4wwvu...

✅ [ChannelKeyService] Successfully pushed key for channel 4150
   Response: {"added":1,"group":"","ids":[262342]}

🚀 [ChannelKeyService] Pushing key for channel 4151 (attempt 1/3)
   Channel: test@gmail.com-091221
   Key preview: AIzaSyD9eVLv981d3jlyT...

✅ [ChannelKeyService] Successfully pushed key for channel 4151
   Response: {"added":1,"group":"","ids":[262343]}

🚀 [ChannelKeyService] Pushing key for channel 4152 (attempt 1/3)
   Channel: test@gmail.com-091221
   Key preview: AIzaSyDE137EB-iFeZTf0...

✅ [ChannelKeyService] Successfully pushed key for channel 4152
   Response: {"added":1,"group":"","ids":[262344]}

✅ [ChannelKeyService] Completed pushing keys for test@gmail.com
   Success: 3, Failed: 0

🎯 [ChannelKeyService] ==================== END PUSH KEYS ====================
```

## 调试建议

### 1. 删除账户前
确保服务正常运行：
```bash
pm2 status
pm2 logs gcloud-manager --lines 20
```

### 2. 删除账户时
在另一个终端实时监控：
```bash
./watch-channel-key-logs.sh
```

### 3. 删除账户后
检查结果：
```bash
./check-recent-logs.sh
```

查看是否有完整的开始/结束标记对：
```bash
pm2 logs gcloud-manager --lines 200 --nostream | grep -E "START PUSH KEYS|END PUSH KEYS"
```

### 4. 排查问题

#### 如果看不到推送日志
- 检查邮箱是否正确
- 检查MySQL数据库连接
- 检查channels表中是否有对应数据

#### 如果推送失败
- 查看错误信息（带❌标记的行）
- 检查重试次数和间隔
- 检查远程API服务器状态

#### 如果推送部分成功
- 查看"Completed pushing keys"行的Success/Failed统计
- 找到失败的channel ID
- 搜索该ID的详细错误信息

## PM2日志文件位置

如果需要查看历史日志文件：
```bash
# 查看日志文件位置
pm2 show gcloud-manager

# 通常在
~/.pm2/logs/gcloud-manager-out.log
~/.pm2/logs/gcloud-manager-error.log
```

## 日志保留建议

建议设置日志轮转：
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```
