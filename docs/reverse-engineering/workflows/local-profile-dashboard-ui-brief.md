# Frontend package — LP-F1, F2, F3, F4

CURRENT ROUTING OVERRIDE (latest user instruction): UI belongs to Codex GPT-6 Luna High. Reuse partial work and ui-worker-report.md left by the predecessor; do not restart from baseline. Four units F1 F2 F3 F4 remain the assigned package, shared modules are accepted/frozen and architecture fixed by Claude Opus LPD-DEC-1/1a. Do not change backend/shared/contracts.

Worktree: ../sum-dashboard-ui. User authorized implementation/delegation and chose a simple access form with four-profile radio group. Contract LPD-CONTRACT-1 and decisions LPD-DEC-1 including appended LPD-DEC-1a are READY and authoritative. S1 shared modules are already copied and frozen (7 tests PASS in root), backend Codex works independently. Read this brief first, then these contract/decisions and specs002/spec.md. Root AGENTS, client/AGENTS and client/.agents/skills/sum-react-implement/SKILL.md plus local-profile-dashboard-worker-rules.md apply. You are not alone; no subagents or reverting others.

EXCLUSIVE OWNERSHIP: all F1–F4 exact client files in synchronized specs/002-local-profile-dashboard/tasks.md, including routeTree generated only by you. No backend/shared/AppModule/root config/package/dependencies/spec/plan/contract edits. You additionally own safe local CodeGraph metadata and evidence/local/local-profile-dashboard/ui-worker-report.md in this worktree. Validate codegraph.json exclusions (private, datos-reales, dependencies, foreign symlinks) before codegraph init when local index is absent; record actual result. No private/operator runtime/production access, no browser ownership.

LPD-DEC-1a takes precedence over old D1 wording: only enter success, logout and run change advance identity generation and clear/invalidate router; observe/ticks/renew/entering/error/markExpired DO NOT trigger loader invalidation. root loaderDeps={generation}; tests observe_no_loader_rerun, identity_transition_clears_cache, expired_guard_exception are required. Profile route reads typed API directly for perfil:null, preserving ApiResponseMap/sumApi signatures (same for six academic keys). Only currently mounted enrollment recovery remains after expiry; other current protected routes and all later protected navigation go to chooser without data fetch.

Implement ALL FOUR units sequentially in this dispatch. Reuse existing components, no generic redesign/password/auth/new dependencies. One session created on deliberate entry and retained across navigation; server clock 15min, explicit renewal; actor data everywhere, no fallback/seed/other profile. Enrollment within current Shell from Ver matrícula uses the active actor/session; existing atomic MR2 result/recovery/report unchanged, no selector or createSession inside enrollment. A→B→A pending intents survive under existing per-run/actor storage. Empty/unavailable facts show truthful local states, not official approvals. Retain legacy/operator/mock behavior outside explicit VITE_SUM_LOCAL_PROFILE=synthetic-actors + local activation. Local-only standalone availability notice migration is specified in D5.

Use pure injected data tests, client test:data/build/lint; do not open browsers or run generic verify.mjs. V1 real browser harness is not written yet, so its red/green steps remain pending and do not block writing/tests of UI; report browser acceptance PENDING for root rather than fake PASS. Required test cases in excerpts and LPD-DEC-1/1a. Do not change frozen exports/shapes to make tests pass: ask coordinator. One automatic repair cycle then diagnostic ask. No commits/git add baseline. On completion read inbox, send worker_done exactly once with actual file list and full report path, then idle. Report each F1–F4 status, commands/exit codes, affected old tests and remaining concerns. Unknown functional/UI behavior must be asked through coordinator, never invented.

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
