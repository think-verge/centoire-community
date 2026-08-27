#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/centoire-community}"
SERVICE_NAME="${SERVICE_NAME:-centoire-community-backend}"
NGINX_SITE="${NGINX_SITE:-centoire-community-5175}"
DOMAIN_NGINX_SITE="${DOMAIN_NGINX_SITE:-centoire-community-domain}"
PUBLIC_PORT="${PUBLIC_PORT:-5175}"
BACKEND_PORT="${BACKEND_PORT:-8002}"
ENV_FILE="/etc/centoire-community/backend.env"
FRONTEND_ENV="/etc/centoire-community/frontend.env"
UPLOAD_DIR="/var/lib/centoire-community/uploads"
DEPLOY_USER="${DEPLOY_USER:-dsehgal}"
DEPLOY_WRAPPER="/usr/local/sbin/deploy-centoire-community"

echo "==> Installing system dependencies"
apt-get update -qq
apt-get install -y -qq nginx curl

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required"
  exit 1
fi

NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20 or newer is required; found $(node --version)"
  exit 1
fi

test -d "$APP_DIR/backend"
test -d "$APP_DIR/ui"
test -f "$ENV_FILE"

install -d -m 0700 /etc/centoire-community
if [ ! -f "$FRONTEND_ENV" ]; then
  printf '%s\n' 'VITE_AI_SEARCH_ENABLED=false' > "$FRONTEND_ENV"
fi
chmod 0600 "$FRONTEND_ENV"
mkdir -p "$UPLOAD_DIR"
chmod 0755 "$UPLOAD_DIR"
chmod 0600 "$ENV_FILE"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

echo "==> Configuring systemd service"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Centoire Community Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}/backend
Environment=NODE_ENV=production
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

echo "==> Configuring nginx site"
cat > "/etc/nginx/sites-available/${NGINX_SITE}" <<EOF
server {
    listen ${PUBLIC_PORT};
    listen [::]:${PUBLIC_PORT};
    server_name _;

    root ${APP_DIR}/ui/dist;
    index index.html;

    client_max_body_size 12M;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /assets/ {
        try_files \$uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sfn "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"

if [ -f /etc/letsencrypt/live/centoire.com/fullchain.pem ]; then
  echo "==> Configuring Centoire Community HTTPS domain site"
  cat > "/etc/nginx/sites-available/${DOMAIN_NGINX_SITE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name centoire.com www.centoire.com;

    location ^~ /.well-known/acme-challenge/ {
        root ${APP_DIR}/ui/dist;
        try_files \$uri =404;
    }

    location / {
        return 301 https://centoire.com\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name www.centoire.com;

    ssl_certificate /etc/letsencrypt/live/centoire.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/centoire.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://centoire.com\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name centoire.com;

    ssl_certificate /etc/letsencrypt/live/centoire.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/centoire.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root ${APP_DIR}/ui/dist;
    index index.html;

    client_max_body_size 12M;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /assets/ {
        try_files \$uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
else
  echo "==> Configuring Centoire Community HTTP domain site"
  cat > "/etc/nginx/sites-available/${DOMAIN_NGINX_SITE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name centoire.com www.centoire.com;

    root ${APP_DIR}/ui/dist;
    index index.html;

    client_max_body_size 12M;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /assets/ {
        try_files \$uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
fi

ln -sfn "/etc/nginx/sites-available/${DOMAIN_NGINX_SITE}" "/etc/nginx/sites-enabled/${DOMAIN_NGINX_SITE}"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "==> Configuring scoped deployment permission"
cat > "$DEPLOY_WRAPPER" <<EOF
#!/bin/sh
exec /bin/bash ${APP_DIR}/deploy.sh
EOF
chmod 0755 "$DEPLOY_WRAPPER"
chown root:root "$DEPLOY_WRAPPER"
cat > /etc/sudoers.d/centoire-community-deploy <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: ${DEPLOY_WRAPPER}
EOF
chmod 0440 /etc/sudoers.d/centoire-community-deploy
visudo -cf /etc/sudoers.d/centoire-community-deploy

bash "$APP_DIR/deploy.sh"
echo "==> Centoire Community is available at http://216.48.180.247:${PUBLIC_PORT}"
