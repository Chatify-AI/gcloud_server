# GCloud Manager - Docker 生产环境部署

## 快速开始

### 一键启动

```bash
# 在项目根目录执行
docker-compose -f docker-compose.prod.yml up -d
```

### 验证部署

```bash
./verify-deployment.sh
```

## 目录结构

```
docker-prod/
├── main/                      # 主应用服务
│   ├── Dockerfile            # 主应用 Dockerfile
│   └── docker-entrypoint.sh  # 主应用启动脚本
├── executor/                  # 执行器服务
│   ├── Dockerfile
│   └── docker-entrypoint.sh
├── stats/                     # 统计服务
│   ├── Dockerfile
│   └── docker-entrypoint.sh
├── nginx/                     # Nginx 反向代理
│   └── nginx.conf            # Nginx 配置
├── mysql/                     # MySQL 初始化
│   └── init-scripts/         # 数据库初始化脚本
│       └── 01-init.sql
├── DEPLOYMENT.md             # 详细部署文档
└── README.md                 # 本文件
```

## 服务端口

| 服务 | 内部端口 | 外部端口 | 说明 |
|-----|---------|---------|------|
| Main Service | 3000 | **5000** | 主应用 |
| Stats Service | 4000 | **5001** | 统计服务 |
| Executor Service | 3001 | **5002** | 执行器 |
| Nginx | 80/443 | **5080/5443** | 反向代理 |
| MySQL | 3306 | **5306** | 数据库 |
| Redis | 6379 | **5379** | 缓存 |

## 常用命令

```bash
# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 重启服务
docker-compose -f docker-compose.prod.yml restart [service-name]

# 重新构建
docker-compose -f docker-compose.prod.yml build

# 清理（包括数据卷，谨慎！）
docker-compose -f docker-compose.prod.yml down -v
```

## 访问地址

- **Web 管理界面**: http://localhost:5000
- **统计服务**: http://localhost:5001
- **执行器服务**: http://localhost:5002
- **Nginx 入口**: http://localhost:5080

## 详细文档

查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 了解：
- 完整架构说明
- 故障排查指南
- 安全配置建议
- 性能优化技巧
- 备份恢复流程
