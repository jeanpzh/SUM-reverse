#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
ENV_FILE="$ROOT/infra/simulator/.env"

if [ ! -f "$ENV_FILE" ] || [ -L "$ENV_FILE" ]; then
  echo "Create the simulator environment first with infra/simulator/bootstrap.sh." >&2
  exit 1
fi

chmod 600 "$ENV_FILE"
if grep -q '^GRAFANA_ADMIN_PASSWORD=' "$ENV_FILE"; then
  echo "Grafana admin secret is already configured; the simulator environment was preserved."
  exit 0
fi

secret=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
if ! printf '%s\n' "$secret" | grep -Eq '^[0-9a-f]{64}$'; then
  echo "Could not generate the Grafana admin secret." >&2
  exit 1
fi

printf '\nGRAFANA_ADMIN_PASSWORD=%s\n' "$secret" >> "$ENV_FILE"
unset secret
echo "Added a private Grafana admin secret without changing the simulator campaign."
