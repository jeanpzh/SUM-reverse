#!/usr/bin/env bash
# Samples CPU and memory of the containers of ONE Compose project into a CSV.
#
# Usage: load/resource-sampler.sh --project <name> --duration <s> --out <csv> [--interval <s>]
#   --project   Compose project (default sum-simulator); only its containers are sampled.
#   --duration  Seconds to sample (required, positive integer).
#   --interval  Seconds between ticks (default 1).
#   --out       CSV path (required; an existing file is never overwritten; created 0600).
# Env: DOCKER_CMD (default "docker"; use "sudo -n docker" where docker needs sudo).
#
# CSV columns: timestamp_ms,container,cpu_percent,mem_bytes
#   cpu_percent is docker's value without "%" (100 = one full core).
#   If /proc/pressure/cpu exists, each tick also appends one row with container
#   __host_psi_cpu_some_avg10, the "some avg10" value in cpu_percent and an empty mem_bytes.
# Only container names and numbers are recorded; no actor IDs, credentials, URLs or cookies.
set -euo pipefail
umask 077

usage() { echo 'Usage: load/resource-sampler.sh --project <name> --duration <seconds> --out <csv> [--interval <seconds>]' >&2; exit 2; }

project=sum-simulator
duration=
interval=1
out=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --project) [ "$#" -ge 2 ] || usage; project=$2; shift 2 ;;
    --duration) [ "$#" -ge 2 ] || usage; duration=$2; shift 2 ;;
    --interval) [ "$#" -ge 2 ] || usage; interval=$2; shift 2 ;;
    --out) [ "$#" -ge 2 ] || usage; out=$2; shift 2 ;;
    *) usage ;;
  esac
done
[[ "$duration" =~ ^[1-9][0-9]*$ ]] || { echo '--duration must be a positive integer.' >&2; usage; }
[[ "$interval" =~ ^[1-9][0-9]*$ ]] || { echo '--interval must be a positive integer.' >&2; usage; }
[[ "$project" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || { echo '--project has an invalid name.' >&2; usage; }
[ -n "$out" ] || usage
if [ -e "$out" ]; then echo 'Refusing to overwrite an existing output file.' >&2; exit 2; fi

read -r -a docker_cmd <<< "${DOCKER_CMD:-docker}"

# Create exclusively (noclobber) with mode 0600 and write the header.
( set -o noclobber; printf 'timestamp_ms,container,cpu_percent,mem_bytes\n' > "$out" )
chmod 600 "$out"

stop=0
warned=0
sleep_pid=
trap 'stop=1; if [ -n "$sleep_pid" ]; then kill "$sleep_pid" 2>/dev/null || true; fi' INT TERM

mem_to_bytes() {
  awk -v s="$1" 'BEGIN {
    if (match(s, /^[0-9.]+/) == 0) { exit }
    n = substr(s, 1, RLENGTH) + 0; u = substr(s, RLENGTH + 1)
    split("B 1 kB 1000 KB 1000 KiB 1024 MB 1000000 MiB 1048576 GB 1000000000 GiB 1073741824 TB 1000000000000 TiB 1099511627776", p, " ")
    for (i = 1; i < 21; i += 2) if (p[i] == u) { printf "%.0f", n * p[i + 1]; exit }
  }'
}

end=$(( $(date +%s) + duration ))
while [ "$stop" -eq 0 ] && [ "$(date +%s)" -lt "$end" ]; do
  ts=$(date +%s%3N)
  tick_start=$(date +%s)
  names=()
  while IFS= read -r line; do
    if [ -n "$line" ]; then names+=("$line"); fi
  done < <("${docker_cmd[@]}" ps --filter "label=com.docker.compose.project=$project" --format '{{.Names}}' 2>/dev/null || true)
  if [ "${#names[@]}" -eq 0 ] && [ "$warned" -eq 0 ] && ! "${docker_cmd[@]}" ps -q >/dev/null 2>&1; then
    echo 'Warning: docker is not reachable with DOCKER_CMD; no container rows will be recorded.' >&2
    warned=1
  fi
  if [ "${#names[@]}" -gt 0 ]; then
    stats=$("${docker_cmd[@]}" stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' "${names[@]}" 2>/dev/null || true)
    while IFS='|' read -r name cpu mem; do
      [ -n "$name" ] || continue
      cpu=${cpu%\%}
      bytes=$(mem_to_bytes "${mem%% / *}")
      printf '%s,%s,%s,%s\n' "$ts" "$name" "$cpu" "$bytes" >> "$out"
    done <<< "$stats"
  fi
  if [ -r /proc/pressure/cpu ]; then
    psi=$(sed -n 's/^some .*avg10=\([0-9.]*\).*/\1/p' /proc/pressure/cpu | head -n 1)
    if [ -n "$psi" ]; then printf '%s,__host_psi_cpu_some_avg10,%s,\n' "$ts" "$psi" >> "$out"; fi
  fi
  [ "$stop" -eq 0 ] || break
  # Compensate for the time spent sampling so the real period stays close to --interval.
  pause=$(( interval - ($(date +%s) - tick_start) ))
  if [ "$pause" -gt 0 ]; then
    sleep "$pause" &
    sleep_pid=$!
    wait "$sleep_pid" || true
    sleep_pid=
  fi
done
exit 0
