# Shared by the scripts that run next to the stack. On the server everything
# lives in /opt/event-planner; scripts/local-test.sh points these variables at
# a local copy instead.
APP_DIR=${APP_DIR:-/opt/event-planner}
STACK_FILE=${STACK_FILE:-$APP_DIR/docker-compose.yml}
ENV_FILE=${ENV_FILE:-$APP_DIR/.env}
BACKUP_DIR=${BACKUP_DIR:-$APP_DIR/backups}

compose() {
  docker compose -f "$STACK_FILE" --env-file "$ENV_FILE" \
    ${STACK_PROJECT:+-p "$STACK_PROJECT"} "$@"
}

# A value of the .env file. The file is not sourced: values such as
# EMAIL_FROM contain spaces and angle brackets.
setting() {
  grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true
}

# Waits until the API reports healthy, or fails after about two minutes.
wait_for_backend() {
  local container status i
  for i in $(seq 1 60); do
    container=$(compose ps -q backend)
    if [ -n "$container" ]; then
      status=$(docker inspect -f '{{.State.Health.Status}}' "$container")
      if [ "$status" = healthy ]; then
        return 0
      fi
    fi
    sleep 2
  done
  echo "The backend did not become healthy. Its last log lines:" >&2
  compose logs --tail 30 backend migrate >&2
  return 1
}
