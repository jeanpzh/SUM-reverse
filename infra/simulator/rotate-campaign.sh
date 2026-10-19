#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LEGACY_ENV="$ROOT/infra/simulator/.env"
RUNTIME="$ROOT/infra/simulator/runtime"
if [[ -f "$LEGACY_ENV" && ! -L "$LEGACY_ENV" ]]; then
  ENV_FILE="$LEGACY_ENV"
else
  ENV_FILE="$RUNTIME/config.env"
fi
EXPECTED_ENROLLMENTS=${1:?Usage: rotate-campaign.sh <expected-current-enrollments> <expected-current-requests> <shared|distributed>}
EXPECTED_REQUESTS=${2:?Usage: rotate-campaign.sh <expected-current-enrollments> <expected-current-requests> <shared|distributed>}
NEXT_CONTENTION=${3:?Usage: rotate-campaign.sh <expected-current-enrollments> <expected-current-requests> <shared|distributed>}
NEXT_ACTOR_COUNT=${4:-100}
NEXT_PROFILE=${5:-$NEXT_CONTENTION}
if ! [[ "$EXPECTED_ENROLLMENTS" =~ ^[0-9]+$ && "$EXPECTED_REQUESTS" =~ ^[0-9]+$ ]] || [[ "$NEXT_CONTENTION" != shared && "$NEXT_CONTENTION" != distributed ]]; then
  echo 'Provide numeric current enrollment and request counts, then shared or distributed for the next campaign.' >&2
  exit 2
fi
if ! [[ "$NEXT_ACTOR_COUNT" =~ ^[1-9][0-9]{0,3}$ ]] || (( NEXT_ACTOR_COUNT > 1000 )) || ! [[ "$NEXT_PROFILE" =~ ^(shared|distributed|ample|last-seat|multi-uniform|multi-hotspot)$ ]]; then
  echo 'Next actor count must be 1..1000 and profile must be a supported synthetic profile.' >&2
  exit 2
fi
if [[ ! -f "$ENV_FILE" || -L "$ENV_FILE" || ! -d "$RUNTIME" || -L "$RUNTIME" || ! -f "$RUNTIME/manifest.json" ]]; then
  echo 'Current private environment, runtime directory, or seed manifest is missing.' >&2
  exit 1
fi
if [[ $(stat -c '%a' "$ENV_FILE") != 600 || $(stat -c '%a' "$RUNTIME/manifest.json") != 600 || $(stat -c '%a' "$RUNTIME") != 700 ]]; then
  echo 'Expected private modes: environment 0600, manifest 0600, runtime directory 0700.' >&2
  exit 1
fi
old_campaign=$(sed -n 's/^SIMULATOR_CAMPAIGN_ID=//p' "$ENV_FILE")
if ! [[ "$old_campaign" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo 'Current campaign ID is missing or invalid.' >&2
  exit 1
fi
old_manifest="$RUNTIME/manifest-$old_campaign.json"
if [[ -e "$old_manifest" ]]; then
  echo 'The current campaign has already been rotated.' >&2
  exit 1
fi
uuid() { docker compose --project-directory "$ROOT" run --rm --no-deps migrate node -e "process.stdout.write(require('node:crypto').randomUUID())"; }
next_campaign=$(uuid)
next_run=$(uuid)
umask 077
next_env="$ENV_FILE.next"
if [[ -e "$next_env" ]]; then
  echo 'A pending private environment file already exists; inspect the prior rotation state before retrying.' >&2
  exit 1
fi
awk -F= -v campaign="$next_campaign" -v run="$next_run" -v contention="$NEXT_CONTENTION" -v actors="$NEXT_ACTOR_COUNT" -v profile="$NEXT_PROFILE" '
  BEGIN { have_campaign=0; have_run=0; have_contention=0; have_actors=0; have_profile=0 }
  $1 == "SIMULATOR_CAMPAIGN_ID" { print "SIMULATOR_CAMPAIGN_ID=" campaign; have_campaign=1; next }
  $1 == "SIMULATOR_RUN_ID" { print "SIMULATOR_RUN_ID=" run; have_run=1; next }
  $1 == "SIMULATOR_CONTENTION" { print "SIMULATOR_CONTENTION=" contention; have_contention=1; next }
  $1 == "SIMULATOR_ACTOR_COUNT" { print "SIMULATOR_ACTOR_COUNT=" actors; have_actors=1; next }
  $1 == "SIMULATOR_SCENARIO_PROFILE" { print "SIMULATOR_SCENARIO_PROFILE=" profile; have_profile=1; next }
  { print }
  END {
    if (!have_campaign || !have_run) exit 3
    if (!have_contention) print "SIMULATOR_CONTENTION=" contention
    if (!have_actors) print "SIMULATOR_ACTOR_COUNT=" actors
    if (!have_profile) print "SIMULATOR_SCENARIO_PROFILE=" profile
  }
' "$ENV_FILE" > "$next_env"
chmod 600 "$next_env"

cd "$ROOT"
bash load/audit-load.sh "$EXPECTED_ENROLLMENTS" "$EXPECTED_REQUESTS"
docker compose run --rm --no-deps \
  -e SIMULATOR_CLOSE_CAMPAIGN_ID="$old_campaign" -e SIMULATOR_CONFIRM_CLOSE="$old_campaign" \
  migrate node dist/scripts/close-simulator.js
mv "$RUNTIME/manifest.json" "$old_manifest"
mv "$next_env" "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo 'Closed and preserved the prior synthetic campaign; starting the next campaign.'
if [[ ${SIMULATOR_REBUILD:-1} == 1 ]]; then
  docker compose up --build --force-recreate -d --wait
else
  docker compose up --force-recreate -d --wait
fi
