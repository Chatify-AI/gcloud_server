#!/bin/bash

# 查看ChannelKeyService相关日志的脚本

echo "🔍 实时监控ChannelKeyService日志..."
echo "   按 Ctrl+C 停止监控"
echo ""
echo "================================================"
echo ""

pm2 logs gcloud-manager --lines 100 --nostream | grep -E "\[ChannelKeyService\]|PUSH KEYS" --color=always

echo ""
echo "================================================"
echo ""
echo "💡 开始实时监控日志 (只显示ChannelKeyService相关)..."
echo ""

pm2 logs gcloud-manager --raw | grep --line-buffered -E "\[ChannelKeyService\]|PUSH KEYS" --color=always
