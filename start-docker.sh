#!/bin/bash

# ==========================================
# GCloud Manager Docker 启动脚本
# ==========================================

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   GCloud Manager - Docker 一键启动                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 检查 Docker 和 Docker Compose
echo "🔍 检查环境..."
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    exit 1
fi

echo "✅ Docker 版本: $(docker --version)"
echo "✅ Docker Compose 版本: $(docker-compose --version)"
echo ""

# 检查并创建环境文件
if [ ! -f .env.prod ]; then
    echo "⚠️  .env.prod 文件不存在，使用示例配置"
    cp .env.prod.example .env.prod 2>/dev/null || true
else
    echo "✅ 使用 .env.prod 配置"
fi

echo ""
echo "📦 准备启动容器..."
echo ""

# 拉取基础镜像
echo "📥 拉取基础镜像..."
docker pull mysql:8.0
docker pull redis:7-alpine
docker pull nginx:1.25-alpine
docker pull node:18-slim
docker pull node:18

echo ""
echo "🔨 构建应用镜像..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "🚀 启动所有容器..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 10

echo ""
echo "📊 检查服务状态..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🔍 验证服务健康状态..."
echo ""

# 检查主应用
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ 主应用 (http://localhost:5000) 正常"
else
    echo "⚠️  主应用未就绪，等待中..."
    sleep 5
fi

# 检查统计服务
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo "✅ 统计服务 (http://localhost:5001) 正常"
else
    echo "⚠️  统计服务未就绪，等待中..."
fi

# 检查执行器
if curl -s http://localhost:5002/health > /dev/null 2>&1; then
    echo "✅ 执行器服务 (http://localhost:5002) 正常"
else
    echo "⚠️  执行器服务未就绪，等待中..."
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🎉 容器已启动！"
echo ""
echo "📍 访问地址:"
echo "   主应用 UI:        http://localhost"
echo "   主应用 API:       http://localhost:3000"
echo "   统计服务:         http://localhost:4000"
echo "   执行器服务:       http://localhost:3001"
echo ""
echo "📚 常用命令:"
echo "   查看日志:        docker-compose -f docker-compose.prod.yml logs -f"
echo "   查看状态:        docker-compose -f docker-compose.prod.yml ps"
echo "   进入容器:        docker-compose -f docker-compose.prod.yml exec main-service bash"
echo "   停止服务:        docker-compose -f docker-compose.prod.yml down"
echo "   查看资源占用:    docker stats"
echo ""
echo "💡 提示: 首次启动可能需要 1-2 分钟才能完全就绪"
echo ""
echo "════════════════════════════════════════════════════════════"
