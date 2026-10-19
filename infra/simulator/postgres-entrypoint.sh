#!/bin/sh
set -eu
. /opt/simulator/load-runtime-env.sh
export POSTGRES_DB=sum_simulator_synthetic POSTGRES_USER=simulator POSTGRES_PASSWORD="$SIMULATOR_DB_PASSWORD"
exec /usr/local/bin/docker-entrypoint.sh "$@"
