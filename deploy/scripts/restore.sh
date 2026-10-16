#!/usr/bin/env bash
# Replaces ALL current data with a backup made by backup.sh:
#   restore.sh <db-....dump> <uploads-....tgz>
# Either may be an s3:// address. The site is down while it runs.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

dump=${1:?usage: restore.sh <db-....dump> <uploads-....tgz>}
uploads=${2:?usage: restore.sh <db-....dump> <uploads-....tgz>}

fetch() {
  if [[ "$1" == s3://* ]]; then
    local file
    file="$BACKUP_DIR/restore-$(basename "$1")"
    aws s3 cp --only-show-errors "$1" "$file"
    echo "$file"
  else
    echo "$1"
  fi
}

mkdir -p "$BACKUP_DIR"
dump=$(fetch "$dump")
uploads=$(fetch "$uploads")
test -s "$dump" && test -s "$uploads"

if [ "${ASSUME_YES:-}" != 1 ]; then
  read -r -p "This replaces all current data with the backup. Type RESTORE to go on: " answer
  [ "$answer" = RESTORE ] || { echo "Nothing changed."; exit 1; }
fi

compose stop web backend
compose exec -T postgres psql -q -U event_planner -d event_planner \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
compose exec -T postgres pg_restore -U event_planner -d event_planner \
  --no-owner --exit-on-error <"$dump"
compose run --rm --no-deps -T --entrypoint sh backend \
  -c 'find /data/uploads -mindepth 1 -delete && tar xzf - -C /data/uploads' <"$uploads"
compose up -d
wait_for_backend
echo "Restored from $dump and $uploads"
