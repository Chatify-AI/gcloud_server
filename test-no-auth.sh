#!/bin/bash

# 测试无需认证的命令执行接口
echo "=========================================="
echo "测试无需认证的 GCloud 命令执行接口"
echo "=========================================="
echo ""

# 服务器地址
SERVER="http://localhost:3000"

# 1. 获取账号列表
echo "1. 获取 GCloud 账号列表 (公开接口)..."
ACCOUNTS=$(curl -s "$SERVER/api/public/accounts")
echo "$ACCOUNTS" | python3 -m json.tool 2>/dev/null || echo "$ACCOUNTS"
echo ""

# 获取第一个账号的ID
ACCOUNT_ID=$(echo "$ACCOUNTS" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['accounts'][0]['id']) if data.get('accounts') else print('')" 2>/dev/null)

if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ 没有找到可用的 GCloud 账号"
  echo "请先通过 Web 界面添加账号"
  exit 1
fi

echo "✅ 找到账号 ID: $ACCOUNT_ID"
echo ""

# 2. 执行同步命令
echo "2. 执行同步命令 (gcloud version)..."
SYNC_RESULT=$(curl -s -X POST "$SERVER/api/public/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"version\",
    \"async\": false
  }")

echo "$SYNC_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SYNC_RESULT"
echo ""

# 3. 执行异步命令
echo "3. 执行异步命令 (gcloud compute instances list)..."
ASYNC_RESULT=$(curl -s -X POST "$SERVER/api/public/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"compute instances list\",
    \"async\": true
  }")

EXECUTION_ID=$(echo "$ASYNC_RESULT" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('executionId', ''))" 2>/dev/null)

if [ -n "$EXECUTION_ID" ]; then
  echo "✅ 异步执行已启动，执行ID: $EXECUTION_ID"
  echo ""

  # 轮询获取结果
  echo "4. 轮询获取执行结果..."
  for i in {1..10}; do
    sleep 2
    STATUS_RESULT=$(curl -s "$SERVER/api/public/executions/$EXECUTION_ID")
    STATUS=$(echo "$STATUS_RESULT" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('execution', {}).get('status', ''))" 2>/dev/null)

    echo "   状态: $STATUS"

    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
      echo ""
      echo "执行完成，结果："
      echo "$STATUS_RESULT" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESULT"
      break
    fi
  done
else
  echo "异步执行结果："
  echo "$ASYNC_RESULT" | python3 -m json.tool 2>/dev/null || echo "$ASYNC_RESULT"
fi

echo ""

# 5. 执行 Cloud Shell 命令
echo "5. 执行 Cloud Shell 命令..."
SHELL_RESULT=$(curl -s -X POST "$SERVER/api/public/cloud-shell" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"echo 'Hello from Cloud Shell' && date\",
    \"async\": false
  }")

echo "$SHELL_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SHELL_RESULT"
echo ""

# 6. 查看执行历史
echo "6. 查看最近的执行历史..."
HISTORY=$(curl -s "$SERVER/api/public/executions?limit=3")
echo "$HISTORY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('最近执行的命令:')
for exec in data.get('executions', [])[:3]:
    print(f\"  - [{exec['status']}] {exec['command'][:50]}...\" if len(exec['command']) > 50 else f\"  - [{exec['status']}] {exec['command']}\")
" 2>/dev/null || echo "$HISTORY"

echo ""
echo "=========================================="
echo "✅ 测试完成！"
echo ""
echo "现在你可以直接使用以下接口，无需任何认证："
echo "  - GET  $SERVER/api/public/accounts           # 获取账号列表"
echo "  - POST $SERVER/api/public/execute            # 执行 gcloud 命令"
echo "  - POST $SERVER/api/public/cloud-shell        # 执行 Cloud Shell 命令"
echo "  - GET  $SERVER/api/public/executions         # 查看执行历史"
echo "  - GET  $SERVER/api/public/executions/{id}    # 查看特定执行详情"
echo "  - POST $SERVER/api/public/executions/{id}/cancel # 取消执行"
echo ""
echo "参数说明："
echo "  accountId: GCloud 账号 ID (必需)"
echo "  command: 要执行的命令 (必需)"
echo "  async: true/false (可选，默认 false)"
echo "=========================================="