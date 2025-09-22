# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GCloud Manager is a Node.js application for managing multiple Google Cloud accounts with real gcloud CLI authentication, command execution, and a modern React web interface. The system provides secure multi-account management, real-time command execution, and API key authentication for programmatic access.

## Core Architecture

### Authentication Flow
1. **Admin Authentication**: JWT-based authentication for web interface users
2. **API Key Authentication**: Token-based authentication for programmatic access with rate limiting
3. **GCloud Account Authentication**: Real `gcloud auth login` integration with isolated configurations per account

### Key Services
- **gcloudExecutor**: Executes gcloud commands with account isolation using `CLOUDSDK_CONFIG` environment variable
- **gcloudAuth**: Manages real gcloud CLI authentication flow, creates isolated config directories
- **apiKeyAuth Middleware**: Validates API keys, enforces rate limits, manages permissions
- **combinedAuth Middleware**: Supports both JWT and API key authentication

### Data Storage
- **MySQL Database**: Local MySQL database (host: localhost, database: gcloud, username: gcloud, password: gcloud123)
- **Session Store**: SQLite-based session storage for temporary auth data
- **Isolated GCloud Configs**: Each account has its own configuration directory at `~/.config/gcloud-manager/account-{timestamp}/`

## ⚠️ CRITICAL DATABASE RULES - NEVER FORGET ⚠️

### 数据库同步规则（防止数据丢失）
**永远不要使用 `{ force: true }` 进行数据库同步！这会删除所有数据！**

1. **正确的同步方式**：
   - 使用 `sequelize.sync({ alter: true })` - 只修改表结构，保留数据
   - 创建专门的迁移脚本（如 `migrate-add-monitor-fields.js`）
   - 使用 `queryInterface.addColumn()` 单独添加字段

2. **错误的同步方式（会导致数据丢失）**：
   - ❌ `sequelize.sync({ force: true })` - 删除并重建所有表
   - ❌ 直接修改模型后运行 sync-database.js（如果它使用 force: true）

3. **添加新字段的正确流程**：
   ```javascript
   // 创建迁移脚本，不要直接 sync
   const tableDesc = await queryInterface.describeTable('table_name');
   if (!tableDesc.new_column) {
     await queryInterface.addColumn('table_name', 'new_column', {
       type: DataTypes.STRING,
       defaultValue: 'default_value'
     });
   }
   ```

4. **数据库表名映射**（使用下划线格式）：
   - Model: `GCloudAccount` → Table: `g_cloud_accounts`
   - Model: `ChannelAutoLog` → Table: `channel_auto_logs`
   - Model: `GCloudMonitorLog` → Table: `gcloud_monitor_logs`

5. **字段名映射**（camelCase → snake_case）：
   - `needMonitor` → `need_monitor`
   - `scriptExecutionCount` → `script_execution_count`
   - `lastMonitorTime` → `last_monitor_time`

## Commands

### Development
```bash
# Install all dependencies (backend + frontend)
npm run install:all

# Run backend development server with hot reload
npm run dev

# Run frontend development server
npm run dev:frontend

# Run database migrations
npm run migrate
```

### Production
```bash
# Build frontend
npm run build:frontend

# Start production server
npm start
```

### Database Management
```bash
# Sync database schema
node backend/scripts/sync-database.js

# Database is located at: database/gcloud_manager.sqlite
```

## High-Level Architecture

### Request Flow
1. **API Request** → Express Router → Middleware (auth/rate limit) → Route Handler → Service Layer → Database/External API
2. **WebSocket Request** → Socket.IO → Authentication → Command Executor → Real-time streaming to client
3. **GCloud Command** → Account Selection → Config Isolation (`CLOUDSDK_CONFIG`) → Command Execution → Output Capture

### Account Isolation Strategy
Each GCloud account operates in complete isolation:
- Unique configuration directory per account
- No shared credentials or configurations
- Commands executed with `CLOUDSDK_CONFIG` environment variable pointing to account's config
- Supports simultaneous operations on different accounts

### API Key System
- Keys stored as hashed values in database
- Rate limiting per key (configurable, default 100 req/hour)
- Permission-based access control:
  - `execute:commands` - Execute gcloud/shell commands
  - `manage:accounts` - Manage GCloud accounts
  - `read:data` - Read-only access to data

### Public API Endpoints
The system provides unauthenticated public endpoints for shell command execution:
- `POST /api/public/shell` - Execute shell commands (sync/async)
- `GET /api/public/executions/{id}` - Get execution status
- `GET /api/public/executions/{id}/stream` - SSE stream for real-time output
- `POST /api/public/executions/{id}/cancel` - Cancel running execution

## Environment Configuration

Required environment variables in `.env`:
```bash
PORT=3000
HOST=0.0.0.0  # For external access
JWT_SECRET=<secure-random-string>
SESSION_SECRET=<secure-random-string>
GOOGLE_CLIENT_ID=<oauth-client-id>  # Not used with real gcloud auth
GOOGLE_CLIENT_SECRET=<oauth-secret>  # Not used with real gcloud auth
GOOGLE_CLOUD_PROJECT=<default-project>
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=*  # Be restrictive in production
```

## Database Configuration

**Database Type**: MySQL (not SQLite as file paths might suggest)
- Host: localhost
- Port: 3306
- Database: gcloud
- Username: gcloud
- Password: gcloud123

**Connection**: Uses Sequelize ORM with MySQL dialect
- Configuration file: `/root/gcloud_server/backend/config/database.js`

## Database Schema

Key models:
- **Admin**: System administrators (username, passwordHash, role)
- **GCloudAccount**: Google Cloud accounts (email, configDir, configName, projectId, needMonitor, scriptExecutionCount, lastMonitorTime)
- **ApiKey**: API keys (name, keyHash, permissions, rateLimit, expiresAt)
- **CommandExecution**: Command history (command, output, error, status, executedBy)
- **ExecutionHistory**: Generic execution history for public API
- **GCloudMonitorLog**: Monitoring logs for GCloud accounts (accountId, monitorStatus, availableChannels, testedChannels, scriptExecuted, etc.)
- **ChannelAutoLog**: Auto channel creation logs from file monitoring (fileName, channelName, channelType, status, attempts)

## WebSocket Events

Real-time command execution via Socket.IO:
- Client → Server: `execute-command`, `cloud-shell-command`, `cancel-command`
- Server → Client: `command-started`, `command-output`, `command-error`, `command-complete`

## Frontend Architecture

React-based SPA with Material-UI:
- **Router**: React Router v6 for navigation
- **State Management**: React Context API for auth state
- **Real-time**: Socket.IO client for WebSocket communication
- **Terminal**: xterm.js for terminal emulation
- **API Client**: Axios with interceptors for auth handling

## Security Considerations

1. **Authentication**: JWT tokens expire in 7 days, API keys can have custom expiration
2. **Rate Limiting**: Global rate limit + per-API-key limits
3. **Command Isolation**: Each GCloud account runs in isolated configuration
4. **Input Validation**: Command sanitization, parameter validation
5. **CORS**: Configurable origin restrictions
6. **Helmet**: Security headers enabled

## Common Development Tasks

### Adding a New API Endpoint
1. Create route in `backend/routes/`
2. Add authentication middleware (`authMiddleware` or `combinedAuthMiddleware`)
3. Implement business logic in `backend/services/`
4. Update frontend API client if needed

### Adding GCloud Account Support for New Commands
1. Update `gcloudExecutor.js` to handle new command types
2. Ensure proper `CLOUDSDK_CONFIG` environment variable usage
3. Add command validation/sanitization if needed

### Modifying Database Schema
1. Update model in `backend/models/`
2. Run `node backend/scripts/sync-database.js` to sync schema
3. Consider data migration if modifying existing fields