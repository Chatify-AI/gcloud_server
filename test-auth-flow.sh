#!/bin/bash

echo "=== Testing Complete GCloud Authentication Flow ==="
echo ""

# 1. Login as admin
echo "1. Logging in as admin..."
TOKEN=$(curl -s http://localhost:3000/api/admin/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to login"
  exit 1
fi

echo "✅ Login successful"
echo ""

# 2. Generate auth URL (this maintains the session)
echo "2. Generating gcloud auth URL (keeps session alive)..."
AUTH_RESPONSE=$(curl -s http://localhost:3000/api/gcloud-accounts/auth-url \
  -H "Authorization: Bearer $TOKEN")

AUTH_URL=$(echo "$AUTH_RESPONSE" | jq -r .authUrl)
AUTH_ID=$(echo "$AUTH_RESPONSE" | jq -r .authId)

if [ -z "$AUTH_URL" ] || [ "$AUTH_URL" = "null" ]; then
  echo "❌ Failed to generate auth URL"
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "✅ Auth URL generated successfully"
echo "Auth Session ID: $AUTH_ID"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 AUTHORIZATION URL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$AUTH_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 INSTRUCTIONS:"
echo "1. Copy the URL above"
echo "2. Open it in your browser"
echo "3. Login with your Google account"
echo "4. Authorize the permissions"
echo "5. Copy the verification code from the success page"
echo ""
echo -n "Please enter the verification code: "
read VERIFICATION_CODE

if [ -z "$VERIFICATION_CODE" ]; then
  echo "❌ No verification code provided"
  exit 1
fi

# 3. Complete authentication (uses existing session)
echo ""
echo "3. Completing authentication with existing session..."
ADD_RESPONSE=$(curl -s http://localhost:3000/api/gcloud-accounts/add \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$VERIFICATION_CODE\",\"authId\":\"$AUTH_ID\"}")

SUCCESS=$(echo "$ADD_RESPONSE" | jq -r .success)
MESSAGE=$(echo "$ADD_RESPONSE" | jq -r .message)
ERROR=$(echo "$ADD_RESPONSE" | jq -r .error)

if [ "$SUCCESS" = "true" ]; then
  echo "✅ $MESSAGE"
  echo ""
  echo "Account details:"
  echo "$ADD_RESPONSE" | jq .account
else
  echo "❌ Failed to add account"
  echo "Error: $ERROR"
  echo "Full response: $ADD_RESPONSE"
  exit 1
fi

echo ""
echo "=== Authentication Complete ===="
echo ""

# 4. Test command execution
echo "4. Testing command execution with new account..."
ACCOUNT_ID=$(echo "$ADD_RESPONSE" | jq -r .account.id)

EXEC_RESPONSE=$(curl -s http://localhost:3000/api/commands/execute \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":$ACCOUNT_ID,\"command\":\"projects list --limit=1\"}")

EXEC_STATUS=$(echo "$EXEC_RESPONSE" | jq -r .status)

if [ "$EXEC_STATUS" = "completed" ]; then
  echo "✅ Command executed successfully"
  echo "Output:"
  echo "$EXEC_RESPONSE" | jq -r .output
else
  echo "❌ Command execution failed"
  echo "$EXEC_RESPONSE" | jq .
fi