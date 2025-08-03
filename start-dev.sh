#!/bin/bash

echo "✅ Starting Backend Server..."
npx nodemon index.ts &
BACKEND_PID=$!

sleep 3

echo "🌐 Starting Tunnel..."
npx localtunnel --port 3001 --subdomain urbandrive &
TUNNEL_PID=$!

# Cleanup function on Ctrl+C
cleanup() {
  echo "🛑 Shutting down backend and tunnel..."
  kill $BACKEND_PID
  kill $TUNNEL_PID
  exit
}

trap cleanup SIGINT

# Keep script alive to allow cleanup
wait
