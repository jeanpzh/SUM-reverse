#!/bin/sh
set -u
umask 077
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RESULTS="$ROOT/infra/simulator/runtime/results"
if [ "$#" -lt 1 ]; then echo 'Usage: load/run-observed.sh reads|enrollment|recovery|browser [k6 arguments...]' >&2; exit 2; fi
scenario=$1
shift
case "$scenario" in
  reads|enrollment|recovery) service=k6; profile=load ;;
  browser) service=k6-browser; profile=browser ;;
  *) echo 'Unknown scenario. Use reads, enrollment, recovery, or browser.' >&2; exit 2 ;;
esac
if [ ! -f "$ROOT/infra/simulator/runtime/config.env" ]; then echo 'Start the stack with: docker compose up --build -d' >&2; exit 2; fi
testid=${OBSERVABILITY_TEST_ID:-}
if [ -z "$testid" ]; then testid=$(cat /proc/sys/kernel/random/uuid) || exit 2; fi
if ! printf '%s\n' "$testid" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'; then echo 'OBSERVABILITY_TEST_ID must be 1-64 letters, digits, underscores, or hyphens.' >&2; exit 2; fi
if ! docker compose exec -T grafana wget -q -O /dev/null http://127.0.0.1:3000/api/health >/dev/null 2>&1; then echo 'Grafana is not ready; start the full stack before running k6.' >&2; exit 2; fi
mkdir -p "$RESULTS"
chmod 700 "$ROOT/infra/simulator/runtime" "$RESULTS"
summary="$RESULTS/$scenario-$testid-summary.json"
log="$RESULTS/$scenario-$testid.log"
if [ -e "$summary" ] || [ -e "$log" ]; then echo 'This testid already has local result files; choose a fresh OBSERVABILITY_TEST_ID.' >&2; exit 2; fi
case "$scenario" in
  reads) script=/load/reads.js ;;
  enrollment) script=/load/enrollment.js ;;
  recovery) script=/load/recovery.js ;;
  browser) script=/load/browser.js ;;
esac
set +e
docker compose --profile "$profile" run --rm "$service" run --tag "testid=$testid" --out experimental-prometheus-rw --summary-export "/results/$scenario-$testid-summary.json" "$@" "$script" > "$log" 2>&1
status=$?
set -e
remote_write_failed=0
if grep -Fq 'Failed to send the time series data to the endpoint' "$log"; then remote_write_failed=1; if [ "$status" -eq 0 ]; then status=1; fi; fi
if [ -f "$summary" ]; then chmod 600 "$summary"; fi
if [ -f "$log" ]; then chmod 600 "$log"; fi
printf 'testid=%s scenario=%s exit=%s summary=%s\n' "$testid" "$scenario" "$status" "$summary"
if [ "$status" -eq 99 ]; then echo 'k6 thresholds failed; the result remains in the private results directory.'; elif [ "$status" -ne 0 ]; then echo 'k6 failed; inspect the private run log for details.'; fi
if [ "$remote_write_failed" -eq 1 ]; then echo 'Prometheus remote-write failed; this run is not available for Grafana acceptance.'; fi
exit "$status"
