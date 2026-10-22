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
if ! [[ "$NEXT_ACTOR_COUNT" =~ ^[1-9][0-9]{0,3}$ ]] || (( NEXT_ACTOR_COUNT > 2000 )) || ! [[ "$NEXT_PROFILE" =~ ^(shared|distributed|ample|last-seat|multi-uniform|multi-hotspot|fisi-schools)$ ]]; then
  echo 'Next actor count must be 1..2000 and profile must be a supported synthetic profile.' >&2
  exit 2
fi
# SIMULATOR_FISI_* come from the environment (not positional args) and only apply to the fisi-schools profile.
# They are validated with the same rules as the backend parser, before any docker call.
fisi_franja=${SIMULATOR_FISI_FRANJA-}
fisi_ia=${SIMULATOR_FISI_IA_ACTORS-}
fisi_capacity=${SIMULATOR_FISI_CAPACITY-}
fisi_ratio=${SIMULATOR_FISI_SCARCE_RATIO-}
if [[ "$NEXT_PROFILE" != fisi-schools ]]; then
  if [[ -n "${SIMULATOR_FISI_FRANJA+x}${SIMULATOR_FISI_IA_ACTORS+x}${SIMULATOR_FISI_CAPACITY+x}${SIMULATOR_FISI_SCARCE_RATIO+x}" ]]; then
    echo 'SIMULATOR_FISI_* variables require the fisi-schools profile.' >&2
    exit 2
  fi
else
  if [[ -n "${SIMULATOR_FISI_FRANJA+x}" && ! "$fisi_franja" =~ ^([1-9]|jornada)$ ]]; then echo 'SIMULATOR_FISI_FRANJA must be 1..9 or jornada.' >&2; exit 2; fi
  if [[ -n "${SIMULATOR_FISI_IA_ACTORS+x}" ]] && { ! [[ "$fisi_ia" =~ ^[0-9]{1,4}$ ]] || (( 10#$fisi_ia > NEXT_ACTOR_COUNT )); }; then echo 'SIMULATOR_FISI_IA_ACTORS must be an integer from 0 to the actor count.' >&2; exit 2; fi
  if [[ -n "${SIMULATOR_FISI_CAPACITY+x}" && "$fisi_capacity" != ample && "$fisi_capacity" != scarce ]]; then echo 'SIMULATOR_FISI_CAPACITY must be ample or scarce.' >&2; exit 2; fi
  if [[ -n "${SIMULATOR_FISI_SCARCE_RATIO+x}" ]]; then
    if [[ "${fisi_capacity:-ample}" != scarce ]]; then echo 'SIMULATOR_FISI_SCARCE_RATIO requires SIMULATOR_FISI_CAPACITY=scarce.' >&2; exit 2; fi
    if ! [[ "$fisi_ratio" =~ ^0?\.[0-9]{1,6}$ && "$fisi_ratio" =~ [1-9] ]]; then echo 'SIMULATOR_FISI_SCARCE_RATIO must be a decimal greater than 0 and lower than 1.' >&2; exit 2; fi
  fi
fi
# SIMULATOR_RECREATE: full (default) recreates the whole stack; app keeps postgres and the observability services running.
RECREATE=${SIMULATOR_RECREATE:-full}
if [[ "$RECREATE" != full && "$RECREATE" != app ]]; then
  echo 'SIMULATOR_RECREATE must be full or app.' >&2
  exit 2
fi
if [[ "$RECREATE" == app && "${SIMULATOR_REBUILD-}" == 1 ]]; then
  echo 'SIMULATOR_RECREATE=app does not rebuild images; build first (SCENARIO_BUILD=1 or docker compose build) and leave SIMULATOR_REBUILD unset or 0.' >&2
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
awk -F= -v campaign="$next_campaign" -v run="$next_run" -v contention="$NEXT_CONTENTION" -v actors="$NEXT_ACTOR_COUNT" -v profile="$NEXT_PROFILE" \
  -v fisi_franja="$fisi_franja" -v fisi_ia="$fisi_ia" -v fisi_capacity="$fisi_capacity" -v fisi_ratio="$fisi_ratio" '
  BEGIN { have_campaign=0; have_run=0; have_contention=0; have_actors=0; have_profile=0 }
  $1 == "SIMULATOR_CAMPAIGN_ID" { print "SIMULATOR_CAMPAIGN_ID=" campaign; have_campaign=1; next }
  $1 == "SIMULATOR_RUN_ID" { print "SIMULATOR_RUN_ID=" run; have_run=1; next }
  $1 == "SIMULATOR_CONTENTION" { print "SIMULATOR_CONTENTION=" contention; have_contention=1; next }
  $1 == "SIMULATOR_ACTOR_COUNT" { print "SIMULATOR_ACTOR_COUNT=" actors; have_actors=1; next }
  $1 == "SIMULATOR_SCENARIO_PROFILE" { print "SIMULATOR_SCENARIO_PROFILE=" profile; have_profile=1; next }
  $1 ~ /^SIMULATOR_FISI_/ { next }
  { print }
  END {
    if (!have_campaign || !have_run) exit 3
    if (!have_contention) print "SIMULATOR_CONTENTION=" contention
    if (!have_actors) print "SIMULATOR_ACTOR_COUNT=" actors
    if (!have_profile) print "SIMULATOR_SCENARIO_PROFILE=" profile
    # Stale FISI lines were dropped above; write only the ones requested for this fisi-schools campaign.
    if (profile == "fisi-schools") {
      if (fisi_franja != "") print "SIMULATOR_FISI_FRANJA=" fisi_franja
      if (fisi_ia != "") print "SIMULATOR_FISI_IA_ACTORS=" fisi_ia
      if (fisi_capacity != "") print "SIMULATOR_FISI_CAPACITY=" fisi_capacity
      if (fisi_ratio != "") print "SIMULATOR_FISI_SCARCE_RATIO=" fisi_ratio
    }
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
if [[ "$RECREATE" == app ]]; then
  # The new config.env is already in place. migrate/seed run against the unchanged PostgreSQL and create the new campaign row
  # (a bare API restart would fail in onModuleInit); simulator-init is not needed because config.env already exists.
  # api-a/api-b/web are recreated because they read config.env and web stays bound to the campaign. No rebuild happens in this mode.
  docker compose run --rm --no-deps migrate
  docker compose run --rm --no-deps seed
  docker compose up -d --wait --no-deps --force-recreate api-a api-b web
elif [[ ${SIMULATOR_REBUILD:-1} == 1 ]]; then
  docker compose up --build --force-recreate -d --wait
else
  docker compose up --force-recreate -d --wait
fi
