#!/bin/bash

echo "=== Testing Async Execution Flow ==="
echo ""

# 1. Login
TOKEN=$(curl -s http://localhost:3000/api/admin/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to login"
  exit 1
fi

echo "✅ Login successful"
echo ""

# 2. Start async execution
echo "Starting async command execution..."
RESPONSE=$(curl -s http://localhost:3000/api/commands/execute \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accountId": 2, "command": "compute regions list --limit=5", "async": true}')

EXEC_ID=$(echo "$RESPONSE" | jq -r .executionId)
STATUS=$(echo "$RESPONSE" | jq -r .status)

echo "Execution ID: $EXEC_ID"
echo "Initial Status: $STATUS"
echo ""

# 3. Poll for status
echo "Polling for execution status..."
for i in {1..10}; do
  sleep 1

  EXEC_DATA=$(curl -s http://localhost:3000/api/commands/executions/$EXEC_ID \
    -H "Authorization: Bearer $TOKEN")

  STATUS=$(echo "$EXEC_DATA" | jq -r .execution.status)
  echo "  Attempt $i: Status = $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
done

echo ""

# 4. Get final results
echo "Final Execution Details:"
echo "========================"
curl -s http://localhost:3000/api/commands/executions/$EXEC_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.execution | {
    id: .id,
    status: .status,
    command: .command,
    executionTime: .executionTime,
    output: .output[0:200] + (if .output | length > 200 then "..." else "" end),
    error: .error
  }'

echo ""
echo "=== Async Execution Test Complete ==="