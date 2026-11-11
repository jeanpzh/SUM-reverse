# T4b lifecycle repair — 2026-11-11

Scope: local-only internal planning, existing interfaces and explicit save/CAS/approval retained. No student or module chooser changes. No private data or production sources. Diagnosis uses independently constructed synthetic requests.

## Compatible correlation protocol (fixed before implementation)

Optional `requestId` UUID in POST busquedas; its value is the public jobId. Legacy callers receive a generated UUID. Nest reserves ownership before POST to Python, using a separate random hex internal ID in `X-Job-Id` header (no solver-model extension). Same key and canonical payload returns the existing job; different payload returns 409. Engine uses canonical model JSON equivalence. Unknown UUID cancellation reserves a cancelled public fence; unknown hex engine DELETE reserves a fence and returns 404, proving no accepted job at that instant while preventing delayed starts. Delayed starts against either fence return 409. Fences/idempotency last 15 minutes, in memory only, reset on restart. Never reuse IDs.

Capacity policy: max 256 protected correlations per process; reject new work with 429 instead of evicting unexpired fences or pending cleanup. Confirmed terminals expire after retention; pending cleanup never expires or counts as publicly terminal. Each cleanup action attempts at most three HTTP operations (5s timeout each); failed cleanup retains ownership and actionable error; explicit retry/status and shutdown retry it. Shutdown refuses new starts and makes a bounded sweep without waiting for queued starts. Process restart loses tracking; solver watchdog bounds residual work, not a transport-error claim of confirmed CPU stop.

Client knows UUID before POST and can cancel even if POST response is lost. Uncertain cleanup keeps generation/save/edit gates and a visible retry message. Configuration changes invalidate result application but keep cleanup obligations; new generation first reconciles outstanding cleanup. No autosave, UI redesign or new component family.

## Red evidence

- Backend `vitest run test/programacion-academica-jobs.spec.ts`: 5 pass, 2 fail. Lost POST leaves size 0 instead of 1; second cancel resolves cached failed snapshot.
- Client `node --experimental-strip-types --test --test-name-pattern='failed cancellation|cancel before start rejection' src/data/planningSession.test.ts`: 0 pass, 2 fail. Cancel failure busy=false; cancel-before-rejected-start busy=true forever.

## Acceptance results

Completed with the acceptance matrix and command results below.

## Implemented files and compatibility

- `shared/programacion-academica-api.{mjs,d.mts,test.mjs}`: optional UUID validation and compatibility test.
- `backend/src/programacion-academica/demo-proposal.service.ts`, `backend/test/programacion-academica-jobs.spec.ts`: reserve before network/queue, separate `cleanupPending`/`cancelRequested`, public fences, bounded retry, protected capacity and shutdown sweep. Registration order prevents older starts cancelling newer queued reservations. Existing controller and engine payload builder reused unchanged by this repair.
- `planning-engine/{jobs.py,main.py,test_solve_jobs.py}`: header correlation, duplicate/conflict handling, cancellation fence and protected retention. Solver and T8 files untouched by this worker.
- `client/src/data/{academicScheduling.ts,planningSession.ts,planningSession.test.ts}`: caller-known correlation, cleanup ownership across stale intents/dispose, serialized cancellation attempts, gated recovery. Optional second session-adapter argument preserves existing injected callers; legacy adapters returning a different ID have their late ID cancelled too.
- `client/src/screens/AcademicScheduling.tsx`: only the existing progress/cancellation block gains an uncertainty message and retry label, using its existing Button. Student screens, chooser, styling, explicit save/CAS and approval/publication preserved.
- `client/scripts/verify-planning-jobs.mjs`: own HTTP proxy drops an engine response after acceptance; client transport drops a backend response after acceptance. Allowlisted environment, independently synthetic resources, ephemeral ports/state, own-process teardown only. No browser.

Retention detail: public jobs retain identity/payload for 15 minutes from creation (lazy collection), unknown cancellation fences for 15 minutes from cancellation. Engine correlated results retain identity for 15 minutes after termination; their expiry leaves a further 15-minute fence. Legacy uncorrelated engine terminal snapshots keep the previous 20-result bound and now leave a fence on eviction. The overall 256-job/fence capacity rejects admission rather than evicting protected identities. Pending Nest cleanup is never evicted by age/capacity. These are in-memory protections, not durable recovery after restart; delayed delivery outside retention is outside the guarantee. Optional field/header require the updated server when used; requests omitting them remain valid.

## Criterion → synthetic check → expected → actual

| Criterion | Check/scenario | Expected | Actual |
| --- | --- | --- | --- |
| P1 lost engine start response | Backend lost-response regression; real HTTP proxy drops accepted Python POST response | Known internal ownership, cleanup reachable | PASS; default session resolves terminal through known public UUID |
| P1 failed DELETE remains pending | Backend repeated cancel transport failures, expiry, recovery/shutdown | No cached terminal success or eviction; DELETE retried | PASS; retained beyond 16 minutes while offline, shutdown clears pending when transport recovers |
| P2 cancel failure gates save/edit | Session failure + stale period cleanup tests | Busy/save/edit gates retained, actionable retry | PASS; generation blocked while uncertain, retry restores idle |
| P2 cancel-before-rejected-start | Deferred session start rejection after cancel | No silent busy forever | PASS; confirmed cancelled snapshot settles busy |
| Lost client POST response | Caller UUID session test and real accepted Nest POST with dropped client response | Cancel by caller-known ID | PASS; no synchronous fallback/autosave |
| Cancel before delayed start | Shared UUID; Nest and Python fence tests; real stack | No later CPU start for fenced ID; 409 | PASS |
| Duplicate identity | Nest/Python and real stack same/different payload | One start for same payload; 409 on mismatch | PASS |
| Capacity/retention | Backend 256 pending reservations; Python 256 fences plus clock advance | 429 without eviction; admission after fence TTL | PASS |
| Shutdown during lost pending POST | Deferred backend POST, DELETE 404 fence before resolving start | Shutdown does not wait for start response; late start cannot escape fence | PASS |
| Obsolete/new jobs | Session disposal/config/period/restart, stale poll, failed cleanup; backend concurrent reservations | No stale proposal replacement or cancellation of newer queued job | PASS |
| Stable proposals/incumbents/final proofs | Existing jobs, session and normative/publication suites; real integration | Stable public/proposal identity, coherent progress, explicit save gate, honest proofs | PASS |
| UI and visual fidelity | Source-scoped change; build/lint | Reuse existing panel/Button; no redesign | Source/static checks PASS; browser/DOM, keyboard, zoom and visual comparison NOT EXECUTED |

## Executed verification

Commands below run in this checkout, with explicit workdir. No installations, dependency/lockfile edits, commits, merges or delegation.

- Root: `node --test shared/academic-normative-profile.test.mjs shared/programacion-academica-api.test.mjs shared/programacion-academica-publication.test.mjs` — **25/25 passed**.
- Backend: `SUM_PLANNING_ENGINE_URL=off ./node_modules/.bin/vitest run test/programacion-academica-jobs.spec.ts test/programacion-academica-normative.spec.ts test/programacion-academica-normative-publication.spec.ts test/programacion-academica-publication.spec.ts test/programacion-academica-persistence.spec.ts test/programacion-academica-generator-partial.spec.ts test/programacion-academica-schedule.spec.ts` — **7 files, 128/128 passed**; followed by the final expanded job suite below.
- Backend: `./node_modules/.bin/vitest run test/programacion-academica-jobs.spec.ts` — **12/12 passed**, including shutdown and concurrent reservation regressions added after the broad run.
- Engine: `.venv/bin/python -m pytest test_solve_jobs.py -q` — **11/11 passed**, 9.17 s. No heavy candidate/capacity/scale suites run; T8 ownership preserved.
- Backend: `./node_modules/.bin/nest build` and `./node_modules/.bin/oxlint --type-aware src/ test/` — **passed**, four pre-existing unbound-method warnings in `test/local-profile-session.spec.ts`.
- Client: `./node_modules/.bin/tsc -p tsconfig.data-tests.json` and `node --experimental-strip-types --test --test-isolation=none src/data/*.test.ts` — **339/339 passed**, 8 suites (final repeat after cancellation serialization and legacy late-ID repair).
- Client: `./node_modules/.bin/tsc -b`, `./node_modules/.bin/vite build`, `./node_modules/.bin/eslint .` — **all passed**, final production build 12.07 s.
- Root: `node --experimental-strip-types client/scripts/verify-planning-jobs.mjs` — real fresh synthetic stack passed both lost-response seams, duplicate/conflict/fence tests, default session lifecycle, live witness/progress, save gate, normal complete/shortfall and cancellation. Own services stopped and temporary state removed. **Final repeat passed after the concurrent-reservation repair and client serialization changes.**
- `git diff --check` — **passed**, including final report update.

Known nonblocking warnings: existing Vite CSS `@reference`/chunk-size notices, vite-tsconfig-paths recommendation, Python langchain-community deprecation. An intermediate client compile caught a null error-message type and an intermediate test caught a legacy adapter late-ID cancellation regression; both corrected before final verification. The first proxy test also exposed that global client fetch interception affected the in-process proxy; the proxy now captures its own transport before injection.

Limits: transport failure alone never proves CPU stopped. Exhausted bounded cleanup attempts retain the gate and require explicit retry/status or shutdown reconciliation. No durable job recovery after process restart, no guarantee for delayed requests outside the stated retention window. No production/SUM parity claims or browser acceptance. CodeGraph was consulted first; changed-source misses were read directly. No private sources or pre-existing servers were inspected.


Document acceptance: all implementation paths named above exist, the contract names match the validator/header/adapter, and the report distinguishes executed synthetic HTTP/session checks from unexecuted React DOM/visual checks. Main normative-engine plan and T8 sources were not edited by this worker. The final diff check passed. Work remains uncommitted as requested.
