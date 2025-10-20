# GCloud Server v3.6.1 - 快速部署

## 一键部署（3步）

```bash
# 1. 配置环境变量
cp .env.example .env
nano .env  # 修改必填项：DB_PASSWORD, MYSQL_ROOT_PASSWORD, REDIS_PASSWORD, JWT_SECRET, SESSION_SECRET

# 2. 启动所有服务
docker-compose up -d

# 3. 验证部署
curl http://localhost:5080/health
```

## 必须修改的配置

编辑 `.env` 文件，修改以下项：

```bash
DB_PASSWORD=<设置MySQL密码>
MYSQL_ROOT_PASSWORD=<设置MySQL root密码>
REDIS_PASSWORD=<设置Redis密码>
JWT_SECRET=<64字符随机字符串>
SESSION_SECRET=<64字符随机字符串>
```

## 访问地址

- Web管理界面: http://服务器IP:5080
- API端点: http://服务器IP:5000

## 端口说明

- 5080: Nginx (HTTP)
- 5000: 主服务 API
- 5001: 统计服务 API
- 5002: 执行器服务 API
- 5306: MySQL
- 5379: Redis
- 5021: FTP

## 服务管理

```bash
# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 停止并删除数据
docker-compose down -v
```
