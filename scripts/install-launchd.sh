#!/bin/zsh
# Installs the nightly Claude Code stats sync as a LaunchAgent (21:30 local).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/LaunchAgents/com.shub.shub-ca-claude.plist"
sed "s#__REPO__#$HERE#" "$HERE/scripts/launchd/com.shub.shub-ca-claude.plist" > "$DEST"
launchctl bootout "gui/$(id -u)/com.shub.shub-ca-claude" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DEST"
echo "installed: $DEST (runs scripts/claude-sync.sh nightly at 21:30; log at /tmp/shub-ca-claude.log)"
echo "run now:   launchctl kickstart -k gui/$(id -u)/com.shub.shub-ca-claude"
