# GCloud Manager - Docker 生产部署指南

## 🚀 快速启动 (一键部署)

### 方式 1: 使用启动脚本 (最简单)

```bash
# 方式 1: 一键启动
chmod +x start-docker.sh
./start-docker.sh

# 脚本会自动:
# ✅ 检查 Docker 环境
# ✅ 拉取基础镜像
# ✅ 构建应用镜像
# ✅ 启动所有容器
# ✅ 验证服务健康
```

### 方式 2: 手动启动

```bash
# 1. 复制环境配置
cp .env.prod.example .env.prod

# 2. 修改关键配置 (可选)
nano .env.prod

# 3. 启动容器
docker-compose -f docker-compose.prod.yml up -d

# 4. 查看进度
docker-compose -f docker-compose.prod.yml logs -f main-service
```

---

## 📋 项目结构

```
.
├── docker-prod/                          # Docker 构建目录
│   ├── main/
│   │   ├── Dockerfile                   # 主应用镜像定义
│   │   └── docker-entrypoint.sh         # 启动脚本
│   ├── stats/
│   │   ├── Dockerfile                   # 统计服务镜像定义
│   │   └── docker-entrypoint.sh         # 启动脚本
│   ├── executor/
│   │   ├── Dockerfile                   # 执行器镜像定义
│   │   └── docker-entrypoint.sh         # 启动脚本
│   ├── nginx/
│   │   └── nginx.conf                   # 反向代理配置
│   └── mysql/
│       └── init-scripts/
│           └── 01-init.sql              # 数据库初始化
│
├── docker-compose.prod.yml               # Docker Compose 编排文件
├── .env.prod                             # 环境变量配置
├── start-docker.sh                       # 一键启动脚本
└── DOCKER_PROD_GUIDE.md                  # 本文件
```

---

## 🏗️ 包含的服务

| 服务 | 端口 | 说明 |
|------|------|------|
| MySQL | 3306 | 数据库 |
| Redis | 6379 | 缓存/会话 |
| Main Service | 3000 | Web UI + API |
| Stats Service | 4000 | 统计分析 |
| Executor | 3001 | GCloud 命令 |
| Nginx | 80 | 反向代理 |

---

## ⚙️ 配置说明

### 环境变量 (.env.prod)

**必须修改的配置:**

```env
# 生成强密钥 (推荐)
JWT_SECRET=<32个随机字符>
SESSION_SECRET=<32个随机字符>

# 数据库密码
DB_PASSWORD=<数据库密码>
REDIS_PASSWORD=<Redis密码>
```

**生成安全密钥:**

```bash
# 方式 1: 使用 openssl
openssl rand -base64 32

# 方式 2: 使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 📊 启动后验证

### 1. 检查容器状态

```bash
docker-compose -f docker-compose.prod.yml ps

# 输出应该显示:
# mysql-service        ... healthy
# redis-service        ... healthy
# main-service         ... healthy (starting)
# stats-service        ... healthy (starting)
# executor-service     ... healthy (starting)
# nginx-proxy          ... up
```

### 2. 验证健康检查

```bash
# 主应用
curl http://localhost:3000/health

# 统计服务
curl http://localhost:4000/health

# 执行器
curl http://localhost:3001/health
```

### 3. 查看应用

```bash
# 打开浏览器访问
http://localhost
# 或
http://localhost:3000
```

---

## 🔧 常用命令

### 查看日志

```bash
# 查看所有日志
docker-compose -f docker-compose.prod.yml logs

# 实时查看主应用日志
docker-compose -f docker-compose.prod.yml logs -f main-service

# 查看最后 100 行
docker-compose -f docker-compose.prod.yml logs --tail=100 main-service

# 查看特定时间的日志
docker-compose -f docker-compose.prod.yml logs --since 10m
```

### 管理容器

```bash
# 启动
docker-compose -f docker-compose.prod.yml up -d

# 停止
docker-compose -f docker-compose.prod.yml stop

# 重启
docker-compose -f docker-compose.prod.yml restart main-service

# 完全清理
docker-compose -f docker-compose.prod.yml down

# 清理卷数据（谨慎！会删除数据）
docker-compose -f docker-compose.prod.yml down -v
```

### 进入容器

```bash
# 进入主应用
docker-compose -f docker-compose.prod.yml exec main-service bash

# 进入数据库
docker-compose -f docker-compose.prod.yml exec mysql-service mysql -u gcloud -p

# 进入 Redis
docker-compose -f docker-compose.prod.yml exec redis-service redis-cli
```

### 数据库操作

```bash
# 导出数据库
docker-compose -f docker-compose.prod.yml exec -T mysql-service \
    mysqldump -u gcloud -pgcloud123 gcloud > backup.sql

# 导入数据库
docker-compose -f docker-compose.prod.yml exec -T mysql-service \
    mysql -u gcloud -pgcloud123 gcloud < backup.sql

# 查看表
docker-compose -f docker-compose.prod.yml exec mysql-service \
    mysql -u gcloud -pgcloud123 gcloud -e "SHOW TABLES;"
```

### 资源监控

```bash
# 查看容器资源占用
docker stats

# 查看镜像大小
docker images | grep gcloud

# 清理未使用的资源
docker system prune
```

---

## 🚨 故障排除

### 问题 1: 容器无法启动

```bash
# 查看错误日志
docker-compose -f docker-compose.prod.yml logs main-service

# 查看容器状态
docker-compose -f docker-compose.prod.yml ps

# 重新构建镜像
docker-compose -f docker-compose.prod.yml build --no-cache
```

### 问题 2: 端口被占用

```bash
# 查看占用 3000 端口的进程
sudo lsof -i :3000

# 解决方案 1: 修改 docker-compose.prod.yml 中的端口
# ports:
#   - "8000:3000"  # 改为 8000

# 解决方案 2: 杀死占用进程
sudo kill -9 <PID>
```

### 问题 3: 数据库连接失败

```bash
# 等待 30 秒让 MySQL 初始化
sleep 30

# 检查 MySQL 是否就绪
docker-compose -f docker-compose.prod.yml exec mysql-service \
    mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT 1;"

# 重新启动 MySQL
docker-compose -f docker-compose.prod.yml restart mysql-service
```

### 问题 4: 内存不足

```bash
# 查看内存占用
docker stats

# 清理 Docker 缓存
docker system prune -a

# 增加交换空间 (Ubuntu)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 问题 5: 网络问题

```bash
# 检查网络连接
docker network inspect gcloud_gcloud-network

# 检查容器间通信
docker-compose -f docker-compose.prod.yml exec main-service \
    ping mysql-service

# 重建网络
docker-compose -f docker-compose.prod.yml down
docker network prune
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔐 安全建议

### 1. 修改默认密码

在 `.env.prod` 中修改所有默认密码:

```env
DB_PASSWORD=your_strong_password
REDIS_PASSWORD=your_strong_redis_password
MYSQL_ROOT_PASSWORD=your_root_password
JWT_SECRET=your_32_char_jwt_secret
SESSION_SECRET=your_32_char_session_secret
```

### 2. 启用防火墙

```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. 启用 HTTPS (可选)

```bash
# 生成自签名证书
mkdir -p docker-prod/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker-prod/nginx/ssl/private.key \
  -out docker-prod/nginx/ssl/certificate.crt

# 或使用 Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot certonly --standalone -d your-domain.com
```

### 4. 定期备份

```bash
# 创建备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

docker-compose -f docker-compose.prod.yml exec -T mysql-service \
    mysqldump -u gcloud -pgcloud123 gcloud > $BACKUP_DIR/gcloud.sql

echo "✅ 备份完成: $BACKUP_DIR"
EOF

chmod +x backup.sh

# 定期运行 (每天凌晨 2 点)
(crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && ./backup.sh") | crontab -
```

---

## 📈 性能优化

### 1. 资源限制调优

在 `docker-compose.prod.yml` 中根据需要调整:

```yaml
deploy:
  resources:
    limits:
      cpus: "2.0"      # 增加 CPU 限制
      memory: 1G       # 增加内存限制
```

### 2. 数据库优化

```bash
# 进入 MySQL
docker-compose -f docker-compose.prod.yml exec mysql-service mysql -u gcloud -p

# 查看查询性能
mysql> SELECT * FROM mysql.slow_log;

# 添加索引优化
mysql> CREATE INDEX idx_created_at ON command_execution(created_at);

# 优化表
mysql> OPTIMIZE TABLE command_execution;
```

### 3. Redis 优化

```bash
# 进入 Redis
docker-compose -f docker-compose.prod.yml exec redis-service redis-cli -a redis123

# 查看内存使用
> INFO memory

# 清理过期数据
> FLUSHDB
```

---

## 🎯 生产检查清单

部署前请确认:

- [ ] 修改了所有默认密码
- [ ] 修改了 JWT_SECRET 和 SESSION_SECRET
- [ ] 配置了防火墙
- [ ] 设置了定期备份
- [ ] 测试了健康检查
- [ ] 验证了日志记录
- [ ] 配置了监控告警 (可选)
- [ ] 进行了性能测试

---

## 📞 获取帮助

### 快速查看日志

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### 查看容器状态

```bash
docker-compose -f docker-compose.prod.yml ps
```

### 重新启动所有服务

```bash
docker-compose -f docker-compose.prod.yml restart
```

### 完整重置

```bash
docker-compose -f docker-compose.prod.yml down -v
docker system prune -a
docker-compose -f docker-compose.prod.yml up -d
```

---

## 💡 提示

- 首次启动可能需要 1-2 分钟才能完全就绪
- 检查日志中是否有错误: `docker-compose logs main-service`
- 使用 `docker stats` 监控资源占用
- 定期更新 Docker 镜像: `docker pull <image-name>`

---

**版本**: 1.0.0
**最后更新**: 2024-10-20
**状态**: ✅ 生产就绪
