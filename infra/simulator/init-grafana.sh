#!/bin/sh
set -eu
mkdir -p /var/lib/grafana
if [ -L /var/lib/grafana ]; then
  echo 'Grafana data path must not be a symlink.' >&2
  exit 1
fi
chown -R 1000:1000 /var/lib/grafana
chmod 700 /var/lib/grafana
