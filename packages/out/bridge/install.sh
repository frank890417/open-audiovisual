#!/bin/bash
# install.sh — keep the out-bridge running at login on this Mac (launchd user agent, KeepAlive).
#
#   bash packages/out/bridge/install.sh                 use the existing config (or a log-only starter one)
#   bash packages/out/bridge/install.sh --config my.json    install this config
#
# What it does:
#   1. copies the bridge (and the few OAV files it imports) to
#      ~/Library/Application Support/OpenAV/out-bridge — the service never depends on a checkout
#      or branch staying where it is; run install.sh again after pulling a newer bridge
#   2. config lives at ~/Library/Application Support/OpenAV/out-bridge/out.json and is never overwritten
#      unless you pass --config (first install without --config: a log-only starter, edit it to wire hardware)
#   3. writes ~/Library/LaunchAgents/com.openaudiovisual.out-bridge.plist and (re)loads it
#   4. waits for http://127.0.0.1:6450/health
# Logs: ~/Library/Logs/OpenAV/out-bridge.log. Undo: uninstall.sh.
set -euo pipefail

LABEL=com.openaudiovisual.out-bridge
PORT=6450
HERE="$(cd "$(dirname "$0")" && pwd)"
PKGS="$(cd "$HERE/../.." && pwd)"                       # …/packages
DEST="$HOME/Library/Application Support/OpenAV/out-bridge"
CONFIG="$DEST/out.json"
LOGDIR="$HOME/Library/Logs/OpenAV"
LOG="$LOGDIR/out-bridge.log"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SRC_CONFIG=""
while [ $# -gt 0 ]; do case "$1" in
  --config) SRC_CONFIG="${2:-}"; [ -f "$SRC_CONFIG" ] || { echo "✗ --config needs a JSON file" >&2; exit 2; }; shift 2 ;;
  -h|--help) sed -n 2,15p "$0"; exit 0 ;;
  *) echo "unknown option: $1" >&2; exit 2 ;; esac; done

[ "$(uname)" = "Darwin" ] || { echo "✗ install.sh is for macOS (launchd). Elsewhere run: node $HERE/out-bridge.mjs --config out.json" >&2; exit 1; }
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "✗ node not found on PATH (Node 18+ needed)" >&2; exit 1; }
NODE="$(cd "$(dirname "$NODE")" && pwd -P)/$(basename "$NODE")"   # absolute: launchd has no shell PATH

# 1. copy (only what the bridge imports; keep the package layout so relative imports resolve)
mkdir -p "$DEST/packages/out/bridge/sinks" "$DEST/packages/relay" "$LOGDIR" "$HOME/Library/LaunchAgents"
cp "$HERE/out-bridge.mjs" "$DEST/packages/out/bridge/"
cp "$HERE"/sinks/*.js "$DEST/packages/out/bridge/sinks/"
cp "$PKGS/out/package.json" "$DEST/packages/out/"
cp "$PKGS/relay/frames.js" "$PKGS/relay/package.json" "$DEST/packages/relay/"
REV="$(git -C "$PKGS" rev-parse --short HEAD 2>/dev/null || echo unknown)"
printf '{\n  "from": "%s",\n  "commit": "%s",\n  "installed": "%s"\n}\n' "$PKGS" "$REV" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DEST/INSTALLED.json"

# 2. config
if [ -n "$SRC_CONFIG" ]; then cp "$SRC_CONFIG" "$CONFIG"
elif [ ! -f "$CONFIG" ]; then
  printf '{\n  "channels": [ { "match": "*", "sink": "log" } ],\n  "safe": {},\n  "timeoutMs": 500\n}\n' > "$CONFIG"
  echo "ℹ wrote a log-only starter config: $CONFIG  (see $HERE/out.example.json for WLED / serial / OSC)"
fi
"$NODE" -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$CONFIG" || { echo "✗ $CONFIG is not valid JSON" >&2; exit 1; }

# 3. the agent
sed -e "s|__NODE__|$NODE|" -e "s|__BRIDGE__|$DEST/packages/out/bridge/out-bridge.mjs|" \
    -e "s|__CONFIG__|$CONFIG|" -e "s|__WORKDIR__|$DEST|" -e "s|__LOG__|$LOG|g" \
    "$HERE/launchd/$LABEL.plist" > "$PLIST"
plutil -lint "$PLIST" >/dev/null
UID_=$(id -u)
launchctl bootout "gui/$UID_/$LABEL" 2>/dev/null || true
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ port $PORT is already in use:" >&2
  lsof -nP -iTCP:$PORT -sTCP:LISTEN >&2
  echo "  stop it, then run install.sh again" >&2
  exit 1
fi
launchctl bootstrap "gui/$UID_" "$PLIST"
launchctl enable "gui/$UID_/$LABEL"

# 4. wait for it
for _ in $(seq 1 40); do
  if H="$(curl -fsS --max-time 1 http://127.0.0.1:$PORT/health 2>/dev/null)"; then
    echo "✅ out-bridge running (commit $REV)"
    echo "   $H"
    echo "   ws://127.0.0.1:$PORT/out · config: $CONFIG · logs: $LOG"
    exit 0
  fi
  sleep 0.25
done
echo "✗ the agent is loaded but /health does not answer — see $LOG" >&2
tail -n 20 "$LOG" >&2 || true
exit 1
