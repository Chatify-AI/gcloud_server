# Docker 镜像推送指南

## 快速开始

### 1. 配置仓库信息

在推送镜像前，请先在 `docker-push.sh` 中配置您的仓库信息：

```bash
# Docker Hub配置
DOCKER_HUB_NAMESPACE="your-dockerhub-username"  # 修改为你的Docker Hub用户名

# 阿里云配置
ALIYUN_NAMESPACE="registry.cn-hangzhou.aliyuncs.com/your-namespace"  # 修改为你的阿里云命名空间
```

### 2. 执行推送脚本

```bash
# 给脚本添加执行权限（首次需要）
chmod +x docker-push.sh

# 运行推送脚本
./docker-push.sh
```

### 3. 选择推送目标

脚本会询问您要推送到哪个仓库：

```
请选择推送目标:
  1) Docker Hub (docker.io/your-username)
  2) 阿里云镜像仓库 (registry.cn-hangzhou.aliyuncs.com/your-namespace)
  3) 两者都推送
请输入选择 [1/2/3]:
```

建议：
- **国内服务器**: 选择阿里云（速度更快）
- **国际服务器**: 选择Docker Hub
- **同时使用**: 选择两者都推送

## 推送的镜像列表

推送完成后，以下镜像将可用：

### Docker Hub镜像（假设用户名为 `chatifyai`）

```
chatifyai/gcloud-main-service:v3.6.0
chatifyai/gcloud-main-service:latest

chatifyai/gcloud-executor-service:v3.6.0
chatifyai/gcloud-executor-service:latest

chatifyai/gcloud-stats-service:v3.6.0
chatifyai/gcloud-stats-service:latest

chatifyai/gcloud-ftp-service:v3.6.0
chatifyai/gcloud-ftp-service:latest
```

### 阿里云镜像（假设命名空间为 `chatify`）

```
registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-main-service:v3.6.0
registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-main-service:latest

registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-executor-service:v3.6.0
registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-executor-service:latest

registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-stats-service:v3.6.0
registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-stats-service:latest

registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-ftp-service:v3.6.0
registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-ftp-service:latest
```

## 使用远程镜像部署

推送完成后，脚本会自动生成 `docker-compose.remote.yml` 文件，使用远程镜像。

### 部署步骤

1. **在目标服务器上准备环境**

   ```bash
   # 创建项目目录
   mkdir -p /opt/gcloud_server
   cd /opt/gcloud_server

   # 下载必要文件
   wget https://raw.githubusercontent.com/Chatify-AI/gcloud_server/v3.6.0/docker-compose.remote.yml
   wget https://raw.githubusercontent.com/Chatify-AI/gcloud_server/v3.6.0/.env.example
   cp .env.example .env
   ```

2. **配置环境变量**

   编辑 `.env` 文件，修改以下必填项：
   ```bash
   DB_PASSWORD=your-secure-mysql-password
   MYSQL_ROOT_PASSWORD=your-secure-root-password
   REDIS_PASSWORD=your-secure-redis-password
   JWT_SECRET=your-random-jwt-secret-64-characters-or-more
   SESSION_SECRET=your-random-session-secret-64-characters-or-more
   ```

3. **下载Nginx配置文件**

   ```bash
   mkdir -p docker-prod/nginx
   wget -O docker-prod/nginx/nginx.conf \
     https://raw.githubusercontent.com/Chatify-AI/gcloud_server/v3.6.0/docker-prod/nginx/nginx.conf
   ```

4. **启动服务**

   ```bash
   docker-compose -f docker-compose.remote.yml pull
   docker-compose -f docker-compose.remote.yml up -d
   ```

5. **验证部署**

   ```bash
   # 检查所有服务状态
   docker-compose -f docker-compose.remote.yml ps

   # 健康检查
   curl http://localhost:5080/health

   # 查看日志
   docker-compose -f docker-compose.remote.yml logs -f
   ```

## 手动推送单个镜像

如果需要手动推送特定镜像：

### 推送到Docker Hub

```bash
# 1. 构建镜像
docker-compose -f docker-compose.prod.yml build main-service

# 2. 打标签
docker tag gcloud_server-main-service:latest \
  your-username/gcloud-main-service:v3.6.0

docker tag gcloud_server-main-service:latest \
  your-username/gcloud-main-service:latest

# 3. 推送
docker push your-username/gcloud-main-service:v3.6.0
docker push your-username/gcloud-main-service:latest
```

### 推送到阿里云

```bash
# 1. 登录阿里云镜像仓库（如果未登录）
docker login --username=your-aliyun-username \
  registry.cn-hangzhou.aliyuncs.com

# 2. 打标签
docker tag gcloud_server-main-service:latest \
  registry.cn-hangzhou.aliyuncs.com/your-namespace/gcloud-main-service:v3.6.0

docker tag gcloud_server-main-service:latest \
  registry.cn-hangzhou.aliyuncs.com/your-namespace/gcloud-main-service:latest

# 3. 推送
docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/gcloud-main-service:v3.6.0
docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/gcloud-main-service:latest
```

## 镜像大小参考

| 镜像 | 大小（约） | 说明 |
|------|-----------|------|
| gcloud-main-service | 1.7GB | 主应用服务（包含Node.js和前端构建） |
| gcloud-executor-service | 2.4GB | 命令执行服务（包含gcloud CLI） |
| gcloud-stats-service | 303MB | 统计服务（仅Node.js运行时） |
| gcloud-ftp-service | 148MB | FTP服务（轻量级Alpine镜像） |

## 常见问题

### 1. 推送失败：unauthorized

**问题**:
```
denied: requested access to the resource is denied
```

**解决**:
```bash
# Docker Hub
docker login

# 阿里云
docker login --username=your-aliyun-username registry.cn-hangzhou.aliyuncs.com
```

### 2. 推送速度慢

**建议**:
- 国内服务器使用阿里云镜像仓库
- 使用国内服务器进行构建和推送
- 考虑使用镜像加速器

### 3. 镜像标签错误

**检查**:
```bash
# 查看本地镜像
docker images | grep gcloud

# 确认标签正确
docker images your-namespace/gcloud-main-service
```

### 4. docker-compose.remote.yml 镜像路径不对

如果生成的配置文件中镜像路径不对，手动编辑：

```yaml
# 示例：修改为阿里云镜像
main-service:
  image: registry.cn-hangzhou.aliyuncs.com/chatify/gcloud-main-service:v3.6.0
```

## 最佳实践

1. **版本管理**
   - 同时推送版本号标签（如 `v3.6.0`）和 `latest` 标签
   - 生产环境使用版本号标签，避免使用 `latest`

2. **镜像优化**
   - 定期清理不用的镜像：`docker system prune -a`
   - 考虑多阶段构建进一步减小镜像体积

3. **安全性**
   - 使用私有镜像仓库存储生产镜像
   - 定期更新基础镜像以修复安全漏洞
   - 不要在镜像中包含敏感信息

4. **CI/CD集成**
   - 将镜像构建和推送集成到CI/CD流程
   - 自动化版本号管理
   - 自动运行测试后再推送

## 自动化推送（GitHub Actions示例）

```yaml
name: Build and Push Docker Images

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          docker-compose -f docker-compose.prod.yml build
          # ... 推送逻辑
```

---

**提示**: 首次推送可能需要较长时间（取决于网络速度），请耐心等待。后续推送会利用层缓存，速度会更快。

如有问题，请查看 [GitHub Issues](https://github.com/Chatify-AI/gcloud_server/issues)。
