#!/bin/sh
set -eu
CONFIG=/runtime/config.env
if [ ! -f "$CONFIG" ] || [ -L "$CONFIG" ]; then
  echo 'Private simulator runtime config is missing or invalid.' >&2
  exit 1
fi
. "$CONFIG"
