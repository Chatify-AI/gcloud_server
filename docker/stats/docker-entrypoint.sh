#!/bin/bash
set -e

echo "========================================="
echo "GCloud Manager - Stats Service Startup"
echo "========================================="
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-4000}"
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

# 等待主服务准备就绪
echo "Waiting for Main Service to be ready..."
ATTEMPT=0

while [ $ATTEMPT -lt 20 ]; do
    if curl -s http://main-service:3000/health > /dev/null 2>&1; then
        echo "✓ Main Service is ready!"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo "  Attempt $ATTEMPT/20 - Waiting for Main Service..."
    sleep 2
done

# 创建日志目录
LOG_DIR="${LOG_DIR:-/app/logs}"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
fi

echo ""
echo "========================================="
echo "Configuration Summary:"
echo "========================================="
echo "Service: Channel Statistics Service"
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-4000}"
echo "Database: ${DB_HOST}:${DB_PORT}"
echo "Main Service: ${MAIN_SERVICE_URL:-http://main-service:3000}"
echo "========================================="
echo ""

echo "Starting Channel Statistics Service..."
exec "$@"
