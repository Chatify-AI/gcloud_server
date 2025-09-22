#!/bin/bash

# Test script for API Key functionality
echo "Testing API Key functionality..."

# Get admin JWT token first
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme123"}')

JWT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$JWT_TOKEN" ]; then
  echo "❌ Failed to login as admin"
  exit 1
fi

echo "✅ Successfully logged in"

# Create a new API key
echo -e "\n2. Creating a new API key..."
API_KEY_RESPONSE=$(curl -s -X POST http://localhost:3001/api/apikeys/generate \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test API Key",
    "description": "API Key for testing",
    "permissions": ["execute:commands", "read:data"],
    "rateLimit": 100
  }')

API_KEY=$(echo $API_KEY_RESPONSE | grep -o '"plainKey":"[^"]*' | grep -o '[^"]*$')

if [ -z "$API_KEY" ]; then
  echo "❌ Failed to create API key"
  echo "Response: $API_KEY_RESPONSE"
  exit 1
fi

echo "✅ API Key created successfully: $API_KEY"

# List all API keys
echo -e "\n3. Listing all API keys..."
LIST_RESPONSE=$(curl -s -X GET http://localhost:3001/api/apikeys \
  -H "Authorization: Bearer $JWT_TOKEN")

echo "API Keys list response:"
echo $LIST_RESPONSE | python3 -m json.tool 2>/dev/null || echo $LIST_RESPONSE

# Test API key authentication with the commands endpoint
echo -e "\n4. Testing API key authentication..."

# First, we need to get an account ID
ACCOUNTS_RESPONSE=$(curl -s -X GET http://localhost:3001/api/gcloud-accounts \
  -H "X-API-Key: $API_KEY")

ACCOUNT_ID=$(echo $ACCOUNTS_RESPONSE | grep -o '"id":[0-9]*' | head -n 1 | grep -o '[0-9]*')

if [ -z "$ACCOUNT_ID" ]; then
  echo "⚠️  No GCloud accounts found, creating test execution without account"

  # Test execution history endpoint with API key
  echo -e "\n5. Testing execution history endpoint with API key..."
  HISTORY_RESPONSE=$(curl -s -X GET http://localhost:3001/api/commands/executions \
    -H "X-API-Key: $API_KEY")

  echo "Execution history response:"
  echo $HISTORY_RESPONSE | python3 -m json.tool 2>/dev/null || echo $HISTORY_RESPONSE
else
  echo "✅ Found account ID: $ACCOUNT_ID"

  # Test command execution with API key
  echo -e "\n5. Testing command execution with API key..."
  EXEC_RESPONSE=$(curl -s -X POST http://localhost:3001/api/commands/execute \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"accountId\": $ACCOUNT_ID,
      \"command\": \"gcloud version\",
      \"async\": false
    }")

  echo "Command execution response:"
  echo $EXEC_RESPONSE | python3 -m json.tool 2>/dev/null || echo $EXEC_RESPONSE
fi

# Test with invalid API key
echo -e "\n6. Testing with invalid API key (should fail)..."
INVALID_RESPONSE=$(curl -s -X GET http://localhost:3001/api/commands/executions \
  -H "X-API-Key: gck_invalid_key_12345")

echo "Invalid API key response:"
echo $INVALID_RESPONSE | python3 -m json.tool 2>/dev/null || echo $INVALID_RESPONSE

echo -e "\n✅ API Key testing completed successfully!"
echo "You can now use the API key in your requests:"
echo "  Header: X-API-Key: $API_KEY"
echo "  Or: Authorization: Bearer $API_KEY"