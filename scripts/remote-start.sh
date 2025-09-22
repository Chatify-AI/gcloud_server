#!/bin/bash

echo "==================================="
echo "GCloud Manager Remote Server Start"
echo "==================================="

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo "Detected Server IP: $SERVER_IP"
echo ""

# Check if .env exists, if not create from remote template
if [ ! -f .env ]; then
    if [ -f .env.remote ]; then
        echo "Creating .env from .env.remote template..."
        cp .env.remote .env
        # Replace YOUR_SERVER_IP with actual IP
        sed -i "s/YOUR_SERVER_IP/$SERVER_IP/g" .env
        echo "Updated .env with server IP: $SERVER_IP"
    else
        echo "Warning: No .env file found. Please create one from .env.example"
        exit 1
    fi
else
    echo "Using existing .env file"
fi

# Create frontend .env if needed
if [ ! -f frontend/.env ]; then
    echo "Creating frontend/.env..."
    echo "VITE_API_URL=http://$SERVER_IP:3000" > frontend/.env
    echo "Frontend configured to use API at: http://$SERVER_IP:3000"
fi

# Create necessary directories
mkdir -p database logs

# Clean old database if exists (optional)
if [ "$1" == "--clean" ]; then
    echo "Cleaning old database..."
    rm -f database/gcloud_manager.sqlite
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "==================================="
echo "Starting servers..."
echo "==================================="
echo ""

# Start backend and frontend in background
echo "Starting backend server..."
npm run dev &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 3

echo "Starting frontend server..."
cd frontend && npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "==================================="
echo "Servers started successfully!"
echo "==================================="
echo ""
echo "Access points:"
echo "  Backend API: http://$SERVER_IP:3000"
echo "  Frontend UI: http://$SERVER_IP:5173"
echo ""
echo "Google OAuth Redirect URI:"
echo "  http://$SERVER_IP:3000/api/auth/google/callback"
echo ""
echo "To stop servers, run: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Logs:"
echo "  Backend: logs/combined.log"
echo "  Errors: logs/error.log"
echo ""

# Keep script running
wait