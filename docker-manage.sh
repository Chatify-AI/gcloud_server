#!/bin/bash

# GCloud Manager Docker 管理脚本

COMPOSE_FILE="docker-compose.prod.yml"

show_usage() {
    echo "GCloud Manager Docker 管理工具"
    echo ""
    echo "用法: $0 <命令> [选项]"
    echo ""
    echo "命令:"
    echo "  start          启动所有服务"
    echo "  stop           停止所有服务"
    echo "  restart        重启所有服务"
    echo "  status         查看服务状态"
    echo "  logs [服务]    查看日志 (可选指定服务名)"
    echo "  build          重新构建镜像"
    echo "  update         更新并重启服务"
    echo "  clean          停止并删除所有容器和卷（危险！）"
    echo "  verify         验证部署状态"
    echo ""
    echo "示例:"
    echo "  $0 start                # 启动所有服务"
    echo "  $0 logs main-service    # 查看主服务日志"
    echo "  $0 restart              # 重启所有服务"
}

case "$1" in
    start)
        echo "🚀 启动所有服务..."
        docker-compose -f $COMPOSE_FILE up -d
        echo ""
        echo "✅ 启动完成！运行 '$0 verify' 验证部署"
        ;;

    stop)
        echo "🛑 停止所有服务..."
        docker-compose -f $COMPOSE_FILE down
        echo "✅ 已停止所有服务"
        ;;

    restart)
        echo "🔄 重启所有服务..."
        docker-compose -f $COMPOSE_FILE restart
        echo "✅ 重启完成"
        ;;

    status)
        echo "📊 服务状态:"
        docker-compose -f $COMPOSE_FILE ps
        ;;

    logs)
        if [ -z "$2" ]; then
            echo "📋 查看所有服务日志 (Ctrl+C 退出)..."
            docker-compose -f $COMPOSE_FILE logs -f --tail=100
        else
            echo "📋 查看 $2 服务日志 (Ctrl+C 退出)..."
            docker-compose -f $COMPOSE_FILE logs -f --tail=100 "$2"
        fi
        ;;

    build)
        echo "🔨 重新构建镜像..."
        docker-compose -f $COMPOSE_FILE build
        echo "✅ 构建完成"
        ;;

    update)
        echo "🔄 更新服务..."
        echo "1. 重新构建镜像..."
        docker-compose -f $COMPOSE_FILE build
        echo "2. 重启服务..."
        docker-compose -f $COMPOSE_FILE up -d
        echo "✅ 更新完成"
        ;;

    clean)
        read -p "⚠️  这将删除所有容器和数据卷！确定吗? (yes/no): " confirm
        if [ "$confirm" == "yes" ]; then
            echo "🗑️  清理所有资源..."
            docker-compose -f $COMPOSE_FILE down -v
            echo "✅ 清理完成"
        else
            echo "❌ 已取消"
        fi
        ;;

    verify)
        if [ -f "./verify-deployment.sh" ]; then
            ./verify-deployment.sh
        else
            echo "❌ 找不到验证脚本"
        fi
        ;;

    *)
        show_usage
        exit 1
        ;;
esac
