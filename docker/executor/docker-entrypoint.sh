#!/bin/bash
set -e

echo "========================================="
echo "GCloud Manager - Executor Service Startup"
echo "========================================="
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-3001}"
echo ""

# 等待 MySQL 准备就绪
echo "Waiting for MySQL database to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if nc -z mysql-service 3306 > /dev/null 2>&1; then
        echo "✓ MySQL is ready!"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS - Waiting for MySQL..."
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "✗ Failed to connect to MySQL"
    exit 1
fi

# 等待 Redis 准备就绪 (如果配置了)
if [ -n "$REDIS_HOST" ]; then
    echo "Waiting for Redis to be ready..."
    ATTEMPT=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if nc -z ${REDIS_HOST} ${REDIS_PORT:-6379} > /dev/null 2>&1; then
            echo "✓ Redis is ready!"
            break
        fi

        ATTEMPT=$((ATTEMPT + 1))
        echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS - Waiting for Redis..."
        sleep 2
    done

    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "✗ Failed to connect to Redis"
        exit 1
    fi
fi

# 初始化 GCloud 配置目录
echo "Initializing GCloud configuration..."
GCLOUD_CONFIG_DIR="${CLOUDSDK_CONFIG:-/root/.config/gcloud-manager}"

if [ ! -d "$GCLOUD_CONFIG_DIR" ]; then
    mkdir -p "$GCLOUD_CONFIG_DIR"
    echo "✓ Created GCloud config directory: $GCLOUD_CONFIG_DIR"
else
    echo "✓ GCloud config directory exists: $GCLOUD_CONFIG_DIR"
fi

# 验证 GCloud CLI 可用
echo "Verifying GCloud CLI..."
if command -v gcloud &> /dev/null; then
    GCLOUD_VERSION=$(gcloud --version | head -n 1)
    echo "✓ GCloud CLI available: $GCLOUD_VERSION"
else
    echo "✗ GCloud CLI not found"
    exit 1
fi

# 创建日志目录
LOG_DIR="${LOG_DIR:-/app/logs}"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    echo "✓ Created log directory: $LOG_DIR"
fi

echo ""
echo "========================================="
echo "Configuration Summary:"
echo "========================================="
echo "Service: GCloud Executor Service"
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-3001}"
echo "Database: ${DB_HOST}:${DB_PORT}"
echo "Redis: ${REDIS_HOST}:${REDIS_PORT}"
echo "GCloud Config: $GCLOUD_CONFIG_DIR"
echo "GCloud Project: ${GCLOUD_PROJECT:-default}"
echo "========================================="
echo ""

echo "Starting GCloud Executor Service..."
exec "$@"
