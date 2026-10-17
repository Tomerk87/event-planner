#!/usr/bin/env bash
# Builds the two production images on this machine, for the server's ARM
# processor, tagged with the current commit. Usage: build-images.sh
# ALLOW_DIRTY=1 builds uncommitted changes too, tagged "dev" (local tests only).
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"

if [ -n "$(git status --porcelain)" ]; then
  if [ "${ALLOW_DIRTY:-}" != 1 ]; then
    echo "There are uncommitted changes; commit them first, so the version names exactly what is deployed." >&2
    exit 1
  fi
  version=dev
else
  version=$(git rev-parse --short HEAD)
fi

docker build --platform linux/arm64 -t "event-planner-backend:$version" backend
docker build --platform linux/arm64 -f deploy/web/Dockerfile \
  --build-arg VITE_DEMO_ENABLED="${VITE_DEMO_ENABLED:-true}" \
  --build-arg VITE_GOOGLE_MAPS_KEY="${VITE_GOOGLE_MAPS_KEY:-}" \
  -t "event-planner-web:$version" .

echo "Built version $version"
