#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
RUNTIME="$ROOT/infra/simulator/runtime"
ENV_FILE="$ROOT/infra/simulator/.env"
mkdir -p "$RUNTIME/results"
chmod 700 "$RUNTIME" "$RUNTIME/results"
if [ -e "$ENV_FILE" ]; then
  echo "Refusing to overwrite existing simulator .env; preserve the current campaign or rotate it explicitly." >&2
  exit 1
fi
uuid() { node -e "process.stdout.write(require('node:crypto').randomUUID())"; }
secret() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }
campaign=$(uuid)
run=$(uuid)
printf '%s\n%s\n' "$campaign" "$run" | while IFS= read -r value; do
  printf '%s\n' "$value" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' || { echo "Host Node did not generate UUIDv4 values." >&2; exit 1; }
done
db_password=$(secret)
metrics=$(secret)
{
  printf 'SIMULATOR_CAMPAIGN_ID=%s\n' "$campaign"
  printf 'SIMULATOR_RUN_ID=%s\n' "$run"
  printf 'SIMULATOR_DB_PASSWORD=%s\n' "$db_password"
  printf 'SIMULATOR_METRICS_TOKEN=%s\n' "$metrics"
  printf 'SIMULATOR_CONTENTION=shared\n'
  printf 'SIMULATOR_UID=%s\n' "$(id -u)"
  printf 'SIMULATOR_GID=%s\n' "$(id -g)"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "Created private simulator runtime and environment. Start with: docker compose --env-file infra/simulator/.env -f compose.simulator.yaml up --build -d"
