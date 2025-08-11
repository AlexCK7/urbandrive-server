#!/usr/bin/env bash
set -u
set -o pipefail
trap 'echo; echo "💥 Failed at: $BASH_COMMAND (exit $?)";' ERR

BASE=${BASE:-http://localhost:3001}

run() {
  echo
  echo "▶ $*"
  eval "$@" || echo "   ↳ non-zero exit ($?) — continuing"
}

echo "Health:"
run "curl -iS $BASE/health"

echo "Login admin:"
ADMIN_TOKEN=$(curl -s -X POST "$BASE/api/users/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admina@example.com"}' | jq -r '.token // empty')
echo "ADMIN_TOKEN: ${ADMIN_TOKEN:0:20}..."

echo "Login user:"
USER_TOKEN=$(curl -s -X POST "$BASE/api/users/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com"}' | jq -r '.token // empty')
echo "USER_TOKEN: ${USER_TOKEN:0:20}..."

echo "Apply (creating or 409 if already pending):"
run "curl -iS -X POST $BASE/api/driver-applications/apply \
  -H 'Authorization: Bearer $USER_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"licenseNumber\":\"ABC12345\",\"vehicle\":\"Honda Civic\",\"notes\":\"5yrs\"}'"

echo "Mine:"
run "curl -iS $BASE/api/driver-applications/mine \
  -H 'Authorization: Bearer $USER_TOKEN'"

echo "Admin list (applied):"
LIST_JSON=$(curl -s "$BASE/admin/driver-applications?status=applied" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$LIST_JSON" | jq . || true
APP_ID=$(echo "$LIST_JSON" | jq -r '.applications[0].id // empty')
echo "APP_ID=$APP_ID"

if [ -n "$APP_ID" ]; then
  echo "Approve:"
  run "curl -iS -X POST $BASE/admin/driver-applications/$APP_ID/approve \
    -H 'Authorization: Bearer $ADMIN_TOKEN' \
    -H 'Content-Type: application/json' \
    -d '{\"reviewNotes\":\"looks good\"}'"
else
  echo "No pending app to approve (maybe already approved)."
fi

echo "Verify final role for alice@example.com:"
run "curl -iS $BASE/admin/users -H 'Authorization: Bearer $ADMIN_TOKEN' \
  | jq '.users[] | select(.email==\"alice@example.com\")'"
