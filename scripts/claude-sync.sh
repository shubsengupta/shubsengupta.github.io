#!/bin/zsh
# Nightly: refresh Claude Code counts in a dedicated clone of master and push.
# Safe to run before the redesign is merged: it exits if the exporter is absent.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:$PATH"
REPO="${SHUB_CA_SYNC_DIR:-$HOME/.shub-ca-sync}"
REMOTE="git@github.com:shubsengupta/shubsengupta.github.io.git"
[ -d "$REPO/.git" ] || git clone -q "$REMOTE" "$REPO"
cd "$REPO"
git fetch -q origin master
git checkout -q master
git reset -q --hard origin/master
[ -f scripts/claude-stats.mjs ] || { echo "exporter not on master yet, skipping"; exit 0; }
node scripts/claude-stats.mjs
git add src/data/claude.json
git diff --cached --quiet && { echo "no change"; exit 0; }
git -c user.name=claude-stats -c user.email=claude-stats@shub.ca commit -qm "claude: refresh $(date -u +%F)"
git push -q origin master
echo "pushed"
