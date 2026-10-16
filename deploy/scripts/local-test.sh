#!/usr/bin/env bash
# Runs the production stack on this machine, as on the server, at
# https://localhost:8443 with a self-signed certificate:
#   deploy/scripts/local-test.sh up [version]   (default version: dev)
#   deploy/scripts/local-test.sh down           (keeps the data)
#   deploy/scripts/local-test.sh wipe           (deletes the data)
#   deploy/scripts/local-test.sh backup | restore <dump> <uploads>
# Uses its own project name and data, apart from the development database.
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
local_dir="$root/deploy/.local"
export STACK_FILE="$root/deploy/docker-compose.yml"
export ENV_FILE="$local_dir/.env"
export BACKUP_DIR="$local_dir/backups"
export STACK_PROJECT=event-planner-local
. "$root/deploy/scripts/lib.sh"

prepare() {
  local version=$1
  mkdir -p "$local_dir/certs/live/localhost"
  if [ ! -f "$local_dir/certs/live/localhost/fullchain.pem" ]; then
    openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj /CN=localhost \
      -addext subjectAltName=DNS:localhost \
      -keyout "$local_dir/certs/live/localhost/privkey.pem" \
      -out "$local_dir/certs/live/localhost/fullchain.pem" 2>/dev/null
  fi
  local password
  password=$( [ -f "$ENV_FILE" ] && setting POSTGRES_PASSWORD || openssl rand -hex 24)
  cat >"$ENV_FILE" <<ENV
DOMAIN=localhost
POSTGRES_PASSWORD=$password
APP_VERSION=$version
HTTP_PORT=8080
HTTPS_PORT=8443
PUBLIC_PORT_SUFFIX=:8443
CERTS_DIR=$local_dir/certs
EMAIL_MODE=off
ENV
}

case "${1:-}" in
  up)
    prepare "${2:-dev}"
    compose up -d --remove-orphans
    wait_for_backend
    echo "Running at https://localhost:8443"
    ;;
  down) compose down ;;
  wipe) compose down -v ;;
  backup) "$root/deploy/scripts/backup.sh" ;;
  restore) ASSUME_YES=1 "$root/deploy/scripts/restore.sh" "${2:?dump}" "${3:?uploads}" ;;
  *)
    echo "usage: local-test.sh up [version] | down | wipe | backup | restore <dump> <uploads>" >&2
    exit 1
    ;;
esac
