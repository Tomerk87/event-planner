#!/usr/bin/env bash
# Backs up the database and the uploaded pictures. Run nightly by cron
# (server-setup.sh), or by hand. Keeps 7 days on the server and, when
# BACKUP_BUCKET is set in .env, copies each backup to that S3 bucket.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$BACKUP_DIR"
dump="$BACKUP_DIR/db-$stamp.dump"
uploads="$BACKUP_DIR/uploads-$stamp.tgz"

compose exec -T postgres pg_dump -U event_planner -Fc event_planner >"$dump"
compose exec -T backend tar czf - -C /data/uploads . >"$uploads"
# An empty file means the copy failed.
test -s "$dump" && test -s "$uploads"
echo "Backed up to $dump and $uploads"

find "$BACKUP_DIR" -name 'db-*.dump' -mtime +7 -delete
find "$BACKUP_DIR" -name 'uploads-*.tgz' -mtime +7 -delete

bucket=$(setting BACKUP_BUCKET)
if [ -n "$bucket" ]; then
  aws s3 cp --only-show-errors "$dump" "s3://$bucket/$stamp/"
  aws s3 cp --only-show-errors "$uploads" "s3://$bucket/$stamp/"
  echo "Copied to s3://$bucket/$stamp/"
fi
