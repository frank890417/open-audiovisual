#!/bin/bash
# install.sh — keep the Leap bridge running at login on this Mac (launchd user agent, KeepAlive).
#
#   bash packages/leap/bridge/install.sh           the sensor
#   bash packages/leap/bridge/install.sh --mock    two animated hands (no sensor; demos, CI machines)
#
# What it does:
#   1. copies the bridge (and the few OAV files it imports) to
#      ~/Library/Application Support/OpenAV/leap-bridge — the service never depends on a checkout
#      or branch staying where it is; run install.sh again after pulling a newer bridge
#   2. compiles the C reader against the Ultraleap app's LeapSDK (skipped with --mock)
#   3. writes ~/Library/LaunchAgents/com.openaudiovisual.leap-bridge.plist and (re)loads it
#   4. waits for http://127.0.0.1:6437/health
# Logs: ~/Library/Logs/OpenAV/leap-bridge.log. Undo: uninstall.sh.
set -euo pipefail

LABEL=com.openaudiovisual.leap-bridge
HERE="$(cd "$(dirname "$0")" && pwd)"
PKGS="$(cd "$HERE/../.." && pwd)"                       # …/packages
DEST="$HOME/Library/Application Support/OpenAV/leap-bridge"
LOGDIR="$HOME/Library/Logs/OpenAV"
LOG="$LOGDIR/leap-bridge.log"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
MOCK=0
for a in "$@"; do case "$a" in --mock) MOCK=1 ;; -h|--help) sed -n 2,14p "$0"; exit 0 ;; *) echo "unknown option: $a" >&2; exit 2 ;; esac; done

[ "$(uname)" = "Darwin" ] || { echo "✗ install.sh is for macOS (launchd). Elsewhere run: node $HERE/leap-bridge.mjs" >&2; exit 1; }
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "✗ node not found on PATH (Node 18+ needed)" >&2; exit 1; }
NODE="$(cd "$(dirname "$NODE")" && pwd -P)/$(basename "$NODE")"   # absolute: launchd has no shell PATH

# 1. copy (only what the bridge imports; keep the package layout so relative imports resolve)
mkdir -p "$DEST/packages/leap/bridge" "$DEST/packages/relay" "$LOGDIR" "$HOME/Library/LaunchAgents"
cp "$HERE/leap-bridge.mjs" "$HERE/build.mjs" "$HERE/leap-stream.c" "$DEST/packages/leap/bridge/"
cp "$PKGS/leap/frame.js" "$PKGS/leap/mock.js" "$PKGS/leap/package.json" "$DEST/packages/leap/"
cp "$PKGS/relay/frames.js" "$PKGS/relay/package.json" "$DEST/packages/relay/"
REV="$(git -C "$PKGS" rev-parse --short HEAD 2>/dev/null || echo unknown)"
printf '{\n  "from": "%s",\n  "commit": "%s",\n  "installed": "%s"\n}\n' "$PKGS" "$REV" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DEST/INSTALLED.json"

# 2. build the reader now, so a missing SDK / clang shows up here and not as a silent restart loop
EXTRA=""
if [ "$MOCK" = 1 ]; then
  EXTRA='\n    <string>--mock</string>'                        # awk -v turns \n into a newline
else
  "$NODE" "$DEST/packages/leap/bridge/build.mjs" >/dev/null
fi

# 3. the agent
sed -e "s|__NODE__|$NODE|" -e "s|__BRIDGE__|$DEST/packages/leap/bridge/leap-bridge.mjs|" \
    -e "s|__WORKDIR__|$DEST|" -e "s|__LOG__|$LOG|g" \
    "$HERE/launchd/$LABEL.plist" | awk -v extra="$EXTRA" '{ gsub(/__EXTRA_ARGS__/, extra); print }' > "$PLIST"
plutil -lint "$PLIST" >/dev/null
UID_=$(id -u)
launchctl bootout "gui/$UID_/$LABEL" 2>/dev/null || true
if lsof -nP -iTCP:6437 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ port 6437 is already in use (another bridge or the old Leap service):" >&2
  lsof -nP -iTCP:6437 -sTCP:LISTEN >&2
  echo "  stop it, then run install.sh again" >&2
  exit 1
fi
launchctl bootstrap "gui/$UID_" "$PLIST"
launchctl enable "gui/$UID_/$LABEL"

# 4. wait for it
for _ in $(seq 1 40); do
  if H="$(curl -fsS --max-time 1 http://127.0.0.1:6437/health 2>/dev/null)"; then
    echo "✅ leap-bridge running ($( [ "$MOCK" = 1 ] && echo mock || echo sensor ), commit $REV)"
    echo "   $H"
    echo "   ws://127.0.0.1:6437/v6.json · /raw · logs: $LOG"
    exit 0
  fi
  sleep 0.25
done
echo "✗ the agent is loaded but /health does not answer — see $LOG" >&2
tail -n 20 "$LOG" >&2 || true
exit 1
