#!/bin/bash

# GCloud Server Docker镜像推送脚本
# 支持推送到Docker Hub和阿里云镜像仓库

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
VERSION="v3.6.0"
DOCKER_HUB_NAMESPACE="${DOCKER_HUB_USER:-chatifyai}"  # 修改为你的Docker Hub用户名
ALIYUN_NAMESPACE="registry.cn-hangzhou.aliyuncs.com/chatify"  # 修改为你的阿里云命名空间

# 服务列表
SERVICES=("main-service" "executor-service" "stats-service" "ftp-service")

echo -e "${GREEN}=== GCloud Server 镜像推送脚本 ===${NC}"
echo -e "${GREEN}版本: $VERSION${NC}"
echo ""

# 选择推送目标
echo "请选择推送目标:"
echo "  1) Docker Hub (docker.io/$DOCKER_HUB_NAMESPACE)"
echo "  2) 阿里云镜像仓库 ($ALIYUN_NAMESPACE)"
echo "  3) 两者都推送"
read -p "请输入选择 [1/2/3]: " CHOICE

case $CHOICE in
  1)
    PUSH_DOCKERHUB=true
    PUSH_ALIYUN=false
    ;;
  2)
    PUSH_DOCKERHUB=false
    PUSH_ALIYUN=true
    ;;
  3)
    PUSH_DOCKERHUB=true
    PUSH_ALIYUN=true
    ;;
  *)
    echo -e "${RED}无效选择，退出${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${YELLOW}=== 第1步：构建镜像 ===${NC}"

# 构建所有镜像
echo "开始构建镜像..."
docker-compose -f docker-compose.prod.yml build

echo -e "${GREEN}✓ 镜像构建完成${NC}"
echo ""

# 为每个服务打标签并推送
for SERVICE in "${SERVICES[@]}"; do
  LOCAL_IMAGE="gcloud_server-$SERVICE:latest"

  echo -e "${YELLOW}=== 处理服务: $SERVICE ===${NC}"

  # Docker Hub
  if [ "$PUSH_DOCKERHUB" = true ]; then
    DOCKERHUB_IMAGE="$DOCKER_HUB_NAMESPACE/gcloud-$SERVICE"

    echo "打标签: $DOCKERHUB_IMAGE:$VERSION"
    docker tag $LOCAL_IMAGE $DOCKERHUB_IMAGE:$VERSION
    docker tag $LOCAL_IMAGE $DOCKERHUB_IMAGE:latest

    echo "推送到Docker Hub..."
    docker push $DOCKERHUB_IMAGE:$VERSION
    docker push $DOCKERHUB_IMAGE:latest

    echo -e "${GREEN}✓ Docker Hub推送完成: $DOCKERHUB_IMAGE${NC}"
  fi

  # 阿里云
  if [ "$PUSH_ALIYUN" = true ]; then
    ALIYUN_IMAGE="$ALIYUN_NAMESPACE/gcloud-$SERVICE"

    echo "打标签: $ALIYUN_IMAGE:$VERSION"
    docker tag $LOCAL_IMAGE $ALIYUN_IMAGE:$VERSION
    docker tag $LOCAL_IMAGE $ALIYUN_IMAGE:latest

    echo "推送到阿里云..."
    docker push $ALIYUN_IMAGE:$VERSION
    docker push $ALIYUN_IMAGE:latest

    echo -e "${GREEN}✓ 阿里云推送完成: $ALIYUN_IMAGE${NC}"
  fi

  echo ""
done

echo -e "${GREEN}=== 所有镜像推送完成 ===${NC}"
echo ""

# 显示镜像信息
echo -e "${YELLOW}推送的镜像列表：${NC}"
echo ""

if [ "$PUSH_DOCKERHUB" = true ]; then
  echo "Docker Hub镜像:"
  for SERVICE in "${SERVICES[@]}"; do
    echo "  $DOCKER_HUB_NAMESPACE/gcloud-$SERVICE:$VERSION"
    echo "  $DOCKER_HUB_NAMESPACE/gcloud-$SERVICE:latest"
  done
  echo ""
fi

if [ "$PUSH_ALIYUN" = true ]; then
  echo "阿里云镜像:"
  for SERVICE in "${SERVICES[@]}"; do
    echo "  $ALIYUN_NAMESPACE/gcloud-$SERVICE:$VERSION"
    echo "  $ALIYUN_NAMESPACE/gcloud-$SERVICE:latest"
  done
  echo ""
fi

# 生成docker-compose配置
echo -e "${YELLOW}=== 生成生产环境docker-compose配置 ===${NC}"

if [ "$PUSH_DOCKERHUB" = true ]; then
  REGISTRY="$DOCKER_HUB_NAMESPACE"
elif [ "$PUSH_ALIYUN" = true ]; then
  REGISTRY="$ALIYUN_NAMESPACE"
fi

cat > docker-compose.remote.yml << EOF
# 使用远程镜像的生产环境配置
# 自动生成于: $(date)
# 版本: $VERSION

version: '3.8'

services:
  mysql-service:
    image: mysql:8.0
    container_name: gcloud-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:-root123}
      MYSQL_DATABASE: gcloud
      MYSQL_USER: gcloud
      MYSQL_PASSWORD: \${DB_PASSWORD:-gcloud123}
    ports:
      - "5306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker-prod/mysql/init-scripts:/docker-entrypoint-initdb.d
    networks:
      - gcloud-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10
      interval: 5s

  redis-service:
    image: redis:7-alpine
    container_name: gcloud-redis
    restart: unless-stopped
    ports:
      - "5379:6379"
    volumes:
      - redis_data:/data
    networks:
      - gcloud-network
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD:-redis123}
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "\${REDIS_PASSWORD:-redis123}", "ping"]
      timeout: 3s
      retries: 5
      interval: 5s

  main-service:
    image: $REGISTRY/gcloud-main-service:$VERSION
    container_name: gcloud-main
    restart: unless-stopped
    depends_on:
      mysql-service:
        condition: service_healthy
      redis-service:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      HOST: 0.0.0.0
      DB_HOST: mysql-service
      DB_PORT: 3306
      DB_NAME: gcloud
      DB_USER: gcloud
      DB_PASSWORD: \${DB_PASSWORD:-gcloud123}
      REDIS_HOST: redis-service
      REDIS_PORT: 6379
      REDIS_PASSWORD: \${REDIS_PASSWORD:-redis123}
      JWT_SECRET: \${JWT_SECRET:-your-secret-key-change-this}
      SESSION_SECRET: \${SESSION_SECRET:-your-session-secret-change-this}
      GCLOUD_PROJECT: \${GCLOUD_PROJECT:-}
      LOG_LEVEL: \${LOG_LEVEL:-info}
      CHANNEL_MONITOR_PATH: /home/ftpusers/chatify/vip
      EXECUTOR_SERVICE_URL: http://executor-service:3001
      ONEAPI_BASE_URL: \${ONEAPI_BASE_URL:-http://104.194.9.201:11002}
      ONEAPI_KEY: \${ONEAPI_KEY:-t0bAXxyETOitEfEWuU37sWSqwJrE}
      GCLOUD_SCRIPT_URL: \${GCLOUD_SCRIPT_URL:-https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh}
      GCLOUD_SCRIPT_BACKUP_URL: \${GCLOUD_SCRIPT_BACKUP_URL:-}
      FTP_HOST: ftp-service
      FTP_PORT: 21
      FTP_USERNAME: chatify
      FTP_PASSWORD: chatify123
    ports:
      - "5000:3000"
    volumes:
      - gcloud_config:/home/node/.config/gcloud-manager
      - app_logs:/app/logs
      - ftp_data:/home/ftpusers/chatify
    networks:
      - gcloud-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      timeout: 10s
      retries: 5
      interval: 15s
      start_period: 40s

  stats-service:
    image: $REGISTRY/gcloud-stats-service:$VERSION
    container_name: gcloud-stats
    restart: unless-stopped
    depends_on:
      mysql-service:
        condition: service_healthy
      main-service:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 4000
      HOST: 0.0.0.0
      DB_HOST: mysql-service
      DB_PORT: 3306
      DB_NAME: gcloud
      DB_USER: gcloud
      DB_PASSWORD: \${DB_PASSWORD:-gcloud123}
      LOG_LEVEL: \${LOG_LEVEL:-info}
    ports:
      - "5001:4000"
    volumes:
      - stats_logs:/app/logs
    networks:
      - gcloud-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      timeout: 10s
      retries: 5
      interval: 15s
      start_period: 30s

  executor-service:
    image: $REGISTRY/gcloud-executor-service:$VERSION
    container_name: gcloud-executor
    restart: unless-stopped
    depends_on:
      mysql-service:
        condition: service_healthy
      redis-service:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3001
      HOST: 0.0.0.0
      DB_HOST: mysql-service
      DB_PORT: 3306
      DB_NAME: gcloud
      DB_USER: gcloud
      DB_PASSWORD: \${DB_PASSWORD:-gcloud123}
      REDIS_HOST: redis-service
      REDIS_PORT: 6379
      REDIS_PASSWORD: \${REDIS_PASSWORD:-redis123}
      CLOUDSDK_CONFIG: /home/node/.config/gcloud-manager
      GCLOUD_PROJECT: \${GCLOUD_PROJECT:-}
      LOG_LEVEL: \${LOG_LEVEL:-info}
    ports:
      - "5002:3001"
    volumes:
      - gcloud_config:/home/node/.config/gcloud-manager
      - executor_logs:/app/logs
    networks:
      - gcloud-network
    cap_add:
      - SYS_ADMIN
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      timeout: 10s
      retries: 5
      interval: 15s
      start_period: 30s

  ftp-service:
    image: $REGISTRY/gcloud-ftp-service:$VERSION
    container_name: gcloud-ftp
    restart: unless-stopped
    environment:
      PUBLICHOST: \${FTP_PUBLIC_HOST:-82.197.94.152}
      FTP_USER_NAME: chatify
      FTP_USER_PASS: chatify123
      FTP_USER_HOME: /home/ftpusers/chatify
    ports:
      - "5021:21"
      - "50000-50009:30000-30009"
    volumes:
      - ftp_data:/home/ftpusers/chatify
    networks:
      - gcloud-network

  nginx-proxy:
    image: nginx:1.25-alpine
    container_name: gcloud-nginx
    restart: unless-stopped
    depends_on:
      - main-service
      - stats-service
    ports:
      - "5080:80"
      - "5443:443"
    volumes:
      - ./docker-prod/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - gcloud-network

networks:
  gcloud-network:
    driver: bridge

volumes:
  mysql_data:
  redis_data:
  gcloud_config:
  app_logs:
  stats_logs:
  executor_logs:
  ftp_data:
EOF

echo -e "${GREEN}✓ 已生成 docker-compose.remote.yml${NC}"
echo ""

echo -e "${GREEN}=== 部署说明 ===${NC}"
echo ""
echo "1. 在目标服务器上创建 .env 文件（参考 .env.example）"
echo ""
echo "2. 使用远程镜像启动服务："
echo "   docker-compose -f docker-compose.remote.yml up -d"
echo ""
echo "3. 查看服务状态："
echo "   docker-compose -f docker-compose.remote.yml ps"
echo ""
echo "4. 查看日志："
echo "   docker-compose -f docker-compose.remote.yml logs -f"
echo ""

echo -e "${GREEN}=== 完成 ===${NC}"
