#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
REPO_URL="https://github.com/rumahsoftware551/EduPay.git"
DOMAIN="edupay.rumahsoftware.site"
DEPLOY_USER="${SUDO_USER:-$(id -un)}"

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo tidak tersedia. Jalankan sebagai root atau install sudo terlebih dahulu."
  exit 1
fi

echo "[1/7] Update package index dan install dependency..."
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx git certbot python3-certbot-nginx

echo "[2/7] Sinkronisasi source EduPay dari GitHub..."
if [ -d "$APP_DIR/.git" ]; then
  sudo chown -R "$DEPLOY_USER":www-data "$APP_DIR"
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  sudo rm -rf "$APP_DIR"
  sudo mkdir -p "$(dirname "$APP_DIR")"
  sudo chown "$DEPLOY_USER":www-data "$(dirname "$APP_DIR")"
  git clone --branch main --depth 1 "$REPO_URL" "$APP_DIR"
fi

echo "[3/7] Set permission web root..."
sudo chown -R "$DEPLOY_USER":www-data "$APP_DIR"
sudo find "$APP_DIR" -type d -exec chmod 755 {} \;
sudo find "$APP_DIR" -type f -exec chmod 644 {} \;

echo "[4/7] Membuat konfigurasi Nginx..."
sudo tee /etc/nginx/sites-available/edupay >/dev/null <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name edupay.rumahsoftware.site;

    root /var/www/edupay;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires -1;
    }

    location ~* \.(?:css|js|json|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$ {
        expires 1h;
        add_header Cache-Control "public";
        try_files $uri =404;
    }

    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires -1;
        try_files $uri =404;
    }
}
NGINX

sudo ln -sfn /etc/nginx/sites-available/edupay /etc/nginx/sites-enabled/edupay

if [ -e /etc/nginx/sites-enabled/default ]; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi

echo "[5/7] Uji konfigurasi Nginx..."
sudo nginx -t

echo "[6/7] Aktifkan dan reload Nginx..."
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "[7/7] Deployment HTTP selesai."
echo
printf 'Buka: https://%s\n' "$DOMAIN"
echo
printf 'Jika SSL belum aktif, jalankan:\n  sudo certbot --nginx -d %s\n' "$DOMAIN"
