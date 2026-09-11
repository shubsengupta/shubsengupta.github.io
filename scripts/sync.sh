#!/bin/zsh
# Nightly data refresh, run by launchd with Shub's local credentials.
# Pulls master into a dedicated clone, re-exports GitHub and Claude Code
# counts, and keeps a single "data-refresh" branch + PR up to date for a
# human to merge. Safe before the redesign lands on master: exits early.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -d "$HOME/.nvm/versions/node" ]; then
  export PATH="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" | tail -1)/bin:$PATH"
fi

REPO="${SHUB_CA_SYNC_DIR:-$HOME/.shub-ca-sync}"
SLUG="shubsengupta/shubsengupta.github.io"
BRANCH="data-refresh"
DATA=(src/data/pulse.json src/data/claude.json)

[ -d "$REPO/.git" ] || git clone -q "git@github.com:$SLUG.git" "$REPO"
cd "$REPO"
git fetch -q --prune origin
git checkout -q -B "$BRANCH" origin/master
[ -f scripts/pulse.mjs ] || { echo "exporters not on master yet, skipping"; exit 0; }

# Start from the newest data we have, so an unmerged refresh is not lost to
# Claude Code's log pruning before it lands.
if git rev-parse -q --verify "origin/$BRANCH" >/dev/null; then
  git checkout -q "origin/$BRANCH" -- "${DATA[@]}" 2>/dev/null || true
fi

npm ci --silent --ignore-scripts >/dev/null 2>&1 || true
node scripts/pulse.mjs
node scripts/claude-stats.mjs

git add "${DATA[@]}"
if git diff --quiet origin/master -- "${DATA[@]}"; then echo "no change"; exit 0; fi

git -c user.name="shub.ca sync" -c user.email="sync@shub.ca" commit -qm "data: refresh $(date -u +%F)"
git push -q --force-with-lease=refs/heads/$BRANCH origin "$BRANCH" 2>/dev/null || git push -q -f origin "$BRANCH"

if [ -z "$(gh pr list -R "$SLUG" --head "$BRANCH" --state open --json number --jq '.[0].number')" ]; then
  gh pr create -R "$SLUG" --base master --head "$BRANCH" \
    --title "Data refresh" \
    --body "Nightly refresh of GitHub contributions and Claude Code counts from Shub's Mac. Merge when convenient; the branch is rewritten each night until then."
  echo "opened PR"
else
  echo "updated PR"
fi
