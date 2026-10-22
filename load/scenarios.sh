#!/usr/bin/env bash
# Run the owned independently synthetic simulator; never target SUM or snapshots.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
scenario=${1:-all}
ACTORS=${SCENARIO_ACTORS:-400}
QUICK=${SCENARIO_QUICK:-0}
if ! [[ "$ACTORS" =~ ^[1-9][0-9]{0,3}$ ]] || (( ACTORS > 1000 )); then echo 'SCENARIO_ACTORS must be 1..1000' >&2; exit 2; fi
ENV_LABEL=${SCENARIO_ENV:-H}
REP=${SCENARIO_REP:-1}
REPEATS=${SCENARIO_REPEATS:-1}
WARMUP=${SCENARIO_WARMUP:-0}
ORDER=${SCENARIO_ORDER:-fixed}
SEED=${SCENARIO_SEED:-}
if [[ "$ENV_LABEL" != H && "$ENV_LABEL" != C ]]; then echo 'SCENARIO_ENV must be H or C' >&2; exit 2; fi
if ! [[ "$REP" =~ ^[1-9][0-9]{0,5}$ ]]; then echo 'SCENARIO_REP must be a positive integer' >&2; exit 2; fi
if ! [[ "$REPEATS" =~ ^[1-9][0-9]{0,2}$ ]]; then echo 'SCENARIO_REPEATS must be a positive integer (1..999)' >&2; exit 2; fi
if [[ "$REPEATS" != 1 && -n "${SCENARIO_REP:-}" ]]; then echo 'SCENARIO_REP cannot be combined with SCENARIO_REPEATS>1; repetition r of n runs with rep=r' >&2; exit 2; fi
if [[ "$WARMUP" != 0 && "$WARMUP" != 1 ]]; then echo 'SCENARIO_WARMUP must be 0 or 1' >&2; exit 2; fi
if [[ "$ORDER" != fixed && "$ORDER" != shuffle ]]; then echo 'SCENARIO_ORDER must be fixed or shuffle' >&2; exit 2; fi
if [[ -n "$SEED" ]] && ! [[ "$SEED" =~ ^[0-9]{1,9}$ ]]; then echo 'SCENARIO_SEED must be an integer with at most 9 digits' >&2; exit 2; fi
if [[ "${SIMULATOR_RECREATE:-full}" != full && "${SIMULATOR_RECREATE:-full}" != app ]]; then echo 'SIMULATOR_RECREATE must be full or app' >&2; exit 2; fi
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
export DOCKER_CMD=${DOCKER_CMD:-docker}
PROJECT=${COMPOSE_PROJECT_NAME:-sum-simulator}
fault_pid=''
container=''
sampler_pid=''
stop_sampler() {
  if [[ -n "$sampler_pid" ]]; then kill -TERM "$sampler_pid" 2>/dev/null || true; wait "$sampler_pid" 2>/dev/null || true; sampler_pid=''; fi
}
cpuset_lines() {
  local ids
  ids=$(docker compose ps -q 2>/dev/null) || return 0
  if [[ -n "$ids" ]]; then docker inspect --format '{{.Name}} {{.HostConfig.CpusetCpus}}' $ids 2>/dev/null | sed 's#^/##' || true; fi
}
cleanup() {
  stop_sampler
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
meta_patch() {
  # Host-side minimal merge into the run metadata written by `run-meta`; metadata is informative, so a failure only warns.
  node -e "const fs=require('node:fs');const f=process.argv[1];const m=JSON.parse(fs.readFileSync(f,'utf8'));fs.writeFileSync(f,JSON.stringify({...m,...JSON.parse(process.argv[2])},null,2)+'\n')" "$1" "$2" || echo "Warning: could not update $1" >&2
}
shuffle_items() {
  node -e "let a=Number(process.argv[1])>>>0;const r=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296};const x=process.argv.slice(2);for(let i=x.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[x[i],x[j]]=[x[j],x[i]]}console.log(x.join('\n'))" "$@"
}
run_one() {
  local item=$1 profile=shared script=enrollment duration='' stage='30s' mode=normal testid status=0 check_status=0 guard_status=0
  local current_enrollments current_requests
  local started_ms ended_ms warmup_status=0
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
  helper run-meta "$testid" "$ENV_LABEL" "$REP" "$(git rev-parse HEAD 2>/dev/null || echo unknown)" "$(cpuset_lines)" > /dev/null || return 1
  if (( REPEATS > 1 )) || [[ "$ORDER" == shuffle || "$WARMUP" == 1 ]]; then
    meta_patch "$RESULTS/run-meta-$testid.json" "{\"repeats\":$REPEATS,\"order\":\"$ORDER\",\"orderSeed\":${ORDER_SEED:-null},\"scenarioSeed\":${SEED:-null},\"warmup\":$([[ "$WARMUP" == 1 ]] && echo true || echo false)}"
  fi
  if [[ "$WARMUP" == 1 ]]; then
    # Separate k6 run against the already prepared campaign: its summary and exit status never reach `check`.
    # Closest faithful use of the existing reads.js knobs: RATE=10 it/s for 30s, with 1s ramps instead of the default 30s ones.
    # It is not sent to Prometheus, so dashboards filtered by testid only show the measured run.
    container="sum-load-$testid-warmup"
    printf 'Warm-up: reads at 10 it/s for 30s (phase=warmup, excluded from thresholds and pass/fail)\n'
    docker compose run --rm --no-deps --name "$container" -e SCENARIO_NAME=warmup -e SCENARIO_RUN_MODE=warmup -e RATE=10 -e DURATION=30s -e RAMP_10_DURATION=1s -e RAMP_25_DURATION=1s k6 run \
      --tag "testid=$testid" --tag "load_scenario=$item" --tag "population=$ACTORS" --tag "run_mode=$mode" --tag "env=$ENV_LABEL" --tag "rep=$REP" --tag "phase=warmup" \
      --summary-export "/results/warmup-$testid-summary.json" /load/reads.js > "$RESULTS/warmup-$testid.log" 2>&1 || warmup_status=$?
    container="sum-load-$testid"
    chmod 600 "$RESULTS/warmup-$testid.log" "$RESULTS/warmup-$testid-summary.json" 2>/dev/null || true
    meta_patch "$RESULTS/run-meta-$testid.json" "{\"warmupExitCode\":$warmup_status}"
    if [[ "$warmup_status" != 0 && "$warmup_status" != 99 ]]; then
      echo "Warm-up failed hard (exit $warmup_status). Inspect $RESULTS/warmup-$testid.log; the measured run was not started."
      return 1
    fi
  fi
  printf '\nScenario=%s actors=%s profile=%s mode=%s testid=%s\n' "$item" "$ACTORS" "$profile" "$mode" "$testid"
  started_ms=$(date +%s%3N)
  bash load/resource-sampler.sh --project "$PROJECT" --duration "${SCENARIO_SAMPLER_MAX_SECONDS:-14400}" --out "$RESULTS/resources-$testid.csv" > /dev/null 2>&1 & sampler_pid=$!
  if [[ "$item" == resilience ]]; then fault_sequence & fault_pid=$!; fi
  docker compose run --rm --no-deps --name "$container" "${args[@]}" k6 run \
    --tag "testid=$testid" --tag "load_scenario=$item" --tag "population=$ACTORS" --tag "run_mode=$mode" --tag "env=$ENV_LABEL" --tag "rep=$REP" \
    --out experimental-prometheus-rw --summary-export "/results/$item-$testid-summary.json" "/load/$script.js" > "$RESULTS/$item-$testid.log" 2>&1 || status=$?
  ended_ms=$(date +%s%3N)
  stop_sampler
  container=''
  if [[ -n "$fault_pid" ]]; then
    wait "$fault_pid" || { echo 'Fault injection failed; this is not an accepted resilience run.'; status=1; }
    fault_pid=''; restore || return 1
  fi
  chmod 600 "$RESULTS/$item-$testid.log" "$RESULTS/$item-$testid-summary.json" 2>/dev/null || true
  if grep -Fq 'Failed to send the time series data to the endpoint' "$RESULTS/$item-$testid.log"; then status=1; fi
  tail -n 48 "$RESULTS/$item-$testid.log"
  # Informative validity of the load generator; it never changes the k6 or check exit status.
  node load/check-generator-guard.mjs --resources "$RESULTS/resources-$testid.csv" --summary "$RESULTS/$item-$testid-summary.json" --log "$RESULTS/$item-$testid.log" > "$RESULTS/guard-$testid.json" 2>/dev/null || guard_status=$?
  if [[ "$guard_status" != 0 && "$guard_status" != 3 ]] || ! node -e "const g=JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8'));if(typeof g.valid!=='boolean')process.exit(1)" "$RESULTS/guard-$testid.json" 2>/dev/null; then
    printf '{"valid":false,"reasons":["GUARD_FAILED: el validador del generador no produjo resultado (exit %s)"]}\n' "$guard_status" > "$RESULTS/guard-$testid.json"
  fi
  chmod 600 "$RESULTS/guard-$testid.json" "$RESULTS/resources-$testid.csv" 2>/dev/null || true
  audit > "$RESULTS/audit-$testid.json" || return 1
  helper check "audit-$testid.json" "$item" "$testid" "$status" "$mode" "$started_ms" "$ended_ms" "guard-$testid.json" || check_status=$?
  printf 'Grafana: http://127.0.0.1:%s/d/sum-simulator-k6?var-testid=%s&from=%s&to=%s\n' "${SIMULATOR_GRAFANA_PORT:-5190}" "$testid" "$((started_ms - 15000))" "$((ended_ms + 15000))"
  if [[ "$status" != 0 || "$check_status" != 0 ]]; then return 1; fi
}
status=0
items_all=(login race last-seat ample mixed multi-uniform multi-hotspot retry resilience stress soak reads)
if [[ "$ORDER" == shuffle && -z "$SEED" ]]; then SEED=$(( ((RANDOM << 15) | RANDOM) % 900000000 )); fi
ORDER_SEED=''
for (( rep_index = 1; rep_index <= REPEATS; rep_index++ )); do
  if (( REPEATS > 1 )); then REP=$rep_index; fi
  if [[ "$scenario" == all ]]; then items=("${items_all[@]}"); else items=("$scenario"); fi
  if [[ "$ORDER" == shuffle && ${#items[@]} -gt 1 ]]; then
    ORDER_SEED=$(( SEED + rep_index - 1 ))
    mapfile -t items < <(shuffle_items "$ORDER_SEED" "${items[@]}")
    printf 'Order=shuffle seed=%s rep=%s: %s\n' "$ORDER_SEED" "$REP" "${items[*]}"
  fi
  for item in "${items[@]}"; do
    run_one "$item" || status=1
  done
done
exit "$status"
