#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get server IP
SERVER_IP=$(curl -s -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

# Function to check if port is in use
check_port() {
    local port=$1
    nc -z localhost $port 2>/dev/null
    return $?
}

# Function to get process info
get_process_info() {
    local pid=$1
    if ps -p $pid > /dev/null 2>&1; then
        ps -p $pid -o pid,vsz,rss,pcpu,pmem,etime,comm --no-headers
    else
        echo "Not running"
    fi
}

# Function to test endpoint
test_endpoint() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    echo $response
}

# Clear screen and show header
clear_screen() {
    clear
    echo -e "${CYAN}======================================"
    echo "   GCloud Manager Monitor"
    echo "======================================"
    echo -e "${NC}"
    echo -e "${GREEN}Server IP:${NC} $SERVER_IP"
    echo -e "${GREEN}Time:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# Main monitoring loop
monitor_loop() {
    while true; do
        clear_screen

        echo -e "${YELLOW}[Process Status]${NC}"
        echo "----------------------------------------"

        # Backend status
        if [ -f .backend.pid ]; then
            BACKEND_PID=$(cat .backend.pid)
            echo -e "${BLUE}Backend (PID: $BACKEND_PID):${NC}"
            PROC_INFO=$(get_process_info $BACKEND_PID)
            if [ "$PROC_INFO" != "Not running" ]; then
                echo -e "  ${GREEN}● Running${NC}"
                echo "  $PROC_INFO" | awk '{printf "  Memory: %.1fMB | CPU: %s%% | Uptime: %s\n", $3/1024, $4, $6}'
            else
                echo -e "  ${RED}● Stopped${NC}"
            fi
        else
            echo -e "${BLUE}Backend:${NC} ${RED}● Not started${NC}"
        fi

        # Frontend status
        if [ -f .frontend.pid ]; then
            FRONTEND_PID=$(cat .frontend.pid)
            echo -e "${BLUE}Frontend (PID: $FRONTEND_PID):${NC}"
            PROC_INFO=$(get_process_info $FRONTEND_PID)
            if [ "$PROC_INFO" != "Not running" ]; then
                echo -e "  ${GREEN}● Running${NC}"
                echo "  $PROC_INFO" | awk '{printf "  Memory: %.1fMB | CPU: %s%% | Uptime: %s\n", $3/1024, $4, $6}'
            else
                echo -e "  ${RED}● Stopped${NC}"
            fi
        else
            echo -e "${BLUE}Frontend:${NC} ${RED}● Not started${NC}"
        fi

        echo ""
        echo -e "${YELLOW}[Network Status]${NC}"
        echo "----------------------------------------"

        # Port status
        if check_port 3000; then
            echo -e "Port 3000 (Backend):  ${GREEN}● Open${NC}"
        else
            echo -e "Port 3000 (Backend):  ${RED}● Closed${NC}"
        fi

        if check_port 5173; then
            echo -e "Port 5173 (Frontend): ${GREEN}● Open${NC}"
        else
            echo -e "Port 5173 (Frontend): ${RED}● Closed${NC}"
        fi

        echo ""
        echo -e "${YELLOW}[Endpoint Health]${NC}"
        echo "----------------------------------------"

        # Test endpoints
        health_status=$(test_endpoint "http://localhost:3000/health")
        if [ "$health_status" = "200" ]; then
            echo -e "Backend Health:  ${GREEN}● OK (200)${NC}"
        else
            echo -e "Backend Health:  ${RED}● Failed ($health_status)${NC}"
        fi

        api_status=$(test_endpoint "http://localhost:3000/api/auth/google/url")
        if [ "$api_status" = "200" ]; then
            echo -e "API Endpoint:    ${GREEN}● OK (200)${NC}"
        else
            echo -e "API Endpoint:    ${RED}● Failed ($api_status)${NC}"
        fi

        frontend_status=$(test_endpoint "http://localhost:5173")
        if [ "$frontend_status" = "200" ]; then
            echo -e "Frontend:        ${GREEN}● OK (200)${NC}"
        else
            echo -e "Frontend:        ${RED}● Failed ($frontend_status)${NC}"
        fi

        echo ""
        echo -e "${YELLOW}[Access URLs]${NC}"
        echo "----------------------------------------"
        echo -e "${CYAN}Local:${NC}"
        echo "  Backend:  http://localhost:3000"
        echo "  Frontend: http://localhost:5173"
        echo -e "${CYAN}Remote:${NC}"
        echo "  Backend:  http://$SERVER_IP:3000"
        echo "  Frontend: http://$SERVER_IP:5173"

        echo ""
        echo -e "${YELLOW}[Recent Logs]${NC}"
        echo "----------------------------------------"

        if [ -f logs/backend.log ]; then
            echo -e "${BLUE}Backend (last 3 lines):${NC}"
            tail -n 3 logs/backend.log | sed 's/^/  /'
        fi

        if [ -f logs/frontend.log ]; then
            echo -e "${BLUE}Frontend (last 3 lines):${NC}"
            tail -n 3 logs/frontend.log | sed 's/^/  /'
        fi

        echo ""
        echo "----------------------------------------"
        echo -e "${MAGENTA}Press Ctrl+C to exit | Refreshing in 5s...${NC}"

        sleep 5
    done
}

# Handle Ctrl+C
trap 'echo -e "\n${GREEN}Monitor stopped${NC}"; exit 0' INT

# Check if servers are running
if [ ! -f .backend.pid ] && [ ! -f .frontend.pid ]; then
    echo -e "${YELLOW}Warning: No server PIDs found${NC}"
    echo "Start servers first with: ./start.sh background"
    echo ""
    read -p "Continue monitoring anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Start monitoring
monitor_loop