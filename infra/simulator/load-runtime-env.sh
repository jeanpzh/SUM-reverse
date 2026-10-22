#!/bin/sh
set -eu
CONFIG=/runtime/config.env
if [ ! -f "$CONFIG" ] || [ -L "$CONFIG" ]; then
  echo 'Private simulator runtime config is missing or invalid.' >&2
  exit 1
fi
. "$CONFIG"
# The sourced config.env only sets shell variables; the seed parses SIMULATOR_FISI_* from its process environment.
for fisi_name in SIMULATOR_FISI_FRANJA SIMULATOR_FISI_IA_ACTORS SIMULATOR_FISI_CAPACITY SIMULATOR_FISI_SCARCE_RATIO; do
  if eval "[ -n \"\${$fisi_name+x}\" ]"; then export "$fisi_name"; fi
done
unset fisi_name
