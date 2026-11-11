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

## PA-ENGINE-2 — authorized capacity, decisions and teacher prelation

This is an internal product contract, specified by ticket T2; it does not claim
observed SUM behavior. No UI is changed; existing interfaces and the A/B/C design
direction remain outside this change. The engine accepts resolved teacher caps
and ranks, without resolving regulations, articles or implicit hour ceilings.

`TeacherInput` adds optional `exceptionMaxWeeklyMinutes`, `exceptionKind`
(`voluntary-declaration` / `vrap-authorization`), `appointmentTier` (0 faculty,
1 interfaculty, 2 contract) and `categoryRank` (1–9, lower first). An exception
cap, when supplied, must exceed `maxWeeklyMinutes`. Exception caps only enter
capacity decision analysis: every timetable assignment still uses the authorized
`maxWeeklyMinutes` and existing course-specific `sectionLimits`. The request's
`maxTimeSeconds` accepts up to 120 seconds; its 3-second default is unchanged.

The response always serializes these additional fields (old constructors and
callers remain valid):

- `coverageProof`, default `inconclusive`: `complete` witnesses every required
  session; `shortfall-proven` means the actual complete-section schedule reaches
  a proven capacity upper bound, optionally combined with existing proven
  no-teacher/no-room/no-window exclusions. Only that case returns `impossible`.
  Other partial results return `search-limit`. Candidate sampling/truncation
  cannot establish impossibility. If a sampled schedule reaches an independently
  proven capacity upper bound, sampling cannot hide additional coverage, so that
  capacity proof remains valid. Exhaustive timetable infeasibility alone is not
  classified as one of the contract's proven causes.
- `capacityCertificate`, default `null`: an exact section-to-eligible-teacher
  assignment relaxation using actual required section minutes, shared teacher
  load and section limits, without rooms/calendars/cohort conflicts. `proven`
  requires CP-SAT optimality; otherwise the returned covered count is only a
  feasible lower bound. Course rows list deficits in one deterministic global
  optimum, **not independent per-course maxima**: shared teachers can make
  several equally optimal distributions possible. `requiredMinutes` is the
  total required minutes for all sections of that course. Existing
  `TEACHER_CAPACITY_SHORTFALL` codes and Spanish message shapes are retained;
  these course diagnostics describe the joint allocation rather than freezing
  excluded section IDs. The separate precheck codes are unchanged.
- `decisions`, default `[]`: when authorized capacity is incomplete, an exact
  relaxation maximizes exception-cap coverage, fixes that value, minimizes the
  number of exception teachers, fixes that count, then minimizes extra minutes.
  Each `teacher-load-exception` reports the teacher's actual minimal overload;
  `courseIds` lists courses assigned to that teacher in the relaxation.
  `sectionsUnlocked` is the marginal optimal coverage gain when enabling these
  minimal concessions in teacher-ID order, allowing global reassignment at each
  step. These gains sum to the overall capacity improvement; complementary
  concessions can have a zero individual marginal gain. Remaining unassigned
  sections produce one `additional-teacher` row per course with their total
  minutes. IDs are `teacher-load-exception:<teacherId>` and
  `additional-teacher:<courseId>`, in that order and sorted by resource ID.
  Every capacity decision has `basis: capacity-relaxation`: these are necessary capacity
  concessions, not promises of feasible timetable placement. If any concession
  optimization is unproven, no minimal decisions are claimed and diagnostic
  `CAPACITY_ANALYSIS_LIMIT` is emitted. The authorized certificate may still be
  proven. A construction timeout can return the default null certificate.
- `prelation`, default `null`: applies only if all teachers eligible for any
  requested section carry both priority fields. Otherwise diagnostic
  `PRELATION_DATA_MISSING` explains the absence; no ranks are inferred. With
  complete data, successive CP-SAT objectives maximize scheduled sessions,
  minimize contract sections, minimize interfaculty sections, minimize summed
  category rank per section, then maximize the existing preference/time bonus.
  Achieved objective values become constraints; teacher assignments stay free.
  Coverage receives the search budget first. The three reported levels give
  their actual achieved values and `proven` flags. A time limit or candidate
  sampling keeps affected priority proofs false, even with complete coverage.
  Without priority data, existing preference assignment behavior is retained.

Capacity analysis shares the request deadline and gets at most 20% of the request
budget, capped at 1 s, after the existing cheap timetable incumbent is built. It
counts sections per (course, required minutes, teacher) rather than choosing a
teacher per section: with the per-section model the minimal-concession objectives
stayed unproven after 60 s on the 166-section synthetic catalog; aggregated, the
full analysis with exception caps is proven in 0.16–0.25 s (orchestrator
measurement, 2026-11-10).
This preserves a useful feasible schedule if candidate preparation later expires.
It uses one CP-SAT worker; the timetable coverage search uses `min(4, usable cores)` (see PA-ENGINE-JOBS-1).

Synthetic acceptance is through `solve_academic_schedule`, without a running
server or private fixtures. `test_capacity_prelation.py` covers criteria 1–9,
joint deficits, section limits, minimal teacher-count/minute concessions, mixed
precheck/capacity proof, honest candidate sampling, deterministic decisions,
response defaults and request limits. Criterion 10 uses unchanged regression
suites. Run the timing-sensitive scale suite once, after the focused checks:

```sh
nice uv run --directory planning-engine pytest test_capacity_prelation.py test_engine.py test_advisor_agent.py -q
nice uv run --directory planning-engine pytest test_solver_scale.py -q
```

Consumer follow-up is outside T2: `advisor.py` still derives its legacy synthetic
increase-load recommendations with its simulator ceiling; it does not consume
these minimal decisions or proof fields. `advisor_agent.py` retains only legacy
coverage counters and `solverStatus` from a dry run. NestJS's engine adapter and
shared wire contracts must forward/validate resolved caps and priorities and
retain the new response fields before the product can expose this analysis.
`main.py` already serializes the extended Pydantic response; no change is needed.

T2 execution record (2026-11-10), using independently constructed synthetic
fixtures only:

| Criterion | Public-interface test in `test_capacity_prelation.py` | Actual |
| --- | --- | --- |
| 1. Authorized 600 / four 360-minute sections | `test_authorized_capacity_shortfall_is_proven` | Pass: proven 1/4, one scheduled, impossible |
| 2. Shared teacher deficit | `test_shared_teacher_capacity_is_joint` | Pass: two shared teachers cover 2/4 jointly |
| 3. Exception analysis keeps timetable authorized | `test_exception_decision_and_remaining_teacher_gap` | Pass: +120 minutes unlock one section; timetable remains at one |
| 4. Remaining teacher gap | same test | Pass: two missing sections / 720 minutes |
| 5. Faculty before better contract preference | `test_faculty_precedes_contract_preference` | Pass |
| 6. Global reassignment preserves coverage | `test_prelating_does_not_freeze_assignments_before_coverage` | Pass: A→Y, C→X; contract value 1 |
| 7. Interfaculty and category priority | `test_interfaculty_precedes_contract`, `test_lower_category_rank_precedes_preferences` | Both pass; exhaustive rank fixture has proven levels |
| 8. Missing priority fields | `test_missing_priority_data_disables_prelation`, `test_missing_rank_also_disables_prelation` | Both pass: null plus diagnostic |
| 9. Authorized loads | Shared `solve` assertion in every scheduling fixture | Pass: every returned teacher load within authorized cap |
| 10. Existing engine/advisor/scale regression | Commands below | Focused suites pass; all five scale cases pass after repair |

Actual command results:

- `nice uv run --directory planning-engine pytest test_capacity_prelation.py test_engine.py test_advisor_agent.py -q`: **36 passed, 1 warning in 1.18s**.
- After strengthening the joint-capacity fixture to two teachers, targeted
  `test_capacity_prelation.py -q -k shared_teacher_capacity_is_joint`:
  **1 passed, 16 deselected, 1 warning in 0.56s**.
- The full `test_solver_scale.py -q` ran once: **1 failed, 4 passed in 7.71s**.
  Its existing injected-deadline test intercepted the new capacity solver before
  its old timetable-candidate expiration point. Capacity assignment variables
  now use Boolean variables, so the same injection correctly expires during
  capacity preparation, returns an unproven certificate, and preserves the
  already constructed feasible incumbent. No existing test assertions changed.
- Necessary post-repair scale checks were split into targeted selections:
  `-k 'scale_useful_within_advisor_budget or deadline_during_construction'`:
  **2 passed, 3 deselected in 0.96s**; the complementary selection:
  **3 passed, 2 deselected in 6.75s**. The full suite was not repeated. This
  targeted retry is the only deviation from the requested one scale execution.
- A temporary pytest timing observer outside the repository wrapped capacity
  analysis, using `perf_counter` without changing its inputs or results. Final
  166-section analysis measurements: **29.538, 29.278, 23.092, 24.773 and
  25.484 ms**, all with proven certificates. The deadline-injection case took
  8.022 ms and correctly returned `proven=false`. Timing instrumentation was
  selected with `PYTHONPATH` / `PYTEST_PLUGINS`; its first setup attempt failed
  before test collection because the engine import path was absent, then was
  corrected. No scale scenario executed during that setup failure.
- `git diff --check`: pass. The warning in focused suites is the existing
  upstream `langchain-community` deprecation warning.

No contract deviation or outstanding implementation blocker. Live services,
cloud calls, private datasets, browser/visual validation and downstream consumer
integration were not used to establish these results.

### T6a — window and delivery-mode options (2026-11-10)

For sections already excluded by `NO_SCHEDULING_WINDOW`, the response appends
counterfactual decisions **after** the unchanged capacity decisions, in this order:

1. `planning-window:afternoon`, kind `planning-window`, with
   `policyChange: { allowAfternoon: true }` when afternoon is not already allowed.
2. `planning-window:saturday`, same kind, with
   `policyChange: { allowSaturday: true }` when Saturday is not already allowed.
3. `delivery-mode-split`, kind `delivery-mode-split`, for continuous courses only.
4. `planning-window:combined`, kind `planning-window`, for sections that none of
   the single changes unlocks but the combination unlocks.

Each single change is evaluated independently. A section unlocked by two options
counts in both; counts must not be summed as disjoint gains. Only nonempty
options are returned. All have `basis: window-precheck`, `teacherId: null`,
`exceptionKind: null`, `additionalMinutes: 0`, sorted affected `courseIds`, and
`sectionsUnlocked` counting excluded sections that gain a permitted window for
every block. `policyChange` omits null flags and is absent on delivery-mode and
capacity decisions. Its flag model is shared with the existing advisor patch.

The combined option enables **all currently disabled policy flags** and evaluates
each component separately for continuous courses. Its `policyChange` lists those
flags, while the deterministic `:combined` ID also denotes the split assumption;
the fixed contract has no separate split field on this decision. Already enabled
flags and already split modes remain enabled. This is an all-changes comparison,
not a claim that each participating change is individually necessary or that the
combination is minimal. Sections that still fail produce one
`WINDOW_RELAXATION_INSUFFICIENT` diagnostic listing their session IDs.

The analysis reuses the precheck's `planning_time_rank`, request windows, start
grid and continuous/individual durations. It checks only window existence, not
teacher/room availability, capacity, clashes or joint component placement.
Results are necessary conditions, not feasible-timetable promises, rankings or
automatically selected changes. Upper-cycle window criteria remain `testimony`
without a located regulation, as recorded in
[`0003`](../docs/adr/0003-regulated-load-exceptions-and-lexicographic-prelation.md)
and the normative-engine plan's
[`Resultado de T2`](../docs/reverse-engineering/plans/programacion-academica-normative-engine.md#resultado-de-t2).
This is a local product decision, not observed SUM behavior. No UI or design
direction changes are authorized by this ticket.

Explanation runs after timetable construction, under the original request
deadline, with request-local memoization and no additional CP-SAT solve. It never
changes the request, assignments, status, coverage proof, certificate, capacity
decisions or prelation. No window exclusions means no new information. Additive
deadline behavior: `WINDOW_ANALYSIS_LIMIT` lists the excluded session IDs if the
budget expires; no partial options or insufficient-window conclusions are then
claimed. This explicit diagnostic extends the ticket's diagnostic list to honor
its deadline requirement without misrepresenting unfinished analysis.

Synthetic acceptance record (independently invented tiny fixtures in
`test_window_decisions.py`; no private data, services or provider calls):

| Criterion | Pytest check | Expected → actual |
| --- | --- | --- |
| 1. Afternoon only | `test_afternoon_option_does_not_schedule_afternoon` | One afternoon decision, count 1/course X, no assignments or request mutation → passed |
| 2. Saturday only | `test_saturday_option_does_not_schedule_saturday` | One Saturday decision, count 1/course X, no Saturday assignments → passed |
| 3. Split only | `test_split_option_does_not_change_continuous_delivery` | One split decision; request stays continuous, no split assignments → passed |
| 4. Independent counts | `test_single_options_count_the_same_section_independently` | One section counted by both afternoon and Saturday → passed |
| 5. Combined / insufficient | `test_combination_and_insufficient_options_report_only_their_sections` | Combined unlocks X; insufficient diagnostic lists only Y's session → passed |
| 6. Already allowed | `test_already_allowed_afternoon_is_not_offered` | No afternoon option → passed |
| 7. Capacity compatibility | Unmodified `test_capacity_prelation.py` | 17 tests pass; 17 responses separately compared with baseline `a768ce4`, matching assignments, status, coverage, certificate, capacity decisions, prelation, limit reason and old diagnostics → passed |
| 8. Engine/advisor/scale regression | `test_engine.py`, `test_advisor_agent.py`, `test_solver_scale.py` | All pass in the commands below |
| Wire compatibility, aggregation, empty options and boundaries | Remaining window tests | Null policy keys omitted; sorted course IDs and section counts; already active split not offered; no exclusions give no options; start grid and Sunday unchanged → passed |
| Deadline | `test_expired_budget_keeps_schedule_and_does_not_claim_options` | Original proven result retained; explicit analysis-limit diagnostic without unsupported options → passed |

Executed with `UV_OFFLINE=1 UV_FROZEN=1` so only locked, cached dependencies
were used:

```text
nice uv run --directory planning-engine pytest test_window_decisions.py test_capacity_prelation.py test_engine.py test_advisor_agent.py -q
50 passed, 1 warning in 1.43s

nice uv run --directory planning-engine pytest test_solver_scale.py -q
5 passed, 1 warning in 7.85s
```

The warning is the existing upstream `langchain-community` deprecation. Scale
suite executed once. A throwaway script in `/tmp` reused the scale fixture
(`scale_request.__wrapped__()`), without adding a test or changing its data:
56 synthetic courses / 166 sections / 332 sessions; 18 excluded sections;
afternoon unlocks **18**, Saturday **0**, split **18**, combined-only **0**;
no insufficient-relaxation diagnostic. The measured window analysis took
**0.387 ms** against the 800 ms request budget. The options concern the same
18 sections and do not constitute 36 unlocked sections. Disk free space stayed
above 1.8 GB during execution; no additional repository copy was created.

## PA-ENGINE-JOBS-1 — background search jobs (ticket T4a, 2026-11-11)

Internal product contract; no UI and no SUM behavior is claimed. It lets the backend
show a first feasible timetable quickly, watch it improve and cancel, without new
infrastructure: one in-memory job inside the engine, polled over HTTP. `POST /v1/solve`
is unchanged. Engine restarts lose all jobs (nothing is written to disk).

| Call | Response |
| --- | --- |
| `POST /v1/solve-jobs` with a `SolveScheduleRequest` (`maxTimeSeconds`, up to 120, is the search budget) | `202 { jobId, state: 'running', budgetSeconds }`. Only one search runs: starting a job cancels the running one (it becomes `cancelled`) |
| `GET /v1/solve-jobs/{jobId}` | `200 { jobId, state, phase, elapsedSeconds, budgetSeconds, progress, result, error }`; unknown or expired id: `404` |
| `DELETE /v1/solve-jobs/{jobId}` | Cancels a running job and returns the same body as GET in its terminal state; on a terminal job it is a no-op returning that state; `404` if unknown |

- `state`: `running` / `completed` / `cancelled` / `failed`. `phase`: `preparing`
  (prechecks, cheap incumbent, model build) → `capacity` → `coverage` (first CP-SAT
  solve) → `prelation` (contract, interfaculty, category stages) → `preferences` →
  `done`. `done` is reported only when `completed`; a `cancelled` or `failed` job keeps
  the phase it stopped in. `prelation` and `preferences` appear only with complete
  priority data (PA-ENGINE-2).
- `elapsedSeconds` counts from the moment the search worker starts solving, the same
  clock as `budgetSeconds`; it is `0` while the worker is still booting and stops at the
  terminal state.
- `progress`: `requiredSessions` / `requiredSections` come from the request.
  `scheduledSessions` / `scheduledSections` describe the best valid schedule seen so far
  and never decrease. `improvements` counts strictly better schedules. "Better" means
  more scheduled sessions or, with equal sessions and complete priority data, a
  lexicographically better (contract, interfaculty, category-rank) value. Improvements
  that only raise the legacy preference bonus are not counted. No percentage or time
  estimate is produced.
- `result` is `null` while running. `completed`: the final `SolveScheduleResponse`, the
  same as `POST /v1/solve` for that request and budget (status, `coverageProof`,
  certificate, decisions, prelation, diagnostics). `cancelled`: the best valid schedule
  found so far if there is one, else `null`; `status` is `complete` only if every session
  is placed, otherwise `search-limit` with `coverageProof: 'inconclusive'`,
  `limitReason: null`, no certificate/decisions/prelation and a `SEARCH_CANCELLED`
  diagnostic listing the unscheduled sessions. `failed`: always `null`.
- `error` codes (messages are fixed Spanish texts that never echo input): `SEARCH_FAILED`
  (exception inside the search), `SEARCH_PROCESS_LOST` (the worker died without a result),
  `SEARCH_OVERRUN` (no result after `1.5 × budget + 20 s`; the worker is killed).
- Retention: terminal jobs are kept 15 minutes and at most 20 of them, oldest dropped
  first. A running job is never dropped. Teacher names and ids are never logged; only job
  ids and exception class names.

Isolation: each job runs `solve_academic_schedule` in a child process (`forkserver`
start, `solver` preloaded, `spawn` where unavailable) niced by 5 so `/health` and the job
endpoints stay responsive. The child streams `phase` and `best` messages over a pipe to a
supervisor thread in the server process, which owns the job state. Cancellation sends
`SIGKILL` to the child, so the CPU work ends with the process (the test asserts the child
is no longer alive within one second of the `DELETE` response, which itself took about 6 ms
in the measured run), and the best schedule received so far is returned. The supervisor reaps the child on every
outcome; children are daemonic, so an engine exit takes them down.

`solve_academic_schedule(req, hooks=None)` keeps its signature for direct callers. The
optional `SearchHooks` (`on_phase`, `on_improvement`, `should_cancel`) attach a CP-SAT
solution callback only when supplied; without hooks the solve call is the plain one.
`should_cancel` is cooperative (polled between stages and on each solution); hard
stopping is the job manager's process kill.

CP-SAT worker count: the timetable coverage solve now uses `search_workers()` =
`min(4, usable cores)`, taking the smaller of the CPU affinity and the cgroup quota
(previously a fixed 4). This setting is shared by `POST /v1/solve`. The capacity analysis
and the lexicographic stages still use one worker.

Backend integration notes: poll `GET` at roughly 250–500 ms; stop polling at any state
other than `running`; treat `404` as "lost" (expired or engine restarted) and re-run.
`budgetSeconds` is the search budget only; wall time can exceed it by the final window
analysis and, for the first job after an engine start, by the worker bootstrap (about 1 s).
A `cancelled` result with `status: 'complete'` is a valid full schedule.

Prelation proofs and budget (measured 2026-11-11, synthetic 56-course catalog with
invented tiers/ranks, 30 s job): the contract, interfaculty and category stages all ended
`OPTIMAL` (the job reached `preferences`), yet every level stayed `proven: false`. The
proof flag also requires `not candidates_truncated`, and candidate sampling truncates on
this catalog, so a longer budget improves coverage and time to a first schedule but does
not by itself yield prelation proofs while sampling truncates candidates.
