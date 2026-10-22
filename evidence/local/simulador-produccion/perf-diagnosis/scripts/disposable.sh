#!/usr/bin/env bash
# P1-06 E3b / E9 on a disposable PostgreSQL (never the stack volume). Runs only when the driver has finished
# (single Docker owner, no concurrent load). Same image digest and diagnostic flags as compose.perf.yaml.
# Usage: bash disposable.sh e3b|e9
#   e3b: bench shared N=400 x3 on a disk-backed anonymous volume, then x3 on tmpfs (fresh container per arm)
#   e9:  fresh container: bench x3 (1-3 campaigns) + EXPLAIN; seed 20 extra campaigns with the same bench; bench x3 + EXPLAIN
set -euo pipefail
S=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
P=$S/p16
REPO=${REPO:-$(pwd)}
OUT=$P/runs-disp
mkdir -p "$OUT"
D=(sudo -n /usr/bin/docker)
IMG_PG='postgres:18.6@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336'
IMG_APP=sum-simulator-migrate:latest
NET=sum-perf-p16
PG=sum-perf-p16-pg
PW=$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
URL="postgres://simulator:$PW@$PG:5432/sum_simulator_synthetic"
mark() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$P/driver.log"; }

start_pg() { # start_pg disk|tmpfs
  local storage
  if [[ $1 == tmpfs ]]; then storage=(--tmpfs /var/lib/postgresql:rw,size=3g); else storage=(-v /var/lib/postgresql); fi
  "${D[@]}" network inspect "$NET" >/dev/null 2>&1 || "${D[@]}" network create "$NET" >/dev/null
  "${D[@]}" run -d --rm --name "$PG" --network "$NET" "${storage[@]}" \
    -e POSTGRES_DB=sum_simulator_synthetic -e POSTGRES_USER=simulator -e POSTGRES_PASSWORD="$PW" \
    "$IMG_PG" postgres -c shared_preload_libraries=pg_stat_statements -c track_io_timing=on -c track_wal_io_timing=on >/dev/null
  for _ in $(seq 60); do "${D[@]}" exec "$PG" pg_isready -U simulator -d sum_simulator_synthetic >/dev/null 2>&1 && break; sleep 1; done
  sleep 2 # the image restarts the server once after initdb
  for _ in $(seq 30); do "${D[@]}" exec "$PG" pg_isready -U simulator -d sum_simulator_synthetic >/dev/null 2>&1 && break; sleep 1; done
  app node dist/scripts/migrate-simulator.js >/dev/null
}
stop_pg() { "${D[@]}" rm -f -v "$PG" >/dev/null 2>&1 || true; }
trap 'stop_pg; "${D[@]}" network rm "$NET" >/dev/null 2>&1 || true' EXIT
app() { "${D[@]}" run --rm --network "$NET" -v "$OUT:/out" -e DATABASE_URL="$URL" -e SIMULATOR_DATA_PROVENANCE=independently-synthetic --entrypoint node "$IMG_APP" "${@:2}"; }
bench() { # bench <label>
  app node dist/scripts/bench-submit.js --actors 400 --profile shared --budget-ms 60000 --out "/out/$1.bench.json" > "$OUT/$1.bench.log" 2>&1 || true
  mark "DONE $1 $(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(`p95=${r.latencyMs.p95} drain=${r.drainMs} tcs=${r.estimatedCriticalSectionMs} acc=${r.accepted}/${r.expectedAccepted} audit=${r.audit.passed}`)' "$OUT/$1.bench.json" 2>/dev/null)"
}
explain() { # explain <label> <bench-label whose campaign is probed>
  local cid manifest=$OUT/.manifest-$1.json
  cid=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).campaignId)' "$OUT/$2.bench.json")
  printf '{"campaignId":"%s","actors":[{"actorId":"probe-actor"}]}\n' "$cid" > "$manifest"
  (cd "$REPO" && RESULTS=$OUT SIMULATOR_MANIFEST=$manifest PG_DIAG_DOCKER=$S/bin-perf/docker bash load/pg-diagnostics.sh dump --container "$PG" --testid "$1" >/dev/null 2>&1) || mark "WARN $1 explain failed"
  rm -f "$manifest" "$OUT/pg-fsync-$1.txt"
  "${D[@]}" exec "$PG" psql -U simulator -d sum_simulator_synthetic -Atc "select json_build_object('campaigns',(select count(*) from simulator_campaigns),'academicSessions',(select count(*) from simulator_academic_sessions),'dbBytes',pg_database_size(current_database()))" > "$OUT/$1.state.json"
}

case "${1:-}" in
  e3b)
    mark "START disposable e3b"
    for arm in disk tmpfs; do # a fresh container per arm; same bench, so the arms differ only in the storage
      start_pg "$arm"
      for r in 1 2 3; do bench "e3b-$arm-r$r"; done
      stop_pg
    done
    mark "END disposable e3b" ;;
  e9)
    mark "START disposable e9"
    start_pg disk
    for r in 1 2 3; do bench "e9-fresh-r$r"; done
    explain e9-fresh e9-fresh-r3
    for i in $(seq 1 20); do app node dist/scripts/bench-submit.js --actors 400 --profile shared --budget-ms 60000 > /dev/null 2>&1 || mark "WARN e9 seed $i failed"; done
    for r in 1 2 3; do bench "e9-retained-r$r"; done
    explain e9-retained e9-retained-r3
    stop_pg
    mark "END disposable e9" ;;
  *) echo 'Usage: disposable.sh e3b|e9' >&2; exit 2 ;;
esac
