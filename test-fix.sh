#!/bin/bash

echo "Testing fixes..."
echo ""

# Test health endpoint
echo "1. Health check:"
curl -s http://localhost:3000/health | jq .

echo ""
echo "2. Admin check-setup:"
curl -s http://localhost:3000/api/admin/check-setup | jq .

echo ""
echo "3. Frontend static files:"
if curl -s -f "http://localhost:3000/" > /dev/null; then
    echo "✓ Frontend is accessible"
else
    echo "✗ Frontend not accessible"
fi

echo ""
echo "4. Testing admin login..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
    echo "✓ Admin login successful"
    echo "Token: ${TOKEN:0:20}..."

    echo ""
    echo "5. Testing authenticated endpoints:"

    echo "- GCloud accounts:"
    curl -s -H "Authorization: Bearer $TOKEN" \
      http://localhost:3000/api/gcloud-accounts | jq '.accounts | length'

    echo "- Command executions:"
    curl -s -H "Authorization: Bearer $TOKEN" \
      http://localhost:3000/api/commands/executions | jq '.total'
else
    echo "✗ Admin login failed"
fi

echo ""
echo "Test complete!"