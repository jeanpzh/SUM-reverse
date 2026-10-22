#!/bin/sh
# Stack with compose.perf.yaml (pg_stat_statements) and unpinned cpusets; sudo drops the caller's env, so pass it explicitly.
# PERF_* / SIMULATOR_DB_POOL_MAX / COMPOSE_FILE can be overridden by the caller (E4 cpusets, E5 pool, E14 nginx override).
exec sudo -n /usr/bin/env COMPOSE_FILE="${PERF_COMPOSE_FILE:-compose.simulator.yaml:compose.perf.yaml}" PERF_CPUSET_K6="${PERF_CPUSET_K6:-0-1}" PERF_CPUSET_POSTGRES="${PERF_CPUSET_POSTGRES:-0-1}" PERF_CPUSET_API_A="${PERF_CPUSET_API_A:-0-1}" PERF_CPUSET_API_B="${PERF_CPUSET_API_B:-0-1}" PERF_CPUSET_WEB="${PERF_CPUSET_WEB:-0-1}" SIMULATOR_DB_POOL_MAX="${SIMULATOR_DB_POOL_MAX:-12}" /usr/bin/docker "$@"
