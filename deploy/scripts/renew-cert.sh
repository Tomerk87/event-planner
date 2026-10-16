#!/usr/bin/env bash
# Run twice a day by cron (server-setup.sh). certbot renews only within 30
# days of expiry; Nginx then reloads to use the new certificate.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

compose run --rm certbot renew --webroot -w /var/www/acme --quiet
compose exec -T web nginx -s reload
