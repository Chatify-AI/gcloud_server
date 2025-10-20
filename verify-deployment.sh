#!/bin/bash

echo "========================================="
echo "GCloud Manager - 生产环境部署验证"
echo "========================================="
echo ""

# 检查所有容器状态
echo "📦 检查容器状态..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "========================================="
echo "🔍 服务健康检查"
echo "========================================="

# 检查 Main Service
echo -n "Main Service (5000): "
MAIN_HEALTH=$(curl -s http://localhost:5000/health | jq -r '.status' 2>/dev/null)
if [ "$MAIN_HEALTH" == "healthy" ]; then
    echo "✅ 健康"
else
    echo "❌ 异常"
fi

# 检查 Stats Service
echo -n "Stats Service (5001): "
STATS_HEALTH=$(curl -s http://localhost:5001/health 2>/dev/null)
if [ -n "$STATS_HEALTH" ]; then
    echo "✅ 健康"
else
    echo "❌ 异常"
fi

# 检查 Executor Service
echo -n "Executor Service (5002): "
EXECUTOR_HEALTH=$(curl -s http://localhost:5002/health | jq -r '.status' 2>/dev/null)
if [ "$EXECUTOR_HEALTH" == "healthy" ]; then
    echo "✅ 健康"
else
    echo "❌ 异常"
fi

# 检查 Nginx Proxy
echo -n "Nginx Proxy (5080): "
NGINX_HEALTH=$(curl -s http://localhost:5080/health 2>/dev/null)
if [ -n "$NGINX_HEALTH" ]; then
    echo "✅ 健康"
else
    echo "❌ 异常"
fi

# 检查 MySQL
echo -n "MySQL (5306): "
MYSQL_STATUS=$(docker exec gcloud-mysql mysqladmin ping -h localhost -uroot -proot123 2>/dev/null)
if echo "$MYSQL_STATUS" | grep -q "alive"; then
    echo "✅ 健康"
else
    echo "❌ 异常"
fi

# 检查 Redis
echo -n "Redis (5379): "
REDIS_STATUS=$(docker exec gcloud-redis redis-cli -a redis123 ping 2>/dev/null)
if [ "$REDIS_STATUS" == "PONG" ]; then
    echo "✅ 健康"
else
    echo "❌ 异常"
fi

echo ""
echo "========================================="
echo "📊 端口使用情况"
echo "========================================="
echo "主应用服务:    http://localhost:5000"
echo "统计服务:      http://localhost:5001"
echo "执行器服务:    http://localhost:5002"
echo "Nginx 代理:    http://localhost:5080"
echo "MySQL 数据库:  localhost:5306"
echo "Redis 缓存:    localhost:5379"
echo ""

echo "========================================="
echo "🎉 部署验证完成！"
echo "========================================="
