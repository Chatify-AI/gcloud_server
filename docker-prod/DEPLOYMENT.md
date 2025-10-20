# GCloud Manager 生产环境部署文档

## 🎉 部署成功！

所有服务已成功容器化并通过 Docker Compose 完成部署。

## 📦 服务架构

### 服务列表

| 服务名称 | 容器名 | 端口映射 | 状态 | 说明 |
|---------|--------|---------|------|------|
| MySQL 数据库 | gcloud-mysql | 5306:3306 | ✅ Healthy | MySQL 8.0 |
| Redis 缓存 | gcloud-redis | 5379:6379 | ✅ Healthy | Redis 7 Alpine |
| 主应用服务 | gcloud-main | 5000:3000 | ✅ Healthy | 主要业务逻辑和 Web 界面 |
| 统计服务 | gcloud-stats | 5001:4000 | ✅ Healthy | 渠道统计分析服务 |
| 执行器服务 | gcloud-executor | 5002:3001 | ✅ Healthy | GCloud 命令执行服务 |
| Nginx 代理 | gcloud-nginx | 5080:80, 5443:443 | ✅ Running | 反向代理和负载均衡 |

### 网络架构

- **自定义网络**: `gcloud-network` (172.28.0.0/16)
- **服务间通信**: 通过 Docker 内部 DNS 解析服务名
- **对外访问**: 通过 5000+ 端口系列

## 🚀 快速开始

### 启动所有服务

```bash
# 在项目根目录执行
docker-compose -f docker-compose.prod.yml up -d

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看服务日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 停止所有服务

```bash
docker-compose -f docker-compose.prod.yml down

# 同时删除数据卷（谨慎操作！）
docker-compose -f docker-compose.prod.yml down -v
```

### 重启单个服务

```bash
# 重启主服务
docker-compose -f docker-compose.prod.yml restart main-service

# 查看单个服务日志
docker-compose -f docker-compose.prod.yml logs -f main-service
```

### 验证部署

```bash
# 运行验证脚本
./verify-deployment.sh
```

## 🔧 配置说明

### 环境变量配置

所有服务的环境变量在 `docker-compose.prod.yml` 中配置：

```yaml
environment:
  DB_HOST: mysql-service
  DB_PORT: 3306
  DB_NAME: gcloud
  DB_USER: gcloud
  DB_PASSWORD: gcloud123  # 生产环境请修改！
  REDIS_HOST: redis-service
  REDIS_PORT: 6379
  REDIS_PASSWORD: redis123  # 生产环境请修改！
  NODE_ENV: production
```

### 数据持久化

以下数据使用 Docker Volume 持久化存储：

- `mysql_data`: MySQL 数据库文件
- `redis_data`: Redis 持久化数据
- `gcloud_config`: GCloud CLI 配置文件
- `app_logs`: 主应用日志
- `stats_logs`: 统计服务日志
- `executor_logs`: 执行器服务日志

### 资源限制

每个服务都配置了 CPU 和内存限制：

- **MySQL**: 最大 1 CPU / 1GB 内存
- **Redis**: 最大 0.5 CPU / 256MB 内存
- **Main Service**: 最大 1 CPU / 512MB 内存
- **Stats Service**: 最大 0.5 CPU / 256MB 内存
- **Executor Service**: 最大 1 CPU / 512MB 内存
- **Nginx**: 最大 0.5 CPU / 256MB 内存

## 📝 服务详情

### 主应用服务 (Main Service)

- **端口**: 5000
- **健康检查**: http://localhost:5000/health
- **功能**: Web 管理界面、API 网关、GCloud 账户管理
- **Dockerfile**: `docker-prod/main/Dockerfile`

**特性**:
- 多阶段构建（前端 + 后端）
- 集成 Google Cloud SDK
- 非 root 用户运行（node 用户）
- 自动健康检查（30秒间隔）

### 统计服务 (Stats Service)

- **端口**: 5001
- **健康检查**: http://localhost:5001/health
- **功能**: 渠道统计、数据分析、SSE 流式统计
- **Dockerfile**: `docker-prod/stats/Dockerfile`

**特性**:
- 轻量级 Alpine 镜像
- 独立的统计数据库连接
- 实时流式统计 API

### 执行器服务 (Executor Service)

- **端口**: 5002
- **健康检查**: http://localhost:5002/health
- **功能**: GCloud 命令执行、Shell 脚本执行
- **Dockerfile**: `docker-prod/executor/Dockerfile`

**特性**:
- 完整的 GCloud SDK 安装
- SYS_ADMIN 权限支持
- 独立的配置目录隔离

### Nginx 反向代理

- **HTTP 端口**: 5080
- **HTTPS 端口**: 5443
- **配置文件**: `docker-prod/nginx/nginx.conf`

**代理规则**:
- `/` → Main Service (3000)
- `/api/stats/` → Stats Service (4000)

## 🔍 故障排查

### 查看服务日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs main-service
docker-compose -f docker-compose.prod.yml logs executor-service
docker-compose -f docker-compose.prod.yml logs stats-service

# 实时跟踪日志
docker-compose -f docker-compose.prod.yml logs -f --tail=100
```

### 进入容器调试

```bash
# 进入主服务容器
docker exec -it gcloud-main bash

# 进入 MySQL 容器
docker exec -it gcloud-mysql mysql -uroot -proot123

# 进入 Redis 容器
docker exec -it gcloud-redis redis-cli -a redis123
```

### 常见问题

#### 1. 服务无法启动

```bash
# 检查容器日志
docker logs gcloud-main

# 检查端口占用
netstat -tulpn | grep 5000

# 重建服务
docker-compose -f docker-compose.prod.yml up -d --force-recreate main-service
```

#### 2. 数据库连接失败

```bash
# 检查 MySQL 是否健康
docker-compose -f docker-compose.prod.yml ps mysql-service

# 测试数据库连接
docker exec gcloud-mysql mysqladmin ping -h localhost
```

#### 3. Redis 连接失败

```bash
# 检查 Redis 是否健康
docker exec gcloud-redis redis-cli -a redis123 ping
```

## 🔐 安全建议

### 生产环境必做

1. **修改默认密码**
   - MySQL root 密码
   - MySQL gcloud 用户密码
   - Redis 密码
   - JWT_SECRET
   - SESSION_SECRET

2. **使用环境变量文件**
   ```bash
   cp .env.prod.example .env.prod
   # 编辑 .env.prod 设置安全密码
   ```

3. **配置 HTTPS**
   - 在 Nginx 配置中添加 SSL 证书
   - 使用 Let's Encrypt 自动续期

4. **限制网络访问**
   - 配置防火墙规则
   - 只开放必要的端口

5. **定期备份**
   ```bash
   # 备份数据库
   docker exec gcloud-mysql mysqldump -uroot -proot123 gcloud > backup.sql

   # 备份所有数据卷
   docker run --rm -v gcloud_server_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup.tar.gz /data
   ```

## 📊 监控和维护

### 健康检查

所有服务都配置了自动健康检查：

```bash
# 查看健康状态
docker-compose -f docker-compose.prod.yml ps
```

### 日志管理

所有服务配置了日志轮转：
- 最大文件大小: 10MB
- 保留文件数: 3-5 个

### 更新服务

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose -f docker-compose.prod.yml build

# 重启服务（零停机时间）
docker-compose -f docker-compose.prod.yml up -d --no-deps --build main-service
```

## 📈 性能优化

### 资源调整

根据实际使用情况调整 `docker-compose.prod.yml` 中的资源限制：

```yaml
deploy:
  resources:
    limits:
      cpus: "2.0"      # 增加 CPU 限制
      memory: 1G       # 增加内存限制
    reservations:
      cpus: "1.0"
      memory: 512M
```

### 数据库优化

```bash
# 连接到 MySQL
docker exec -it gcloud-mysql mysql -uroot -proot123

# 查看慢查询
SHOW VARIABLES LIKE 'slow_query%';

# 优化表
OPTIMIZE TABLE table_name;
```

## 🎯 访问地址

- **主应用 Web 界面**: http://localhost:5000
- **统计服务 API**: http://localhost:5001
- **执行器服务 API**: http://localhost:5002
- **Nginx 代理入口**: http://localhost:5080

## 📞 技术支持

如有问题，请查看：
1. 项目 README.md
2. 各服务的日志文件
3. Docker 容器状态

---

**部署完成时间**: 2025-10-20
**Docker Compose 版本**: 3.8
**测试状态**: ✅ 所有服务健康运行
