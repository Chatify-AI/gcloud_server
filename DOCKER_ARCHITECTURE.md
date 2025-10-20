# GCloud Manager - Docker 容器化完整架构分析

## 📋 项目概览

GCloud Manager 是一个基于 Node.js 的多账户 Google Cloud 管理系统，包含以下核心组件：

### 系统架构图
```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Applications                          │
│                    (Web UI, CLI, API Clients)                        │
└────────┬──────────────────────┬──────────────────────┬───────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Main Service    │  │ Stats Service    │  │ Executor Service │
│  (Port 3000)     │  │ (Port 4000)      │  │ (Port 3001)      │
│  - Web UI        │  │ - Channel Stats  │  │ - GCloud Exec    │
│  - Auth/JWT      │  │ - Monitoring     │  │ - Command Exec   │
│  - API Gateway   │  │ - SSE Streaming  │  │ - Job Queue      │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                      │                      │
         └──────────┬───────────┴──────────┬───────────┘
                    │                      │
                    ▼                      ▼
            ┌─────────────────────┐  ┌──────────────────┐
            │   MySQL Database    │  │  GCloud Config   │
            │   (Port 3306)       │  │  Volumes         │
            │   - Accounts        │  │  - .config/      │
            │   - Logs            │  │  - Credentials   │
            │   - Stats           │  │                  │
            └─────────────────────┘  └──────────────────┘
```

---

## 🔧 核心服务组件分析

### 1. **Main Service** (backend/src/server.js)
**端口**: 3000
**语言**: Node.js + Express
**主要功能**:
- Web UI 服务 (React 前端)
- OAuth2 认证与 JWT 管理
- API 网关 (路由所有请求)
- WebSocket (Socket.IO) 实时通信
- 用户管理和权限控制

**核心路由**:
- `GET /` - Web UI 主页面
- `POST /api/auth/login` - 用户认证
- `POST /api/gcloud/accounts` - GCloud 账户管理
- `POST /api/commands/execute` - 命令执行
- `GET /api/health` - 健康检查

**依赖服务**:
- MySQL 数据库
- Redis (可选，用于会话)
- GCloud CLI

---

### 2. **Channel Statistics Service** (channel-stats-service/server.js)
**端口**: 4000
**语言**: Node.js + Express
**主要功能**:
- 渠道统计和监控
- SSE (Server-Sent Events) 流式数据传输
- 实时监控仪表板数据
- API 统计和使用记录

**核心路由**:
- `GET /api/stats/overview-stream` - 流式统计数据
- `GET /api/stats/channels` - 渠道列表
- `POST /api/stats/track` - 记录事件

**依赖服务**:
- MySQL 数据库
- OneAPI 服务

---

### 3. **GCloud Executor Service** (gcloud-executor-service)
**端口**: 3001
**语言**: Node.js
**主要功能**:
- 执行 GCloud 命令
- 管理 GCloud 认证凭证
- 命令结果处理和日志记录
- 账户隔离执行环境

**核心接口**:
- `POST /execute` - 执行命令
- `GET /status/:jobId` - 查看命令状态
- `POST /auth/login` - 执行 GCloud 认证

**依赖服务**:
- GCloud CLI
- Redis (任务队列)

---

### 4. **前端应用** (frontend)
**构建工具**: Vite + React
**功能**:
- 管理后台 UI
- 实时数据展示
- 命令执行界面
- 监控仪表板

**静态文件**: 构建后的 dist 目录通过 Express 服务

---

## 📊 数据库结构

### MySQL 数据库: `gcloud`
**连接信息**:
- Host: localhost (或 mysql-service)
- Port: 3306
- Username: gcloud
- Password: gcloud123
- Database: gcloud

**主要表**:
```sql
-- 用户管理
admin (username, passwordHash, role)
api_key (key, permissions, rateLimit, expiresAt)

-- GCloud 账户管理
g_cloud_account (email, projectId, configDir, configName,
                 needMonitor, scriptExecutionCount, lastMonitorTime)

-- 执行历史
command_execution (command, output, error, status, executedBy, executedAt)
execution_history (executionId, status, output, createdAt)

-- 监控日志
gcloud_monitor_log (accountId, monitorStatus, availableChannels,
                    testedChannels, scriptExecuted, lastExecutionTime)
channel_auto_log (fileName, channelName, channelType, status, attempts)

-- 统计数据
channel_statistics (channelId, messageCount, errorCount, lastUpdated)
```

---

## 🌍 环境变量配置

### Main Service (.env)
```bash
# 服务配置
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# 数据库
DB_HOST=mysql-service
DB_PORT=3306
DB_NAME=gcloud
DB_USER=gcloud
DB_PASSWORD=gcloud123

# 认证
JWT_SECRET=<secure-32-char-string>
JWT_EXPIRES_IN=7d
SESSION_SECRET=<secure-session-secret>

# Google OAuth (如果使用)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# 前端
FRONTEND_URL=http://localhost:3000

# GCloud
GCLOUD_PROJECT=<default-project-id>
GCLOUD_CONFIG_DIR=/root/.config/gcloud-manager
```

### Channel Stats Service (.env)
```bash
PORT=4000
NODE_ENV=production
DB_HOST=mysql-service
DB_PORT=3306
DB_NAME=gcloud
DB_USER=gcloud
DB_PASSWORD=gcloud123
```

### GCloud Executor Service (.env)
```bash
PORT=3001
NODE_ENV=production
REDIS_HOST=redis-service
REDIS_PORT=6379
CLOUDSDK_CONFIG=/root/.config/gcloud-manager
```

---

## 💾 存储卷 (Volumes) 需求

### 持久化存储
1. **MySQL 数据**: `/var/lib/mysql`
   - 存储所有数据库数据
   - 关键: 必须持久化

2. **GCloud 配置**: `/root/.config/gcloud-manager`
   - GCloud CLI 配置和凭证
   - 每个账户单独的配置目录
   - 关键: 必须持久化

3. **应用日志**: `/app/logs`
   - 服务运行日志
   - 命令执行日志
   - 建议: 持久化

4. **上传文件** (如需): `/app/uploads`
   - 用户上传的文件
   - 建议: 持久化

---

## 🔐 外部依赖分析

### 必需的外部工具

1. **GCloud CLI**
   - 必需在容器内安装
   - 版本: Latest (或指定版本)
   - 用途: 执行 GCloud 命令

2. **Google Cloud SDK**
   - 随 GCloud CLI 自动安装
   - 包含认证工具

### 可选的外部服务

1. **Redis** (可选但推荐)
   - 用于会话存储
   - 用于任务队列
   - 用于缓存

2. **FTP 服务** (未来需求)
   - 目前项目不包含
   - 可选: 使用 vsftpd 或 pure-ftpd

---

## 📦 Docker 镜像规划

### 基础镜像选择
- **主应用**: `node:18-slim` (轻量级，已包含 Node.js)
- **前端构建**: `node:18-alpine` (超轻量，用于构建阶段)

### 多阶段构建优势
- 第一阶段: 构建前端 (Vite 编译)
- 第二阶段: 构建后端 (安装依赖)
- 第三阶段: 运行时 (仅包含必要文件)

---

## 🚀 启动顺序与健康检查

### 启动依赖关系
```
mysql-service
    ↓
main-service (等待 MySQL 就绪)
    ↓
stats-service (依赖 MySQL 和 main-service)
    ↓
executor-service (可以并行启动)
```

### 健康检查端点
```
main-service:     GET /health
stats-service:    GET /health
executor-service: GET /health
mysql-service:    mysqladmin ping
```

---

## 🔄 网络配置

### Docker 网络
- **网络名称**: `gcloud-network`
- **类型**: bridge (用于容器间通信)
- **服务间通信**:
  - `http://main-service:3000`
  - `http://stats-service:4000`
  - `http://executor-service:3001`
  - `mysql-service:3306`

### 外部访问
- **主应用**: `http://localhost:3000`
- **统计服务**: `http://localhost:4000`
- **执行器**: `http://localhost:3001` (内部使用)

---

## 📋 FTP 服务集成方案

### 选项 1: Pure-FTP (推荐)
```dockerfile
RUN apt-get install -y pure-ftpd
EXPOSE 20 21
EXPOSE 30000-30100
```

### 选项 2: vsftpd
```dockerfile
RUN apt-get install -y vsftpd
EXPOSE 20 21
```

### FTP 集成步骤
1. 创建 FTP 用户目录
2. 配置 FTP 权限 (上传/下载/删除)
3. 映射 FTP 端口 (20, 21, 30000-30100)
4. 创建 FTP 凭证管理

---

## ⚙️ 编排配置关键要素

### Resource Limits (资源限制)
```yaml
main-service:
  cpu: 1.0
  memory: 512M

stats-service:
  cpu: 0.5
  memory: 256M

mysql-service:
  cpu: 1.0
  memory: 1024M
```

### Restart Policies (重启策略)
- **生产环境**: `unless-stopped` (异常自动重启)
- **开发环境**: `no` (手动控制)

### Logging (日志驱动)
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 🛠️ 初始化流程

### 启动时必需的操作
1. MySQL 数据库初始化
2. 表结构创建 (如需)
3. 初始管理员账户创建
4. GCloud CLI 配置初始化
5. 前端资源部署

### 脚本文件
- `docker-entrypoint.sh` - 主应用启动脚本
- `init-database.js` - 数据库初始化
- `init-gcloud.sh` - GCloud 初始化

---

## 📱 部署环境预检

### 最小系统要求
- **CPU**: 2 核心
- **内存**: 4GB
- **磁盘**: 20GB (含数据)
- **Docker**: 20.10+
- **Docker Compose**: 1.29+

### 建议配置 (生产)
- **CPU**: 4 核心
- **内存**: 8GB
- **磁盘**: 50GB+ (可扩展)
- **网络**: 1Mbps 最低

---

## 🎯 后续工作清单

- [ ] 创建 docker-compose.yml
- [ ] 编写 Dockerfile (main-service)
- [ ] 编写 Dockerfile (stats-service)
- [ ] 编写 Dockerfile (executor-service)
- [ ] 创建 docker-entrypoint.sh
- [ ] 创建数据库初始化脚本
- [ ] 测试容器编排和启动
- [ ] 文档: 部署指南
- [ ] 文档: 运维指南
- [ ] 性能优化和调优
- [ ] 添加 FTP 服务支持
- [ ] 集成监控系统 (Prometheus/Grafana)

