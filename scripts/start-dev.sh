#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"
echo "✅ Starting Backend on ${PORT}…"

# Start API
npx nodemon --watch . --ext ts,json --exec "ts-node index.ts" &
API_PID=$!

# Prefer localtunnel first (stable subdomain), else ngrok
TUNNEL_PID=""
PUBLIC_URL=""
if command -v lt >/dev/null 2>&1 || command -v localtunnel >/dev/null 2>&1; then
  echo "🌐 Trying localtunnel first…"
  # Note: customize subdomain if "urbandrive" is taken
  (command -v lt >/dev/null 2>&1 && lt --port "${PORT}" --subdomain urbandrive) \
  || (command -v localtunnel >/dev/null 2>&1 && localtunnel --port "${PORT}" --subdomain urbandrive) &
  TUNNEL_PID=$!
  # LocalTunnel prints its URL to stdout (not as easy to parse reliably),
  # so we’ll skip auto-write in this branch. If you want, you can hardcode:
  # PUBLIC_URL="https://urbandrive.loca.lt"
else
  echo "ℹ️ Using ngrok…"
  npx ngrok http "${PORT}" --log=stdout > .ngrok.log 2>&1 &
  TUNNEL_PID=$!
  # Wait for ngrok to come up and resolve the public URL
  for i in {1..40}; do
    PUBLIC_URL="$(curl -sf http://127.0.0.1:4040/api/tunnels | sed -n 's/.*"public_url":"\([^"]*\)".*/\1/p' | head -n1 || true)"
    if [[ -n "${PUBLIC_URL}" ]]; then break; fi
    sleep 0.5
  done
  echo "✅ Ngrok up. Dashboard: http://127.0.0.1:4040"
fi

# >>> NEW: write the URL into the frontend .env.local so Expo picks it up
if [[ -n "${PUBLIC_URL:-}" ]]; then
  FRONTEND_DIR="${FRONTEND_DIR:-../UrbanDrive}"
  mkdir -p "${FRONTEND_DIR}"
  echo "EXPO_PUBLIC_BASE_URL=${PUBLIC_URL}" > "${FRONTEND_DIR}/.env.local"
  echo "📝 Wrote ${FRONTEND_DIR}/.env.local"
  echo "🔗 EXPO_PUBLIC_BASE_URL=${PUBLIC_URL}"
fi
# <<< NEW

cleanup() {
  echo -e "\n🛑 Shutting down…"
  if [[ -n "${TUNNEL_PID}" ]] && ps -p "${TUNNEL_PID}" >/dev/null 2>&1; then
    kill "${TUNNEL_PID}" || true
  fi
  if ps -p "${API_PID}" >/dev/null 2>&1; then
    kill "${API_PID}" || true
  fi
  sleep 0.3
  kill -9 -$$ >/dev/null 2>&1 || true
}
trap cleanup INT TERM

wait "${API_PID}"
