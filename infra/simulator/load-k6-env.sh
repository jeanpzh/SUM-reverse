#!/bin/sh
set -eu
if [ "$#" -eq 0 ]; then
  echo 'Pass an explicit k6 command for browser scenarios.' >&2
  exit 2
fi
exec k6 "$@"
