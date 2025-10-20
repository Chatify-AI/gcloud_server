# GCloud Manager - Docker 部署完整指南

## 📋 目录

1. [前置条件](#前置条件)
2. [快速开始](#快速开始)
3. [详细安装步骤](#详细安装步骤)
4. [配置说明](#配置说明)
5. [常见操作](#常见操作)
6. [故障排除](#故障排除)
7. [性能优化](#性能优化)
8. [生产部署](#生产部署)
9. [备份和恢复](#备份和恢复)

---

## 前置条件

### 系统要求

- **操作系统**: Linux (Ubuntu 20.04+, CentOS 8+) 或 macOS
- **CPU**: 最少 2 核心 (生产环境推荐 4 核心)
- **内存**: 最少 4GB (生产环境推荐 8GB+)
- **磁盘**: 最少 20GB (包含数据)
- **网络**: 稳定的网络连接

### 必需软件

```bash
# 检查 Docker 版本
docker --version          # 需要 20.10 或更高版本
docker-compose --version  # 需要 1.29 或更高版本
```

### 安装 Docker 和 Docker Compose

#### Ubuntu/Debian

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 添加当前用户到 docker 组 (可选,避免每次都用 sudo)
sudo usermod -aG docker $USER
```

#### macOS

```bash
# 安装 Docker Desktop (包含 Docker 和 Docker Compose)
# 从 https://www.docker.com/products/docker-desktop 下载安装

# 或使用 Homebrew
brew install docker docker-compose
```

---

## 快速开始

### 1. 克隆或获取项目

```bash
cd /path/to/gcloud-server
```

### 2. 准备环境文件

```bash
# 复制示例 env 文件
cp .env.docker .env

# 编辑 .env 文件，设置必需的配置
# 重要: 更改以下密钥!!!
# - JWT_SECRET
# - SESSION_SECRET
# - DB_PASSWORD (如果需要)
# - REDIS_PASSWORD
nano .env
```

### 3. 创建数据目录

```bash
# 创建所有必需的数据目录
mkdir -p data/{mysql,redis,gcloud-config,logs/{app,stats,executor},frontend-build,ftp}

# 设置权限
chmod -R 755 data/
```

### 4. 启动所有服务

```bash
# 启动所有容器 (后台运行)
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f main-service
```

### 5. 验证部署

```bash
# 等待约 30 秒,让所有服务启动完毕

# 检查主应用
curl http://localhost:3000/health

# 检查统计服务
curl http://localhost:4000/health

# 检查执行器服务
curl http://localhost:3001/health

# 打开 Web UI
# 访问 http://localhost:3000
```

---

## 详细安装步骤

### 第一步: 准备系统环境

```bash
# 1. 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 2. 安装基础工具
sudo apt-get install -y curl wget git

# 3. 设置时区 (重要!)
sudo timedatectl set-timezone Asia/Shanghai
# 或
sudo timedatectl set-timezone UTC

# 4. 检查磁盘空间
df -h
```

### 第二步: 安装 Docker

```bash
# 使用官方脚本安装
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 验证安装
docker --version
docker run hello-world
```

### 第三步: 安装 Docker Compose

```bash
# 下载最新版本
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)

sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

### 第四步: 克隆项目

```bash
# 方式一: 使用 git (如果已配置)
git clone https://your-repo.git gcloud-server
cd gcloud-server

# 方式二: 从本地上传
# 将项目复制到服务器
```

### 第五步: 配置环境变量

```bash
# 1. 复制示例文件
cp .env.docker .env

# 2. 编辑配置文件
nano .env
```

**重要配置项**:

```env
# 必需修改!
JWT_SECRET=<生成32字符随机字符串>
SESSION_SECRET=<生成32字符随机字符串>
DB_PASSWORD=gcloud123  # 建议修改
REDIS_PASSWORD=<生成强密码>
MYSQL_ROOT_PASSWORD=<生成强密码>

# Google Cloud 配置 (如需要)
GCLOUD_PROJECT=your-project-id

# 环境
NODE_ENV=production

# 可选: 自定义卷路径
VOLUME_PATH=/data/gcloud
```

### 第六步: 创建数据目录

```bash
# 创建目录结构
mkdir -p data/{mysql,redis,gcloud-config,logs,frontend-build,ftp}

# 设置权限
chmod -R 755 data/
sudo chown -R 999:999 data/mysql/  # MySQL 用户
sudo chown -R 999:999 data/redis/  # Redis 用户
```

### 第七步: 构建和启动容器

```bash
# 1. 构建镜像 (首次运行)
docker-compose build

# 2. 启动所有服务
docker-compose up -d

# 3. 检查容器状态
docker-compose ps

# 输出应该显示:
# mysql-service       ... healthy
# redis-service       ... healthy
# main-service        ... healthy
# stats-service       ... healthy
# executor-service    ... healthy
```

### 第八步: 初始化数据库

```bash
# 等待 MySQL 完全启动
sleep 30

# 检查数据库是否初始化
docker-compose exec mysql-service mysql -u root -p$MYSQL_ROOT_PASSWORD -e "USE gcloud; SHOW TABLES;"

# 如果需要手动导入初始化脚本
docker-compose exec mysql-service mysql -u gcloud -pgcloud123 gcloud < docker/mysql/init.sql
```

### 第九步: 创建默认管理员

```bash
# 进入主应用容器
docker-compose exec main-service /bin/bash

# 运行管理员创建脚本 (如果存在)
node backend/scripts/create-admin.js

# 或使用 CLI
npm run cli admin create -- --username admin --password admin123

# 退出容器
exit
```

### 第十步: 验证所有服务

```bash
# 1. 检查健康状态
curl http://localhost:3000/health
curl http://localhost:4000/health
curl http://localhost:3001/health

# 2. 查看日志
docker-compose logs --tail=100 main-service
docker-compose logs --tail=100 stats-service

# 3. 测试 API
curl -X GET http://localhost:3000/api/health

# 4. 访问 Web UI
# 打开浏览器访问 http://localhost:3000
```

---

## 配置说明

### 环境变量详解

| 变量 | 默认值 | 说明 | 是否必需 |
|------|--------|------|---------|
| `NODE_ENV` | production | Node.js 环境 | 是 |
| `PORT` | 3000 | 主应用端口 | 否 |
| `DB_HOST` | mysql-service | 数据库主机 | 是 |
| `DB_PORT` | 3306 | 数据库端口 | 否 |
| `DB_NAME` | gcloud | 数据库名 | 是 |
| `JWT_SECRET` | - | JWT 加密密钥 (32+ 字符) | 是 |
| `SESSION_SECRET` | - | 会话加密密钥 (32+ 字符) | 是 |
| `REDIS_HOST` | redis-service | Redis 主机 | 否 |
| `GCLOUD_PROJECT` | - | GCP 默认项目 | 否 |
| `LOG_LEVEL` | info | 日志级别 | 否 |

### 生成安全的密钥

```bash
# 生成 32 字符的随机字符串
openssl rand -base64 32

# 生成 64 字符的随机字符串
openssl rand -base64 64

# 或使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 卷挂载说明

```yaml
# 数据库数据 (MySQL)
mysql_data: ./data/mysql

# Redis 数据
redis_data: ./data/redis

# GCloud 配置 (所有服务共享)
gcloud_config: ./data/gcloud-config

# 应用日志
app_logs: ./data/logs/app
stats_logs: ./data/logs/stats
executor_logs: ./data/logs/executor

# FTP 数据
ftp_data: ./data/ftp
```

---

## 常见操作

### 启动和停止

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启特定服务
docker-compose restart main-service

# 停止单个服务
docker-compose stop mysql-service
```

### 查看日志

```bash
# 查看所有日志 (最后 100 行)
docker-compose logs --tail=100

# 实时查看特定服务日志
docker-compose logs -f main-service

# 查看历史日志
docker-compose logs main-service | head -50
```

### 进入容器

```bash
# 进入主应用容器
docker-compose exec main-service bash

# 进入数据库容器
docker-compose exec mysql-service bash

# 执行命令
docker-compose exec main-service npm run cli status
```

### 管理数据库

```bash
# 连接到 MySQL
docker-compose exec mysql-service mysql -u gcloud -pgcloud123 gcloud

# 查看所有表
mysql> SHOW TABLES;

# 查看数据库大小
mysql> SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
        FROM information_schema.TABLES
        WHERE table_schema = 'gcloud';

# 导出数据库
docker-compose exec mysql-service mysqldump -u gcloud -pgcloud123 gcloud > backup.sql

# 导入数据库
docker-compose exec -T mysql-service mysql -u gcloud -pgcloud123 gcloud < backup.sql
```

### 监控资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
docker system df

# 清理未使用的资源
docker system prune -a
```

### 更新应用

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 重启服务
docker-compose up -d

# 4. 查看日志验证
docker-compose logs -f main-service
```

---

## 故障排除

### 常见问题

#### 1. 容器无法启动

```bash
# 查看错误日志
docker-compose logs main-service

# 检查端口是否被占用
sudo netstat -tlnp | grep 3000

# 解决方案: 修改 docker-compose.yml 中的端口或停止占用服务
```

#### 2. 数据库连接失败

```bash
# 检查 MySQL 容器状态
docker-compose ps mysql-service

# 查看 MySQL 日志
docker-compose logs mysql-service

# 验证数据库连接
docker-compose exec mysql-service mysql -u root -p<password> -e "SELECT 1;"

# 重新初始化数据库
docker-compose exec mysql-service mysql -u root -p<password> < docker/mysql/init.sql
```

#### 3. Redis 连接失败

```bash
# 测试 Redis 连接
docker-compose exec redis-service redis-cli ping

# 检查 Redis 密码
docker-compose exec redis-service redis-cli -a <password> PING

# 查看 Redis 日志
docker-compose logs redis-service
```

#### 4. GCloud 认证失败

```bash
# 检查 GCloud 配置
docker-compose exec executor-service gcloud config list

# 验证认证
docker-compose exec executor-service gcloud auth list

# 重新初始化 GCloud
docker-compose exec executor-service gcloud auth login
```

#### 5. 内存不足

```bash
# 查看容器内存使用
docker stats

# 增加容器内存限制 (在 docker-compose.yml 中修改 memory 值)
# 重启容器
docker-compose up -d

# 清理 Docker 缓存
docker system prune
```

### 调试模式

```bash
# 启用调试日志
docker-compose exec main-service node --inspect=0.0.0.0:9229 backend/src/server.js

# 或设置环境变量
docker-compose exec main-service bash
export DEBUG=*
npm start
```

---

## 性能优化

### 1. 数据库优化

```bash
# 进入 MySQL 容器
docker-compose exec mysql-service mysql -u gcloud -pgcloud123 gcloud

# 检查慢查询
mysql> SELECT * FROM mysql.slow_log;

# 添加索引
mysql> CREATE INDEX idx_created_at ON command_execution(created_at);

# 优化表
mysql> OPTIMIZE TABLE command_execution;
```

### 2. Redis 优化

```bash
# 监控 Redis
docker-compose exec redis-service redis-cli MONITOR

# 查看统计
docker-compose exec redis-service redis-cli INFO

# 清理过期数据
docker-compose exec redis-service redis-cli FLUSHDB
```

### 3. 应用优化

```bash
# 调整 Node.js 内存限制 (在 docker-compose.yml 中)
environment:
  NODE_OPTIONS: "--max-old-space-size=1024"
```

### 4. 网络优化

```bash
# 启用 Nginx 缓存和压缩 (已在配置中)
# 定期检查网络延迟
docker-compose exec main-service ping -c 4 mysql-service
```

---

## 生产部署

### 前置检查清单

- [ ] 使用强密钥替换所有默认密码
- [ ] 启用 HTTPS/SSL
- [ ] 配置防火墙规则
- [ ] 设置日志聚合
- [ ] 配置备份策略
- [ ] 设置监控告警
- [ ] 进行负载测试
- [ ] 配置自动重启策略

### 安全配置

```bash
# 1. 限制 Docker 访问
sudo usermod -aG docker limited-user  # 不推荐给所有用户添加

# 2. 配置防火墙
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # 如果直接暴露
sudo ufw enable

# 3. 设置 SELinux (如果使用 CentOS)
sudo semanage port -a -t http_port_t -p tcp 3000
```

### HTTPS 配置

```bash
# 1. 生成自签名证书 (测试用)
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/private.key \
  -out docker/nginx/ssl/certificate.crt

# 2. 或使用 Let's Encrypt (推荐)
sudo apt-get install -y certbot python3-certbot-nginx

# 3. 在 nginx.conf 中配置 HTTPS
```

### 监控和日志

```bash
# 启用日志驱动
# 在 docker-compose.yml 中配置日志驱动

# 使用 ELK Stack (Elasticsearch, Logstash, Kibana)
# 或其他日志聚合工具

# 配置 Prometheus 监控
docker run -d --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

---

## 备份和恢复

### 备份策略

```bash
# 备份脚本 (backup.sh)
#!/bin/bash

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# 备份 MySQL
echo "Backing up MySQL..."
docker-compose exec -T mysql-service mysqldump -u gcloud -pgcloud123 gcloud > $BACKUP_DIR/gcloud.sql

# 备份 GCloud 配置
echo "Backing up GCloud config..."
tar -czf $BACKUP_DIR/gcloud-config.tar.gz data/gcloud-config/

# 备份应用代码和配置
echo "Backing up application..."
tar -czf $BACKUP_DIR/app.tar.gz backend/ frontend/ docker/

echo "Backup completed: $BACKUP_DIR"
```

### 执行备份

```bash
# 创建备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
docker-compose exec -T mysql-service mysqldump -u gcloud -pgcloud123 gcloud > $BACKUP_DIR/gcloud.sql
tar -czf $BACKUP_DIR/gcloud-config.tar.gz data/gcloud-config/
echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x backup.sh
./backup.sh
```

### 恢复备份

```bash
# 恢复 MySQL
docker-compose exec -T mysql-service mysql -u gcloud -pgcloud123 gcloud < backups/2024*/gcloud.sql

# 恢复配置
tar -xzf backups/2024*/gcloud-config.tar.gz

# 重启服务
docker-compose restart
```

### 自动备份 (Cron)

```bash
# 编辑 crontab
crontab -e

# 添加每日备份任务 (凌晨 2 点)
0 2 * * * cd /path/to/gcloud-server && ./backup.sh

# 添加周备份清理 (每周日)
0 3 * * 0 find ./backups -mtime +30 -delete
```

---

## 故障恢复

### 完整恢复步骤

```bash
# 1. 停止所有服务
docker-compose down

# 2. 清理损坏的卷
docker volume rm gcloud_*

# 3. 重新创建目录
mkdir -p data/{mysql,redis,gcloud-config,logs,frontend-build,ftp}

# 4. 重启服务
docker-compose up -d

# 5. 等待初始化
sleep 30

# 6. 恢复数据库
docker-compose exec -T mysql-service mysql -u gcloud -pgcloud123 gcloud < backups/latest/gcloud.sql

# 7. 恢复配置
tar -xzf backups/latest/gcloud-config.tar.gz -C data/

# 8. 验证
docker-compose ps
curl http://localhost:3000/health
```

---

## 维护任务

### 日常维护

```bash
# 检查磁盘空间
df -h

# 查看容器日志
docker-compose logs --tail=50

# 检查数据库大小
docker-compose exec mysql-service mysql -u gcloud -pgcloud123 -e "SELECT SUM(data_length + index_length) / 1024 / 1024 AS size_mb FROM information_schema.TABLES WHERE table_schema = 'gcloud';"
```

### 周期性维护

```bash
# 清理 Docker 系统
docker system prune

# 更新镜像
docker pull node:18-slim
docker pull mysql:8.0
docker pull redis:7-alpine

# 重建镜像
docker-compose build --no-cache

# 运行测试
npm test
```

### 定期检查

- 每周: 检查日志, 验证备份
- 每月: 清理旧日志, 优化数据库
- 每季度: 更新依赖, 安全审计
- 每年: 灾难恢复演练

---

## 支持和反馈

如有问题,请查看日志并收集以下信息:
- Docker 版本
- Docker Compose 版本
- 系统信息
- 相关的错误日志
- 复现步骤

---

**最后修改**: 2024-10-20
**版本**: 1.0.0
