#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/centoire-community}"
BACKEND_DIR="$APP_DIR/backend"
UI_DIR="$APP_DIR/ui"
SERVICE_NAME="${SERVICE_NAME:-centoire-community-backend}"
PUBLIC_PORT="${PUBLIC_PORT:-5175}"
BACKEND_PORT="${BACKEND_PORT:-8002}"
FRONTEND_ENV="${FRONTEND_ENV:-/etc/centoire-community/frontend.env}"

if [ ! -f /etc/centoire-community/backend.env ]; then
  echo "Missing /etc/centoire-community/backend.env"
  exit 1
fi

if [ ! -f "$FRONTEND_ENV" ]; then
  echo "Missing $FRONTEND_ENV"
  exit 1
fi

echo "==> Installing backend dependencies"
cd "$BACKEND_DIR"
npm ci

echo "==> Building backend"
npm run build

echo "==> Cleaning removed UI source files"
# scp does not delete files removed from the repo; remove them explicitly
rm -f "$UI_DIR/src/components/nav/SidebarSection.tsx"

echo "==> Installing UI dependencies"
cd "$UI_DIR"
npm ci

echo "==> Building UI"
set -a
. "$FRONTEND_ENV"
set +a
VITE_API_BASE_URL="" npm run build

test -f "$BACKEND_DIR/dist/server.js"
test -f "$UI_DIR/dist/index.html"

echo "==> Restarting backend"
systemctl restart "$SERVICE_NAME"

echo "==> Verifying nginx"
nginx -t
systemctl reload nginx

echo "==> Verifying deployment"
for attempt in {1..15}; do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/v1/health" >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 15 ]; then
    journalctl -u "$SERVICE_NAME" --no-pager -n 50
    exit 1
  fi
  sleep 2
done

curl -sf "http://127.0.0.1:${PUBLIC_PORT}/" >/dev/null
curl -sf "http://127.0.0.1:${PUBLIC_PORT}/api/v1/health" >/dev/null
if [ -f /etc/letsencrypt/live/centoire.com/fullchain.pem ]; then
  curl -sf --resolve centoire.com:443:127.0.0.1 https://centoire.com/ >/dev/null
  curl -sf --resolve centoire.com:443:127.0.0.1 https://centoire.com/api/v1/health >/dev/null
fi
echo "==> Centoire Community deployment complete"
