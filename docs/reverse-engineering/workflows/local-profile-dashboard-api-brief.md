# API worker package — LP-R1 then LP-S1 and LP-B1–B4

CURRENT ROUTING OVERRIDE (latest user instruction): backend belongs to Claude Sonnet High. The previous Codex attempt is being handed over cooperatively. R1 and S1 are ALREADY ACCEPTED AND FROZEN; do not reimplement or rerun their unchanged baseline checks. The replacement owns ONLY B1 B2 B3 B4, reusing partial work and api-worker-report.md from its predecessor. Full GO-LPD-CONTRACT-1 remains valid. Ignore historical model/start-R1 wording in the original task description; actual launcher selects Claude Sonnet and this latest handoff specifies remaining work. Unknown behavior/UI goes to coordinator ask, difficult architectural changes to Claude Opus/human as applicable.

Worktree: ../sum-dashboard-api. You are not alone; no subagents, preserve others' changes. Read root AGENTS, backend/AGENTS and backend/.agents/skills/sum-nestjs-implement/SKILL.md plus the root worker-rules document. Private access and operator runtimes are prohibited.

Current authorization: execute ONLY LP-R1 immediately using fixed MR-CONTRACT-2. Claude Opus is reconciling global architecture; do NOT implement S1/B1–B4 until coordinator sends explicit GO-LPD-CONTRACT-1 and synchronized documents. After LP-R1, ask coordinator for GO if not delivered; work on no unassigned code while waiting. This one package owns six logical units; report each separately.

Exclusive runtime files: R1 owns FIVE exact files: backend/src/matricula-regular/rules.ts, backend/src/matricula-regular/selection.rules.ts, backend/src/matricula-regular/matricula-regular.service.ts, backend/src/matricula-regular/canonical-causes.ts, backend/test/matricula-regular-cause-order.spec.ts. In addition it owns shared/local-profile-dashboard.{mjs,d.mts,test.mjs}, backend/src/local-profile-dashboard/**, backend/src/matricula-regular/clock.ts and context.service.ts, backend/test/local-profile-{session,projection,academic,dashboard-http}.spec.ts. Do NOT own bootstrap/Vite/browser files (V1), AppModule, other backend modules, client, specs/plans/contracts, package manifests or dependencies. You also own safe local CodeGraph metadata, after validating codegraph.json exclusions and foreign dependency symlinks before init if index absent.

After S1 is implemented and node --test shared/local-profile-dashboard.test.mjs passes, send a STATUS milestone 'S1 shared ready' with the three paths and command/output before continuing backend work. Coordinator will synchronize those files for frontend. Shared contract freezes after that; do not change exports/shapes without ask.

No browser ownership; run only synthetic data/HTTP suites with isolated modules. No commits or git add of baseline. Required checks: shared Node tests, targeted new backend tests, cause-order regression plus affected existing MR2 suites, backend build and lint. Max one automatic repair cycle then report diagnosis. Report path evidence/local/local-profile-dashboard/api-worker-report.md (explicitly assigned in this worktree). Before worker_done read inbox; send once exactly per injected task/dispatch authority, list actual modified files/checks and unmet criteria. After all assigned authorized units settle, idle.

GO-LPD-CONTRACT-1 COMPLETO granted by coordinator after LPD-DEC-1 reconciliation: implement LP-S1 and LP-B1–B4 in dependency order. The synchronized READY contract and decision file prevail. No SessionView/read/close endpoints or server session mutation. S1 shared-green milestone remains required before backend continuation so frontend can consume the frozen three shared files. LP-R1 is already integrated in root and must not be edited again without ask.

Reconciled excerpts:

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
- Follow actual configured Luna High implementation roles and folder skills; shared runtime gets its own explicitly assigned root owner before layers.


## Review Focus

- Late actor-A response after actor-B login must be ignored by generation, even if abort is ignored (F1/F4 tests).
- Logout/actor switch during an in-flight commit is client-only: the late response is discarded by generation and the actor's run/actor-keyed intent is recovered manually on re-entry, never by inferred rollback or automatic POST (F1/F3/V1 tests).
- Session expiry at exactly900000ms must use advancing server time, not browser clock or fixed August instant (B1/F2 tests).
- Empty debt/history/official fields must never become institutional approval or fabricated records (B2/F4 tests).
- Inconsistent enrollment/report linkage must produce failure rather than a seeded report or empty success (B3/V1 tests).


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
