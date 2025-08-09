#!/usr/bin/env bash
set -euo pipefail

# ---- Config (edit emails here if you like) ----
ADMIN_EMAIL="${ADMIN_EMAIL:-taiga@example.com}"
DRIVER_EMAIL="${DRIVER_EMAIL:-driver@example.com}"
USER_EMAIL="${USER_EMAIL:-jake@example.com}"
FRIEND_EMAIL="${FRIEND_EMAIL:-friend@example.com}"

MODE="${1:-local}" # local | ngrok
BASE=""

# ---- Coloring ----
GREEN="$(printf '\033[0;32m')"; RED="$(printf '\033[0;31m')"; YELLOW="$(printf '\033[0;33m')"; NC="$(printf '\033[0m')"

say() { echo -e "${YELLOW}▶ $*${NC}"; }
ok() { echo -e "${GREEN}✔ $*${NC}"; }
fail() { echo -e "${RED}✘ $*${NC}"; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || return 1; }

# ---- Resolve BASE ----
if [[ "$MODE" == "local" ]]; then
  BASE="${BASE:-http://localhost:3001}"
elif [[ "$MODE" == "ngrok" ]]; then
  say "Resolving ngrok public URL from 127.0.0.1:4040"
  if ! curl -s http://127.0.0.1:4040/api/tunnels >/dev/null; then
    fail "ngrok API not reachable at 127.0.0.1:4040. Start ngrok first:  'ngrok http 3001'"
  fi
  BASE=$(curl -s http://127.0.0.1:4040/api/tunnels \
    | sed -n 's/.*"public_url":"\([^"]*\)".*/\1/p' \
    | head -n1 \
    | sed 's#http://#https://#')
  [[ -z "$BASE" ]] && fail "Could not parse ngrok public URL from API."
else
  fail "Unknown mode: $MODE (use 'local' or 'ngrok')"
fi
ok "BASE = $BASE"

# ---- Helpers ----

# curl_json METHOD URL [headers...] [data]
# Sets global: HTTP_CODE, BODY
HTTP_CODE=""
BODY=""
curl_json() {
  local METHOD="$1"; shift
  local URL="$1"; shift
  local EXTRA=("$@")

  # shellcheck disable=SC2206
  RESP=($(curl -s -w " %{http_code}" -X "$METHOD" "$URL" "${EXTRA[@]}"))
  HTTP_CODE="${RESP[-1]}"
  unset 'RESP[-1]'
  BODY="${RESP[*]}"
}

# get_value JSON KEY -> uses jq if present, otherwise sed (best-effort)
get_value() {
  local json="$1"
  local key="$2"
  if need_cmd jq; then
    echo "$json" | jq -r ".$key" 2>/dev/null
    return 0
  fi
  # basic sed fallback (will fail for complex JSON; ok for simple IDs)
  echo "$json" | sed -n "s/.*\"$key\":\s*\"\?\([^\",}]*\)\"\?.*/\1/p" | head -n1
}

expect_code() {
  local want="$1"
  local context="$2"
  if [[ "$HTTP_CODE" != "$want" ]]; then
    echo
    fail "$context — Expected $want, got $HTTP_CODE. Body: $BODY
Hints:
- Check backend logs in your dev terminal for errors.
- Verify 'x-user-email' header and roles are correct.
- If using ngrok, confirm BASE matches the current public URL (see ngrok UI).
- Health says: $(curl -s "$BASE/health" || echo 'unreachable')"
  fi
}

# ---- 1) /health ----
say "1) Health check"
curl_json GET "$BASE/health"
expect_code "200" "Health check failed"
ok "Health: $BODY"

# ---- 2) Create Jake (idempotent) ----
say "2) Create user: $USER_EMAIL (idempotent)"
curl_json POST "$BASE/api/users" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Jake\",\"email\":\"$USER_EMAIL\",\"role\":\"user\"}"
if [[ "$HTTP_CODE" == "409" ]]; then
  ok "User already exists (409). Proceeding."
elif [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]]; then
  ok "User created."
else
  echo "Create user: HTTP=$HTTP_CODE Body=$BODY"
  fail "User creation failed."
fi

# ---- 3) Jake books a ride ----
say "3) Jake books a ride"
curl_json POST "$BASE/api/rides" \
  -H "Content-Type: application/json" \
  -H "x-user-email: $USER_EMAIL" \
  -d '{"origin":"Downtown","destination":"Uptown"}'
expect_code "201" "Ride creation failed"
RIDE_ID="$(get_value "$BODY" "id")"
[[ -z "$RIDE_ID" || "$RIDE_ID" == "null" ]] && fail "Could not parse ride id from: $BODY"
ok "Ride created: id=$RIDE_ID"

# ---- 4) Jake cannot list all rides (403 expected) ----
say "4) Non-admin cannot list all rides (expect 403)"
curl_json GET "$BASE/api/rides" -H "x-user-email: $USER_EMAIL"
expect_code "403" "Non-admin access to GET /api/rides should be forbidden"
ok "Got 403 as expected."

# ---- 5) Admin can list all rides ----
say "5) Admin lists all rides"
curl_json GET "$BASE/api/rides" -H "x-user-email: $ADMIN_EMAIL"
expect_code "200" "Admin failed to list rides"
ok "Admin rides OK"

# ---- 6) Admin assigns driver ----
say "6) Admin assigns $DRIVER_EMAIL to ride $RIDE_ID"
curl_json PATCH "$BASE/api/rides/$RIDE_ID/assign" \
  -H "Content-Type: application/json" \
  -H "x-user-email: $ADMIN_EMAIL" \
  -d "{\"driverEmail\":\"$DRIVER_EMAIL\"}"
expect_code "200" "Assign driver failed"
ok "Assigned driver."

# ---- 7) Jake shares with friend ----
say "7) Jake shares the ride with $FRIEND_EMAIL"
curl_json PATCH "$BASE/api/rides/$RIDE_ID/share" \
  -H "Content-Type: application/json" \
  -H "x-user-email: $USER_EMAIL" \
  -d "{\"friendEmail\":\"$FRIEND_EMAIL\"}"
expect_code "200" "Share ride failed"
ok "Shared ride."

# ---- 8) Driver sees assigned rides ----
say "8) Driver views assigned rides"
curl_json GET "$BASE/api/rides/driver" -H "x-user-email: $DRIVER_EMAIL"
expect_code "200" "Driver failed to fetch assigned rides"
ok "Driver rides OK"

# ---- 9) Driver completes ride ----
say "9) Driver completes the ride"
curl_json PATCH "$BASE/api/rides/$RIDE_ID/complete" \
  -H "x-user-email: $DRIVER_EMAIL"
expect_code "200" "Complete ride failed"
ok "Ride completed."

# ---- 10) Admin confirms completed ----
say "10) Admin confirms completed status"
curl_json GET "$BASE/api/rides" -H "x-user-email: $ADMIN_EMAIL"
expect_code "200" "Admin failed to list rides (post-complete)"
if echo "$BODY" | grep -q "\"id\":$RIDE_ID" && echo "$BODY" | grep -qi "\"status\":\"completed\""; then
  ok "Ride $RIDE_ID is completed. ✅"
else
  fail "Ride $RIDE_ID not marked completed in admin list. Body: $BODY"
fi

echo
ok "Smoke test finished successfully. All core flows are green."
