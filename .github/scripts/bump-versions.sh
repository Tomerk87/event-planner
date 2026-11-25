#!/usr/bin/env bash
# Raises the version of each side a merged pull request changed (D107).
# Reads the PR's changed file names on stdin, one per line.
#
#   frontend: any file under frontend/ or deploy/web/ (the web image)
#   backend:  any file under backend/
#   Markdown files (*.md) never count.
#
# A side whose VERSION file the PR edited keeps that number (a new major
# version, set by hand). Otherwise 1.N becomes 1.(N+1): 1.9 -> 1.10.
#
# Writes the new VERSION files unless --dry-run, and prints one line per
# side that gets a tag: "<side> <version> <bumped|kept>".
# Usage: bump-versions.sh [--dry-run] < changed-files
set -euo pipefail

dry_run=false
if [ "${1:-}" = --dry-run ]; then
  dry_run=true
fi

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
files=$(cat)

changed() {
  # Paths matching the side's pattern, ignoring Markdown.
  printf '%s\n' "$files" | grep -E "$1" | grep -vE '\.md$' || true
}

next_version() {
  local major=${1%%.*} minor=${1#*.}
  if ! [[ $major =~ ^[0-9]+$ && $minor =~ ^[0-9]+$ ]]; then
    echo "Not a MAJOR.MINOR version: '$1'" >&2
    exit 1
  fi
  echo "$major.$((minor + 1))"
}

for side in frontend backend; do
  case $side in
    frontend) pattern='^(frontend|deploy/web)/' ;;
    backend) pattern='^backend/' ;;
  esac
  file="$root/$side/VERSION"
  current=$(tr -d '[:space:]' < "$file")

  if printf '%s\n' "$files" | grep -qx "$side/VERSION"; then
    echo "$side $current kept"
  elif [ -n "$(changed "$pattern")" ]; then
    new=$(next_version "$current")
    if [ "$dry_run" = false ]; then
      printf '%s\n' "$new" > "$file"
    fi
    echo "$side $new bumped"
  fi
done
