#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get server IP
SERVER_IP=$(curl -s -4 ifconfig.me 2>/dev/null || curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${GREEN}→${NC} $1"
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null)
    if [ ! -z "$pid" ]; then
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Function to test endpoints
test_server() {
    echo ""
    echo "Testing server endpoints..."
    echo "======================================"

    # Test backend health
    print_info "Testing backend health endpoint..."
    if curl -s -f "http://localhost:3000/health" > /dev/null; then
        print_success "Backend is healthy"
    else
        print_error "Backend health check failed"
        return 1
    fi

    # Test frontend
    print_info "Testing frontend..."
    if curl -s -f "http://localhost:5173" > /dev/null; then
        print_success "Frontend is accessible"
    else
        print_error "Frontend not accessible"
        return 1
    fi

    # Test API endpoint
    print_info "Testing API endpoint..."
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/auth/google/url")
    if [ "$response" = "200" ]; then
        print_success "API endpoints working"
    else
        print_error "API test failed (HTTP $response)"
    fi

    echo ""
    print_success "All tests passed!"
    return 0
}

# Function to start servers
start_servers() {
    local mode=$1

    echo "======================================"
    echo "   GCloud Manager Startup Script"
    echo "======================================"
    echo ""
    print_info "Server IP: $SERVER_IP"
    echo ""

    # Check and create directories
    if [ ! -d "database" ]; then
        mkdir -p database logs
        print_success "Created required directories"
    fi

    # Check if .env exists
    if [ ! -f ".env" ]; then
        if [ -f ".env.remote" ]; then
            cp .env.remote .env
            sed -i "s/YOUR_SERVER_IP/$SERVER_IP/g" .env
            print_success "Created .env file with server IP: $SERVER_IP"
        else
            print_error "No .env file found. Please create one from .env.example"
            exit 1
        fi
    fi

    # Update frontend .env
    echo "VITE_API_URL=http://$SERVER_IP:3000" > frontend/.env
    print_success "Updated frontend configuration"

    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_warning "Installing backend dependencies..."
        npm install
    fi

    if [ ! -d "frontend/node_modules" ]; then
        print_warning "Installing frontend dependencies..."
        cd frontend && npm install && cd ..
    fi

    # Kill existing processes on ports
    print_info "Checking for existing processes..."
    if check_port 3000; then
        print_warning "Port 3000 is in use, stopping existing process..."
        kill_port 3000
    fi

    if check_port 5173; then
        print_warning "Port 5173 is in use, stopping existing process..."
        kill_port 5173
    fi

    echo ""
    echo "Starting servers in $mode mode..."
    echo "======================================"

    if [ "$mode" = "background" ] || [ "$mode" = "daemon" ]; then
        # Start in background mode
        print_info "Starting backend server (background)..."
        nohup npm run dev > logs/backend.log 2>&1 &
        BACKEND_PID=$!
        echo $BACKEND_PID > .backend.pid

        print_info "Starting frontend server (background)..."
        cd frontend
        nohup npm run dev > ../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > ../.frontend.pid
        cd ..

        # Wait for servers to start
        print_info "Waiting for servers to start..."
        sleep 5

        # Check if processes are still running
        if ps -p $BACKEND_PID > /dev/null; then
            print_success "Backend started (PID: $BACKEND_PID)"
        else
            print_error "Backend failed to start"
            tail -n 20 logs/backend.log
            exit 1
        fi

        if ps -p $FRONTEND_PID > /dev/null; then
            print_success "Frontend started (PID: $FRONTEND_PID)"
        else
            print_error "Frontend failed to start"
            tail -n 20 logs/frontend.log
            exit 1
        fi

        echo ""
        echo "======================================"
        print_success "Servers started successfully!"
        echo "======================================"
        echo ""
        echo "Access URLs:"
        echo "  Backend API: http://$SERVER_IP:3000"
        echo "  Frontend UI: http://$SERVER_IP:5173"
        echo "  Local Frontend: http://localhost:5173"
        echo ""
        echo "Process IDs saved to:"
        echo "  Backend: .backend.pid (PID: $BACKEND_PID)"
        echo "  Frontend: .frontend.pid (PID: $FRONTEND_PID)"
        echo ""
        echo "Logs:"
        echo "  Backend: tail -f logs/backend.log"
        echo "  Frontend: tail -f logs/frontend.log"
        echo ""
        echo "To stop: ./stop.sh"
        echo ""

        # Run tests if requested
        if [ "$2" = "--test" ]; then
            sleep 3
            test_server
        fi

    else
        # Start in foreground mode (default)
        print_info "Starting in foreground mode (Ctrl+C to stop)..."
        print_info "Use './start.sh background' for background mode"
        echo ""

        # Use concurrently if available, otherwise use basic approach
        if command -v concurrently &> /dev/null; then
            concurrently \
                --prefix "[{name}]" \
                --names "BACKEND,FRONTEND" \
                --prefix-colors "bgBlue.bold,bgMagenta.bold" \
                "npm run dev" \
                "cd frontend && npm run dev"
        else
            # Start backend in background
            npm run dev &
            BACKEND_PID=$!

            # Start frontend in foreground
            cd frontend && npm run dev &
            FRONTEND_PID=$!
            cd ..

            # Wait for both processes
            wait $BACKEND_PID $FRONTEND_PID
        fi
    fi
}

# Function to show status
show_status() {
    echo "======================================"
    echo "   GCloud Manager Status"
    echo "======================================"
    echo ""

    # Check backend
    if [ -f .backend.pid ]; then
        BACKEND_PID=$(cat .backend.pid)
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            print_success "Backend is running (PID: $BACKEND_PID)"
            print_info "  Port 3000: $(check_port 3000 && echo 'Active' || echo 'Not listening')"
        else
            print_error "Backend is not running (stale PID: $BACKEND_PID)"
        fi
    else
        if check_port 3000; then
            print_warning "Backend is running on port 3000 (PID unknown)"
        else
            print_error "Backend is not running"
        fi
    fi

    # Check frontend
    if [ -f .frontend.pid ]; then
        FRONTEND_PID=$(cat .frontend.pid)
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            print_success "Frontend is running (PID: $FRONTEND_PID)"
            print_info "  Port 5173: $(check_port 5173 && echo 'Active' || echo 'Not listening')"
        else
            print_error "Frontend is not running (stale PID: $FRONTEND_PID)"
        fi
    else
        if check_port 5173; then
            print_warning "Frontend is running on port 5173 (PID unknown)"
        else
            print_error "Frontend is not running"
        fi
    fi

    echo ""
    echo "Access URLs:"
    echo "  Backend: http://$SERVER_IP:3000"
    echo "  Frontend: http://$SERVER_IP:5173"
    echo ""
}

# Main script logic
case "$1" in
    "background" | "bg" | "daemon" | "-d")
        start_servers "background" "$2"
        ;;
    "test")
        test_server
        ;;
    "status")
        show_status
        ;;
    "stop")
        ./stop.sh
        ;;
    "restart")
        ./stop.sh
        sleep 2
        start_servers "background"
        ;;
    "logs")
        if [ "$2" = "backend" ]; then
            tail -f logs/backend.log
        elif [ "$2" = "frontend" ]; then
            tail -f logs/frontend.log
        else
            tail -f logs/backend.log logs/frontend.log
        fi
        ;;
    "help" | "--help" | "-h")
        echo "Usage: ./start.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  (no args)     Start servers in foreground mode"
        echo "  background    Start servers in background/daemon mode"
        echo "  status        Show server status"
        echo "  test          Test server endpoints"
        echo "  stop          Stop all servers"
        echo "  restart       Restart servers in background"
        echo "  logs [type]   Show logs (backend/frontend/all)"
        echo "  help          Show this help message"
        echo ""
        echo "Options:"
        echo "  --test        Run tests after starting (with background)"
        echo ""
        echo "Examples:"
        echo "  ./start.sh                    # Start in foreground"
        echo "  ./start.sh background         # Start in background"
        echo "  ./start.sh background --test  # Start and test"
        echo "  ./start.sh status            # Check status"
        echo "  ./start.sh logs backend      # View backend logs"
        ;;
    *)
        start_servers "foreground"
        ;;
esac