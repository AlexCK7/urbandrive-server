#!/usr/bin/env bash
set -euo pipefail
trap 'echo; echo "💥 Failed at: $BASH_COMMAND (exit $?)";' ERR

BASE=${BASE:-http://localhost:3001}

j() { jq -C "$@"; }

echo "Health:"
curl -sS "$BASE/health" | j .

echo
echo "Login:"
ADMIN_TOKEN=$(curl -sS -X POST "$BASE/api/users/login" -H 'Content-Type: application/json' -d '{"email":"admina@example.com"}' | jq -r '.token')
USER_TOKEN=$(curl -sS -X POST "$BASE/api/users/login"  -H 'Content-Type: application/json' -d '{"email":"alice@example.com"}'   | jq -r '.token')
DRIVER_TOKEN=$(curl -sS -X POST "$BASE/api/users/login" -H 'Content-Type: application/json' -d '{"email":"driver1@example.com"}' | jq -r '.token')

echo " ADMIN: ${ADMIN_TOKEN:0:20}..."
echo " USER : ${USER_TOKEN:0:20}..."
echo " DRIVER: ${DRIVER_TOKEN:0:20}..."

echo
echo "Create ride as user:"
RIDE_ID=$(curl -sS -X POST "$BASE/api/rides" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"origin":"Airport","destination":"Downtown"}' | jq -r '.id')
echo " RIDE_ID=$RIDE_ID"

echo
echo "Assign driver as admin:"
curl -sS -X PATCH "$BASE/api/rides/$RIDE_ID/assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"driverEmail":"driver1@example.com"}' | j .

echo
echo "Driver transitions:"
for S in accepted enroute arrived completed; do
  echo "  -> $S"
  curl -sS -X PATCH "$BASE/api/driver/status/$RIDE_ID" \
    -H "Authorization: Bearer $DRIVER_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"status\":\"$S\"}" | jq -C '{id,status}'
done

echo
echo "Verify final role for alice@example.com:"
curl -sS "$BASE/admin/users" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -C '.users[] | select(.email=="alice@example.com")'
