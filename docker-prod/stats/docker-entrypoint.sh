#!/bin/bash
set -e

echo "========================================="
echo "Channel Statistics Service"
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

# 等待主服务
echo "⏳ 等待主服务..."
for i in {1..20}; do
    if curl -s http://main-service:3000/health > /dev/null 2>&1; then
        echo "✅ 主服务已就绪"
        break
    fi
    sleep 2
done

mkdir -p /app/logs

echo ""
echo "🚀 启动统计服务..."
exec "$@"
