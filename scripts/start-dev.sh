#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"
echo "✅ Starting Backend on ${PORT}…"

# Start nodemon in foreground (so one Ctrl-C stops it)
# nodemon reads nodemon.json to ignore .ngrok.log, scripts, etc.
npx nodemon --exec "ts-node index.ts" &
API_PID=$!

TUNNEL_PID=""
cleanup() {
  echo -e "\n🛑 Shutting down…"
  if [[ -n "${TUNNEL_PID}" ]] && ps -p "${TUNNEL_PID}" >/dev/null 2>&1; then
    kill "${TUNNEL_PID}" || true
  fi
  if ps -p "${API_PID}" >/dev/null 2>&1; then
    kill "${API_PID}" || true
  fi
}
trap cleanup INT TERM

# Prefer localtunnel if present; else ngrok
if command -v lt >/dev/null 2>&1 || command -v localtunnel >/dev/null 2>&1; then
  echo "🌐 Trying localtunnel…"
  (command -v lt >/dev/null 2>&1 && lt --port "${PORT}" --subdomain urbandrive) \
  || (command -v localtunnel >/dev/null 2>&1 && localtunnel --port "${PORT}" --subdomain urbandrive) &
  TUNNEL_PID=$!
else
  echo "ℹ️ Using ngrok…"
  npx ngrok http "${PORT}" --log=stdout > .ngrok.log 2>&1 &
  TUNNEL_PID=$!
  sleep 1
  echo "✅ Ngrok up. Dashboard: http://127.0.0.1:4040"
fi

wait "${API_PID}"
