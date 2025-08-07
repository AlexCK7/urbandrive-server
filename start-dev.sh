#!/bin/bash

echo "✅ Starting Backend Server..."

# Start nodemon
npx nodemon index.ts &
NODEMON_PID=$!

# Try localtunnel first
npx localtunnel --port 3001 --subdomain urbandrive &
TUNNEL_PID=$!

# Wait briefly
sleep 3

# If localtunnel failed, use ngrok
if ! ps -p $TUNNEL_PID > /dev/null; then
  echo "⚠️ LocalTunnel failed. Falling back to ngrok..."
  npx ngrok http 3001 &
  TUNNEL_PID=$!
fi

# Handle shutdown signals
trap "echo '🛑 Shutting down backend and tunnel...'; kill $NODEMON_PID $TUNNEL_PID; exit 0" SIGINT SIGTERM

# Wait for background processes
wait
