#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"
echo "✅ Starting Backend on ${PORT}…"

# Start backend (foreground inside its own process group)
# We run nodemon in the background but keep its PID
npx nodemon --watch . --ext ts,json --exec "ts-node index.ts" &
API_PID=$!

# Prefer localtunnel if installed, else ngrok
TUNNEL_PID=""
if command -v lt >/dev/null 2>&1 || command -v localtunnel >/dev/null 2>&1; then
  echo "🌐 Trying localtunnel first…"
  # lt sometimes installs as `lt` (global) or `localtunnel`
  (command -v lt >/dev/null 2>&1 && lt --port "${PORT}" --subdomain urbandrive) \
  || (command -v localtunnel >/dev/null 2>&1 && localtunnel --port "${PORT}" --subdomain urbandrive) &
  TUNNEL_PID=$!
else
  echo "ℹ️ localtunnel not installed. Using ngrok…"
  npx ngrok http "${PORT}" --log=stdout > .ngrok.log 2>&1 &
  TUNNEL_PID=$!
  # Give ngrok a sec to boot, then print dashboard
  sleep 2
  echo "✅ Ngrok up. Dashboard: http://127.0.0.1:4040"
fi

# ONE ctrl-c to stop everything
cleanup() {
  echo -e "\n🛑 Shutting down…"
  # Kill tunnel first (if any)
  if [[ -n "${TUNNEL_PID}" ]] && ps -p "${TUNNEL_PID}" >/dev/null 2>&1; then
    kill "${TUNNEL_PID}" || true
  fi
  # Kill API (nodemon)
  if ps -p "${API_PID}" >/dev/null 2>&1; then
    kill "${API_PID}" || true
  fi
  # Hard kill anything left in this process group
  sleep 0.5
  kill -9 -$$ >/dev/null 2>&1 || true
}
trap cleanup INT TERM

# Wait for nodemon to exit
wait "${API_PID}"
