# GCloud Manager - Docker 化文件清单

## 📁 完整文件结构

```
gcloud_server/
├── docker/                              # Docker 配置目录
│   ├── main/                           # 主应用 Dockerfile 和脚本
│   │   ├── Dockerfile                  # 主应用多阶段构建
│   │   └── docker-entrypoint.sh        # 启动脚本
│   ├── stats/                          # 统计服务 Dockerfile 和脚本
│   │   ├── Dockerfile                  # 统计服务构建
│   │   └── docker-entrypoint.sh        # 启动脚本
│   ├── executor/                       # 执行器服务 Dockerfile 和脚本
│   │   ├── Dockerfile                  # 执行器构建
│   │   └── docker-entrypoint.sh        # 启动脚本
│   ├── nginx/                          # Nginx 反向代理配置
│   │   ├── nginx.conf                  # 主配置文件
│   │   ├── conf.d/                     # 站点配置 (可选)
│   │   └── ssl/                        # SSL 证书目录 (可选)
│   ├── mysql/                          # MySQL 配置和初始化
│   │   └── init.sql                    # 数据库初始化脚本
│   └── ftp/                            # FTP 配置 (可选)
│       └── vsftpd.conf                 # FTP 服务器配置
│
├── data/                                # 数据卷挂载点 (运行时创建)
│   ├── mysql/                          # MySQL 数据库文件
│   ├── redis/                          # Redis 数据文件
│   ├── gcloud-config/                  # GCloud 配置和凭证
│   ├── logs/                           # 应用日志
│   │   ├── app/                        # 主应用日志
│   │   ├── stats/                      # 统计服务日志
│   │   └── executor/                   # 执行器日志
│   ├── frontend-build/                 # 前端构建产物
│   └── ftp/                            # FTP 用户文件
│
├── docker-compose.yml                  # Docker Compose 主配置文件
├── .env.docker                         # 环境变量示例
├── .dockerignore                       # Docker 构建忽略文件
│
├── DOCKER_ARCHITECTURE.md              # 架构设计文档
├── DOCKER_DEPLOYMENT_GUIDE.md          # 完整部署指南
├── DOCKER_QUICK_START.md               # 快速启动指南
└── DOCKER_FILES_MANIFEST.md            # 本文件 (文件清单)
```

---

## 📄 新增文件详细说明

### 1. **docker-compose.yml** (核心编排文件)

**位置**: `/root/gcloud_server/docker-compose.yml`

**功能**:
- 定义所有容器服务 (MySQL, Redis, Main App, Stats, Executor, FTP, Nginx)
- 配置卷挂载和网络
- 设置环境变量和健康检查
- 定义服务依赖关系

**关键内容**:
```yaml
services:
  - mysql-service (数据库)
  - redis-service (缓存)
  - main-service (主应用)
  - stats-service (统计)
  - executor-service (执行器)
  - ftp-service (FTP)
  - nginx-proxy (反向代理)

networks:
  - gcloud-network

volumes:
  - mysql_data
  - redis_data
  - gcloud_config
  - app_logs
  - 等等...
```

---

### 2. **Dockerfile 文件** (容器镜像定义)

#### 2.1 `docker/main/Dockerfile`

**用途**: 构建主应用镜像

**特点**:
- 多阶段构建 (前端构建 → 后端构建 → 运行时)
- 包含 GCloud CLI 安装
- 轻量级运行环境
- 非 root 用户运行

**阶段**:
1. `frontend-builder`: 编译前端 (Vite)
2. `backend-builder`: 安装后端依赖和 GCloud
3. `production`: 最终运行时镜像
4. `development`: 开发环境 (可选)

#### 2.2 `docker/stats/Dockerfile`

**用途**: 构建统计服务镜像

**特点**:
- 轻量级 Alpine 镜像
- 最小化依赖
- SSE 流支持

#### 2.3 `docker/executor/Dockerfile`

**用途**: 构建执行器服务镜像

**特点**:
- 完整的 GCloud CLI 环境
- 支持多种认证方式
- 命令执行和日志管理

---

### 3. **启动脚本** (docker-entrypoint.sh)

#### 3.1 `docker/main/docker-entrypoint.sh`

**功能**:
- 等待依赖服务就绪 (MySQL, Redis)
- 初始化 GCloud 配置目录
- 可选的数据库初始化
- 可选的管理员账户创建
- 启动应用并显示配置摘要

#### 3.2 `docker/stats/docker-entrypoint.sh`

**功能**:
- 等待 MySQL 和主服务就绪
- 初始化日志目录
- 启动统计服务

#### 3.3 `docker/executor/docker-entrypoint.sh`

**功能**:
- 等待 MySQL 和 Redis 就绪
- 验证 GCloud CLI 可用
- 初始化 GCloud 配置
- 启动执行器服务

---

### 4. **配置文件**

#### 4.1 `.env.docker`

**位置**: `/root/gcloud_server/.env.docker`

**功能**: 环境变量示例文件

**包含**:
- 数据库配置 (MySQL, Redis)
- 应用配置 (JWT, 会话)
- Google OAuth 配置
- GCloud 配置
- 日志和监控配置

**使用**:
```bash
cp .env.docker .env
# 编辑 .env 文件
nano .env
```

#### 4.2 `.dockerignore`

**位置**: `/root/gcloud_server/.dockerignore`

**功能**: 指定构建时忽略的文件

**包含**:
- Git 文件和目录
- Node modules (重新安装)
- IDE 配置
- 日志文件
- 临时文件

---

### 5. **数据库初始化脚本**

#### 5.1 `docker/mysql/init.sql`

**用途**: MySQL 数据库初始化

**包含表**:
- `admin` - 管理员用户
- `api_key` - API 密钥
- `g_cloud_account` - GCloud 账户
- `command_execution` - 命令执行记录
- `execution_history` - 执行历史
- `gcloud_monitor_log` - 监控日志
- `channel_auto_log` - 自动渠道日志
- `channel_statistics` - 渠道统计
- `api_usage_stats` - API 使用统计
- `sessions` - 会话表

**执行时机**:
- MySQL 容器首次启动时自动执行
- 或手动导入: `docker-compose exec mysql-service mysql -u root < init.sql`

---

### 6. **反向代理配置**

#### 6.1 `docker/nginx/nginx.conf`

**用途**: Nginx 反向代理和负载均衡

**功能**:
- 路由主应用流量
- 路由统计服务流量
- SSL/TLS 支持 (可选)
- 限流和速率限制
- 静态文件缓存
- Gzip 压缩
- WebSocket 支持

**上游配置**:
```nginx
upstream main_app {
    server main-service:3000;
}

upstream stats_app {
    server stats-service:4000;
}
```

---

### 7. **文档文件**

#### 7.1 `DOCKER_ARCHITECTURE.md`

**内容**:
- 系统架构图
- 组件分析
- 数据库结构
- 环境变量说明
- 外部依赖分析
- Docker 镜像规划
- 启动顺序和健康检查

#### 7.2 `DOCKER_DEPLOYMENT_GUIDE.md`

**内容**:
- 前置条件
- 快速启动步骤
- 详细安装步骤
- 配置说明
- 常见操作
- 故障排除
- 性能优化
- 生产部署指南
- 备份和恢复

#### 7.3 `DOCKER_QUICK_START.md`

**内容**:
- 最快 5 分钟启动
- 常用命令速查表
- 重要配置修改
- 快速故障修复
- 监控和日志
- 升级和更新
- 备份和恢复
- 安全检查清单

#### 7.4 `DOCKER_FILES_MANIFEST.md`

**内容**: 本文件 (完整文件清单和说明)

---

## 📊 文件大小统计

```
Dockerfile:
├── docker/main/Dockerfile           ~150 lines
├── docker/stats/Dockerfile          ~80 lines
└── docker/executor/Dockerfile       ~100 lines

启动脚本:
├── docker/main/docker-entrypoint.sh    ~80 lines
├── docker/stats/docker-entrypoint.sh   ~50 lines
└── docker/executor/docker-entrypoint.sh ~70 lines

配置文件:
├── docker-compose.yml               ~400 lines
├── .env.docker                      ~60 lines
├── .dockerignore                    ~50 lines
├── docker/nginx/nginx.conf          ~150 lines
└── docker/mysql/init.sql            ~200 lines

文档:
├── DOCKER_ARCHITECTURE.md           ~400 lines
├── DOCKER_DEPLOYMENT_GUIDE.md       ~800 lines
├── DOCKER_QUICK_START.md            ~400 lines
└── DOCKER_FILES_MANIFEST.md         ~300 lines

总计: ~3500+ 行代码和文档
```

---

## 🔄 文件依赖关系

```
docker-compose.yml
├── Depends on: .env (环境变量)
├── Depends on: docker/main/Dockerfile
├── Depends on: docker/stats/Dockerfile
├── Depends on: docker/executor/Dockerfile
├── Depends on: docker/nginx/nginx.conf
└── Depends on: docker/mysql/init.sql

主应用 Dockerfile
├── Depends on: docker/main/docker-entrypoint.sh
├── Depends on: backend/ (应用代码)
└── Depends on: frontend/ (前端代码)

数据库初始化
└── Depends on: docker-compose.yml (定义 MySQL 服务)
```

---

## ✅ 部署检查清单

### 部署前验证

- [ ] 所有 Dockerfile 语法正确
- [ ] 所有 `.sh` 脚本有执行权限
- [ ] `.env` 文件已复制和配置
- [ ] `.dockerignore` 文件存在
- [ ] `docker-compose.yml` 文件完整

### 构建时检查

- [ ] Docker 镜像构建成功
- [ ] 没有构建警告
- [ ] 镜像大小合理

### 运行时检查

- [ ] 所有容器启动成功
- [ ] 健康检查通过
- [ ] 服务间通信正常
- [ ] 日志无严重错误

---

## 🔐 安全注意事项

### 文件权限

```bash
# 启动脚本应该有执行权限
chmod +x docker/*/docker-entrypoint.sh

# 数据卷目录权限
chmod 755 data/
chmod 700 data/mysql
chmod 700 data/gcloud-config
```

### 敏感信息

- ❌ 不要在 Dockerfile 中硬编码密码
- ❌ 不要提交 `.env` 文件到 Git
- ✅ 使用环境变量存储敏感信息
- ✅ 使用 `.gitignore` 排除敏感文件

---

## 📝 修改和自定义

### 添加新服务

1. 在 `docker-compose.yml` 中添加服务定义
2. 创建对应的 Dockerfile (如需)
3. 创建启动脚本
4. 更新网络和卷配置
5. 文档中记录更改

### 修改端口

在 `docker-compose.yml` 中修改 `ports` 配置:
```yaml
services:
  main-service:
    ports:
      - "8080:3000"  # 宿主机:容器端口
```

### 修改资源限制

在 `docker-compose.yml` 中修改 `deploy` 部分:
```yaml
deploy:
  resources:
    limits:
      cpus: "2.0"
      memory: 1G
```

---

## 🚀 快速参考

### 启动应用
```bash
docker-compose up -d
```

### 查看日志
```bash
docker-compose logs -f main-service
```

### 进入容器
```bash
docker-compose exec main-service bash
```

### 停止应用
```bash
docker-compose down
```

### 完全重置
```bash
docker-compose down -v
docker system prune -a
docker-compose up -d
```

---

## 📚 相关文档

- `DOCKER_ARCHITECTURE.md` - 架构和设计
- `DOCKER_DEPLOYMENT_GUIDE.md` - 详细部署指南
- `DOCKER_QUICK_START.md` - 快速启动
- `CLAUDE.md` - 项目说明
- `README.md` - 项目概览

---

## 🆘 获取帮助

1. 查看对应的文档
2. 检查容器日志: `docker-compose logs`
3. 查看健康状态: `docker-compose ps`
4. 查看启动脚本输出

---

**最后更新**: 2024-10-20
**版本**: 1.0.0
**维护人**: Docker 容器化团队
