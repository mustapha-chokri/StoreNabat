#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Nabat Al Atlas — Let's Encrypt SSL Bootstrap Script for Ubuntu VPS + Nginx
# Usage: ./scripts/init-ssl.sh yourdomain.com admin@yourdomain.com
# ==============================================================================

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <email>"
  exit 1
fi

DOMAIN="$1"
EMAIL="$2"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p nginx/certbot/conf nginx/certbot/www nginx/conf.d

echo "[ssl] Ensuring Nginx HTTP challenge endpoint is running..."
docker compose up -d web nginx

echo "[ssl] Requesting Let's Encrypt certificate for $DOMAIN and www.$DOMAIN..."
docker compose run --rm --entrypoint "" certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  --rsa-key-size 4096 \
  --agree-tos \
  --no-interactive

echo "[ssl] Generating HTTPS Nginx virtual host config from template..."
sed "s/__DOMAIN__/${DOMAIN}/g" nginx/ssl.conf.template > nginx/conf.d/default.conf

echo "[ssl] Reloading Nginx with TLS 1.2/1.3 enabled and starting Certbot auto-renew..."
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
docker compose --profile ssl up -d certbot

echo "[ssl] SSL setup complete for https://${DOMAIN}"

