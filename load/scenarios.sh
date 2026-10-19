#!/usr/bin/env bash
# Run the owned independently synthetic simulator; never target SUM or snapshots.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
scenario=${1:-all}
ACTORS=${SCENARIO_ACTORS:-400}
QUICK=${SCENARIO_QUICK:-0}
if ! [[ "$ACTORS" =~ ^[1-9][0-9]{0,3}$ ]] || (( ACTORS > 1000 )); then echo 'SCENARIO_ACTORS must be 1..1000' >&2; exit 2; fi
case "$scenario" in all|login|race|last-seat|ample|mixed|multi-uniform|multi-hotspot|retry|resilience|stress|soak|reads) ;; *) echo 'Usage: bash load/scenarios.sh all|login|race|last-seat|ample|mixed|multi-uniform|multi-hotspot|retry|resilience|stress|soak|reads' >&2; exit 2 ;; esac
if [[ "$QUICK" != 0 && "$QUICK" != 1 ]]; then echo 'SCENARIO_QUICK must be 0 or 1' >&2; exit 2; fi
if [[ ! -f infra/simulator/runtime/config.env ]]; then docker compose up --build -d --wait; fi
exec 9>infra/simulator/runtime/scenarios.lock
if ! flock -n 9; then echo 'Another scenario suite is running; wait before rotating campaigns.' >&2; exit 1; fi
if [[ ${SCENARIO_BUILD:-1} == 1 ]]; then docker compose build migrate seed api-a api-b audit; fi
RESULTS=infra/simulator/runtime/results
helper() { docker compose run --rm --no-deps migrate node /opt/simulator/scenario-results.mjs "$@"; }
audit() { docker compose run --rm --no-deps audit env -u EXPECTED_ENROLLMENTS -u EXPECTED_REQUESTS node dist/scripts/audit-simulator.js; }
restore() { docker compose up -d --wait --no-deps postgres api-a api-b >/dev/null; }
fault_pid=''
container=''
cleanup() {
  if [[ -n "$fault_pid" ]]; then kill "$fault_pid" 2>/dev/null || true; wait "$fault_pid" 2>/dev/null || true; fi
  if [[ -n "$container" ]]; then docker stop -t 1 "$container" >/dev/null 2>&1 || true; fi
  if [[ "$scenario" == resilience || "$scenario" == all ]]; then restore || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM
fault_sequence() {
  sleep 15
  docker compose stop -t 1 api-a >/dev/null || return 1
  sleep 5
  docker compose up -d --wait --no-deps api-a >/dev/null || return 1
  sleep 5
  docker compose stop -t 1 postgres >/dev/null || return 1
  sleep 3
  docker compose up -d --wait --no-deps postgres >/dev/null || return 1
}
run_one() {
  local item=$1 profile=shared script=enrollment duration='' stage='30s' mode=normal testid status=0 check_status=0
  local current_enrollments current_requests
  local started_ms ended_ms
  testid=$(docker compose run --rm --no-deps migrate node -e "process.stdout.write(require('node:crypto').randomUUID())") || return 1
  audit > "$RESULTS/preflight-$testid.json" || return 1
  read -r current_enrollments current_requests < <(helper audit-counts "preflight-$testid.json") || return 1
  case "$item" in
    ample|retry|mixed) profile=ample ;;
    last-seat|multi-uniform|multi-hotspot) profile=$item ;;
  esac
  if ! SIMULATOR_REBUILD=0 bash infra/simulator/rotate-campaign.sh "$current_enrollments" "$current_requests" shared "$ACTORS" "$profile" > "$RESULTS/prepare-$testid.log" 2>&1; then
    echo "Campaign preparation failed. Inspect $RESULTS/prepare-$testid.log; no load was started."
    return 1
  fi
  case "$item" in
    login) script=login ;;
    mixed) script=mixed; duration=10m ;;
    retry) script=retry ;;
    resilience) script=resilience; duration=90s ;;
    stress) script=sessions; duration=10m ;;
    soak) script=sessions; duration=30m ;;
    reads) script=reads; duration=2m ;;
  esac
  if [[ "$QUICK" == 1 ]]; then
    mode=quick; stage=5s
    case "$item" in mixed|stress|soak|reads) duration=30s ;; resilience) duration=60s ;; esac
  fi
  duration=${SCENARIO_DURATION:-$duration}
  local -a args=(-e SCENARIO_NAME="$item" -e SCENARIO_RUN_MODE="$mode" -e LOAD_MODE="$mode" -e BARRIER_DELAY_MS="${SCENARIO_BARRIER_MS:-20000}" -e STAGE_DURATION="$stage")
  if [[ -n "$duration" ]]; then args+=(-e DURATION="$duration"); fi
  if [[ "$QUICK" == 1 ]]; then args+=(-e RAMP_10_DURATION=5s -e RAMP_25_DURATION=5s -e THINK_MIN_SECONDS=0.2 -e THINK_MAX_SECONDS=0.5); fi
  if [[ "$item" == resilience ]]; then args+=(-e RESILIENCE_API_DOWN_START_SECONDS=13 -e RESILIENCE_API_DOWN_DURATION_SECONDS=15 -e RESILIENCE_DB_DOWN_START_SECONDS=28 -e RESILIENCE_DB_DOWN_DURATION_SECONDS=20); fi
  container="sum-load-$testid"
  printf '\nScenario=%s actors=%s profile=%s mode=%s testid=%s\n' "$item" "$ACTORS" "$profile" "$mode" "$testid"
  started_ms=$(date +%s%3N)
  if [[ "$item" == resilience ]]; then fault_sequence & fault_pid=$!; fi
  docker compose run --rm --no-deps --name "$container" "${args[@]}" k6 run \
    --tag "testid=$testid" --tag "load_scenario=$item" --tag "population=$ACTORS" --tag "run_mode=$mode" \
    --out experimental-prometheus-rw --summary-export "/results/$item-$testid-summary.json" "/load/$script.js" > "$RESULTS/$item-$testid.log" 2>&1 || status=$?
  ended_ms=$(date +%s%3N)
  container=''
  if [[ -n "$fault_pid" ]]; then
    wait "$fault_pid" || { echo 'Fault injection failed; this is not an accepted resilience run.'; status=1; }
    fault_pid=''; restore || return 1
  fi
  chmod 600 "$RESULTS/$item-$testid.log" "$RESULTS/$item-$testid-summary.json" 2>/dev/null || true
  if grep -Fq 'Failed to send the time series data to the endpoint' "$RESULTS/$item-$testid.log"; then status=1; fi
  tail -n 48 "$RESULTS/$item-$testid.log"
  audit > "$RESULTS/audit-$testid.json" || return 1
  helper check "audit-$testid.json" "$item" "$testid" "$status" "$mode" "$started_ms" "$ended_ms" || check_status=$?
  printf 'Grafana: http://127.0.0.1:%s/d/sum-simulator-k6?var-testid=%s&from=%s&to=%s\n' "${SIMULATOR_GRAFANA_PORT:-5190}" "$testid" "$((started_ms - 15000))" "$((ended_ms + 15000))"
  if [[ "$status" != 0 || "$check_status" != 0 ]]; then return 1; fi
}
status=0
if [[ "$scenario" == all ]]; then
  for item in login race last-seat ample mixed multi-uniform multi-hotspot retry resilience stress soak reads; do
    run_one "$item" || status=1
  done
else
  run_one "$scenario" || status=1
fi
exit "$status"
