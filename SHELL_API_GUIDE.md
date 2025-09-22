# Shell 命令和日志接口使用指南

## 无需认证的Shell命令接口

这些接口完全无需任何认证，可以直接执行Shell命令并获取实时日志。

## 接口列表

### 1. 执行Shell命令
直接在服务器上执行任意Shell命令，无需GCloud账号。

**同步执行**
```bash
curl -X POST http://localhost:3000/api/public/shell \
  -H "Content-Type: application/json" \
  -d '{
    "command": "whoami && hostname && date",
    "async": false,
    "timeout": 30000
  }'
```

**异步执行**
```bash
curl -X POST http://localhost:3000/api/public/shell \
  -H "Content-Type: application/json" \
  -d '{
    "command": "for i in {1..10}; do echo \"Processing $i\"; sleep 1; done",
    "async": true,
    "timeout": 60000
  }'
```

### 2. 获取执行结果
查询命令执行状态和结果。

```bash
curl http://localhost:3000/api/public/executions/{executionId}
```

### 3. 获取实时日志流
通过Server-Sent Events获取命令的实时输出。

```bash
curl -N http://localhost:3000/api/public/executions/{executionId}/stream
```

### 4. 取消执行
取消正在运行的命令。

```bash
curl -X POST http://localhost:3000/api/public/executions/{executionId}/cancel
```

## 完整使用示例

### Python 客户端
```python
import requests
import json
import time
from sseclient import SSEClient  # pip install sseclient-py

SERVER = "http://localhost:3000"

def execute_shell_command(command, async_mode=False):
    """执行Shell命令"""
    response = requests.post(f"{SERVER}/api/public/shell", json={
        "command": command,
        "async": async_mode,
        "timeout": 30000
    })
    return response.json()

def get_execution_result(execution_id):
    """获取执行结果"""
    response = requests.get(f"{SERVER}/api/public/executions/{execution_id}")
    return response.json()

def stream_logs(execution_id):
    """流式获取日志"""
    url = f"{SERVER}/api/public/executions/{execution_id}/stream"
    for event in SSEClient(url):
        if event.data:
            data = json.loads(event.data)
            if data['type'] == 'output':
                print(f"输出: {data['data']}", end='')
            elif data['type'] == 'error':
                print(f"错误: {data['data']}")
            elif data['type'] == 'close':
                print("命令执行完成")
                break

# 示例1: 同步执行
print("=== 同步执行 ===")
result = execute_shell_command("ls -la | head -5")
print(f"输出: {result['output']}")

# 示例2: 异步执行 + 轮询
print("\\n=== 异步执行 + 轮询 ===")
result = execute_shell_command("sleep 5 && echo 'Done!'", async_mode=True)
execution_id = result['executionId']
print(f"执行ID: {execution_id}")

while True:
    status = get_execution_result(execution_id)
    exec_status = status['execution']['status']
    print(f"状态: {exec_status}")

    if exec_status in ['completed', 'failed']:
        print(f"最终输出: {status['execution']['output']}")
        break
    time.sleep(1)

# 示例3: 异步执行 + 实时日志流
print("\\n=== 异步执行 + 实时日志 ===")
result = execute_shell_command("for i in {1..5}; do echo \"Step $i\"; sleep 1; done", async_mode=True)
execution_id = result['executionId']
stream_logs(execution_id)
```

### JavaScript 客户端
```javascript
const SERVER = 'http://localhost:3000';

async function executeShellCommand(command, asyncMode = false) {
    const response = await fetch(`${SERVER}/api/public/shell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            command,
            async: asyncMode,
            timeout: 30000
        })
    });
    return response.json();
}

async function getExecutionResult(executionId) {
    const response = await fetch(`${SERVER}/api/public/executions/${executionId}`);
    return response.json();
}

function streamLogs(executionId) {
    const eventSource = new EventSource(`${SERVER}/api/public/executions/${executionId}/stream`);

    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'output') {
            console.log('输出:', data.data);
        } else if (data.type === 'error') {
            console.log('错误:', data.data);
        } else if (data.type === 'close') {
            console.log('命令执行完成');
            eventSource.close();
        }
    };

    return eventSource;
}

// 使用示例
(async () => {
    // 同步执行
    const syncResult = await executeShellCommand('date');
    console.log('同步结果:', syncResult.output);

    // 异步执行 + 实时日志
    const asyncResult = await executeShellCommand('for i in {1..3}; do echo "Line $i"; sleep 1; done', true);
    streamLogs(asyncResult.executionId);
})();
```

### Bash 脚本
```bash
#!/bin/bash

SERVER="http://localhost:3000"

# 函数：执行Shell命令
execute_command() {
    local command="$1"
    local async="${2:-false}"

    curl -s -X POST "$SERVER/api/public/shell" \
        -H "Content-Type: application/json" \
        -d "{
            \"command\": \"$command\",
            \"async\": $async
        }"
}

# 函数：获取执行结果
get_result() {
    local execution_id="$1"
    curl -s "$SERVER/api/public/executions/$execution_id"
}

# 函数：流式获取日志
stream_logs() {
    local execution_id="$1"
    curl -N "$SERVER/api/public/executions/$execution_id/stream"
}

# 示例1：同步执行
echo "=== 同步执行 ==="
RESULT=$(execute_command "whoami && date")
echo "$RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); print('输出:', data['output'])"

# 示例2：异步执行
echo -e "\\n=== 异步执行 ==="
ASYNC_RESULT=$(execute_command "sleep 3 && echo 'Async done!'" true)
EXECUTION_ID=$(echo "$ASYNC_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['executionId'])")

echo "执行ID: $EXECUTION_ID"
echo "获取实时日志..."
stream_logs "$EXECUTION_ID"
```

## 支持的命令类型

1. **系统命令**: `whoami`, `hostname`, `date`, `uname`
2. **文件操作**: `ls`, `cat`, `echo`, `touch`, `mkdir`
3. **网络工具**: `curl`, `wget`, `ping`
4. **编程语言**: `python3`, `node`, `php`
5. **进程管理**: `ps`, `top`, `kill`
6. **文本处理**: `grep`, `sed`, `awk`, `sort`
7. **压缩解压**: `tar`, `zip`, `unzip`
8. **任何Linux命令**

## 安全限制

- 命令在服务器的隔离环境中执行
- 默认超时时间为30秒，可自定义
- 异步命令会被记录到数据库
- 支持取消正在运行的命令

## 错误处理

命令执行失败时，返回格式：
```json
{
    "executionId": "uuid",
    "status": "failed",
    "output": "",
    "error": "错误信息",
    "executionTime": 1234
}
```

## 性能建议

1. 长时间运行的命令使用异步模式
2. 使用流式日志获取实时反馈
3. 设置合理的超时时间
4. 及时取消不需要的命令

## 实际应用场景

1. **CI/CD脚本执行**
2. **系统监控和检查**
3. **文件处理和数据处理**
4. **自动化运维任务**
5. **API集成测试**
6. **日志分析和处理**