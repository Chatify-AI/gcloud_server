#!/bin/bash
set -e

# ==========================================
# Docker 入口脚本 - 主应用
# ==========================================

echo "========================================="
echo "GCloud Manager - Main Service Startup"
echo "========================================="
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-3000}"
echo ""

# 等待 MySQL 准备就绪
echo "Waiting for MySQL database to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://mysql-service:3306 > /dev/null 2>&1 || \
       nc -z mysql-service 3306 > /dev/null 2>&1; then
        echo "✓ MySQL is ready!"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS - Waiting for MySQL..."
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "✗ Failed to connect to MySQL after $MAX_ATTEMPTS attempts"
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
        echo "✗ Failed to connect to Redis after $MAX_ATTEMPTS attempts"
        exit 1
    fi
fi

# 初始化 GCloud 配置目录
echo "Initializing GCloud configuration..."
if [ ! -d /root/.config/gcloud-manager ]; then
    mkdir -p /root/.config/gcloud-manager
    echo "✓ Created GCloud config directory"
else
    echo "✓ GCloud config directory exists"
fi

# 初始化数据库表 (可选)
if [ "$RUN_DB_INIT" = "true" ]; then
    echo "Running database initialization..."
    if [ -f /app/backend/scripts/init-database.js ]; then
        node /app/backend/scripts/init-database.js
    else
        echo "⚠ Database init script not found"
    fi
fi

# 初始化管理员账户 (可选)
if [ "$CREATE_DEFAULT_ADMIN" = "true" ]; then
    echo "Creating default admin account..."
    if [ -f /app/backend/scripts/create-admin.js ]; then
        node /app/backend/scripts/create-admin.js
    else
        echo "⚠ Admin creation script not found"
    fi
fi

# 显示配置信息
echo ""
echo "========================================="
echo "Configuration Summary:"
echo "========================================="
echo "Application: Main Service"
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-3000}"
echo "Database: ${DB_HOST}:${DB_PORT}"
echo "Database Name: ${DB_NAME}"
echo "GCloud Config: ${GCLOUD_CONFIG_DIR}"
echo "Log Directory: ${LOG_DIR:-/app/logs}"
echo "========================================="
echo ""

# 创建日志目录
LOG_DIR="${LOG_DIR:-/app/logs}"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    echo "✓ Created log directory: $LOG_DIR"
fi

# 启动应用
echo "Starting GCloud Manager Main Service..."
echo "Command: $@"
echo ""

exec "$@"
