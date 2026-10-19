#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
EXPECTED=${1:-10}
EXPECTED_REQUESTS=${2:-$EXPECTED}
cd "$ROOT"
docker compose --profile audit run --rm --no-deps -e EXPECTED_ENROLLMENTS="$EXPECTED" -e EXPECTED_REQUESTS="$EXPECTED_REQUESTS" audit
