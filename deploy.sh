#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVER_IP=$(curl -s -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "======================================"
echo "   GCloud Manager Deployment"
echo "======================================"
echo ""
echo "Server IP: $SERVER_IP"
echo ""

# Step 1: Initialize admin if needed
echo "Step 1: Checking admin account..."
if [ ! -f "database/gcloud_manager.sqlite" ]; then
    print_warning "No database found. Creating initial admin..."
    echo ""
    echo "Please set up an admin account:"
    node scripts/init-admin.js
    echo ""
fi

# Step 2: Build frontend for production
echo "Step 2: Building frontend..."
cd frontend
npm run build
cd ..
print_success "Frontend built successfully"

# Step 3: Stop existing services
echo ""
echo "Step 3: Stopping existing services..."
./stop.sh

# Step 4: Start production server
echo ""
echo "Step 4: Starting production server..."

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    print_success "Using PM2 for process management"

    # Delete existing PM2 process if exists
    pm2 delete gcloud-manager 2>/dev/null

    # Start with PM2
    NODE_ENV=production pm2 start backend/src/server.js \
        --name gcloud-manager \
        --log logs/pm2.log \
        --time \
        --merge-logs

    pm2 save

    print_success "Server started with PM2"
    echo ""
    echo "PM2 Commands:"
    echo "  pm2 status              - Check status"
    echo "  pm2 logs gcloud-manager - View logs"
    echo "  pm2 restart gcloud-manager - Restart"
    echo "  pm2 stop gcloud-manager - Stop"
else
    print_warning "PM2 not found, using nohup instead"
    print_warning "Install PM2 for better process management: npm install -g pm2"

    # Start with nohup
    NODE_ENV=production nohup node backend/src/server.js > logs/production.log 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > .server.pid

    print_success "Server started (PID: $SERVER_PID)"
    echo "Logs: tail -f logs/production.log"
fi

echo ""
echo "======================================"
echo "   Deployment Complete!"
echo "======================================"
echo ""
echo "Access the application at:"
echo "  http://$SERVER_IP:3000"
echo ""
echo "Default ports:"
echo "  Backend + Frontend: 3000 (production mode)"
echo ""
echo "Next steps:"
echo "1. Login to web interface"
echo "2. Add Google Cloud accounts"
echo "3. Start managing your GCloud resources"
echo ""

# Optional: Test the deployment
sleep 3
echo "Testing deployment..."
if curl -s -f "http://localhost:3000/health" > /dev/null; then
    print_success "Health check passed - Server is running!"
else
    print_error "Health check failed - Please check logs"
fi