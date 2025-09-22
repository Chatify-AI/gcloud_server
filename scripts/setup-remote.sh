#!/bin/bash

echo "==================================="
echo "GCloud Manager Remote Setup"
echo "==================================="

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo "Server IP: $SERVER_IP"
echo ""

# Function to update configuration files
update_configs() {
    echo "Updating configuration files with server IP..."

    # Create .env from template
    if [ -f .env.remote ]; then
        cp .env.remote .env
        sed -i "s/YOUR_SERVER_IP/$SERVER_IP/g" .env
        echo "✓ Created .env with server IP: $SERVER_IP"
    fi

    # Create frontend .env
    echo "VITE_API_URL=http://$SERVER_IP:3000" > frontend/.env
    echo "✓ Created frontend/.env"

    echo ""
    echo "IMPORTANT: Update these settings in Google Cloud Console:"
    echo "==================================="
    echo "OAuth 2.0 Redirect URI:"
    echo "  http://$SERVER_IP:3000/api/auth/google/callback"
    echo ""
    echo "Authorized JavaScript origins:"
    echo "  http://$SERVER_IP:3000"
    echo "  http://$SERVER_IP:5173"
    echo "==================================="
}

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
   echo "Warning: Running as root is not recommended for security reasons"
   echo ""
fi

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✓ Node.js installed: $NODE_VERSION"
else
    echo "✗ Node.js not found. Please install Node.js 16+"
    exit 1
fi

# Check if gcloud is installed
if command -v gcloud &> /dev/null; then
    echo "✓ gcloud CLI installed"
else
    echo "✗ gcloud CLI not installed"
    echo "Installing gcloud CLI is recommended for full functionality"
    echo "Visit: https://cloud.google.com/sdk/docs/install"
    echo ""
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p database logs
echo "✓ Directories created"

# Update configurations
update_configs

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
cd frontend && npm install && cd ..
echo "✓ Dependencies installed"

# Check firewall settings
echo ""
echo "==================================="
echo "Firewall Configuration"
echo "==================================="
echo "Make sure these ports are open in your firewall:"
echo "  - Port 3000 (Backend API)"
echo "  - Port 5173 (Frontend Dev Server)"
echo ""
echo "For Google Cloud Platform:"
echo "  gcloud compute firewall-rules create gcloud-manager --allow tcp:3000,tcp:5173"
echo ""
echo "For AWS EC2:"
echo "  Add inbound rules for ports 3000 and 5173 in Security Group"
echo ""
echo "For Ubuntu/Debian with ufw:"
echo "  sudo ufw allow 3000"
echo "  sudo ufw allow 5173"
echo "==================================="

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your Google OAuth credentials"
echo "2. Update OAuth redirect URI in Google Cloud Console to:"
echo "   http://$SERVER_IP:3000/api/auth/google/callback"
echo "3. Run './scripts/remote-start.sh' to start the servers"
echo "4. Access the application at http://$SERVER_IP:5173"