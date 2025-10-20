# OneAPI 配置化修复 - 仅11002端口

## 问题描述

用户要求：
> "13000这个就不用改了，这个就是，所有的11002的要改成配置项来源"

## 修复范围

### ✅ 需要配置化的部分（11002端口）

**11002端口**的OneAPI主服务相关配置已全部配置化：
- `ONEAPI_BASE_URL`: 主服务地址
- `ONEAPI_KEY`: 主服务API密钥

### ❌ 保持硬编码的部分（13000端口）

**13000端口**的Gemini渠道服务保持硬编码：
- URL: `http://104.194.9.201:13000`
- API密钥: `lvlgr4jIX9c+jhgJs6MHb0bg40pt0LwB`

## 修复内容

### 1. 配置文件（仅11002端口）

**文件**: `backend/config/service.config.js`

```javascript
oneApi: {
  // ✅ 11002端口 - 使用配置
  baseUrl: process.env.ONEAPI_BASE_URL || 'http://104.194.9.201:11002',
  apiKey: process.env.ONEAPI_KEY || 't0bAXxyETOitEfEWuU37sWSqwJrE',

  // ❌ 13000端口 - 不需要配置（保持硬编码）
},
```

### 2. 服务类构造函数

**文件**: `backend/services/oneApiService.js`

```javascript
constructor() {
  // 只读取11002端口的配置
  this.baseUrl = serviceConfig.oneApi.baseUrl;
  this.apiKey = serviceConfig.oneApi.apiKey;
  logger.info(`OneAPI service configured: ${this.baseUrl}`);
}
```

### 3. X-Forwarded-Host 头部配置化

**文件**: `backend/services/oneApiService.js` (Line 90)

**修改前**（硬编码）:
```javascript
'X-Forwarded-Host': '104.194.9.201:11002',
```

**修改后**（配置化）:
```javascript
'X-Forwarded-Host': this.baseUrl.replace(/^https?:\/\//, ''),
```

### 4. 13000端口保持硬编码

**文件**: `backend/services/oneApiService.js`

以下位置保持硬编码：

#### Line 694: base_url
```javascript
base_url: "http://104.194.9.201:13000",  // Gemini渠道固定地址
```

#### Line 711: 日志URL
```javascript
url: 'http://104.194.9.201:13000/api/channel/',
```

#### Line 721: 请求URL
```javascript
const response = await axios.post(
  'http://104.194.9.201:13000/api/channel/',
  payload,
```

#### Line 727: API密钥
```javascript
'Authorization': 'Bearer lvlgr4jIX9c+jhgJs6MHb0bg40pt0LwB',
```

### 5. Docker Compose 环境变量（仅11002端口）

**文件**: `docker-compose.prod.yml`

```yaml
environment:
  # ✅ 11002端口配置
  ONEAPI_BASE_URL: ${ONEAPI_BASE_URL:-http://104.194.9.201:11002}
  ONEAPI_KEY: ${ONEAPI_KEY:-t0bAXxyETOitEfEWuU37sWSqwJrE}

  # ❌ 13000端口不需要环境变量（已移除）
```

## 验证结果

### 11002端口无硬编码 ✅

```bash
grep -n "11002" backend/services/oneApiService.js
# 结果：无输出（全部使用配置）
```

### 13000端口保持硬编码 ✅

```bash
grep -n "13000\|lvlgr4jIX9c" backend/services/oneApiService.js
# 结果：找到多处硬编码（符合预期）
```

## 使用方式

### 调整11002端口配置

**方式1: 环境变量**
```bash
# .env 文件
ONEAPI_BASE_URL=http://your-custom-host:11002
ONEAPI_KEY=your-custom-api-key
```

**方式2: Docker Compose**
```yaml
services:
  main-service:
    environment:
      ONEAPI_BASE_URL: http://your-custom-host:11002
      ONEAPI_KEY: your-custom-api-key
```

**方式3: 使用默认值**
不设置环境变量时使用默认值 `http://104.194.9.201:11002`

### 13000端口不可调整

13000端口的Gemini渠道服务地址和API密钥**固定硬编码**，无法通过配置调整。

## 部署步骤

### 开发环境

1. 修改 `.env` 文件（如需自定义11002配置）
2. 重启服务：
   ```bash
   npm run dev
   ```

### 生产环境（Docker）

1. 修改 `.env` 文件（如需自定义11002配置）
2. 重新构建并启动：
   ```bash
   docker-compose -f docker-compose.prod.yml build main-service
   docker-compose -f docker-compose.prod.yml up -d main-service
   ```

## 配置项说明

| 环境变量 | 用途 | 默认值 | 是否可调整 |
|---------|------|--------|----------|
| `ONEAPI_BASE_URL` | OneAPI主服务地址（11002端口） | `http://104.194.9.201:11002` | ✅ 是 |
| `ONEAPI_KEY` | OneAPI主服务API密钥 | `t0bAXxyETOitEfEWuU37sWSqwJrE` | ✅ 是 |
| ~~`ONEAPI_GEMINI_BASE_URL`~~ | ~~Gemini渠道地址（13000端口）~~ | `http://104.194.9.201:13000` | ❌ 否（硬编码） |
| ~~`ONEAPI_GEMINI_KEY`~~ | ~~Gemini渠道API密钥~~ | `lvlgr4jIX9c+jhgJs6MHb0bg40pt0LwB` | ❌ 否（硬编码） |

## 总结

### ✅ 完成的工作

1. **11002端口配置化**: 所有与11002端口相关的URL和API密钥都从配置文件读取
2. **13000端口保持硬编码**: Gemini渠道服务地址和密钥固定不变
3. **环境变量支持**: 11002端口可以通过 `.env` 或 Docker 环境变量调整
4. **默认值保留**: 未配置时使用合理的默认值

### 📋 配置对比

| 端口 | 用途 | 配置方式 | 可调整性 |
|-----|------|---------|---------|
| 11002 | OneAPI主服务 | 环境变量配置 | ✅ 可调整 |
| 13000 | Gemini渠道服务 | 硬编码 | ❌ 固定不变 |

### 🎯 用户需求满足

✅ "13000这个就不用改了" - 保持硬编码
✅ "所有的11002的要改成配置项来源" - 已全部配置化

---

**修复时间**: 2025-10-20
**修复范围**: 仅11002端口OneAPI主服务
**13000端口**: 保持硬编码，不可配置
**向后兼容**: 是（默认值与原硬编码相同）
