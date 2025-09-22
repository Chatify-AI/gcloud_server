# GCloud 账号监控完整流程图

```mermaid
graph TB
    Start([开始]) --> AddAccount[添加 GCloud 账号<br/>needMonitor = true<br/>scriptExecutionCount = 0]

    AddAccount --> ExecuteInit[执行初始化脚本<br/>type: gemini]
    ExecuteInit --> UpdateCount1[scriptExecutionCount = 1]
    UpdateCount1 --> MonitorLoop[进入监控循环<br/>每60秒检查一次]

    MonitorLoop --> CheckNeedMonitor{needMonitor = true?}
    CheckNeedMonitor -->|否| Stop([停止监控])
    CheckNeedMonitor -->|是| GetChannels[获取账号渠道<br/>按ID倒序排序]

    GetChannels --> HasChannels{有渠道?}

    HasChannels -->|无渠道| NoChannelCount[无渠道计数+1]
    NoChannelCount --> Check30Times{连续30次<br/>且count < 4?}
    Check30Times -->|否| MonitorLoop
    Check30Times -->|是| ExecuteScript

    HasChannels -->|有渠道| TestAll[测试所有渠道<br/>失败的立即禁用]
    TestAll --> AllFailed{全部失败?}

    AllFailed -->|否| RecordLog[记录日志<br/>X成功 Y失败]
    RecordLog --> MonitorLoop

    AllFailed -->|是| ExecuteScript{执行脚本}

    ExecuteScript --> CheckScriptCount{scriptExecutionCount?}
    CheckScriptCount -->|< 3| RunGemini[执行 gemini 脚本]
    CheckScriptCount -->|>= 3| RunVertex[执行 vertex 脚本]

    RunGemini --> UpdateCount2[scriptExecutionCount + 1]
    UpdateCount2 --> MonitorLoop

    RunVertex --> UpdateCount3[scriptExecutionCount + 1<br/>needMonitor = false]
    UpdateCount3 --> Stop
```

## 核心规则

1. **新账号**: scriptExecutionCount = 0，立即执行初始化脚本（gemini）
2. **监控周期**: 每60秒检查一次，needMonitor = true 才监控
3. **渠道测试**: 测试所有渠道，失败3次立即禁用
4. **脚本执行条件**:
   - 所有渠道测试失败
   - 连续30次无渠道且 scriptExecutionCount < 4
5. **脚本选择**:
   - scriptExecutionCount < 3: 执行 gemini
   - scriptExecutionCount >= 3: 执行 vertex（执行后禁用监控）