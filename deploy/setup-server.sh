#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# A.R.G.O — one-shot server setup
#
# Usage:
#   bash deploy/setup-server.sh <user@host> <domain> [db-password]
#
# Example:
#   bash deploy/setup-server.sh root@1.2.3.4 argo.acme.com
#
# What it does (fully automated):
#   1. Installs Node 22, PostgreSQL, nginx, PM2, Certbot
#   2. Creates a 'argo' database + user
#   3. Uploads this repo to the server
#   4. Writes .env files
#   5. Builds the app + runs DB migrations
#   6. Starts both services with PM2
#   7. Configures nginx
#   8. Issues a Let's Encrypt SSL certificate
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── args ────────────────────────────────────────────────────────────────────
SSH_TARGET="${1:-}"
DOMAIN="${2:-}"
DB_PASS="${3:-}"

if [[ -z "$SSH_TARGET" || -z "$DOMAIN" ]]; then
  echo "Usage: bash deploy/setup-server.sh <user@host> <domain> [db-password]"
  exit 1
fi

# Generate a random DB password if not supplied
if [[ -z "$DB_PASS" ]]; then
  DB_PASS="$(openssl rand -base64 20 | tr -d '/+=')"
  echo "Generated DB password: $DB_PASS  (save this)"
fi

# Derive repo root (parent of deploy/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── helpers ─────────────────────────────────────────────────────────────────
remote() { ssh -o StrictHostKeyChecking=accept-new "$SSH_TARGET" "$@"; }
upload() { rsync -az --delete \
  --exclude node_modules --exclude .next --exclude dist \
  --exclude '*.pem' --exclude '*.key' --exclude certs/ \
  --exclude '.env' --exclude '.env.local' \
  "$REPO_ROOT/" "$SSH_TARGET:/home/argo/app/"; }

echo "══════════════════════════════════════════"
echo " A.R.G.O server setup → $SSH_TARGET"
echo " Domain : $DOMAIN"
echo "══════════════════════════════════════════"

# ── 1. system packages ───────────────────────────────────────────────────────
echo "▶ Installing system packages…"
remote bash -s << 'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# Node 22
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

# PostgreSQL
if ! command -v psql &>/dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib
fi

# nginx
if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
fi

# PM2
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 >/dev/null
fi

# Certbot
if ! command -v certbot &>/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi

# Create app user/dir
id argo &>/dev/null || useradd -m -s /bin/bash argo
mkdir -p /home/argo/app
chown -R argo:argo /home/argo
REMOTE

# ── 2. database ──────────────────────────────────────────────────────────────
echo "▶ Setting up PostgreSQL…"
remote bash -s << REMOTE
set -euo pipefail
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='argo'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER argo WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='argo'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE argo OWNER argo;"
REMOTE

# ── 3. upload code ───────────────────────────────────────────────────────────
echo "▶ Uploading code…"
upload
remote chown -R argo:argo /home/argo/app

# ── 4. write env files ───────────────────────────────────────────────────────
echo "▶ Writing environment files…"
remote bash -s << REMOTE
set -euo pipefail
cat > /home/argo/app/apps/api/.env << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://argo:${DB_PASS}@localhost:5432/argo
PORT=3001
CORS_ORIGIN=https://${DOMAIN}
EOF

cat > /home/argo/app/apps/web/.env.local << 'EOF'
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://${DOMAIN}
API_INTERNAL_URL=http://localhost:3001
EOF

chown argo:argo \
  /home/argo/app/apps/api/.env \
  /home/argo/app/apps/web/.env.local
REMOTE

# ── 5. install dependencies, migrate, build ──────────────────────────────────
echo "▶ Installing dependencies…"
remote sudo -u argo bash -s << 'REMOTE'
set -euo pipefail
cd /home/argo/app
npm install --prefer-offline 2>&1 | tail -5
REMOTE

echo "▶ Running DB migrations…"
remote sudo -u argo bash -s << 'REMOTE'
set -euo pipefail
cd /home/argo/app/apps/api
npx prisma migrate deploy
npx prisma generate
REMOTE

echo "▶ Building API…"
remote sudo -u argo bash -s << 'REMOTE'
set -euo pipefail
cd /home/argo/app/apps/api
npm run build
REMOTE

echo "▶ Building web…"
remote sudo -u argo bash -s << 'REMOTE'
set -euo pipefail
cd /home/argo/app/apps/web
npm run build
REMOTE

# ── 6. PM2 ──────────────────────────────────────────────────────────────────
echo "▶ Starting services with PM2…"
remote sudo -u argo bash -s << 'REMOTE'
set -euo pipefail
cd /home/argo/app
pm2 delete all 2>/dev/null || true
pm2 start deploy/ecosystem.config.js
pm2 save
REMOTE

# PM2 startup (run as root so it survives reboots)
remote bash -s << 'REMOTE'
env PATH=$PATH:/usr/bin pm2 startup systemd -u argo --hp /home/argo | tail -1 | bash
REMOTE

# ── 7. nginx ─────────────────────────────────────────────────────────────────
echo "▶ Configuring nginx…"
remote bash -s << REMOTE
set -euo pipefail
cat > /etc/nginx/sites-available/argo << 'NGINX'
server {
    listen 80;
    server_name ${DOMAIN};

    # Next.js handles everything (including internal API proxying)
    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/argo /etc/nginx/sites-enabled/argo
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
REMOTE

# ── 8. SSL certificate ───────────────────────────────────────────────────────
echo "▶ Issuing SSL certificate…"
remote certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
  --email "admin@${DOMAIN}" --redirect

# ── done ─────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo " ✓ Setup complete!"
echo " App: https://${DOMAIN}"
echo " DB password: ${DB_PASS}  ← save this"
echo "══════════════════════════════════════════"
echo ""
echo "To deploy updates later:"
echo "  bash deploy/update.sh ${SSH_TARGET}"
