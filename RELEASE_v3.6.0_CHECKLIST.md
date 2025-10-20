# Release v3.6.0 部署和配置检查清单

**版本**: v3.6.0
**发布日期**: 2025-10-20
**Git Tag**: v3.6.0

---

## ✅ 提交状态

- [x] 代码已提交到 GitHub
- [x] Tag v3.6.0 已创建并推送
- [x] 共提交 57 个文件，9180+ 行新增代码

**提交哈希**: `06b618a`
**GitHub**: https://github.com/Chatify-AI/gcloud_server

---

## 📋 配置清单

### 1. 环境变量配置 (.env)

#### 必须配置的变量
```bash
# 数据库
DB_PASSWORD=gcloud123              # ⚠️ 生产环境请修改
MYSQL_ROOT_PASSWORD=root123        # ⚠️ 生产环境请修改

# Redis
REDIS_PASSWORD=redis123            # ⚠️ 生产环境请修改

# JWT和Session
JWT_SECRET=your-jwt-secret         # ⚠️ 必须修改为随机字符串
SESSION_SECRET=your-session-secret # ⚠️ 必须修改为随机字符串
```

#### 可选配置的变量（已有默认值）
```bash
# OneAPI主服务（11002端口）- 可配置
ONEAPI_BASE_URL=http://104.194.9.201:11002
ONEAPI_KEY=t0bAXxyETOitEfEWuU37sWSqwJrE

# GCloud脚本下载 - 可配置
GCLOUD_SCRIPT_URL=https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh
GCLOUD_SCRIPT_BACKUP_URL=  # 可选，留空则不使用备用URL

# FTP配置 - 可配置
FTP_PUBLIC_HOST=82.197.94.152
FTP_USERNAME=chatify
FTP_PASSWORD=chatify123

# 日志级别 - 可配置
LOG_LEVEL=info  # debug, info, warn, error
```

#### 固定不可配置的部分
```bash
# Gemini渠道（13000端口）- 硬编码在代码中
# URL: http://104.194.9.201:13000
# API Key: lvlgr4jIX9c+jhgJs6MHb0bg40pt0LwB
```

### 2. 配置文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| 环境变量示例 | `.env.example` | 所有可配置项的模板 |
| 服务配置 | `backend/config/service.config.js` | 服务端统一配置 |
| 数据库配置 | `backend/config/database.js` | MySQL连接配置 |
| Docker Compose | `docker-compose.prod.yml` | 生产环境容器配置 |

---

## 🐳 Docker镜像清单

### 镜像列表

| 服务 | Dockerfile路径 | 镜像用途 |
|------|---------------|---------|
| main-service | `docker-prod/main/Dockerfile` | 主应用服务 |
| executor-service | `docker-prod/executor/Dockerfile` | 命令执行服务 |
| stats-service | `docker-prod/stats/Dockerfile` | 统计服务 |
| ftp-service | `docker-prod/ftp/Dockerfile` | FTP文件服务器 |

### 第三方镜像

| 服务 | 镜像 | 版本 |
|------|------|------|
| MySQL | `mysql` | 8.0 |
| Redis | `redis` | 7-alpine |
| Nginx | `nginx` | 1.25-alpine |

### 构建镜像

```bash
# 方式1: 使用docker-compose构建所有镜像
docker-compose -f docker-compose.prod.yml build

# 方式2: 单独构建每个服务
docker-compose -f docker-compose.prod.yml build main-service
docker-compose -f docker-compose.prod.yml build executor-service
docker-compose -f docker-compose.prod.yml build stats-service
docker-compose -f docker-compose.prod.yml build ftp-service
```

---

## 🗄️ 数据库迁移清单

### 必须执行的SQL脚本

1. **账户删除CASCADE修复**（如果之前部署过）
   ```bash
   docker exec gcloud-mysql mysql -ugcloud -pgcloud123 -Dgcloud < fix-account-delete-cascade.sql
   ```

### 验证数据库

```bash
# 检查外键约束
docker exec gcloud-mysql mysql -ugcloud -pgcloud123 -Dgcloud -e "
SELECT TABLE_NAME, CONSTRAINT_NAME, DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'gcloud'
  AND REFERENCED_TABLE_NAME = 'g_cloud_accounts';"

# 预期结果：
# command_executions | command_executions_ibfk_1 | CASCADE
# execution_history  | execution_history_ibfk_1   | SET NULL
```

---

## 🚀 部署步骤

### 1. 准备环境

```bash
# 克隆或更新代码
git clone https://github.com/Chatify-AI/gcloud_server.git
cd gcloud_server
git checkout v3.6.0

# 或者更新现有代码
git fetch --tags
git checkout v3.6.0
```

### 2. 配置环境变量

```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 文件，修改以下必填项：
# - DB_PASSWORD
# - MYSQL_ROOT_PASSWORD
# - REDIS_PASSWORD
# - JWT_SECRET
# - SESSION_SECRET
# - FTP_PUBLIC_HOST（如果需要外部访问FTP）

# ⚠️ 生产环境强烈建议修改所有密码和密钥！
```

### 3. 启动服务

```bash
# 首次启动（会自动构建镜像）
docker-compose -f docker-compose.prod.yml up -d

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. 验证部署

```bash
# 运行验证脚本
chmod +x verify-deployment.sh
./verify-deployment.sh

# 手动检查各服务
curl http://localhost:5080/health              # Nginx -> Main
curl http://localhost:5001/health              # Stats Service
curl http://localhost:5002/health              # Executor Service

# 检查数据库
docker exec gcloud-mysql mysql -ugcloud -pgcloud123 -Dgcloud -e "SHOW TABLES;"

# 检查Redis
docker exec gcloud-redis redis-cli -a redis123 PING
```

### 5. 执行数据库迁移（如果需要）

```bash
# 如果从旧版本升级，执行CASCADE修复
docker exec gcloud-mysql mysql -ugcloud -pgcloud123 -Dgcloud < fix-account-delete-cascade.sql
```

---

## 🔍 问题排查检查清单

### 服务无法启动

- [ ] 检查端口是否被占用：`netstat -tulpn | grep -E "5000|5001|5002|5021|5080|5306|5379"`
- [ ] 检查Docker是否运行：`docker ps`
- [ ] 查看服务日志：`docker-compose -f docker-compose.prod.yml logs [service-name]`
- [ ] 检查环境变量是否正确：`docker-compose -f docker-compose.prod.yml config`

### MySQL连接失败

- [ ] 检查MySQL容器健康状态：`docker inspect gcloud-mysql | grep Health`
- [ ] 检查密码是否正确：`.env` 中的 `DB_PASSWORD` 和 `MYSQL_ROOT_PASSWORD`
- [ ] 等待MySQL完全启动（约20-30秒）

### Redis连接失败

- [ ] 检查Redis容器状态：`docker ps | grep redis`
- [ ] 检查Redis密码：`.env` 中的 `REDIS_PASSWORD`
- [ ] 测试连接：`docker exec gcloud-redis redis-cli -a [password] PING`

### Cloud Shell命令超时

- [ ] 检查executor-service是否运行：`docker ps | grep executor`
- [ ] 检查syncAuth配置：应该为 `false`
- [ ] 检查超时配置：
  - 前端：`frontend/src/services/api.js` - 120秒
  - 后端：`backend/services/gcloudExecutorClient.js` - 10分钟

### 脚本下载失败

- [ ] 检查GitHub URL是否可访问
- [ ] 检查备用URL配置：`GCLOUD_SCRIPT_BACKUP_URL`
- [ ] 查看日志确认使用了哪个URL

---

## 📊 服务端口映射

| 服务 | 内部端口 | 外部端口 | 用途 |
|------|---------|---------|------|
| Nginx | 80 | 5080 | HTTP反向代理 |
| Main Service | 3000 | 5000 | 主应用API |
| Stats Service | 4000 | 5001 | 统计服务API |
| Executor Service | 3001 | 5002 | 命令执行API |
| MySQL | 3306 | 5306 | 数据库 |
| Redis | 6379 | 5379 | 缓存 |
| FTP | 21 | 5021 | FTP控制端口 |
| FTP Data | 30000-30009 | 50000-50009 | FTP数据端口 |

---

## 📝 版本变更说明

### 新增功能

1. **配置化改进**
   - OneAPI 11002端口完全配置化
   - GCloud脚本URL支持主+备用智能容错
   - 统一配置管理（service.config.js）

2. **Docker部署**
   - 完整的生产环境Docker Compose配置
   - 7服务架构部署
   - 健康检查和资源限制

3. **性能优化**
   - 前端超时：30秒 → 120秒
   - 后端超时：30秒 → 10分钟
   - 禁用syncAuth避免hang

### 修复问题

1. **Cloud Shell超时** ✅
   - 修复30秒超时导致命令失败
   - 添加长超时支持（10分钟）

2. **初始化脚本执行失败** ✅
   - 禁用syncAuth避免hang
   - 优化脚本执行流程

3. **账户删除失败** ✅
   - 添加ON DELETE CASCADE外键约束
   - 提供迁移SQL脚本

4. **硬编码配置** ✅
   - OneAPI主服务配置化
   - 脚本URL配置化
   - 支持环境变量覆盖

### 向后兼容性

- ✅ 完全向后兼容
- ✅ 默认配置值与之前硬编码相同
- ✅ 无破坏性变更
- ✅ 可直接升级无需修改现有配置

---

## 🔐 安全检查清单

- [ ] **已修改默认密码**
  - [ ] MySQL root密码
  - [ ] MySQL gcloud用户密码
  - [ ] Redis密码
  - [ ] FTP用户密码

- [ ] **已生成随机密钥**
  - [ ] JWT_SECRET（建议64字符以上）
  - [ ] SESSION_SECRET（建议64字符以上）

- [ ] **防火墙配置**
  - [ ] 仅开放必要端口（5080, 5021, 50000-50009）
  - [ ] 数据库和Redis端口不对外暴露

- [ ] **HTTPS配置**（可选但推荐）
  - [ ] 配置SSL证书
  - [ ] Nginx HTTPS配置

---

## 📚 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| Docker快速启动 | `DOCKER_QUICK_START.md` | 快速部署指南 |
| Docker架构 | `DOCKER_ARCHITECTURE.md` | 架构说明 |
| 生产环境部署 | `docker-prod/DEPLOYMENT.md` | 详细部署步骤 |
| 配置化改进 | `配置化改进总结.md` | 配置化修复说明 |
| syncAuth修复 | `syncAuth问题修复总结.md` | 超时问题修复 |
| 账户删除修复 | `账户删除失败问题修复.md` | CASCADE修复 |
| OneAPI配置化 | `OneAPI配置化修复-仅11002端口.md` | OneAPI配置说明 |
| 脚本URL配置化 | `GCloud脚本URL配置化修复.md` | 脚本URL配置 |

---

## 🎯 后续维护建议

1. **定期备份**
   ```bash
   # 备份MySQL数据
   docker exec gcloud-mysql mysqldump -ugcloud -pgcloud123 gcloud > backup_$(date +%Y%m%d).sql

   # 备份Redis数据
   docker exec gcloud-redis redis-cli -a redis123 SAVE
   ```

2. **日志监控**
   ```bash
   # 查看所有服务日志
   docker-compose -f docker-compose.prod.yml logs -f

   # 查看特定服务日志
   docker-compose -f docker-compose.prod.yml logs -f main-service
   ```

3. **资源监控**
   ```bash
   # 查看容器资源使用
   docker stats

   # 查看特定容器
   docker stats gcloud-main gcloud-executor gcloud-mysql
   ```

4. **更新部署**
   ```bash
   # 拉取最新代码
   git pull origin main

   # 重建镜像
   docker-compose -f docker-compose.prod.yml build

   # 重启服务
   docker-compose -f docker-compose.prod.yml up -d
   ```

---

## ✅ 最终检查

部署完成后，确认以下所有项目：

- [ ] 所有7个服务容器正在运行
- [ ] 健康检查全部通过
- [ ] Web界面可以访问（http://your-server:5080）
- [ ] API接口正常响应
- [ ] 数据库连接正常
- [ ] Redis连接正常
- [ ] Cloud Shell命令可以执行
- [ ] 账户可以正常创建和删除
- [ ] 日志没有错误信息
- [ ] 所有密码已修改为安全值

---

**发布负责人**: Claude Code
**发布时间**: 2025-10-20
**版本状态**: ✅ 已发布并推送到GitHub

如有问题，请查看相关文档或检查日志文件。
