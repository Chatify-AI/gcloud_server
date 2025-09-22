#!/bin/bash

echo "==================================="
echo "GCloud Manager Setup Script"
echo "==================================="

# Create necessary directories
echo "Creating directories..."
mkdir -p database logs

# Install dependencies
echo "Installing backend dependencies..."
npm install

echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env file and add your Google OAuth credentials"
else
    echo ".env file already exists"
fi

# Check if gcloud is installed
if command -v gcloud &> /dev/null; then
    echo "✓ gcloud CLI is installed"
    gcloud version
else
    echo "✗ gcloud CLI is not installed"
    echo "Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
fi

echo ""
echo "==================================="
echo "Setup complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your Google OAuth credentials"
echo "2. Run 'npm run dev' to start the backend server"
echo "3. Run 'npm run dev:frontend' to start the frontend"
echo ""
echo "For more information, see README.md"