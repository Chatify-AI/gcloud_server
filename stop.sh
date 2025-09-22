#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
echo "   Stopping GCloud Manager"
echo "======================================"
echo ""

# Function to kill process
kill_process() {
    local pid=$1
    local name=$2

    if ps -p $pid > /dev/null 2>&1; then
        kill $pid 2>/dev/null
        sleep 1

        # Force kill if still running
        if ps -p $pid > /dev/null 2>&1; then
            kill -9 $pid 2>/dev/null
            print_warning "$name stopped forcefully (PID: $pid)"
        else
            print_success "$name stopped gracefully (PID: $pid)"
        fi
    else
        print_warning "$name was not running (PID: $pid)"
    fi
}

# Stop backend
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    kill_process $BACKEND_PID "Backend"
    rm .backend.pid
else
    # Try to find and kill by port
    BACKEND_PID=$(lsof -ti:3000 2>/dev/null)
    if [ ! -z "$BACKEND_PID" ]; then
        kill_process $BACKEND_PID "Backend"
    else
        print_warning "Backend was not running"
    fi
fi

# Stop frontend
if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    kill_process $FRONTEND_PID "Frontend"
    rm .frontend.pid
else
    # Try to find and kill by port
    FRONTEND_PID=$(lsof -ti:5173 2>/dev/null)
    if [ ! -z "$FRONTEND_PID" ]; then
        kill_process $FRONTEND_PID "Frontend"
    else
        print_warning "Frontend was not running"
    fi
fi

# Kill any remaining node processes related to the project
pkill -f "node.*gcloud_server" 2>/dev/null

echo ""
print_success "All servers stopped"
echo ""