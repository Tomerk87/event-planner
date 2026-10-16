#!/usr/bin/env bash
# On the server, once the domain points at it: gets the first Let's Encrypt
# certificate for the domain and www, then switches Nginx to HTTPS.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

domain=$(setting DOMAIN)
email=$(setting LETSENCRYPT_EMAIL)

compose run --rm certbot certonly --webroot -w /var/www/acme \
  -d "$domain" -d "www.$domain" \
  --email "$email" --agree-tos --no-eff-email --non-interactive

# Nginx chooses its site when it starts (40-choose-site.sh).
compose restart web
echo "HTTPS is on: https://$domain"
