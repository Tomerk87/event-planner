#!/bin/sh
# Run by the Nginx image before it starts. Serves the application over HTTPS
# when the certificate for $DOMAIN exists; otherwise only the plain-HTTP
# placeholder, through which Let's Encrypt can issue that certificate.
set -eu

: "${DOMAIN:?DOMAIN must be set}"

if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  site=https
else
  site=http-only
  echo "40-choose-site: no certificate for ${DOMAIN} yet; serving HTTP only" >&2
fi

envsubst '${DOMAIN}' <"/etc/nginx/sites/${site}.conf" >/etc/nginx/conf.d/site.conf
