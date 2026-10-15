#!/bin/bash
# uninstall.sh — stop the out-bridge agent and remove it (install.sh's undo).
#
#   bash packages/out/bridge/uninstall.sh            stop + remove the LaunchAgent plist
#   bash packages/out/bridge/uninstall.sh --purge    also remove the installed copy (and your out.json config)
# Removed files go to the Trash when `trash` is installed; logs are kept.
set -euo pipefail

LABEL=com.openaudiovisual.out-bridge
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DEST="$HOME/Library/Application Support/OpenAV/out-bridge"
PURGE=0
for a in "$@"; do case "$a" in --purge) PURGE=1 ;; -h|--help) sed -n 2,6p "$0"; exit 0 ;; *) echo "unknown option: $a" >&2; exit 2 ;; esac; done

remove() { if command -v trash >/dev/null 2>&1; then trash "$@"; else rm -rf "$@"; fi; }

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null && echo "stopped $LABEL" || echo "$LABEL was not loaded"
[ -f "$PLIST" ] && remove "$PLIST" && echo "removed $PLIST"
if [ "$PURGE" = 1 ]; then
  [ -d "$DEST" ] && remove "$DEST" && echo "removed $DEST"
fi
echo "✅ done (logs kept in ~/Library/Logs/OpenAV/)"
