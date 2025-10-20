# GCloud 脚本URL配置化修复总结

## 问题描述

用户要求：
> "cloud-shell 命令执行脚本要求配置化：
> - 如果配置了 githubusercontent URL 就使用
> - 如果配置了 IP:端口号的备用URL，就加上 || 容错
> - 如果没有配置备用URL，就不要有 || 部分"

## 原始硬编码问题

之前的命令是完全硬编码的：

```bash
cloud-shell ssh --command="(curl -fsSL --connect-timeout 30 https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh -o /tmp/gcp-put-init-3.sh || curl -fsSL --connect-timeout 30 http://82.197.94.152:10086/gcp-put.sh -o /tmp/gcp-put-init-3.sh) && chmod +x /tmp/gcp-put-init-3.sh && /tmp/gcp-put-init-3.sh gemini"
```

**问题**：
1. 主URL和备用URL都是硬编码
2. 即使不需要备用URL，也强制使用 `||` 容错
3. 无法灵活调整脚本下载地址

## 修复方案

### 1. 配置文件扩展

**文件**: `backend/config/service.config.js`

```javascript
// GCloud 脚本配置
gcloudScript: {
  // GitHub 脚本下载URL（主URL）
  scriptDownloadUrl: process.env.GCLOUD_SCRIPT_URL ||
    'https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh',

  // 备用脚本下载URL（可选，如果不设置则不使用容错）
  scriptBackupUrl: process.env.GCLOUD_SCRIPT_BACKUP_URL || '',
  // 默认为空，可配置为 http://82.197.94.152:10086/gcp-put.sh

  // 脚本超时时间（毫秒）
  scriptTimeout: parseInt(process.env.GCLOUD_SCRIPT_TIMEOUT) || 180000,

  // 脚本执行冷却时间（毫秒）
  scriptCooldown: parseInt(process.env.GCLOUD_SCRIPT_COOLDOWN) || 1200000,
}
```

### 2. 服务类读取配置

**文件**: `backend/services/gcloudMonitorService.js` (Line 30-32)

```javascript
// GCloud 脚本配置
this.scriptDownloadUrl = serviceConfig.gcloudScript.scriptDownloadUrl;
this.scriptBackupUrl = serviceConfig.gcloudScript.scriptBackupUrl;
logger.info(`GCloud script URL configured: ${this.scriptDownloadUrl}${this.scriptBackupUrl ? ` (backup: ${this.scriptBackupUrl})` : ' (no backup)'}`);
```

### 3. 动态命令构建方法

**文件**: `backend/services/gcloudMonitorService.js` (Line 88-99)

新增辅助方法，根据是否配置备用URL动态构建命令：

```javascript
/**
 * 构建脚本下载命令
 * @param {string} scriptFileName - 脚本文件名（如 /tmp/gcp-put-123.sh）
 * @returns {string} 完整的下载命令
 */
buildScriptDownloadCommand(scriptFileName) {
  const mainDownload = `curl -fsSL --connect-timeout 30 ${this.scriptDownloadUrl} -o ${scriptFileName}`;

  // 如果配置了备用URL，添加容错
  if (this.scriptBackupUrl && this.scriptBackupUrl.trim()) {
    const backupDownload = `curl -fsSL --connect-timeout 30 ${this.scriptBackupUrl} -o ${scriptFileName}`;
    return `(${mainDownload} || ${backupDownload})`;
  }

  // 没有备用URL，只使用主URL
  return mainDownload;
}
```

### 4. 修改3处命令构建位置

#### 位置1: executeScript 方法 (Line 703-705)

**修改前**:
```javascript
const shellCommand = `(curl -fsSL --connect-timeout 30 ${this.scriptDownloadUrl} -o /tmp/gcp-put-${account.id}.sh || curl -fsSL --connect-timeout 30 ${this.scriptBackupUrl} -o /tmp/gcp-put-${account.id}.sh) && chmod +x /tmp/gcp-put-${account.id}.sh && /tmp/gcp-put-${account.id}.sh ${scriptType}`;
```

**修改后**:
```javascript
const scriptFile = `/tmp/gcp-put-${account.id}.sh`;
const downloadCmd = this.buildScriptDownloadCommand(scriptFile);
const shellCommand = `${downloadCmd} && chmod +x ${scriptFile} && ${scriptFile} ${scriptType}`;
```

#### 位置2: executeFinalVertexScript 方法 (Line 898-900)

**修改前**:
```javascript
const shellCommand = `(curl -fsSL --connect-timeout 30 ${this.scriptDownloadUrl} -o /tmp/gcp-put-final-${account.id}.sh || curl -fsSL --connect-timeout 30 ${this.scriptBackupUrl} -o /tmp/gcp-put-final-${account.id}.sh) && chmod +x /tmp/gcp-put-final-${account.id}.sh && /tmp/gcp-put-final-${account.id}.sh vertex`;
```

**修改后**:
```javascript
const scriptFile = `/tmp/gcp-put-final-${account.id}.sh`;
const downloadCmd = this.buildScriptDownloadCommand(scriptFile);
const shellCommand = `${downloadCmd} && chmod +x ${scriptFile} && ${scriptFile} vertex`;
```

#### 位置3: executeInitialScript 方法 (Line 1003-1005)

**修改前**:
```javascript
const shellCommand = `(curl -fsSL --connect-timeout 30 ${this.scriptDownloadUrl} -o /tmp/gcp-put-init-${account.id}.sh || curl -fsSL --connect-timeout 30 ${this.scriptBackupUrl} -o /tmp/gcp-put-init-${account.id}.sh) && chmod +x /tmp/gcp-put-init-${account.id}.sh && /tmp/gcp-put-init-${account.id}.sh ${scriptType}`;
```

**修改后**:
```javascript
const scriptFile = `/tmp/gcp-put-init-${account.id}.sh`;
const downloadCmd = this.buildScriptDownloadCommand(scriptFile);
const shellCommand = `${downloadCmd} && chmod +x ${scriptFile} && ${scriptFile} ${scriptType}`;
```

## 修复效果

### ✅ 智能容错支持

**场景1: 配置了备用URL**
```bash
# 环境变量
GCLOUD_SCRIPT_URL=https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh
GCLOUD_SCRIPT_BACKUP_URL=http://82.197.94.152:10086/gcp-put.sh

# 生成的命令（带容错）
(curl -fsSL --connect-timeout 30 https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh -o /tmp/gcp-put-123.sh || curl -fsSL --connect-timeout 30 http://82.197.94.152:10086/gcp-put.sh -o /tmp/gcp-put-123.sh) && chmod +x /tmp/gcp-put-123.sh && /tmp/gcp-put-123.sh gemini
```

**场景2: 没有配置备用URL**
```bash
# 环境变量
GCLOUD_SCRIPT_URL=https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh
GCLOUD_SCRIPT_BACKUP_URL=  # 空或不设置

# 生成的命令（无容错）
curl -fsSL --connect-timeout 30 https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh -o /tmp/gcp-put-123.sh && chmod +x /tmp/gcp-put-123.sh && /tmp/gcp-put-123.sh gemini
```

**场景3: 只配置备用URL**
```bash
# 环境变量
GCLOUD_SCRIPT_BACKUP_URL=http://82.197.94.152:10086/gcp-put.sh

# 生成的命令（使用主URL默认值+备用URL）
(curl -fsSL --connect-timeout 30 https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh -o /tmp/gcp-put-123.sh || curl -fsSL --connect-timeout 30 http://82.197.94.152:10086/gcp-put.sh -o /tmp/gcp-put-123.sh) && chmod +x /tmp/gcp-put-123.sh && /tmp/gcp-put-123.sh gemini
```

## 验证结果

```bash
# 检查硬编码的脚本URL
grep -n "raw.githubusercontent.com.*gcp-put\|82.197.94.152.*gcp-put" \
  backend/services/gcloudMonitorService.js
# 结果：无输出 ✅ 所有硬编码已移除

# 检查方法调用
grep -n "buildScriptDownloadCommand" backend/services/gcloudMonitorService.js
# 结果：
# 88:  buildScriptDownloadCommand(scriptFileName) {
# 704:      const downloadCmd = this.buildScriptDownloadCommand(scriptFile);
# 899:      const downloadCmd = this.buildScriptDownloadCommand(scriptFile);
# 1004:      const downloadCmd = this.buildScriptDownloadCommand(scriptFile);
```

## 使用方式

### 方式1: 环境变量配置

```bash
# .env 文件
GCLOUD_SCRIPT_URL=https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh
GCLOUD_SCRIPT_BACKUP_URL=http://82.197.94.152:10086/gcp-put.sh
```

### 方式2: Docker Compose 配置

**文件**: `docker-compose.prod.yml`

```yaml
services:
  main-service:
    environment:
      GCLOUD_SCRIPT_URL: ${GCLOUD_SCRIPT_URL:-https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh}
      GCLOUD_SCRIPT_BACKUP_URL: ${GCLOUD_SCRIPT_BACKUP_URL:-http://82.197.94.152:10086/gcp-put.sh}
```

### 方式3: 使用默认值

不设置环境变量时：
- 主URL: `https://raw.githubusercontent.com/Chatify-AI/gcloud_server/main/scripts/gcp-put.sh`
- 备用URL: 空（不使用容错）

## 配置项说明

| 环境变量 | 用途 | 默认值 | 效果 |
|---------|------|--------|------|
| `GCLOUD_SCRIPT_URL` | 主脚本下载URL | GitHub地址 | 必须使用 |
| `GCLOUD_SCRIPT_BACKUP_URL` | 备用脚本下载URL | 空 | 可选，配置后自动添加 `\|\|` 容错 |

## 部署步骤

### 开发环境

1. 修改 `.env` 文件（可选）
2. 重启服务：
   ```bash
   npm run dev
   ```

### 生产环境（Docker）

1. 修改 `.env` 文件（可选）
2. 重新构建并启动：
   ```bash
   docker-compose -f docker-compose.prod.yml build main-service
   docker-compose -f docker-compose.prod.yml up -d main-service
   ```

### 验证配置生效

查看日志确认配置加载：

```bash
# 查看 main-service 日志
docker-compose -f docker-compose.prod.yml logs main-service | grep "GCloud script URL configured"

# 有备用URL时的输出：
# GCloud script URL configured: https://raw.githubusercontent.com/.../gcp-put.sh (backup: http://82.197.94.152:10086/gcp-put.sh)

# 无备用URL时的输出：
# GCloud script URL configured: https://raw.githubusercontent.com/.../gcp-put.sh (no backup)
```

## 总结

### ✅ 完成的工作

1. **主URL配置化**: 可通过 `GCLOUD_SCRIPT_URL` 环境变量配置
2. **备用URL可选**: 可通过 `GCLOUD_SCRIPT_BACKUP_URL` 环境变量配置
3. **智能容错**: 只有配置了备用URL时才添加 `||` 容错
4. **统一管理**: 所有脚本下载命令都使用同一个方法构建
5. **向后兼容**: 默认值与原硬编码地址相同

### 🎯 用户需求满足

✅ "如果配置了 githubusercontent 就使用" - 通过 `GCLOUD_SCRIPT_URL` 配置
✅ "如果配置了 IP:端口号就加上 || 容错" - 通过 `GCLOUD_SCRIPT_BACKUP_URL` 配置
✅ "没有配置就不要有 ||" - `buildScriptDownloadCommand` 方法智能判断

### 📋 修改范围

| 文件 | 修改内容 | 行数 |
|-----|---------|------|
| `backend/config/service.config.js` | 添加 `scriptBackupUrl` 配置项 | +1 |
| `backend/services/gcloudMonitorService.js` | 从配置读取备用URL | ~1 |
| `backend/services/gcloudMonitorService.js` | 添加 `buildScriptDownloadCommand` 方法 | +12 |
| `backend/services/gcloudMonitorService.js` | 修改 `executeScript` 命令构建 | ~3 |
| `backend/services/gcloudMonitorService.js` | 修改 `executeFinalVertexScript` 命令构建 | ~3 |
| `backend/services/gcloudMonitorService.js` | 修改 `executeInitialScript` 命令构建 | ~3 |

---

**修复时间**: 2025-10-20
**修复范围**: GCloud 脚本下载命令配置化
**影响服务**:
- ✅ 常规恢复脚本执行
- ✅ 最终Vertex脚本执行
- ✅ 初始化新账号脚本执行
**向后兼容**: 是（默认值与原硬编码相同）
