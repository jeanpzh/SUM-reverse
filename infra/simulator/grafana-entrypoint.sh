#!/bin/sh
set -eu
. /opt/simulator/load-runtime-env.sh
export GF_SECURITY_ADMIN_USER=simulator-admin GF_SECURITY_ADMIN_PASSWORD="$GRAFANA_ADMIN_PASSWORD"
exec /run.sh
