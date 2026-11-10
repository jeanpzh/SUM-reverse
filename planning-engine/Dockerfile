FROM ghcr.io/astral-sh/uv:0.11.15 AS uv
FROM python:3.12-slim-bookworm
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app/planning-engine
ENV PYTHONUNBUFFERED=1 AWS_EC2_METADATA_DISABLED=true
RUN useradd --uid 10001 --create-home planner && chown planner:planner /app/planning-engine
USER planner
COPY --chown=planner:planner planning-engine/pyproject.toml planning-engine/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project --no-cache
COPY --chown=planner:planner planning-engine/*.py ./
COPY --chown=planner:planner planning-engine/normative-corpus ./normative-corpus
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s CMD ["/app/planning-engine/.venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3220/health', timeout=2)"]
CMD ["/app/planning-engine/.venv/bin/uvicorn", "main:app", "--host", "127.0.0.1", "--port", "3220"]
