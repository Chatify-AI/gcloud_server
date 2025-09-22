# GCloud Manager

A complete Node.js application for managing multiple Google Cloud accounts with OAuth authentication, command execution, and a modern web interface.

## Features

- **Google OAuth Authentication**: Secure login using Google accounts
- **Multi-Account Management**: Manage multiple Google Cloud accounts
- **Command Execution**: Execute gcloud commands and Cloud Shell commands
- **Real-time Terminal**: WebSocket-based real-time command output streaming
- **Command History**: Track and review all executed commands
- **Modern UI**: React-based interface with Material-UI components

## Prerequisites

- Node.js 16+ and npm
- Google Cloud SDK installed (`gcloud` CLI)
- Google Cloud Project with OAuth 2.0 credentials

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install backend and frontend dependencies
npm run install:all
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google OAuth2 API
   - Cloud Resource Manager API
   - Cloud Shell API
4. Go to "APIs & Services" > "Credentials"
5. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
6. Copy the Client ID and Client Secret

### 3. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Google OAuth credentials
```

Update the following in `.env`:
- `GOOGLE_CLIENT_ID`: Your OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Your OAuth Client Secret
- `JWT_SECRET`: A secure random string
- `GOOGLE_CLOUD_PROJECT`: Your default GCP project ID

### 4. Initialize Database

```bash
# Create database directory
mkdir -p database logs

# The SQLite database will be created automatically on first run
```

### 5. Start the Application

```bash
# Development mode (with hot reload)
npm run dev

# In another terminal, start the frontend
npm run dev:frontend

# Or production mode
npm start
```

The application will be available at:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Project Structure

```
gcloud_server/
├── backend/
│   ├── src/
│   │   ├── server.js          # Main server file
│   │   └── utils/             # Utility functions
│   ├── config/
│   │   └── database.js        # Database configuration
│   ├── models/                # Sequelize models
│   │   ├── User.js
│   │   ├── GCloudAccount.js
│   │   └── CommandExecution.js
│   ├── routes/                # API routes
│   │   ├── auth.js
│   │   ├── accounts.js
│   │   └── commands.js
│   ├── services/              # Business logic
│   │   ├── googleAuth.js
│   │   └── gcloudExecutor.js
│   └── middleware/            # Express middleware
│       └── auth.js
├── frontend/
│   └── src/
│       ├── components/        # React components
│       ├── pages/            # Page components
│       ├── contexts/         # React contexts
│       └── App.jsx           # Main app component
├── database/                 # SQLite database files
├── logs/                     # Application logs
└── package.json

```

## API Endpoints

### Authentication
- `GET /api/auth/google/url` - Generate OAuth authorization URL
- `POST /api/auth/google/callback` - Exchange authorization code for tokens
- `POST /api/auth/login` - Quick login for existing users

### Accounts Management
- `GET /api/accounts` - List all accounts
- `POST /api/accounts/add` - Add new account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account
- `POST /api/accounts/:id/refresh` - Refresh OAuth token

### Command Execution
- `POST /api/commands/execute` - Execute gcloud command
- `POST /api/commands/cloud-shell` - Execute Cloud Shell command
- `GET /api/commands/executions` - Get execution history
- `GET /api/commands/executions/:id` - Get execution details
- `POST /api/commands/executions/:id/cancel` - Cancel running execution

## WebSocket Events

The application uses Socket.IO for real-time communication:

- `execute-command` - Execute a command
- `cloud-shell-command` - Execute Cloud Shell command
- `cancel-command` - Cancel running command
- `command-started` - Command execution started
- `command-output` - Streaming command output
- `command-error` - Command error occurred
- `command-complete` - Command execution completed

## Security Notes

1. **OAuth Tokens**: Stored securely in SQLite database
2. **JWT Authentication**: All API endpoints require authentication
3. **Rate Limiting**: Configured to prevent abuse
4. **CORS**: Configured for frontend origin only
5. **Helmet**: Security headers enabled

## Troubleshooting

### gcloud command not found
Make sure Google Cloud SDK is installed and `gcloud` is in your PATH:
```bash
gcloud version
```

### OAuth Error
1. Verify redirect URI matches exactly in Google Console
2. Check Client ID and Secret are correct
3. Ensure required APIs are enabled

### Database Issues
Delete the SQLite file and restart the server:
```bash
rm database/gcloud_manager.sqlite
npm start
```

## Development

```bash
# Run backend in development mode
npm run dev

# Run frontend in development mode
npm run dev:frontend

# Run both concurrently (requires concurrently package)
npm install -g concurrently
concurrently "npm run dev" "npm run dev:frontend"
```

## Production Deployment

1. Build frontend:
```bash
npm run build:frontend
```

2. Set environment to production:
```bash
NODE_ENV=production
```

3. Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start backend/src/server.js --name gcloud-manager
```

## License

MIT