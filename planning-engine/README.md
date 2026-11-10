# Academic planning advisor — PA-ADVISOR-2

Independent local product implementation, based on the fixed first section of
`../plans/academic-planning-ai-advisor.md`. No SUM production evidence or private
snapshots are used. Existing student interfaces and design direction A/B/C are
outside this worker's write scope.

## Runtime

`uv run --directory planning-engine uvicorn main:app --host 127.0.0.1 --port 3220`
starts the local engine. Provide only independently synthetic resources to it.
Configuration is inherited from the operator's process; dotenv is never loaded.
No live provider invocation was performed during implementation.

- `SUM_LLM_PROVIDER=bedrock_converse`: `SUM_LLM_MODEL` (default
  `us.amazon.nova-lite-v1:0`), `AWS_REGION`, operator-provided bearer or IAM.
  `AWS_BEARER_TOKEN_BEDROCK_FILE` is read only when the runtime adapter is initialized.
- `SUM_LLM_PROVIDER=ollama`: `SUM_LLM_BASE_URL` (default
  `http://127.0.0.1:11434`), `SUM_LLM_MODEL` (default `llama3.1:8b`).
- `SUM_LLM_PROVIDER=openai`: `SUM_LLM_API_KEY`, optional `SUM_LLM_BASE_URL`,
  `SUM_LLM_MODEL` (default `llama-3.3-70b-versatile`, intended for a configured
  compatible endpoint; select a supported model for OpenAI itself).
- `SUM_LLM_TIMEOUT_MS`: default 8000, clamped to 100–30000 ms. Maximum two
  rounds, four model-requested tool calls, three provider invocations including
  finalization. A real deterministic selection simulation runs first; its trace
  is also recorded on fallback. Each dry-run has a 0.8-second budget including
  candidate construction and solver search. Network scheduling and synchronous
  model initialization mean these are budgets, not a 2–3 second latency promise.

Provider construction is isolated in `create_chat_model`, replaceable with a mock
for tests. LangChain's documented `init_chat_model` / `bind_tools` /
`ToolMessage` protocol is used. Provider errors never fabricate tool traces.
Teacher names and IDs are replaced by aliases recursively before serialization
of inputs and tool outputs. Only final explanatory strings are rehydrated locally.
No model-authored patch is accepted and no hidden model reasoning is exposed.

## Selection and simulation

`selectedRecommendationIds` absent selects default recommendations; `[]` selects
no patches. Unknown and duplicate IDs are rejected. The response's optional
`verifiedImpact` always refers to this authoritative selection, even when a model
simulates another subset. It has six measured counters, `recommendationIds`, and
`solverStatus`. Simulations deep-copy inputs and never persist changes. CP-SAT
search limits and candidate truncation remain `search-limit`, not impossibility.
Splits select independent component placements with one teacher per section and
shared teacher/room/cohort collision constraints.

Reference resource incorporation mirrors existing client behavior: 600 minutes,
synthetic FISI eligibility and Monday–Friday 08:00–22:00 availability. The existing
2400-minute expansion ceiling remains a local product assumption, not a verified
universal academic rule. Teacher spare capacity is reserved cumulatively across
courses, with a 60-minute expansion margin, rather than reused for each course.

NestJS retains pre- and post-await version checks, rejects unknown recommendation
IDs, forwards windows and selection, validates the response and checks proposal,
version and selected-impact identity. If Python is unavailable it returns the
existing deterministic catalog without claiming any verified solver impact.

## Acceptance checks (synthetic only)

- `uv run --directory planning-engine pytest -q`: dry-run/no mutation, empty and
  invalid selection, independent split placement, cumulative multi-course load,
  mocked provider configuration, two tool rounds, round/call/time bounds,
  fallback, recursive privacy, CP-SAT timeout status and HTTP wire format.
- `node --test shared/programacion-academica-advisor.test.mjs`: backward-compatible
  runtime schema, counters, selection, unknown fields and trace validation.
- After backend build,
  `node --test shared/programacion-academica-advisor-backend.test.mjs`: retained
  synthetic proposal version, selection propagation, outage and no mutation.
- `pnpm --dir backend build` and `pnpm --dir backend lint`.

The previous HTTP-only advisor tests in `test_engine.py` were replaced with the
mocked LangChain adapter tests in `test_advisor_agent.py`; the solver test remains.
The 166/166 scenario, real provider authentication and React–NestJS integration
are pending root-owned verification. Passing these checks does not establish them.

Documentation consulted: https://docs.langchain.com/oss/python/langchain/models
and https://docs.langchain.com/oss/python/langchain/quickstart via Context7.

## Earlier worker validation before LangChain migration (2026-11-08)

17 Python tests passed; 4 Node contract/backend tests passed. NestJS build passed.
NestJS lint passed with four existing `unbound-method` warnings in
`backend/test/local-profile-session.spec.ts`; no new lint error. One Node run
collided with the build's clearing of `dist`; rerunning after build completed
passed. Builds and consumers of `dist` must run sequentially.

## Documentary retrieval — PA-NORMATIVE-1

`POST /v1/normative/query` accepts only the fixed question/faculty/period/date/
teacher-type contract in `../plans/academic-normative-rag.md`. NestJS exposes
`POST /local/programacion-academica/v1/normativa/consultas`, with the existing
local access/origin checks, strict shared validation and a 15-second timeout.
Questions are not persisted. No caller paths, URLs or identities are accepted.
Student screens/tokens and solver limits are unchanged.

`normative.py` prefilters scope, faculty, period, teacher type, publication and
validity dates before BM25 and semantic similarity, fuses ranks using reciprocal
rank fusion, then expands only applicable explicit related articles. Conflicts
require documentary metadata (`conflictsWith`), never ranking precedence. Tests
inject vectors only at the embedding adapter; that is not evidence of real
semantic retrieval. Generation preserves deterministic abstention/conflicts; eligible supported
responses can use the validated bounded chain described below. The advisor retrieves context before model
construction and includes sources/gaps in its sanitized input and output. An
unknown teacher type cannot receive ordinary-teacher limits. The NestJS fallback
also returns context, explicitly unavailable if the engine cannot be reached.

The public model is optional. To explicitly prepare it once, from repository root:

```sh
uv sync --directory planning-engine
env -i PATH=/usr/bin:/bin HOME=/tmp/pa-normative-clean \
  HF_HUB_DISABLE_TELEMETRY=1 HF_HUB_DISABLE_IMPLICIT_TOKEN=1 HF_HUB_DISABLE_XET=1 \
  planning-engine/.venv/bin/python planning-engine/prepare_normative_model.py
```

The fixed cache `/tmp/pa-normative-model` is outside Git. Preparation downloads
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions).
Runtime FastEmbed uses `local_files_only=True` after the preparation marker;
it never downloads during a query. Preparation alone does not enable hybrid
retrieval: an explicit vector ingestion and configured repository are required.
Missing/broken vector storage produces honest `lexical-only`; empty corpus
produces `unavailable`. Restart after configuration changes (retriever is cached).
Runtime never crawls or depends on operator datasets.

`normative-corpus/v1.json` is a partial reviewed public seed, not a complete or
current rules registry. The only sources downloaded on 2026-11-08 were the two
specified public Medicina UNMSM RR 001380-2026 PDFs. `pdftotext -layout` extraction
was reviewed for articles 1, 5–9, 11, 18, 20, 25–26, complementary provisions and
final third. Physical pages start at 1; articles spanning pages retain their start
page. The corpus records PDF and normalized-excerpt SHA256, source URL, review
date and publication date. Approval is on resolution physical page 2; its physical
page 1 explicitly reads Lima, 06 de Febrero del 2026. Filenames did not establish
these claims. Full PDFs, signatures and personal directories are not stored.
The previous FISI dossier is an index only; primary text supplies the excerpts.

`effectiveFrom/To` remain null: the reviewed text does not establish the precise
commencement date. Such responses remain `not-determined`, even when excerpts
answer a general question. Future dates after review require an explicit warning;
2027 validity, faculty hour duration, individual regime, RENACYT/postgraduate
conditions, permissions and availability remain gaps. No partial/no-result answer
approves an allocation. The synthetic increase-load patch is not selected by
default and always requires external authorization; 2400 minutes is only the
unchanged simulator ceiling.

Acceptance checks (synthetic only):

```sh
node --test shared/programacion-academica-normative.test.mjs
uv run --directory planning-engine pytest test_normative.py test_advisor_agent.py -q
pnpm --dir backend exec vitest run src/programacion-academica/normative.client.spec.ts
pnpm --dir backend build
pnpm --dir backend lint
# Run timing-sensitive regression separately from compilation and other suites:
uv run --directory planning-engine pytest test_engine.py test_solver_scale.py -q
```

The normative tests cover article 7 with related exceptions, hour-duration gaps,
regime/scope/date/period prefilters, historical/future queries, explicit synthetic
conflict, empty/failing model paths, semantic-only paraphrase, strict HTTP inputs,
and retrieval before a fake provider with no external identities. The real-model
test skips honestly if preparation is absent. Client/NestJS/Python browser
integration and visual acceptance remain with the root browser owner.

Pre-migration verification record, 2026-11-08 (historical, not migration acceptance):

| Criterion → synthetic/public check | Expected | Actual |
| --- | --- | --- |
| Request/response limits, dates, unknown fields, URL allowlist, compatibility and Nest increase-load fallback → four relevant shared Node suites | Reject invalid/stale payloads; never select increase by default | 14 passed |
| Retrieval, scope/date/regime, conflict, fusion, HTTP and mandatory sanitized context → `test_normative.py` plus `test_advisor_agent.py` | Applicable cited extracts or explicit abstention; no fake provider calls | 37 passed; final retrieval expansion recheck 19 passed |
| Unchanged solver, scale and deadlines → `test_engine.py test_solver_scale.py`, run separately | Valid synthetic schedules and bounded search | 6 passed |
| Nest client → `normative.client.spec.ts` | Strict request/response and explicit HTTP failures | 3 passed |
| Nest build / lint | Compile; no new diagnostics | Passed; lint reports four existing `unbound-method` warnings in `test/local-profile-session.spec.ts` |
| Public model preparation and offline English paraphrase smoke | Actual multilingual semantic vectors and `hybrid`, future date abstention | Prepared once in clean environment; offline smoke returned `hybrid`, `not-determined`, art. 7 plus related citations |
| Real Python response → shared JS validator | PA-NORMATIVE-1 compatible public corpus response | Passed |
| React → NestJS → Python and UI/keyboard/mobile | Root-owned sequential acceptance | Not run by implementation worker |

No live LLM provider was invoked. The English smoke used a future 2027-I context;
it does not establish 2027 rules or authorization. No student UI, solver, operator
services, private inputs, commits, staging or external publication were changed.


## LangChain migration — package A (2026-11-08)

The fixed interface is in `../plans/academic-rag-langchain-migration.md`.
`rag_models.create_chat_model(env=None)` is the shared factory; importing it
from `advisor_agent` remains compatible. An absent `SUM_LLM_PROVIDER` now
selects Bedrock Converse, including IAM role environments without static keys.
An explicitly empty value or `disabled` disables chat. `bedrock` remains an
alias, `SUM_BEDROCK_MODEL` remains a fallback alias for `SUM_LLM_MODEL`.
There is no implicit provider substitution. Defaults retain the documented
`us.amazon.nova-lite-v1:0` profile and `us-east-1`; its US cross-region routing
must suit the operator's runtime policy. OpenAI's historical compatible-endpoint
default is retained for compatibility: configure an appropriate model explicitly.

Embedding selection is independent:
`SUM_RAG_EMBEDDING_PROVIDER=bedrock|ollama|openai|fastembed`,
`SUM_RAG_EMBEDDING_MODEL`, `SUM_RAG_EMBEDDING_DIMENSIONS`.
Defaults: Bedrock `amazon.titan-embed-text-v2:0`, 1024 dimensions
(Titan supports 256/512/1024). Ollama defaults to `nomic-embed-text`, 768;
OpenAI defaults to `text-embedding-3-small`, 1536; explicit FastEmbed uses the
prepared multilingual model, 384. For custom models, specify actual output
dimensions. The persisted identity includes provider, model and dimensions.
`SUM_RAG_EMBEDDING_BASE_URL` and `SUM_RAG_EMBEDDING_API_KEY` are embedding-only
configuration; they do not reuse the chat endpoint/key. The installed community
FastEmbed wrapper drops the offline flag, so the factory uses an actual
LangChain Embeddings adapter over FastEmbed with `local_files_only=True`.

`SUM_RAG_VECTOR_BACKEND=pgvector` is the default. Configure
`SUM_RAG_DATABASE_URL` and optional `SUM_RAG_COLLECTION` through the runtime.
Package B owns `rag_storage`, the explicit ingestion CLI and storage docs.
Queries pass eligible article IDs to `search` before top-k, validate returned
ID/content/hash against canonical reviewed metadata, and never index. A missing
or failed repository yields an explicit lexical-only gap; no memory fallback.
`NormativeRetriever(..., repository=...)` is the repository test seam.
The historical callable `embedder` argument selects an explicit test adapter
and actual LangChain InMemoryVectorStore; it is never the production default.
BM25 uses LangChain BM25Retriever with rank-bm25 BM25Plus (positive IDF even for
tiny corpora), then reciprocal rank fusion. Applicability, related-article
expansion, conflicts before the eight-citation cap and canonical citations
remain separate audited rules. No manual BM25/cosine engine remains.

Queries read only the local canonical bundle (default `normative-corpus/v1.json`;
optional trusted operator `SUM_RAG_CORPUS_PATH`). Package B's deterministic
`corpus_fingerprint` binds ingestion and retrieval. S3 is explicit ingestion
only; changing a bucket does not change the bundle served by this process.

The second step runs only after retrieval and only for `supported` evidence.
One structured-output Runnable call has an 8-second default budget, clamped by
`SUM_LLM_TIMEOUT_MS` to 100–30000ms, with no automatic model retry loop.
It accepts answer text plus canonical citation IDs, rejects unknown/mismatched
references, links, URI schemes, HTML and extra output fields, and preserves
gaps/status/citations. A fixed authorization disclaimer remains in the answer.
Conflicts and uncertain evidence abstain before provider construction.
`SUM_RAG_GENERATION_MODE=extractive` disables generation explicitly.
The optional strictly validated `generation` response field reports actual
`llm-assisted` versus `extractive`, nullable provider label and optional reason.
Old responses without the field remain valid; absent reasons are omitted.

Runtime IAM uses the SDK credential chain; no dotenv is read. Operator deployment
must authorize credentials, region, model access and `bedrock:InvokeModel`
for the chosen foundation model/inference profile. US cross-region profiles
also require the underlying destination foundation-model permissions. No AWS,
S3, OpenAI or Ollama invocation was performed by package A. Tests use clean
environments and `AWS_EC2_METADATA_DISABLED=true`, with doubles only at remote
model/repository edges. Never run local checks against private snapshots.

Focused checks from repository root:

```sh
env -i PATH="$PATH" AWS_EC2_METADATA_DISABLED=true \
  SUM_RAG_GENERATION_MODE=extractive SUM_LLM_PROVIDER=disabled \
  planning-engine/.venv/bin/python -m pytest \
  planning-engine/test_rag_models.py planning-engine/test_rag_chain.py \
  planning-engine/test_normative.py planning-engine/test_advisor_agent.py -q
node --test shared/programacion-academica-normative-generation.test.mjs \
  shared/programacion-academica-normative.test.mjs \
  shared/programacion-academica-advisor.test.mjs
```

Migration acceptance: factory defaults and independent settings → factory tests;
real BM25/Documents/Runnables and vector injection → normative/pipeline tests;
canonical identity, prefilters, conflict cap/reverse links, abstention, malformed
output, timeout and upstream failures → focused Python scenarios; backward
compatibility and optional generation rejection → Node contract tests.
These checks do not establish live cloud execution, package B's real pgvector
persistence, or root-owned React/NestJS integration/browser/audit acceptance.

Current API sources consulted through Context7 and official AWS documentation:
https://docs.langchain.com/oss/python/langchain/models ,
https://docs.langchain.com/oss/python/langchain/knowledge-base ,
https://github.com/langchain-ai/langchain-postgres ,
https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html ,
https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html .

Package A execution record: 55 focused Python tests passed and 9 Node contract
tests passed. Lock consistency (`uv lock --project planning-engine --check --offline`)
and shared diff whitespace checks passed. The installed langchain-community
integration emits its upstream deprecation warning; it remains the requested
BM25 integration, with no custom manual BM25 implementation. The initial ranking
regression exposed negative IDF on a tiny BM25Okapi corpus; the bounded repair
uses integrated BM25Plus and the existing fusion regression passes. No CP-SAT
timing suite, frontend/backend compilation, browser or live DB/cloud check was
run by this worker.
The real FastAPI public-corpus response also passed the shared JavaScript
validator with extractive generation and a null provider label. A final targeted
pipeline recheck passed 9 tests after distinguishing provider-construction
failures from invalid structured model output.
