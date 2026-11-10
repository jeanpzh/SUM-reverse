#!/usr/bin/env bash
# Only our named isolated fixture, no container discovery or existing services.
set -euo pipefail
case "${1:-start}" in
  start)
    python3 - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 55432))
print('Loopback 55432 is free')
PY
    docker run -d --name sum-rag-b-pgvector \
      --publish 127.0.0.1:55432:5432 \
      --env POSTGRES_USER=rag_test --env POSTGRES_PASSWORD=rag_test_only \
      --env POSTGRES_DB=rag_test pgvector/pgvector:pg16
    ;;
  ready) docker exec sum-rag-b-pgvector pg_isready -U rag_test -d rag_test ;;
  stop) docker stop sum-rag-b-pgvector ;;
  remove) docker rm sum-rag-b-pgvector ;;
  *) echo 'Usage: rag-pgvector-test.sh start|ready|stop|remove' >&2; exit 2 ;;
esac
