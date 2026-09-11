#!/bin/zsh
# Installs the nightly data sync as a LaunchAgent (21:30 local, runs on next wake if asleep).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
LABEL=com.shub.shub-ca-sync
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
# retire the earlier Claude-only agent if present
launchctl bootout "gui/$(id -u)/com.shub.shub-ca-claude" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.shub.shub-ca-claude.plist"
sed "s#__REPO__#$HERE#" "$HERE/scripts/launchd/$LABEL.plist" > "$DEST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DEST"
echo "installed: $DEST (runs scripts/sync.sh nightly at 21:30; log at /tmp/shub-ca-sync.log)"
echo "run now:   launchctl kickstart -k gui/$(id -u)/$LABEL"
