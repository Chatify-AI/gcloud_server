# 公开 API 接口文档

这些接口无需任何认证即可使用。

## 基础信息
- **服务器地址**: `http://localhost:3000`
- **API 基础路径**: `/api/public`

## 接口列表

### 1. 获取账号列表
获取所有可用的 GCloud 账号。

**请求**
```bash
GET /api/public/accounts
```

**响应示例**
```json
{
  "accounts": [
    {
      "id": 2,
      "email": "user@example.com",
      "displayName": "username",
      "projectId": "project-id",
      "isActive": true
    }
  ]
}
```

### 2. 执行 GCloud 命令
执行指定的 gcloud CLI 命令。

**请求**
```bash
POST /api/public/execute
Content-Type: application/json

{
  "accountId": 2,
  "command": "version",
  "async": false
}
```

**参数说明**
- `accountId`: 账号 ID (必需)
- `command`: 要执行的 gcloud 命令，不需要 "gcloud" 前缀 (必需)
- `async`: 是否异步执行 (可选，默认 false)

**同步响应示例**
```json
{
  "executionId": "uuid",
  "status": "completed",
  "output": "命令输出内容",
  "executionTime": 754
}
```

**异步响应示例**
```json
{
  "executionId": "uuid",
  "message": "Execution started",
  "status": "running"
}
```

### 3. 执行 Cloud Shell 命令
通过 Cloud Shell SSH 执行命令。

**请求**
```bash
POST /api/public/cloud-shell
Content-Type: application/json

{
  "accountId": 2,
  "command": "echo 'Hello' && date",
  "async": false
}
```

### 4. 获取执行状态
查询命令执行的详细状态。

**请求**
```bash
GET /api/public/executions/{executionId}
```

**响应示例**
```json
{
  "execution": {
    "id": "uuid",
    "status": "completed",
    "output": "输出内容",
    "error": "",
    "executionTime": 1234,
    "account": {
      "email": "user@example.com"
    }
  }
}
```

### 5. 获取执行历史
获取最近的命令执行历史。

**请求**
```bash
GET /api/public/executions?limit=10&offset=0
```

### 6. 取消执行
取消正在运行的命令。

**请求**
```bash
POST /api/public/executions/{executionId}/cancel
```

## 使用示例

### Python 示例
```python
import requests
import time

# 服务器地址
SERVER = "http://localhost:3000"

# 1. 获取账号
response = requests.get(f"{SERVER}/api/public/accounts")
accounts = response.json()["accounts"]
account_id = accounts[0]["id"]

# 2. 执行同步命令
response = requests.post(f"{SERVER}/api/public/execute", json={
    "accountId": account_id,
    "command": "version",
    "async": False
})
result = response.json()
print(f"输出: {result['output']}")

# 3. 执行异步命令
response = requests.post(f"{SERVER}/api/public/execute", json={
    "accountId": account_id,
    "command": "compute instances list",
    "async": True
})
execution_id = response.json()["executionId"]

# 4. 轮询获取结果
while True:
    response = requests.get(f"{SERVER}/api/public/executions/{execution_id}")
    execution = response.json()["execution"]
    if execution["status"] in ["completed", "failed"]:
        print(f"结果: {execution['output'] or execution['error']}")
        break
    time.sleep(2)
```

### Shell 脚本示例
```bash
#!/bin/bash
SERVER="http://localhost:3000"

# 获取账号 ID
ACCOUNT_ID=$(curl -s "$SERVER/api/public/accounts" | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['accounts'][0]['id'])")

# 执行命令
curl -X POST "$SERVER/api/public/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"accountId\": $ACCOUNT_ID,
    \"command\": \"version\"
  }"
```

### Node.js 示例
```javascript
const axios = require('axios');

const SERVER = 'http://localhost:3000';

async function executeCommand() {
  // 获取账号
  const { data: { accounts } } = await axios.get(`${SERVER}/api/public/accounts`);
  const accountId = accounts[0].id;

  // 执行命令
  const { data } = await axios.post(`${SERVER}/api/public/execute`, {
    accountId,
    command: 'version',
    async: false
  });

  console.log('输出:', data.output);
}

executeCommand();
```

## 状态码说明
- `200`: 成功
- `400`: 请求参数错误
- `404`: 资源未找到
- `500`: 服务器错误

## 注意事项
1. 命令执行时不需要包含 "gcloud" 前缀
2. 异步执行适合长时间运行的命令
3. Cloud Shell 命令会通过 SSH 执行，可能有额外延迟
4. 建议对异步命令设置合理的超时时间