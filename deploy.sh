#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/centoire-community}"
BACKEND_DIR="$APP_DIR/backend"
UI_DIR="$APP_DIR/ui"
SERVICE_NAME="${SERVICE_NAME:-centoire-community-backend}"
PUBLIC_PORT="${PUBLIC_PORT:-5175}"
BACKEND_PORT="${BACKEND_PORT:-8002}"
FRONTEND_ENV="${FRONTEND_ENV:-/etc/centoire-community/frontend.env}"

# Jobs mini app: deployed only when its env file exists on the VM (see setup.sh).
JOBS_SERVICE_NAME="${JOBS_SERVICE_NAME:-centoire-jobs-api}"
JOBS_PORT="${JOBS_PORT:-8010}"
JOBS_HOST="${JOBS_HOST:-jobs.centoire.com}"
JOBS_ENV_FILE="${JOBS_ENV_FILE:-/etc/centoire-community/jobs-api.env}"
JOBS_FRONTEND_ENV="${JOBS_FRONTEND_ENV:-/etc/centoire-community/jobs-frontend.env}"
JOBS_ENABLED=false
if [ -f "$JOBS_ENV_FILE" ] && [ -d "$APP_DIR/apps/jobs/api" ] && [ -d "$APP_DIR/apps/jobs/web" ]; then
  JOBS_ENABLED=true
fi

if [ ! -f /etc/centoire-community/backend.env ]; then
  echo "Missing /etc/centoire-community/backend.env"
  exit 1
fi

if [ ! -f "$FRONTEND_ENV" ]; then
  echo "Missing $FRONTEND_ENV"
  exit 1
fi

echo "==> Cleaning removed UI source files"
# scp does not delete files removed from the repo; remove them explicitly
rm -f "$UI_DIR/src/components/nav/SidebarSection.tsx"

echo "==> Installing workspace dependencies"
cd "$APP_DIR"
# Per-project node_modules from before the workspace migration would shadow the hoisted ones.
rm -rf node_modules "$BACKEND_DIR/node_modules" "$UI_DIR/node_modules"
npm ci

echo "==> Building backend"
npm run build -w backend

echo "==> Building UI"
set -a
. "$FRONTEND_ENV"
set +a
VITE_API_BASE_URL="" npm run build -w ui

if [ "$JOBS_ENABLED" = true ]; then
  echo "==> Building Jobs API"
  npm run build -w @centoire/jobs-api

  echo "==> Building Jobs web"
  set -a
  [ -f "$JOBS_FRONTEND_ENV" ] && . "$JOBS_FRONTEND_ENV"
  set +a
  VITE_API_BASE_URL="" npm run build -w @centoire/jobs-web
fi

test -f "$BACKEND_DIR/dist/server.js"
test -f "$UI_DIR/dist/index.html"
if [ "$JOBS_ENABLED" = true ]; then
  test -f "$APP_DIR/apps/jobs/api/dist/server.js"
  test -f "$APP_DIR/apps/jobs/web/dist/index.html"
fi

echo "==> Restarting backend"
systemctl restart "$SERVICE_NAME"

if [ "$JOBS_ENABLED" = true ]; then
  echo "==> Restarting Jobs API"
  systemctl restart "$JOBS_SERVICE_NAME"
fi

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
if [ "$JOBS_ENABLED" = true ]; then
  for attempt in {1..15}; do
    if curl -sf "http://127.0.0.1:${JOBS_PORT}/api/v1/jobs/health" >/dev/null; then
      break
    fi
    if [ "$attempt" -eq 15 ]; then
      journalctl -u "$JOBS_SERVICE_NAME" --no-pager -n 50
      exit 1
    fi
    sleep 2
  done
  # Through nginx: the jobs host serves the SPA, routes /api/v1/jobs to jobs-api and /api/ to core.
  if [ -f /etc/nginx/sites-enabled/centoire-jobs ]; then
    if grep -q "listen 443" /etc/nginx/sites-enabled/centoire-jobs; then
      curl -sf --resolve "${JOBS_HOST}:443:127.0.0.1" "https://${JOBS_HOST}/" >/dev/null
      curl -sf --resolve "${JOBS_HOST}:443:127.0.0.1" "https://${JOBS_HOST}/api/v1/jobs/health" >/dev/null
      curl -sf --resolve "${JOBS_HOST}:443:127.0.0.1" "https://${JOBS_HOST}/api/v1/health" >/dev/null
    else
      curl -sf -H "Host: ${JOBS_HOST}" "http://127.0.0.1/" >/dev/null
      curl -sf -H "Host: ${JOBS_HOST}" "http://127.0.0.1/api/v1/jobs/health" >/dev/null
    fi
  fi
fi
echo "==> Centoire Community deployment complete"
