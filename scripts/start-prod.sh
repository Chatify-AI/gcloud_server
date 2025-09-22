#!/bin/bash

echo "==================================="
echo "Starting Production Servers"
echo "==================================="

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo "Server IP: $SERVER_IP"

# Build frontend
echo "Building frontend..."
cd frontend
npm run build
cd ..

# Use PM2 if available, otherwise use nohup
if command -v pm2 &> /dev/null; then
    echo "Starting with PM2..."
    pm2 stop gcloud-manager 2>/dev/null
    pm2 delete gcloud-manager 2>/dev/null

    NODE_ENV=production pm2 start backend/src/server.js --name gcloud-manager --log logs/pm2.log
    pm2 save

    echo "✓ Started with PM2"
    echo "Commands:"
    echo "  pm2 status        - Check status"
    echo "  pm2 logs          - View logs"
    echo "  pm2 restart gcloud-manager - Restart"
    echo "  pm2 stop gcloud-manager    - Stop"
else
    echo "Starting with nohup (install PM2 for better process management)..."

    # Kill existing process if any
    pkill -f "node backend/src/server.js" 2>/dev/null

    # Start in background
    NODE_ENV=production nohup node backend/src/server.js > logs/server.log 2>&1 &
    SERVER_PID=$!

    echo "✓ Server started with PID: $SERVER_PID"
    echo "Logs: tail -f logs/server.log"
fi

echo ""
echo "==================================="
echo "Production server running!"
echo "==================================="
echo "Access at: http://$SERVER_IP:3000"
echo ""