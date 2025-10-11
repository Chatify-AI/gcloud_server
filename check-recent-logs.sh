#!/bin/bash

# 查看最近的ChannelKeyService日志

echo "📋 最近50条ChannelKeyService相关日志:"
echo "================================================"
echo ""

pm2 logs gcloud-manager --lines 50 --nostream | grep -E "\[ChannelKeyService\]|PUSH KEYS|keys_pushing|keys_pushed" --color=always

echo ""
echo "================================================"
echo ""
echo "💡 提示: 使用 './watch-channel-key-logs.sh' 实时监控日志"
echo "💡 提示: 使用 'pm2 logs gcloud-manager' 查看完整日志"
