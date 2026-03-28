#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# A.R.G.O — deploy updates to an already-configured server
#
# Usage:
#   bash deploy/update.sh <user@host>
#
# Example:
#   bash deploy/update.sh root@1.2.3.4
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SSH_TARGET="${1:-}"
if [[ -z "$SSH_TARGET" ]]; then
  echo "Usage: bash deploy/update.sh <user@host>"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

remote() { ssh "$SSH_TARGET" "$@"; }
upload() {
  rsync -az --delete \
    --exclude node_modules --exclude .next --exclude dist \
    --exclude '*.pem' --exclude '*.key' --exclude certs/ \
    --exclude '.env' --exclude '.env.local' \
    "$REPO_ROOT/" "$SSH_TARGET:/home/argo/app/"
}

echo "▶ Uploading code…"
upload
remote chown -R argo:argo /home/argo/app

echo "▶ Installing dependencies…"
remote sudo -u argo bash -s << 'REMOTE'
cd /home/argo/app && npm install --prefer-offline 2>&1 | tail -3
REMOTE

echo "▶ Running DB migrations…"
remote sudo -u argo bash -s << 'REMOTE'
cd /home/argo/app/apps/api && npx prisma migrate deploy && npx prisma generate
REMOTE

echo "▶ Building…"
remote sudo -u argo bash -s << 'REMOTE'
cd /home/argo/app/apps/api && npm run build
cd /home/argo/app/apps/web && npm run build
REMOTE

echo "▶ Restarting services…"
remote sudo -u argo pm2 restart all

echo "✓ Deployed. App is live."
