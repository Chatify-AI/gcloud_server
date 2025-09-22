#!/bin/bash

# Test if session persists
TOKEN=$(curl -s http://localhost:3000/api/admin/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

# Test with a dummy verification code to see if session is found
echo "Testing session with authId: auth_1758207549700_6b0ed826"
curl -s http://localhost:3000/api/gcloud-accounts/add \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"test","authId":"auth_1758207549700_6b0ed826"}'
