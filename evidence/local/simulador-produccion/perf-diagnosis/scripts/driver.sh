#!/usr/bin/env bash
# P1-06 driver: runs a plan of labelled experiments sequentially (single Docker owner, never two k6 at once).
# Resumable: a run whose marker exists in $OUT/done is skipped. Markers are line-buffered for Monitor.
# Usage: bash driver.sh <plan-file>
#   plan line: <label> <kind> <args...> [KEY=VALUE ...]
#     kind k6:    <scenario> <actors>            -> load/scenarios.sh with warm-up and app rotation
#     kind bench: <bench args...>                -> bench-submit inside the migrate image, APIs stopped
#     kind reads: <rate> <duration>              -> direct reads.js run at a fixed open rate (E8; scenarios.sh has no RATE knob for reads)
#   KEY=VALUE pairs are exported for that run only (SIMULATOR_DB_POOL_MAX, PERF_CPUSET_*, PERF_COMPOSE_FILE, SCENARIO_QUICK, EXPORTER=stopped).
set -uo pipefail
S=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
P=$S/p16
REPO=${REPO:-$(pwd)}
OUT=$P/runs
mkdir -p "$OUT/done"
export PATH=$S/bin-perf:$PATH PG_DIAG_DOCKER=$S/bin-perf/docker
plan=$(realpath "$1")
cd "$REPO"
mark() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$P/driver.log"; }

psql_q() { docker compose exec -T postgres psql -U simulator -d sum_simulator_synthetic -Atc "$1"; }
state() { # initial-state control (strategy §8.2): retained campaigns and table sizes before each run
  psql_q "select json_build_object('campaigns',(select count(*) from simulator_campaigns),'academicSessions',(select count(*) from simulator_academic_sessions),'sessions',(select count(*) from simulator_sessions),'requests',(select count(*) from simulator_requests),'enrollments',(select count(*) from simulator_enrollments),'httpMetricsRows',(select count(*) from simulator_http_metrics),'dbBytes',pg_database_size(current_database()))"
}
config() { # effective config of the SUT containers for this run (sudo drops env, so verify instead of trusting the request)
  for c in postgres api-a api-b k6; do
    docker inspect "sum-simulator-$c-1" --format "$c cpuset={{.HostConfig.CpusetCpus}} {{range .Config.Env}}{{if eq (index (split . \"=\") 0) \"SIMULATOR_DB_POOL_MAX\"}}{{.}}{{end}}{{end}} state={{.State.Status}}" 2>/dev/null
  done
  docker inspect sum-simulator-metrics-exporter-1 --format 'exporter state={{.State.Status}}' 2>/dev/null
}

run_k6() {
  local label=$1 scenario=$2 actors=$3 line status=0
  docker compose up -d --wait --no-deps postgres >/dev/null 2>&1 # applies cpuset changes (E4) and restores them afterwards
  if [[ "${EXPORTER:-}" == stopped ]]; then docker compose stop metrics-exporter >/dev/null 2>&1; else docker compose up -d --no-deps metrics-exporter >/dev/null 2>&1; fi
  bash load/pg-diagnostics.sh reset >/dev/null 2>&1 || mark "WARN $label pg reset failed"
  SCENARIO_ACTORS=$actors SCENARIO_ENV=H SCENARIO_BUILD=0 SIMULATOR_RECREATE=app SCENARIO_WARMUP=1 \
    bash load/scenarios.sh "$scenario" > "$OUT/$label.log" 2>&1 || status=$?
  config > "$OUT/$label.config"
  line=$(grep -E '^\{"scenario":' "$OUT/$label.log" | tail -1)
  if [[ -z "$line" ]]; then mark "FAIL $label exit=$status (no result line)"; return 1; fi
  printf '%s\n' "$line" > "$OUT/$label.result.json"
  local start end tid
  read -r start end tid < <(node -e 'const r=JSON.parse(process.argv[1]);console.log(r.startedAtMs,r.endedAtMs,r.testid)' "$line")
  sleep 25 # one exporter poll (2 s) plus two scrapes (5 s) after the end, with margin
  node "$P/capture.mjs" "$start" "$end" "$OUT/$label.server.json" 20 > /dev/null || mark "WARN $label capture failed"
  RESULTS=$OUT bash load/pg-diagnostics.sh dump --testid "$label" --fsync-seconds 1 > /dev/null 2>&1 || mark "WARN $label pg dump failed"
  rm -f "$OUT/pg-fsync-$label.txt" # fsync is measured once per session (E3), not per run
  printf '%s\n' "$tid" > "$OUT/$label.testid"
  mark "DONE $label exit=$status $(node -e 'const r=JSON.parse(process.argv[1]);console.log(`valid=${r.runValid} passed=${r.passed} acc=${r.actual.enrollments}/${r.expected.enrollments}`)' "$line")"
}

run_bench() {
  local label=$1; shift
  docker compose stop api-a api-b metrics-exporter >/dev/null 2>&1
  local status=0
  docker compose run --rm --no-deps migrate node dist/scripts/bench-submit.js "$@" --out "/runtime/results/bench-p16-$label.json" > "$OUT/$label.bench.log" 2>&1 || status=$?
  cp "infra/simulator/runtime/results/bench-p16-$label.json" "$OUT/$label.bench.json" 2>/dev/null || sudo -n cat "infra/simulator/runtime/results/bench-p16-$label.json" > "$OUT/$label.bench.json"
  mark "DONE $label exit=$status $(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(`p95=${r.latencyMs.p95} sps=${r.submitsPerSecond} acc=${r.accepted}/${r.expectedAccepted} audit=${r.audit.passed}`)' "$OUT/$label.bench.json" 2>/dev/null)"
}

run_reads() {
  local label=$1 rate=$2 duration=$3 status=0
  docker compose up -d --wait --no-deps api-a api-b metrics-exporter >/dev/null 2>&1
  local start end
  start=$(date +%s%3N)
  docker compose run --rm --no-deps --name "sum-load-p16-$label" -e SCENARIO_NAME=reads -e SCENARIO_RUN_MODE=normal -e RATE="$rate" -e DURATION="$duration" -e RAMP_10_DURATION=5s -e RAMP_25_DURATION=5s k6 run \
    --tag "testid=p16-$label" --tag load_scenario=reads --tag env=H --summary-export "/results/reads-p16-$label-summary.json" /load/reads.js > "$OUT/$label.log" 2>&1 || status=$?
  end=$(date +%s%3N)
  cp "infra/simulator/runtime/results/reads-p16-$label-summary.json" "$OUT/$label.summary.json" 2>/dev/null || sudo -n cat "infra/simulator/runtime/results/reads-p16-$label-summary.json" > "$OUT/$label.summary.json"
  printf '{"startedAtMs":%s,"endedAtMs":%s,"k6Exit":%s,"rate":%s}\n' "$start" "$end" "$status" "$rate" > "$OUT/$label.result.json"
  config > "$OUT/$label.config"
  sleep 25
  node "$P/capture.mjs" "$start" "$end" "$OUT/$label.server.json" 20 > /dev/null || mark "WARN $label capture failed"
  mark "DONE $label exit=$status rate=$rate"
}

mark "START plan=$(basename "$plan") head=$(/usr/bin/git rev-parse --short HEAD)"
while read -r label kind rest <&3; do
  [[ -z "${label:-}" || "$label" == \#* ]] && continue
  if [[ -f "$OUT/done/$label" ]]; then continue; fi
  read -r -a words <<< "$rest"
  args=(); envs=()
  for w in "${words[@]}"; do if [[ "$w" =~ ^[A-Z_][A-Z0-9_]*= ]]; then envs+=("$w"); else args+=("$w"); fi; done
  printf '%s\n' "$(state)" > "$OUT/$label.state.json"
  mark "BEGIN $label $kind ${args[*]} ${envs[*]}"
  ok=0
  case "$kind" in
    k6) ( for e in "${envs[@]}"; do export "$e"; done; run_k6 "$label" "${args[@]}" ) && ok=1 ;;
    bench) ( for e in "${envs[@]}"; do export "$e"; done; run_bench "$label" "${args[@]}" ) && ok=1 ;;
    reads) ( for e in "${envs[@]}"; do export "$e"; done; run_reads "$label" "${args[@]}" ) && ok=1 ;;
    *) mark "SKIP $label unknown kind $kind" ;;
  esac
  if (( ok )); then touch "$OUT/done/$label"; fi
done 3< "$plan"
# Leave the default configuration (pool 12, unpinned, exporter on, both APIs) for the next plan.
docker compose up -d --wait --no-deps postgres api-a api-b metrics-exporter >/dev/null 2>&1
mark "END plan=$(basename "$plan")"
