# Local Profile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect four synthetic actor choices to one15-minute server session and the entire existing dashboard, including real committed enrollment reports.

**Architecture:** Proposed additive LocalProfileDashboardModule imports the existing MR singleton and projects actor-scoped data; one browser memory store supplies all routes and existing Shell. Separate synthetic bootstrap imports no private/operator module. MR-CONTRACT-2 wire/recovery/atomicity remains authoritative.

**Tech Stack:** Existing React19.2.8, TanStack Router1.170.41, TypeScript6.0.2, Vite8.3.0, NestJS12.0.1, Vitest4.1.2 and Playwright1.63.0 manifest ranges; no dependency addition.

**Spec:** [LPD-SPEC-1](../../../specs/002-local-profile-dashboard/spec.md), [design](../specs/2026-10-14-local-profile-dashboard-design.md), [LPD-CONTRACT-1](../../reverse-engineering/contracts/local-api/local-profile-dashboard.md).

**Status:** READY for dispatch. Architecture is frozen by [LPD-DEC-1](../../reverse-engineering/plans/local-profile-dashboard-decisions.md) (Claude Opus ctx_9157662c17e0), and that decision file prevails where wording differs. User authorized direction/delegation. No implementation, runtime tests, production or private-data access performed.

## Global Constraints

- Four actors exactly SYN-SIS-A/B and SYN-SOFT-A/B; local chooser is not real authentication.
- One server-authoritative15-minute session on entry; memory across router navigation, reload returns login; explicit renewal button only.
- Keep all16 existing URLs, same Shell and same actor data; integrate /local/matricula-regular into Ver matrícula.
- Preserve MR-CONTRACT-2 wire, result recovery, identity, replay priority, atomicity and uncertain sessionStorage intent.
- Prematrícula enabled/scope/window/known eligibility gate entry; report existence/download never grants permission.
- Report/schedule only from accepted real committed state; no seeded fallback, fabricated official payment/health state or mock fallback.
- August synthetic clock advances with elapsed wall time; documentary F6 unknown11–12 hours remain unknown.
- Isolated synthetic bootstrap only; never import AppModule/private snapshot providers or inspect operator runtime.
- Preserve dirty tree and old001 tasks/counts; max2 workers, exclusive files, no worker delegation, one browser owner.
- Follow latest explicit user routing: backend Claude Sonnet High, UI Codex GPT-6 Luna High, difficult decisions Claude Opus High. Confirm effective provider/model/effort from the launcher receipt and follow folder skills; shared runtime gets its own explicitly assigned root owner before layers.

## Review Focus

- Late actor-A response after actor-B login must be ignored by generation, even if abort is ignored (F1/F4 tests).
- Logout/actor switch during an in-flight commit is client-only: the late response is discarded by generation and the actor's run/actor-keyed intent is recovered manually on re-entry, never by inferred rollback or automatic POST (F1/F3/V1 tests).
- Session expiry at exactly900000ms must use advancing server time, not browser clock or fixed August instant (B1/F2 tests).
- Empty debt/history/official fields must never become institutional approval or fabricated records (B2/F4 tests).
- Inconsistent enrollment/report linkage must produce failure rather than a seeded report or empty success (B3/V1 tests).

## File ownership and dispatch

[Tasks](../../../specs/002-local-profile-dashboard/tasks.md) is the exclusive complete file list and DAG; no files outside those assignments are implied. Coordinator reads current dirty diffs before dispatch and supplies root/folder AGENTS, `backend/.agents/skills/sum-nestjs-implement/SKILL.md` or `client/.agents/skills/sum-react-implement/SKILL.md`, contract revision, dependencies, tests, source limits and browser ownership. Workers do not alter shared/root docs/contracts unless assigned LP-S1. Verification uses local folder verify skills then root `.agents/skills/sum-fullstack-verify/SKILL.md`. No worker spawned by this plan.

Independent S1/R1 can occupy two slots; after contract freeze, sequence B1/F1, B2/F2, B3/F3, B4/F4 as specified. V1 bootstrap preparation may use a free slot but actual browser run waits for layers and browser transfer. F1 alone regenerates routeTree after route owners finish. This is a recommendation, not an instruction to add nested workers or automatic expensive reviewers.

## LP-S1 — shared contract runtime

**Files:** shared/local-profile-dashboard.{mjs,d.mts,test.mjs}. **Consumes:** Claude-reconciled LPD-CONTRACT-1 and existing MR2 exports. **Produces:** exact types/exports from contract, including `DashboardPayloadMap<ApiResponseMap>` client binding.

- [ ] Add `catalog_exact_four`, `identity_correlation`, `extra_keys_rejected`, `bad_time_rejected`, `payload_validator_called`, `null_report_only_dashboard` tests with independent synthetic values; wrong run/session/actor/key and duplicate actors throw; ordered four choices and valid MR2 session/context pass.
- [ ] Run `node --test shared/local-profile-dashboard.test.mjs`; expect missing module/export FAIL before implementation.
- [ ] Implement named assertion functions; call existing MR2 validators; `.d.mts` matches exports; no imports from backend/client or parallel MR schema.
- [ ] Same command PASS; client/backend build after consuming tasks ensures generic map compile. Freeze revision before layer work; inspect diff, commit only if separately requested.

## LP-R1 — repair raw cause-key ordering

**Files:** exact R1 list in tasks. **Consumes:** current shared orderedSet semantics. **Produces:** `canonicalizeCauses(causes:readonly MatriculaRegularCause[]):MatriculaRegularCause[]` in canonical-causes.ts, used by both existing functions.

- [ ] Add `simultaneous_causes_validate_http`, `prefix_and_separator_order`, `dedup_preserves_sources` tests. Real fixture: preEnrollmentEnabled=false plus institutional.debt='unmet' plus credit-invalid nonempty selection; test valid response with all known causes and zero academic effects for both schools. Additional pure test enumerates all supported cause codes and course/section combinations and validates resulting Outcome, including same-code empty/nonempty course/section arrays. Do not invent a new enum for prefix test; use supported codes.
- [ ] Run `pnpm --dir backend test test/matricula-regular-cause-order.spec.ts`; confirm current validator/order regression fails (if repro differs, diagnose fixture without weakening expectation).
- [ ] Deduplicate by exact `${code}|${courseIds.join(',')}|${sectionIds.join(',')}`; compare entire raw key via `<`/`>` with0 equality, matching validator; preserve existing source behavior. Replace only duplicated ordering implementations, do not change academic rules or shared validator.
- [ ] Same test PASS, then backend build/lint. This is not old T030 completion or MR-MODEL-3 implementation. Transfer ownership from any existing rules/service worker first.

## LP-B1 — shared server session and elapsed clock

**Interfaces:** `LocalProfileSessionService.catalog():Envelope<ProfileCatalog>`, `requireActive(snapshot:RunSnapshot,identity:Identity,now:Date):MatriculaRegularSession` (read-only; throws the contract precedence errors; never renews or mutates); `createAdvancingSyntheticClock(base='2026-08-11T14:00:00.000Z',elapsedNow?:()=>number):ServerClock`. There is no session-read or close endpoint (LPD-DEC-1 D3). All names/types from contract. Session create/renew remain existing MR2 methods.

- [ ] Add `session_boundary_899999_900000`, `renew_same_identity_expiry`, `reads_do_not_renew`, `clock_monotonic`, `clock_window_2h`, `run_actor_session_mismatch` tests. Inject elapsed variable starting0; run100 GETs, assert startedAt/expiry and sessions count unchanged. Advance899999 active;900000 expired; renewal while active sets now+900000, never revives expired.
- [ ] Run `pnpm --dir backend test test/local-profile-session.spec.ts`; expect missing service/clock FAIL.
- [ ] Implement snapshot reads/identity precedence; no session mutation, new session repository, auth or TTL for requests. Catalog names/scopes from repository actors. Use one clock token in later composition.
- [ ] Same command PASS; backend build/lint. No AppModule/server startup.

## LP-B2 — compatible synthetic dashboard projections

**Interfaces:** `projectStudent(actor:ActorProfile):AlumnoFixture`, `projectProfileRead<K extends CompatibleKey>(key:K,actor:ActorProfile):CompatiblePayloadMap[K]`, where CompatibleKey is DashboardKey minus AcademicKey/ReportKey and CompatiblePayloadMap structurally reuses backend existing MI/report/asistencia/tutoria types. Functions in profile-projection.ts; types in profile-projection.types.ts; no client runtime imports.

- [ ] Add `four_actor_identity`, `school_plan_period_mapping`, `catalog_sections_8_13`, `no_private_or_mock_repository`, `empty_records_not_approval`, `independent_clones` tests. Assert IDs/names/schools/plan agree; optional personal values display unavailable; no invented DOB/document/paid/healthy/Regular claim; empty history/evaluation/debt/attendance/tutoring rows; modifying one response does not alter another.
- [ ] Run `pnpm --dir backend test test/local-profile-projection.spec.ts`; expect missing projection FAIL.
- [ ] Use existing catalog/type definitions and independently constructed profile data per contract. Do not instantiate ReportesRepository/MiInformacionRepository, import mocks or read snapshot/env/files. Runtime validation on client reuses existing compatible validators; tests feed outputs through corresponding shared validators where available.
- [ ] Same command PASS; backend build/lint. Per LPD-DEC-1 D2: `perfil` payload is `null`; alumno uses the exact local-v1-valid values in that decision (desEspecialidad 'No disponible', numeric codes0); add tests `perfil_unavailable` and `alumno_local_v1_valid`. Never synthesize a birthday/status.

## LP-B3 — academic context and committed report projections

**Interfaces:** extract `projectContext(snapshot:RunSnapshot,actorId:MatriculaRegularId,now:Date):MatriculaRegularEnvelope<MatriculaRegularContext>` into context.service.ts; existing `ContextService.read` delegates with same semantics. `projectAcademicRead(key:AcademicKey,snapshot:RunSnapshot,actorId:ActorId,now:Date):MatriculaRegularContext`; `projectCommittedReport(snapshot:RunSnapshot,actorId:ActorId):MatriculaRegularEnrollmentReport|null` in academic-projection.ts.

- [ ] Add `context_gate_same_evaluator`, `documentary_unknown_unchanged`, `report_null_before_commit`, `exact_report_after_commit`, `school_actor_isolation`, `report_link_corruption_fails`, `report_immutable_after_offer_change` tests. Real service accepts three4-credit courses for A, B sees none; no report after rejected/pending; unknown health/scope/window does not grant entry; check all F6 rows/unknownDates unchanged under advancing clock.
- [ ] Run `pnpm --dir backend test test/local-profile-academic.spec.ts`; expect missing projections FAIL.
- [ ] Refactor only Context snapshot sampling, preserving read wire; report by enrolled actor links to exact stored report and validates MR2 shape; fail closed on corruption. No report build from current offer/seed, no rules duplication.
- [ ] Same command PASS; relevant existing foundation/US1 regression tests and backend build/lint. R1 required for multi-cause path; old model3/matrix is independent, not a prerequisite for writing this projection.

## LP-B4 — additive HTTP module

**Interfaces:** `LocalProfileDashboardService.catalog/read<K>` delegate to B1/B2/B3 and sample one run snapshot/now per read. Controller mounts exact contract paths, module imports MatriculaRegularModule once, supplies no second repository/clock. It uses exported MR2 error filter and input validator patterns.

- [ ] Add HTTP cases `catalog_entry_cycle`, `all14_keys`, `invalid_query_body_path`, `wrong_run_actor_session`, `expired_read`, `session_boundary_899999_900000`, `run_reset` in local-profile-dashboard-http.spec.ts; Test module imports only new module, override clock with synthetic controllable instance. Assert success/error exact shapes, headers JSON and described precedence.
- [ ] Run `pnpm --dir backend test test/local-profile-dashboard-http.spec.ts`; expect missing module/routes FAIL.
- [ ] Implement endpoints/runtime DTO parsing and typed projections. Consult rejects expired with409 SESSION_EXPIRED; no close/session-read routes exist. Do not mount in operator AppModule.
- [ ] Same command PASS; backend build/lint; negative assertions that operator modules are absent in module graph. Real HTTP tests do not establish React integration.

## LP-F1 — transport, memory store and root login

**Interfaces:** `createLocalProfileDashboardApi({fetchImpl?})` returns catalog/read<K> using typed contract (session create/renew via existing `createMatriculaRegularApi`); `createLocalProfileSessionStore({dashboardApi,enrollmentApi})` exposes contract store methods, subscription and discriminated snapshots. `localProfileSessionStore` singleton; `getActiveProfileIdentity():Identity` throws when unavailable. `sumApi.get<K>` keeps existing API but branches active profile academic keys to dedicated typed dashboard API at route adapters, compatible keys unwrap existing validated payloads.

- [ ] Add tests `enter_double_click_one_create`, `reload_new_store_anonymous`, `navigation_no_create`, `wrong_identity_response_fails`, `late_response_generation_ignored`, `logout_no_http`, `client_deadline_never_early`, `activation_switch`, `no_fallback_on_error`. Two deferred fetches resolve A after B; B state unchanged; protocol/network failures never use mockResponses. Inject APIs so tests do not evaluate browser env or open network.
- [ ] Run `pnpm --dir client test:data`; expect new tests fail on missing functions; retain known unrelated baseline failures separately.
- [ ] Implement store and `/local/login` as the user-approved simple access form (one radio group of four catalog profiles, one “Ingresar” button, explicit local-only text, retry; no password/SUM look-alike/remembered choice); root anonymous branch fetches only catalog and renders login outside Shell. Active root loader retains formulario envelope type for student hooks; router redirects ordinary protected direct URLs to login without fetching old data. Handle active identity generation/invalidate/abort before awaiting. Feature is activated only when `VITE_SUM_DATA_MODE=local` and `VITE_SUM_LOCAL_PROFILE=synthetic-actors` (set by V1 Vite config/start script; absent → legacy; other value → configuration error), not merely local mode; default/operator branch remains existing behavior. Do not persist session in browser storage.
- [ ] Same data tests PASS, client build/lint. F1 alone regenerates routeTree after route additions, then after F3/F4 if necessary. Do not hand-edit generated types.

## LP-F2 — global shell/student controls

**Interfaces:** `useLocalProfileSession()` subscribes store; `LocalSessionControls()` renders countdown, explicit renewal/logout; `useShellStudent` and `useStudentFormData/useStudent` preserve consumer return types with active actor data from root/store. Existing legacy branch retained outside isolated demo.

- [ ] Tests in F1-owned store suite must be added before ownership transfer or provided as patch request; F2 owns browser assertions under V1 coordination: countdown starts15:00, elapsed time decreases, same session on menu navigation, renew preserves startedAt, logout moves focus to login heading. No direct F2 edits to F1 tests while F1 active.
- [ ] Before implementing UI, execute V1 targeted scenario `node client/scripts/verify-local-profile-dashboard.mjs --scenario session-controls` once harness is ready; expect current hardcoded00:00:00/disabled logout FAIL. Until harness exists record pending red, not passed.
- [ ] Replace fixed clock and disabled logout only in profile demo branch; renewal button disabled while pending/expired; visible errors/status accessible, timer does not announce every second. UI max0 uses server anchor+elapsed time; ordinary navigation does not reset. Logout calls `store.logout()` only: synchronous clear, no HTTP.
- [ ] Same scenario PASS; client build/lint. No generic redesign or fabricated header fallback.

## LP-F3 — enrollment within existing shell

**Interfaces:** `LocalAcademicView({kind,response})` consumes academic Context or report/null typed union, reuses existing panels/tables/report view. `localAcademicView.ts` exports pure report/schedule view conversion from committed Report using buildReportView. RegularEnrollment receives actor/session via global store, uses existing createSubmissionFlow/recovery helpers and result dialogs unchanged in protocol.

- [ ] Add `schedule_from_committed_report`, `null_report_empty`, `no_actor_default`, `scope_isolation` data tests; V1 `--scenario enrollment` red checks no inner actor chooser/session-create and no extra session POST on Ver matrícula.
- [ ] Run client test:data for pure tests and future targeted scenario; current own actor/session behavior must fail the integration expectation.
- [ ] Remove scoped local actor/session create ownership from RegularEnrollment, consume store, keep Context entry gates and selection clearing on expiry. Renewal button lives in global shell. Report route requires `search.runId/actorId` equal to the active or expired store identity, otherwise redirects to `/alumnoWebSum/v2/reportes/matricula` without fetch (`report_route_identity_guard`); never query-provided actor override. Add `uncertain_A_B_A_lookup`. Wire result lookups remain MR2 and manual; preserve pending intent on leave/logout/expiry. Profile-mode matricula-informacion renders LocalAcademicView with link labelled “Ver matrícula” to /local/matricula-regular (local-only, D5); `EnrollmentInfo.tsx` stays unchanged for legacy modes; outside profile mode /local/matricula-regular shows only an availability notice. Accepted outcome additionally links committed local report.
- [ ] Tests/scenario PASS; client build/lint, existing matrícula data/recovery tests remain passing. UI context blocked plus forced HTTP rejection is distinct acceptance, not a fabricated D2 transition.

## LP-F4 — remaining route adapters and truthful displays

**Interfaces:** existing compatible `sumApi.get<K>` results unchanged; academic route loaders call `dashboardApi.read(key,identity)` and pass typed result to LocalAcademicView. Static Manuales content remains existing resources under global guard; Home summary uses same active actor.

- [ ] V1 scenario `--scenario routes` defines64 visits (16×4) plus late-A response while B active, empty/error retry cases and no outgoing legacy/mock path in profile mode. Record old unauthenticated/root behavior as red before edits.
- [ ] Adapt exact15 route files assigned in tasks and screens. Compatible MI/table screens reuse existing schemas/components. Academic programacion/prematricula/plan show Context-known data and gaps; report/horarios show committed report/null. Explanatory synthetic empty records must not imply debt paid, health approved, tutoring fulfilled or official enrollment. No silent numeric section coercion into legacy official rows.
- [ ] Run targeted64-visit scenario after V1 ready, client test:data/build/lint. Verify same clock/session per actor, no seed record, stale response discarded, direct route anonymous/login coherent. Compare only local behavior, no unsupported pixel/N3 claim.

## LP-V1 — isolated runnable demo and real integration harness

**Interfaces:** `createLocalProfileDashboardTestApp({clock?}={})` returns `{app,repository,clock,listen(port?:number):Promise<string>,reset():string,close():Promise<void>}`; reuse TestingModule style from existing matrícula test-app but new module only, default advancing clock. `scripts/start-local-profile-dashboard.mjs` is developer entry, not default operator startup. `client/vite.local-profile-test.config.ts` selects profile demo mode and receives owned backend origin; no SYN-SHELL-001 middleware. Scenario runner options `--scenario session-controls|enrollment|routes|all`, default all.

- [ ] Bootstrap spec asserts imports exclusively local module/MR factories, no AppModule/snapshot/operator env path; rejects external/nonloopback proxy and occupied explicit ports, otherwise listen0 and pass actual origin. Construct child env allowlist PATH and local mode/proxy/feature switch only; never spread process.env. Test bootstrap before starting any browser/server; no inherited MATRICULA_SNAPSHOT_DIR.
- [ ] Run `pnpm --dir backend test test/local-profile-dashboard-bootstrap.spec.ts`; expect missing bootstrap FAIL, then implement and rerun PASS.
- [ ] Implement owned backend + Vite test instance + fresh isolated Playwright context. Transport fault injection may drop browser-visible response after real commit, never mock accepted success. Root is sole browser owner. Every finally closes only owned processes/contexts; no attachment to existing localhost server.
- [ ] Run `node scripts/start-local-profile-dashboard.mjs` for reviewable local demo (prints owned loopback URLs, Ctrl-C cleans up), and `node client/scripts/verify-local-profile-dashboard.mjs --scenario all` for automated acceptance; expected process exit0, criterion ledger with LP-A01–12 and64 route visits, actual actor/run evidence, no tokens/private data. Fake elapsed clock in harness allows900000 boundary without15-minute wait. No command here was executed in docstage.

## LP-V2 — final local acceptance and separate scope report

- [ ] Run backend build/lint, targeted new suites and existing relevant matrícula foundation/US1/recovery/regression suites; client build/lint/test:data. Commands use current scripts: `pnpm --dir backend build`, `pnpm --dir backend lint`, `pnpm --dir backend test test/local-profile-session.spec.ts test/local-profile-projection.spec.ts test/local-profile-academic.spec.ts test/local-profile-dashboard-http.spec.ts test/local-profile-dashboard-bootstrap.spec.ts test/matricula-regular-cause-order.spec.ts`, `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data`. Expected exit0; global pre-existing failures recorded with affected scope, never silently called pass.
- [ ] Run V1 all scenario against real isolated React/Nest chain; include reject/pending/accepted per school, one last-vacancy race, response-loss/manual recovery, reset, logout race, malformed-response no-fallback and keyboard chooser/renew/logout/dialog/report. Assert request/enrollment/report/capacity before and after via owned repository, not production APIs. Existing tests may supply sufficient MR2 coverage; do not require old242/170 matrix to accept independent dashboard criteria.
- [ ] Write verification.md criterion→scenario→expected→actual→artifact/command; report feature002 local contract/UI/integration, visual fidelity, normative fidelity, N3 and old001 remaining tasks separately. Tests not run remain pending. Never mark001 tasks complete in002 ledger.
- [ ] Inspect assigned diffs and required checks. At most1 repair cycle per failure, then diagnosis/decision. No automatic commit/deploy/production action; no broadening into private operator runtime.

## Claude decisions (resolved)

[LPD-DEC-1](../../reverse-engineering/plans/local-profile-dashboard-decisions.md) resolved the four handoff points and is applied to every LPD document:

1. **Academic payloads:** six keys use MR2 Context/Report through the additive typed map; legacy wire, `ApiResponseMap` and legacy modes stay unchanged.
2. **Compatible personal data:** `perfil` payload is exactly `null` (explicit unavailable branch); alumno projections use only local-v1-valid values (desEspecialidad 'No disponible', numeric codes0); no invented personal facts.
3. **Activation/bootstrap:** `VITE_SUM_DATA_MODE=local` + `VITE_SUM_LOCAL_PROFILE=synthetic-actors` only via V1 Vite config/start script; backend only via isolated test app with advancing clock base `2026-08-11T14:00:00.000Z`; AppModule untouched.
4. **Session expiry/logout:** no close or session-read endpoint; logout is client-only and synchronous; server decides expiry; client deadline never earlier than server; entry-response loss is a deliberate re-entry; MR2 recovery helpers unchanged (already keyed by run/actor).

The access form (simple four-profile radio selector) is user-approved. No further planning pass is required; coordinator dispatches per tasks waves.
