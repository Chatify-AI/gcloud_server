#!/bin/bash
set -e

echo "========================================="
echo "GCloud Executor Service"
echo "========================================="

# 等待 MySQL
echo "⏳ 等待 MySQL..."
for i in {1..30}; do
    if nc -z mysql-service 3306 2>/dev/null; then
        echo "✅ MySQL 已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ MySQL 连接失败"
        exit 1
    fi
    sleep 2
done

# 初始化 GCloud
echo "🔧 初始化 GCloud..."
GCLOUD_CONFIG_DIR="${CLOUDSDK_CONFIG:-/home/node/.config/gcloud-manager}"
mkdir -p "$GCLOUD_CONFIG_DIR"
export CLOUDSDK_CONFIG="$GCLOUD_CONFIG_DIR"

# 验证 GCloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "❌ GCloud CLI 未找到"
    exit 1
fi
echo "✅ GCloud CLI 就绪"

mkdir -p /app/logs

echo ""
echo "🚀 启动执行器服务..."
exec "$@"
