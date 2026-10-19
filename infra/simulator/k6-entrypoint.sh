#!/bin/sh
set -eu
if [ "$#" -gt 0 ]; then
  exec k6 "$@"
fi
testid=$(cat /proc/sys/kernel/random/uuid)
printf 'k6 testid=%s\nGrafana: http://127.0.0.1:%s/d/sum-simulator-k6/sum-simulator-k6?var-testid=%s\n' "$testid" "${SIMULATOR_GRAFANA_PORT:-5190}" "$testid"
log="/results/enrollment-$testid.log"
summary="/results/enrollment-$testid-summary.json"
set +e
k6 run --tag "testid=$testid" --out experimental-prometheus-rw \
  --summary-export "$summary" /load/enrollment.js > "$log" 2>&1
status=$?
set -e
chmod 600 "$log" "$summary" 2>/dev/null || true
cat "$log"
if grep -Fq 'Failed to send the time series data to the endpoint' "$log" && [ "$status" -eq 0 ]; then
  status=1
  echo 'Prometheus remote-write failed; this run is not available for Grafana.' >&2
fi
exit "$status"
