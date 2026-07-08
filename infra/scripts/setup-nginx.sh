#!/usr/bin/env bash

set -euo pipefail

readonly APP_NAME="personal-finance-tracker"
readonly UPSTREAM_HOST="${UPSTREAM_HOST:-127.0.0.1}"
readonly UPSTREAM_PORT="${UPSTREAM_PORT:-3000}"
readonly NGINX_SNIPPET="/etc/nginx/default.d/${APP_NAME}.conf"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root, for example: sudo $0" >&2
  exit 1
fi

if command -v dnf >/dev/null 2>&1; then
  dnf install -y nginx firewalld policycoreutils
elif command -v yum >/dev/null 2>&1; then
  yum install -y nginx firewalld policycoreutils
else
  echo "This script requires an Oracle Linux/RHEL-compatible VM with dnf or yum." >&2
  exit 1
fi

if ! grep -Eq 'include[[:space:]]+/etc/nginx/default\.d/\*\.conf;' /etc/nginx/nginx.conf; then
  echo "/etc/nginx/nginx.conf does not include /etc/nginx/default.d/*.conf." >&2
  echo "Refusing to install a proxy snippet that Nginx would not load." >&2
  exit 1
fi

install -d -m 0755 /etc/nginx/default.d

cat >"${NGINX_SNIPPET}" <<EOF
# Managed by infra/scripts/setup-nginx.sh.
# The Next.js process remains private on the VM loopback interface.
location / {
    proxy_pass http://${UPSTREAM_HOST}:${UPSTREAM_PORT};
    proxy_http_version 1.1;

    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";

    # Keep Next.js development HMR and long-running requests responsive.
    proxy_buffering off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}
EOF

chmod 0644 "${NGINX_SNIPPET}"

# Oracle Linux enables SELinux by default. Permit Nginx to reach Next.js.
if command -v setsebool >/dev/null 2>&1; then
  setsebool -P httpd_can_network_connect 1
fi

systemctl enable --now firewalld
if ! firewall-cmd --permanent --query-service=http >/dev/null; then
  firewall-cmd --permanent --add-service=http
fi
firewall-cmd --reload

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "Nginx is proxying HTTP traffic to http://${UPSTREAM_HOST}:${UPSTREAM_PORT}."
echo "Configuration written to ${NGINX_SNIPPET}."
