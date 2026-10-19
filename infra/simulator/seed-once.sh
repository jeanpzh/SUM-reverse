#!/bin/sh
set -eu
marker="/runtime/seeded-${SIMULATOR_CAMPAIGN_ID}"
if [ -f "$marker" ]; then
  echo "Synthetic campaign already seeded"
  exit 0
fi
node /app/backend/dist/scripts/seed-simulator.js
umask 077
printf '%s\n' "$SIMULATOR_CAMPAIGN_ID" > "${marker}.tmp"
mv "${marker}.tmp" "$marker"
chmod 600 "$marker"
