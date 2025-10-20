#!/bin/bash
set -e

echo "========================================="
echo "GCloud Manager - Main Service"
echo "========================================="

# 等待 MySQL 就绪
echo "⏳ 等待 MySQL 数据库..."
for i in {1..30}; do
    if nc -z mysql-service 3306 2>/dev/null; then
        echo "✅ MySQL 已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ MySQL 连接超时"
        exit 1
    fi
    echo "  尝试 $i/30..."
    sleep 2
done

# 等待 Redis 就绪
if [ -n "$REDIS_HOST" ]; then
    echo "⏳ 等待 Redis..."
    for i in {1..20}; do
        if nc -z ${REDIS_HOST} ${REDIS_PORT:-6379} 2>/dev/null; then
            echo "✅ Redis 已就绪"
            break
        fi
        if [ $i -eq 20 ]; then
            echo "⚠️  Redis 连接超时（继续）"
            break
        fi
        sleep 2
    done
fi

# 初始化 GCloud 配置
echo "🔧 初始化 GCloud 配置..."
GCLOUD_CONFIG_DIR="${CLOUDSDK_CONFIG:-/home/node/.config/gcloud-manager}"
mkdir -p "$GCLOUD_CONFIG_DIR"
export CLOUDSDK_CONFIG="$GCLOUD_CONFIG_DIR"

# 创建日志目录
mkdir -p /app/logs

echo ""
echo "========================================="
echo "配置信息:"
echo "========================================="
echo "环境: ${NODE_ENV:-production}"
echo "端口: ${PORT:-3000}"
echo "数据库: ${DB_HOST}:${DB_PORT}"
echo "========================================="
echo ""

echo "🚀 启动应用..."
exec "$@"
