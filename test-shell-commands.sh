#!/bin/bash

echo "========================================"
echo "测试 Cloud Shell 命令接口"
echo "========================================"
echo ""

SERVER="http://localhost:3000"

# 获取账号 ID
echo "获取账号 ID..."
ACCOUNT_ID=$(curl -s "$SERVER/api/public/accounts" | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['accounts'][0]['id'])" 2>/dev/null)

if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ 无法获取账号 ID"
  exit 1
fi

echo "✅ 账号 ID: $ACCOUNT_ID"
echo ""

# 测试各种 Shell 命令
echo "=== 1. 基础系统信息 ==="
curl -s -X POST "$SERVER/api/public/cloud-shell" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"whoami && hostname && date && uname -a\"
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('输出:')
print(data.get('output', ''))
print(f'执行时间: {data.get(\"executionTime\", 0)}ms')
" 2>/dev/null

echo ""

echo "=== 2. 文件系统操作 ==="
curl -s -X POST "$SERVER/api/public/cloud-shell" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"pwd && ls -la | head -10\"
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('输出:')
print(data.get('output', ''))
" 2>/dev/null

echo ""

echo "=== 3. 网络测试 ==="
curl -s -X POST "$SERVER/api/public/cloud-shell" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"curl -s ipinfo.io/json\"
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('输出:')
print(data.get('output', ''))
" 2>/dev/null

echo ""

echo "=== 4. Python 命令 ==="
curl -s -X POST "$SERVER/api/public/cloud-shell" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"python3 -c 'import sys; print(f\\\"Python版本: {sys.version}\\\"); import os; print(f\\\"当前目录: {os.getcwd()}\\\")' \"
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('输出:')
print(data.get('output', ''))
" 2>/dev/null

echo ""

echo "=== 5. 异步执行长命令 ==="
ASYNC_RESULT=$(curl -s -X POST "$SERVER/api/public/cloud-shell" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"for i in {1..5}; do echo \\\"计数: \$i\\\"; sleep 1; done\",
    \"async\": true
  }")

EXECUTION_ID=$(echo "$ASYNC_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('executionId', ''))" 2>/dev/null)

if [ -n "$EXECUTION_ID" ]; then
  echo "异步执行已启动，ID: $EXECUTION_ID"
  echo "轮询获取结果..."

  for i in {1..10}; do
    sleep 2
    STATUS_RESULT=$(curl -s "$SERVER/api/public/executions/$EXECUTION_ID")
    STATUS=$(echo "$STATUS_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('execution', {}).get('status', ''))" 2>/dev/null)

    echo "  状态: $STATUS"

    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
      echo ""
      echo "最终结果:"
      echo "$STATUS_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
exec_data = data.get('execution', {})
print('输出:')
print(exec_data.get('output', ''))
if exec_data.get('error'):
    print('错误:')
    print(exec_data.get('error'))
print(f'执行时间: {exec_data.get(\"executionTime\", 0)}ms')
" 2>/dev/null
      break
    fi
  done
fi

echo ""

echo "=== 6. 创建和读取文件 ==="
curl -s -X POST "$SERVER/api/public/cloud-shell" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"echo 'Hello from Cloud Shell API' > test.txt && cat test.txt && rm test.txt\"
  }" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('输出:')
print(data.get('output', ''))
" 2>/dev/null

echo ""

echo "========================================"
echo "✅ Cloud Shell 接口测试完成！"
echo ""
echo "Cloud Shell 接口地址:"
echo "  POST $SERVER/api/public/cloud-shell"
echo ""
echo "参数示例:"
echo '  {'
echo '    "accountId": 2,'
echo '    "command": "你的shell命令",'
echo '    "async": false'
echo '  }'
echo ""
echo "支持的命令类型:"
echo "  - 任何 Linux shell 命令"
echo "  - Python 脚本"
echo "  - 网络工具 (curl, wget 等)"
echo "  - 文件操作"
echo "  - 系统信息查询"
echo "========================================"