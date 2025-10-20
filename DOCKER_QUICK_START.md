# GCloud Manager - Docker 快速启动指南

## 🚀 最快 5 分钟启动

### 前置要求
- Docker 20.10+ 和 Docker Compose 1.29+
- 至少 4GB 内存
- 至少 20GB 磁盘空间

### 1. 快速启动 (一键部署)

```bash
# 1. 创建并配置环境文件
cp .env.docker .env

# 2. 创建数据目录
mkdir -p data/{mysql,redis,gcloud-config,logs,frontend-build,ftp}

# 3. 启动所有服务
docker-compose up -d

# 4. 等待初始化 (约 30 秒)
sleep 30

# 5. 验证
curl http://localhost:3000/health
```

### 2. 访问应用

- **Web UI**: http://localhost:3000
- **API**: http://localhost:3000/api
- **统计服务**: http://localhost:4000

---

## 📊 常用命令速查表

### 查看状态
```bash
# 查看所有容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f main-service

# 查看资源使用
docker stats
```

### 管理服务
```bash
# 启动
docker-compose start

# 停止
docker-compose stop

# 重启
docker-compose restart main-service

# 完全停止并清理
docker-compose down -v
```

### 进入容器
```bash
# 进入 main-service
docker-compose exec main-service bash

# 进入 MySQL
docker-compose exec mysql-service mysql -u gcloud -pgcloud123 gcloud

# 进入 Redis
docker-compose exec redis-service redis-cli
```

### 数据库操作
```bash
# 导出数据库
docker-compose exec -T mysql-service mysqldump -u gcloud -pgcloud123 gcloud > backup.sql

# 导入数据库
docker-compose exec -T mysql-service mysql -u gcloud -pgcloud123 gcloud < backup.sql

# 查看数据库大小
docker-compose exec mysql-service mysql -u gcloud -pgcloud123 -e \
  "SELECT SUM(data_length + index_length) / 1024 / 1024 AS size_mb FROM information_schema.TABLES WHERE table_schema = 'gcloud';"
```

---

## ⚙️ 重要配置修改

### 修改密码

编辑 `.env` 文件:
```env
# MySQL
DB_PASSWORD=your_new_password
MYSQL_ROOT_PASSWORD=your_root_password

# Redis
REDIS_PASSWORD=your_redis_password

# 应用
JWT_SECRET=your_32_char_secret
SESSION_SECRET=your_32_char_secret
```

然后重启服务:
```bash
docker-compose down
docker-compose up -d
```

### 修改端口

编辑 `docker-compose.yml`:
```yaml
main-service:
  ports:
    - "8000:3000"  # 改为 8000

stats-service:
  ports:
    - "8001:4000"  # 改为 8001
```

重启:
```bash
docker-compose restart
```

### 启用 HTTPS

```bash
# 1. 生成证书
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/private.key \
  -out docker/nginx/ssl/certificate.crt

# 2. 取消注释 docker/nginx/nginx.conf 中的 HTTPS 块
# 3. 重启 Nginx
docker-compose restart nginx-proxy
```

---

## 🔧 故障快速修复

### 服务无法启动

```bash
# 查看错误日志
docker-compose logs main-service

# 清理并重新启动
docker-compose down
docker system prune
docker-compose up -d
```

### 数据库连接失败

```bash
# 检查 MySQL 状态
docker-compose ps mysql-service

# 重启 MySQL
docker-compose restart mysql-service

# 等待并验证
sleep 10
docker-compose exec mysql-service mysql -u gcloud -pgcloud123 -e "SELECT 1;"
```

### 内存不足

```bash
# 查看内存使用
docker stats

# 清理旧容器和镜像
docker system prune -a

# 增加交换空间 (临时解决)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 端口被占用

```bash
# 查看占用 3000 端口的进程
sudo lsof -i :3000

# 杀死进程
sudo kill -9 <PID>

# 或修改 docker-compose.yml 中的端口
```

---

## 📈 监控和日志

### 实时监控

```bash
# 监控所有容器
watch -n 1 'docker stats'

# 查看实时日志 (所有服务)
docker-compose logs -f

# 只看 main-service 的最后 100 行
docker-compose logs --tail=100 main-service
```

### 日志位置

```
日志文件位置:
├── data/logs/app/         # 主应用日志
├── data/logs/stats/       # 统计服务日志
├── data/logs/executor/    # 执行器日志
└── docker-compose 生成的日志 (通过 docker logs)
```

### 导出日志

```bash
# 导出所有日志
docker-compose logs > all-logs.txt

# 导出特定服务日志
docker-compose logs main-service > app-logs.txt

# 查看最近 1 小时的日志
docker-compose logs --since 1h > recent-logs.txt
```

---

## 🔄 升级和更新

### 更新应用代码

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重建镜像 (不使用缓存)
docker-compose build --no-cache

# 3. 重启服务
docker-compose up -d

# 4. 检查日志
docker-compose logs -f main-service
```

### 更新 Docker 镜像

```bash
# 拉取最新基础镜像
docker pull node:18-slim
docker pull mysql:8.0
docker pull redis:7-alpine

# 重建所有镜像
docker-compose build --pull --no-cache

# 重启
docker-compose up -d
```

---

## 💾 备份和恢复

### 快速备份

```bash
# 创建备份目录
mkdir -p backups/$(date +%Y%m%d_%H%M%S)

# 备份数据库
docker-compose exec -T mysql-service mysqldump -u gcloud -pgcloud123 gcloud \
  > backups/$(date +%Y%m%d_%H%M%S)/gcloud.sql

# 备份配置
tar -czf backups/$(date +%Y%m%d_%H%M%S)/gcloud-config.tar.gz data/gcloud-config/

echo "Backup completed!"
```

### 快速恢复

```bash
# 从最新备份恢复
LATEST_BACKUP=$(ls -d backups/*/ | tail -1)

# 恢复数据库
docker-compose exec -T mysql-service mysql -u gcloud -pgcloud123 gcloud \
  < ${LATEST_BACKUP}gcloud.sql

# 恢复配置
tar -xzf ${LATEST_BACKUP}gcloud-config.tar.gz -C data/

# 重启
docker-compose restart

echo "Recovery completed!"
```

### 自动备份 (每日)

```bash
# 创建 backup.sh
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
docker-compose exec -T mysql-service mysqldump -u gcloud -pgcloud123 gcloud > $BACKUP_DIR/gcloud.sql
tar -czf $BACKUP_DIR/gcloud-config.tar.gz data/gcloud-config/
echo "✓ Backup completed: $BACKUP_DIR"
EOF

chmod +x backup.sh

# 添加到 crontab (每天凌晨 2 点)
(crontab -l 2>/dev/null; echo "0 2 * * * cd /path/to/gcloud-server && ./backup.sh") | crontab -
```

---

## 🔒 安全检查清单

- [ ] 修改了 JWT_SECRET 和 SESSION_SECRET
- [ ] 修改了 MySQL root 和应用密码
- [ ] 修改了 Redis 密码
- [ ] 配置了防火墙
- [ ] 启用了 HTTPS (生产环境)
- [ ] 配置了日志审计
- [ ] 设置了备份策略
- [ ] 验证了容器隔离
- [ ] 限制了容器资源

---

## 📋 部署检查清单

### 初始部署前
- [ ] Docker 和 Docker Compose 已安装
- [ ] 系统资源充足 (4GB+ 内存, 20GB+ 磁盘)
- [ ] 网络连接正常
- [ ] 必需的端口未被占用

### 部署中
- [ ] 克隆或上传项目
- [ ] 复制 `.env.docker` 为 `.env`
- [ ] 修改所有默认密码
- [ ] 创建数据目录
- [ ] 启动容器

### 部署后
- [ ] 所有容器健康
- [ ] Web UI 可访问
- [ ] API 响应正常
- [ ] 数据库初始化成功
- [ ] 日志无错误

---

## 🆘 获取帮助

### 查看文档

```bash
# 详细部署指南
cat DOCKER_DEPLOYMENT_GUIDE.md

# 架构说明
cat DOCKER_ARCHITECTURE.md

# 项目文档
cat CLAUDE.md
```

### 常见问题

**Q: 如何修改应用端口?**
A: 编辑 `docker-compose.yml` 中的 `ports` 部分,修改第一个数字(宿主机端口)

**Q: 如何访问容器内的日志?**
A: 使用 `docker-compose logs <service-name>` 查看

**Q: 如何导出和导入数据?**
A: 参考上面的"备份和恢复"部分

**Q: 如何扩展存储空间?**
A: 修改 `VOLUME_PATH` 或手动挂载更大的磁盘

**Q: 如何监控系统性能?**
A: 使用 `docker stats` 或 `docker-compose exec prometheus` (如果配置了)

---

## 📞 技术支持

有问题? 按照这个顺序:

1. **查看日志**: `docker-compose logs`
2. **检查健康**: `curl http://localhost:3000/health`
3. **查看进程**: `docker-compose ps`
4. **查看文档**: `DOCKER_DEPLOYMENT_GUIDE.md`
5. **重启服务**: `docker-compose restart`
6. **完全重置**: `docker-compose down && docker system prune && docker-compose up -d`

---

## 💡 快速技巧

```bash
# 一键查看系统状态
docker-compose ps && echo "---" && docker-compose exec mysql-service mysql -u gcloud -pgcloud123 -e "SELECT COUNT(*) as tables FROM information_schema.TABLES WHERE table_schema = 'gcloud';" 2>/dev/null && echo "Database OK"

# 实时监控日志中的错误
docker-compose logs -f | grep -i error

# 清理所有 Docker 资源
docker system prune -a --volumes

# 查看实时网络流量
docker stats --no-stream | awk 'NR>1 {print $1, "CPU:", $3, "Memory:", $4}'

# 定期清理旧日志
find ./data/logs -name "*.log" -mtime +30 -delete
```

---

**提示**: 将此文件加入书签,快速访问常用命令!

**最后更新**: 2024-10-20
**版本**: 1.0.0
