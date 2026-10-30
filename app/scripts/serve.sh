#!/usr/bin/env bash
# Start (or restart) a server in the background. Usage: scripts/serve.sh <port> [fake]
# fake = PayPal test mode (no network) on a separate throwaway database.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-5180}"
PIDFILE="/tmp/jastip-$PORT.pid"
if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then kill "$(cat "$PIDFILE")"; sleep 1; fi
if [[ "${2:-}" == "fake" ]]; then
  rm -f /tmp/jastip-fake-"$PORT".db*
  DEMO_SWITCH=1 PORT="$PORT" PAYPAL_FAKE=1 DB_FILE="/tmp/jastip-fake-$PORT.db" setsid nohup node --no-warnings server.mjs > "/tmp/jastip-$PORT.log" 2>&1 &
else
  DEMO_SWITCH=1 PORT="$PORT" setsid nohup node --no-warnings server.mjs > "/tmp/jastip-$PORT.log" 2>&1 &
fi
echo $! > "$PIDFILE"
sleep 1.5
cat "/tmp/jastip-$PORT.log"
