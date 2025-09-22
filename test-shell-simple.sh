#!/bin/bash

echo "========================================"
echo "测试简单 Shell 命令接口（无需账号）"
echo "========================================"
echo ""

SERVER="http://localhost:3000"

echo "=== 1. 执行基础命令 ==="
curl -s -X POST "$SERVER/api/public/shell" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "whoami && hostname && date"
  }' | python3 -m json.tool

echo ""

echo "=== 2. 文件操作 ==="
curl -s -X POST "$SERVER/api/public/shell" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "echo Hello > /tmp/test.txt && cat /tmp/test.txt && rm /tmp/test.txt"
  }' | python3 -m json.tool

echo ""

echo "=== 3. 系统信息 ==="
curl -s -X POST "$SERVER/api/public/shell" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "uname -a && df -h | head -5"
  }' | python3 -m json.tool

echo ""

echo "=== 4. 异步执行 ==="
ASYNC_RESULT=$(curl -s -X POST "$SERVER/api/public/shell" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "for i in {1..3}; do echo \"Step $i\"; sleep 1; done",
    "async": true
  }')

echo "异步执行结果:"
echo "$ASYNC_RESULT" | python3 -m json.tool

EXECUTION_ID=$(echo "$ASYNC_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('executionId', ''))" 2>/dev/null)

if [ -n "$EXECUTION_ID" ]; then
  echo ""
  echo "轮询获取结果..."
  for i in {1..10}; do
    sleep 2
    STATUS_RESULT=$(curl -s "$SERVER/api/public/executions/$EXECUTION_ID")
    STATUS=$(echo "$STATUS_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('execution', {}).get('status', ''))" 2>/dev/null)

    echo "  状态: $STATUS"

    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
      echo ""
      echo "最终结果:"
      echo "$STATUS_RESULT" | python3 -m json.tool
      break
    fi
  done
fi

echo ""
echo "========================================"
echo "✅ Shell 命令接口测试完成！"
echo ""
echo "接口地址："
echo "  POST $SERVER/api/public/shell             # 执行 shell 命令"
echo "  GET  $SERVER/api/public/executions/{id}   # 获取执行结果"
echo "  GET  $SERVER/api/public/executions/{id}/stream # 获取流式日志"
echo ""
echo "参数说明："
echo '  {"command": "your_command", "async": false, "timeout": 30000}'
echo "========================================"