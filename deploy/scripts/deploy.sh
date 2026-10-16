#!/usr/bin/env bash
# Sends a built version to the server and runs it. From this machine:
#   deploy/scripts/deploy.sh <ssh-host> [version]
# The version defaults to the current commit (build it first with
# build-images.sh). Deploying an older version is the rollback: the server
# keeps the last three.
set -euo pipefail

host=${1:?usage: deploy.sh <ssh-host> [version]}
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
version=${2:-$(git -C "$root" rev-parse --short HEAD)}
remote=${REMOTE_DIR:-/opt/event-planner}
keep=3

for name in backend web; do
  image="event-planner-$name:$version"
  if ssh "$host" docker image inspect "$image" >/dev/null 2>&1; then
    echo "$image is already on the server"
    continue
  fi
  id=$(docker image inspect -f '{{.Id}}' "$image" 2>/dev/null) || {
    echo "$image is not built here; run deploy/scripts/build-images.sh" >&2
    exit 1
  }
  # Unchanged since an earlier version (only the other image changed): the
  # server has it already under that version's name.
  if ssh "$host" docker image inspect "$id" >/dev/null 2>&1; then
    echo "$image is unchanged; naming the server's copy"
    ssh "$host" docker tag "$id" "$image"
  else
    echo "Sending $image..."
    docker save "$image" | gzip | ssh "$host" 'gunzip | docker load'
  fi
done

ssh "$host" "mkdir -p $remote/scripts"
scp -q "$root/deploy/docker-compose.yml" "$host:$remote/docker-compose.yml"
scp -q "$root"/deploy/scripts/{lib,backup,restore,issue-cert,renew-cert}.sh "$host:$remote/scripts/"

ssh "$host" bash -s -- "$version" "$keep" "$remote" <<'REMOTE'
set -euo pipefail
version=$1
keep=$2
export APP_DIR=$3
cd "$APP_DIR"
chmod +x scripts/*.sh
. scripts/lib.sh
sed -i.previous "s/^APP_VERSION=.*/APP_VERSION=$version/" .env
compose up -d --remove-orphans
wait_for_backend
compose ps

# Keep the running version and the newest others, up to $keep in all.
for name in backend web; do
  docker images "event-planner-$name" --format '{{.Tag}}' |
    grep -vx "$version" | tail -n +"$keep" |
    xargs -r -I{} docker rmi "event-planner-$name:{}" >/dev/null
done
docker image prune -f >/dev/null
echo "Version $version is running."
REMOTE
