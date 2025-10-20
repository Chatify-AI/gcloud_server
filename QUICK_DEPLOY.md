# GCloud Server v3.6.1 - 快速部署指南

## 一键部署（仅需一个文件）

### 方法1：使用默认密码（测试用）

```bash
# 下载docker-compose文件
wget https://raw.githubusercontent.com/Chatify-AI/gcloud_server/v3.6.1/docker-compose.quick.yml

# 启动所有服务
docker-compose -f docker-compose.quick.yml up -d
```

**默认密码（仅用于测试，生产环境必须修改）：**
- MySQL密码: `gcloud123`
- MySQL root密码: `root123`
- Redis密码: `redis123`
- JWT Secret: `CHANGE-THIS-SECRET-IN-PRODUCTION-USE-64-CHARS-MINIMUM`
- Session Secret: `CHANGE-THIS-SESSION-SECRET-IN-PRODUCTION-64-CHARS`

### 方法2：使用自定义密码（生产推荐）

```bash
# 下载docker-compose文件
wget https://raw.githubusercontent.com/Chatify-AI/gcloud_server/v3.6.1/docker-compose.quick.yml

# 创建.env文件
cat > .env << 'EOF'
DB_PASSWORD=你的数据库密码
MYSQL_ROOT_PASSWORD=你的MySQL_root密码
REDIS_PASSWORD=你的Redis密码
JWT_SECRET=你的64字符随机字符串
SESSION_SECRET=你的64字符随机字符串
EOF

# 启动所有服务
docker-compose -f docker-compose.quick.yml up -d
```

**生成安全密码：**
```bash
# 生成32字符密码
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32

# 生成64字符密码
openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
```

## 访问服务

部署完成后，访问以下地址：

- **Web管理界面**: http://你的服务器IP:5080
- **主服务API**: http://你的服务器IP:5000
- **统计服务API**: http://你的服务器IP:5001
- **执行器API**: http://你的服务器IP:5002

## 服务说明

### 自动初始化

首次启动时，系统会自动：
1. 下载MySQL初始化脚本
2. 创建所有必需的数据库表
3. 配置所有服务依赖关系
4. 进行健康检查

整个过程大约需要2-3分钟。

### 服务端口

| 服务 | 容器端口 | 主机端口 | 说明 |
|-----|---------|---------|------|
| MySQL | 3306 | 5306 | 数据库 |
| Redis | 6379 | 5379 | 缓存 |
| Main Service | 3000 | 5000, 5080 | 主服务 |
| Stats Service | 4000 | 5001 | 统计服务 |
| Executor | 3001 | 5002 | 执行器 |
| FTP | 21, 30000-30009 | 5021, 50000-50009 | FTP服务 |

## 管理命令

```bash
# 查看服务状态
docker-compose -f docker-compose.quick.yml ps

# 查看日志
docker-compose -f docker-compose.quick.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.quick.yml logs -f main-service

# 停止服务
docker-compose -f docker-compose.quick.yml down

# 停止服务并删除数据（慎用！）
docker-compose -f docker-compose.quick.yml down -v

# 重启服务
docker-compose -f docker-compose.quick.yml restart
```

## 故障排除

### 服务启动失败

1. 检查端口是否被占用：
   ```bash
   netstat -tulpn | grep -E '5000|5001|5002|5306|5379|5021'
   ```

2. 查看服务日志：
   ```bash
   docker-compose -f docker-compose.quick.yml logs
   ```

### 数据库连接失败

1. 确认MySQL服务已启动：
   ```bash
   docker-compose -f docker-compose.quick.yml ps mysql-service
   ```

2. 检查健康状态：
   ```bash
   docker inspect gcloud-mysql | grep -A 5 Health
   ```

### 密码不匹配

如果之前部署过旧版本，需要删除旧的数据卷：
```bash
docker-compose -f docker-compose.quick.yml down -v
docker-compose -f docker-compose.quick.yml up -d
```

## 环境变量完整列表

可选的环境变量（在.env文件中配置）：

```bash
# 数据库配置
DB_PASSWORD=gcloud123
MYSQL_ROOT_PASSWORD=root123

# Redis配置
REDIS_PASSWORD=redis123

# 安全密钥
JWT_SECRET=your-64-char-secret
SESSION_SECRET=your-64-char-secret

# OneAPI配置
ONEAPI_BASE_URL=http://104.194.9.201:11002
ONEAPI_KEY=your-oneapi-key

# GCloud脚本配置
GCLOUD_SCRIPT_URL=https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh
GCLOUD_SCRIPT_BACKUP_URL=

# FTP配置
FTP_PUBLIC_HOST=your-server-ip
```

## 系统要求

- Docker 20.10+
- Docker Compose 1.29+
- 最少4GB内存
- 最少20GB磁盘空间

## 完整部署包

如果需要完整的配置文件和更高级的部署选项，请访问：
https://github.com/Chatify-AI/gcloud_server/tree/v3.6.1/deploy
