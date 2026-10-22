#!/usr/bin/env bash
# PostgreSQL diagnostics for the owned synthetic simulator (P1-04); never targets SUM or private snapshots.
# Run `reset` before a load and `dump`/`fsync` after it; artifacts are suffixed with the testid.
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

usage() {
  cat <<'USAGE'
Usage: bash load/pg-diagnostics.sh <reset|dump|fsync> [options]

  reset                   CREATE EXTENSION IF NOT EXISTS pg_stat_statements + pg_stat_statements_reset().
                          Run it before the load. Add --stats to also run pg_stat_reset().
  dump  --testid <id>     After the load: pg-top-<id>.csv, pg-explain-<id>.txt and pg-fsync-<id>.txt.
  fsync --testid <id>     Only pg-fsync-<id>.txt (pg_test_fsync inside the PostgreSQL container).

Options:
  --testid <id>           Artifact suffix, [A-Za-z0-9._-]{1,64} (required for dump and fsync).
  --container <name>      Use `docker exec <name>` instead of the Compose service (disposable PostgreSQL).
  --top <N>               Statements in the top-N CSV, 1..200 (default 25).
  --fsync-seconds <S>     Seconds per pg_test_fsync test (-s), 1..60 (default 2).
  --stats                 reset only: also run pg_stat_reset().
  -h, --help              This help.

Environment:
  RESULTS                 Output directory (default infra/simulator/runtime/results).
  PG_DIAG_DOCKER          Docker command (default $DOCKER_CMD or `sudo -n docker`).
  PG_DIAG_COMPOSE_ARGS    Extra `docker compose` arguments, for example `-f compose.simulator.yaml -f compose.perf.yaml`.
  COMPOSE_PROJECT_NAME    Compose project (default sum-simulator).
  SIMULATOR_CAMPAIGN_ID   Campaign for the EXPLAIN queries (default: manifest campaignId).
  SIMULATOR_MANIFEST      Manifest with a synthetic actor (default infra/simulator/runtime/manifest.json).

The Compose stack must run with compose.perf.yaml (pg_stat_statements in shared_preload_libraries).
Exit codes: 0 ok, 1 failure, 2 usage.
USAGE
}
die_usage() { echo "$1" >&2; echo "Try: bash load/pg-diagnostics.sh --help" >&2; exit 2; }

cmd=${1:-}
case "$cmd" in -h|--help) usage; exit 0 ;; reset|dump|fsync) shift ;; '') usage >&2; exit 2 ;; *) die_usage "Unknown subcommand: $cmd" ;; esac
testid=''; container=''; top=25; fsync_seconds=2; stats=0
while (( $# )); do
  case "$1" in
    --testid) [[ $# -ge 2 ]] || die_usage '--testid needs a value'; testid=$2; shift 2 ;;
    --container) [[ $# -ge 2 ]] || die_usage '--container needs a value'; container=$2; shift 2 ;;
    --top) [[ $# -ge 2 ]] || die_usage '--top needs a value'; top=$2; shift 2 ;;
    --fsync-seconds) [[ $# -ge 2 ]] || die_usage '--fsync-seconds needs a value'; fsync_seconds=$2; shift 2 ;;
    --stats) stats=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die_usage "Unknown option: $1" ;;
  esac
done
if [[ "$cmd" != reset ]] && ! [[ "$testid" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then die_usage '--testid is required and must match [A-Za-z0-9._-]{1,64}'; fi
if ! [[ "$top" =~ ^[0-9]{1,3}$ ]] || (( 10#$top < 1 || 10#$top > 200 )); then die_usage '--top must be 1..200'; fi
if ! [[ "$fsync_seconds" =~ ^[0-9]{1,2}$ ]] || (( 10#$fsync_seconds < 1 || 10#$fsync_seconds > 60 )); then die_usage '--fsync-seconds must be 1..60'; fi
if [[ -n "$container" ]] && ! [[ "$container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]; then die_usage '--container has an invalid name'; fi
top=$((10#$top)); fsync_seconds=$((10#$fsync_seconds))

RESULTS=${RESULTS:-infra/simulator/runtime/results}
PROJECT=${COMPOSE_PROJECT_NAME:-sum-simulator}
read -r -a DOCKER <<< "${PG_DIAG_DOCKER:-${DOCKER_CMD:-sudo -n docker}}"
read -r -a COMPOSE_EXTRA <<< "${PG_DIAG_COMPOSE_ARGS:-}"
DB=sum_simulator_synthetic
DBUSER=simulator

# Run a command inside the PostgreSQL container (Compose service or a named container); stdin is forwarded.
pgexec() {
  if [[ -n "$container" ]]; then "${DOCKER[@]}" exec -i "$container" "$@"
  else "${DOCKER[@]}" compose -p "$PROJECT" ${COMPOSE_EXTRA[@]+"${COMPOSE_EXTRA[@]}"} exec -T postgres "$@"; fi
}
psql_run() { pgexec psql -U "$DBUSER" -d "$DB" -X -q -v ON_ERROR_STOP=1 "$@"; }

require_preload() {
  local libs
  libs=$(psql_run -At -c 'SHOW shared_preload_libraries') || { echo 'Cannot reach PostgreSQL; check the stack or --container.' >&2; exit 1; }
  if [[ ",${libs// /}," != *,pg_stat_statements,* ]]; then
    echo 'pg_stat_statements is not in shared_preload_libraries; start PostgreSQL with compose.perf.yaml (docker compose -f compose.simulator.yaml -f compose.perf.yaml up -d).' >&2
    exit 1
  fi
}

# Placeholders replace the campaign/run/actor/session ids in every artifact; anything id-like left over fails the dump.
UUID_RE='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
B64_RE='(^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{43}([^A-Za-z0-9_-]|$)'
SYN_RE='SYN-[A-Za-z0-9]'
sanitize_file() {
  local file=$1 pair name value escaped
  for pair in "campaign:${campaign_id:-}" "run:${run_id:-}" "actor:${actor_id:-}" "session:${probe_session:-}"; do
    name=${pair%%:*}; value=${pair#*:}
    if [[ -n "$value" ]]; then
      escaped=$(printf '%s' "$value" | sed 's/[][\.*^$/]/\\&/g')
      sed -i "s/$escaped/<$name>/Ig" "$file"
    fi
  done
  if grep -Eq "$B64_RE|$UUID_RE|$SYN_RE" "$file"; then
    rm -f "$file"
    echo "Sanitization failed: $(basename "$file") held an id-like or credential-like string; the artifact was deleted." >&2
    exit 1
  fi
}
finalize() { # finalize <tmpfile> <final>
  sanitize_file "$1"
  mv -f "$1" "$2"
  echo "wrote $2"
}

read_manifest() { # prints the campaignId and the first actorId only; credentials are never read or printed
  local manifest=${SIMULATOR_MANIFEST:-infra/simulator/runtime/manifest.json}
  [[ -f "$manifest" ]] || { echo "Manifest not found: $manifest (set SIMULATOR_MANIFEST)." >&2; exit 1; }
  node -e "const m=JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8'));const a=Array.isArray(m.actors)&&m.actors[0];process.stdout.write((m.campaignId||'-')+' '+((a&&a.actorId)||'-'))" "$manifest"
}

do_reset() {
  require_preload
  psql_run -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements' -c 'SELECT pg_stat_statements_reset() IS NOT NULL AS statements_reset' >/dev/null
  if (( stats )); then psql_run -c 'SELECT pg_stat_reset()' >/dev/null; fi
  echo "pg_stat_statements reset$( if (( stats )); then echo ' and pg_stat_reset()'; fi ) on $DB"
}

dump_top() {
  local tmp="$RESULTS/pg-top-$testid.csv.tmp"
  psql_run -c "COPY (SELECT calls, round(total_exec_time::numeric,3) AS total_exec_time_ms, round(mean_exec_time::numeric,3) AS mean_exec_time_ms, round(max_exec_time::numeric,3) AS max_exec_time_ms, rows, shared_blks_hit, shared_blks_read, wal_bytes, left(regexp_replace(query, '\\s+', ' ', 'g'), 2000) AS query FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND query NOT ILIKE '%pg_stat_statements%' ORDER BY total_exec_time DESC LIMIT $top) TO STDOUT WITH CSV HEADER" > "$tmp"
  finalize "$tmp" "$RESULTS/pg-top-$testid.csv"
}

# The nine statements below are copied from backend/src/persistence/postgres-enrollment.store.ts:
#   Q1-Q7 loadRunState (actors, profiles, sections, academic sessions, requests, enrollments, reports),
#   Q8 the campaign SELECT (loadSnapshot) and Q9 the academic-session check (submit path).
# Parameters $1/$2/$3 became psql variables :'campaign', :'actor', :'session'. The text can drift if the store changes:
# re-check it against the store whenever loadRunState, loadSnapshot or the session check is edited.
dump_explain() {
  local tmp="$RESULTS/pg-explain-$testid.txt.tmp"
  {
    printf '\\set campaign %s\n\\set actor %s\n\\set session %s\n' "'$campaign_id'" "'$actor_id'" "'$probe_session'"
    cat <<'SQL'
\pset pager off
\echo # EXPLAIN (ANALYZE, BUFFERS) of the store queries; ids are placeholders, the session is a synthetic non-existent value.
BEGIN;
SET LOCAL statement_timeout = '5s';
\echo
\echo ## Q1 loadRunState actors
EXPLAIN (ANALYZE, BUFFERS) SELECT profile FROM simulator_actors WHERE campaign_id=:'campaign' AND actor_id=:'actor';
\echo
\echo ## Q2 loadRunState profiles
EXPLAIN (ANALYZE, BUFFERS) SELECT profile FROM simulator_profiles WHERE campaign_id=:'campaign';
\echo
\echo ## Q3 loadRunState sections
EXPLAIN (ANALYZE, BUFFERS) SELECT course,section_id,capacity,occupied,section FROM simulator_sections WHERE campaign_id=:'campaign' ORDER BY course_id,section_id;
\echo
\echo ## Q4 loadRunState academic sessions
EXPLAIN (ANALYZE, BUFFERS) SELECT session_id,started_at,expires_at FROM simulator_academic_sessions WHERE campaign_id=:'campaign' AND actor_id=:'actor';
\echo
\echo ## Q5 loadRunState requests
EXPLAIN (ANALYZE, BUFFERS) SELECT request_id,payload,outcome FROM simulator_requests WHERE campaign_id=:'campaign' AND actor_id=:'actor';
\echo
\echo ## Q6 loadRunState enrollments
EXPLAIN (ANALYZE, BUFFERS) SELECT e.enrollment_id,e.request_id,e.profile_revision,e.accepted_at,coalesce(jsonb_agg(jsonb_build_object('courseId',i.course_id,'sectionId',i.section_id) ORDER BY i.course_id) FILTER (WHERE i.course_id IS NOT NULL),'[]') selection FROM simulator_enrollments e LEFT JOIN simulator_enrollment_items i USING(campaign_id,enrollment_id) WHERE e.campaign_id=:'campaign' AND e.actor_id=:'actor' GROUP BY e.campaign_id,e.enrollment_id,e.actor_id,e.request_id,e.profile_revision,e.accepted_at;
\echo
\echo ## Q7 loadRunState reports
EXPLAIN (ANALYZE, BUFFERS) SELECT r.enrollment_id,r.report FROM simulator_reports r JOIN simulator_enrollments e USING(campaign_id,enrollment_id) WHERE r.campaign_id=:'campaign' AND e.actor_id=:'actor';
\echo
\echo ## Q8 campaign
EXPLAIN (ANALYZE, BUFFERS) SELECT run_id,status,config FROM simulator_campaigns WHERE campaign_id=:'campaign';
\echo
\echo ## Q9 academic session check
EXPLAIN (ANALYZE, BUFFERS) SELECT 1 FROM simulator_academic_sessions WHERE campaign_id=:'campaign' AND actor_id=:'actor' AND session_id=:'session' AND expires_at>now();
ROLLBACK;
SQL
  } | psql_run > "$tmp"
  finalize "$tmp" "$RESULTS/pg-explain-$testid.txt"
}

do_fsync() {
  local tmp="$RESULTS/pg-fsync-$testid.txt.tmp"
  pgexec sh -c '
    bin=$(command -v pg_test_fsync 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_test_fsync /usr/local/bin/pg_test_fsync 2>/dev/null | head -n 1 || true)
    [ -n "$bin" ] || { echo "pg_test_fsync not found in the PostgreSQL image" >&2; exit 1; }
    dir=${PGDATA:-/var/lib/postgresql/data}
    if [ ! -d "$dir" ] || [ ! -w "$dir" ]; then dir=/tmp; fi
    file="$dir/pg_diag_fsync.$$"
    trap "rm -f \"$file\"" EXIT
    echo "pg_test_fsync -s $1 on the volume holding $dir"
    "$bin" -f "$file" -s "$1"
  ' sh "$fsync_seconds" > "$tmp"
  finalize "$tmp" "$RESULTS/pg-fsync-$testid.txt"
}

mkdir -p "$RESULTS"
cleanup() { rm -f "$RESULTS/pg-top-${testid:-_}.csv.tmp" "$RESULTS/pg-explain-${testid:-_}.txt.tmp" "$RESULTS/pg-fsync-${testid:-_}.txt.tmp" 2>/dev/null || true; }
trap cleanup EXIT

case "$cmd" in
  reset) do_reset ;;
  fsync) do_fsync ;;
  dump)
    require_preload
    manifest_out=$(read_manifest)
    campaign_id=${SIMULATOR_CAMPAIGN_ID:-${manifest_out%% *}}
    actor_id=${manifest_out#* }
    [[ "$campaign_id" =~ ^[0-9a-fA-F-]{36}$ ]] || { echo 'No valid campaign id (SIMULATOR_CAMPAIGN_ID or manifest campaignId).' >&2; exit 1; }
    [[ "$actor_id" =~ ^[A-Za-z0-9._-]{1,64}$ && "$actor_id" != - ]] || { echo 'The manifest has no usable synthetic actor id.' >&2; exit 1; }
    probe_session=00000000-0000-4000-8000-000000000000
    run_id=$(psql_run -At -c "SELECT run_id FROM simulator_campaigns WHERE campaign_id='$campaign_id'" | head -n 1)
    [[ -z "$run_id" || "$run_id" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || run_id=''
    dump_top
    dump_explain
    do_fsync
    ;;
esac
