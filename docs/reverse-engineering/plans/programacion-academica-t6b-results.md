# T6b — retained engine decisions as advisor (2026-11-11)

Implemented in the existing integration checkout `/home/ubuntu/.t3/worktrees/SUM-reverse/t3-81820e33`, branch `feat/planning-normative-engine`, base `1f7063d`. Existing uncommitted T7/T4b/T8 work preserved. No commits, merges, resets, checkouts, delegation, lock/dependency edits, production/private data or operator services. CodeGraph queried first against this checkout; existing index was present, so no initialization. Root/RTK/folder instructions, binding design direction/redesign specification, ADR 0003, final T6b contract, T4b lifecycle and T8 reports reviewed. NestJS best practices (boundary validation), Vitest and Oxlint guidance applied with the existing shared runtime validators, without new dependencies.

## Contract, migration and removal

- Existing `/propuestas/:id/consejero`, request shape and `expectedEditVersion` CAS retained. Advice rejects running searches and unresolved cleanup using T4b's existing ownership gate. Current resolved normative revision/duration must agree with the retained report.
- Shared response adds `source.mode: engine-decisions`, requiring `providerLabel: null`, no `fallbackReason`, `verifiedImpact` or simulation reasoning. Optional recommendation `decisionIds` must be a nonempty list of unique nonblank strings; the service mapper validates membership against current retained decisions. Unrecognized modes/fields remain rejected. Legacy responses remain readable, including old impact records.
- `analyzeProposalAdvisor` is now a synchronous pure mapping in the existing transport file. Removed live `/v1/advisor`, deterministic deficit/window heuristics, local privacy codec and normative-query fallback from this path. The service no longer separately computes candidates then analyzes/simulates. Python advisor code and unrelated normative endpoint/consumers remain intact.
- Load patch validation uses the existing resource contract's physical weekly bound 10080 rather than the former arbitrary 2400 ceiling. That bound is not authorization: backend recommendations and client application use the shared resolved profile's already authorized cap. Exact increase, previous configured load, period, duration and profile revision are checked. No duplicated normative hours or new profile implementation.
- Window flags and split course IDs come exactly from decisions. A formal exception yields an explanation of requirements/source IDs and directs to the existing PlanningDecisions authorization queue/editor; no executable load patch substitutes a formal authorization. Configuration adjustments alone may yield a legal exact load patch.
- Additional-teacher decisions use eligible existing catalog reference IDs, excluding incorporated identities. No adequate reference means a missing-resource finding without a fictitious candidate. Room references are not suggested without a corresponding retained decision; the existing incorporation patch still supports explicit known room IDs and validates them at application.
- Important incompatibility found: current catalog reference teachers only supply ID/name/course IDs, and room references lack availability. The existing advisor application invented 600 minutes, category/qualification metadata and weekday availability. This path now incorporates teachers with zero configured load and empty availability, rooms with empty availability, and copies only catalog fields. Missing information is disclosed before application; edit it in existing Resources. Repeated incorporation is idempotent; duplicate/unknown patch IDs reject. Existing bulk-editor prototype helpers are separate explicit synthetic presets and were inspected but not changed by this advisor ticket. No new catalog, component or parallel contract.
- Missing decisions/certificate/proof/normative report is reported as missing analysis. Empty complete and inconclusive results are distinct; cancellation never proves impossibility. Certificate totals and retained normative gaps/blockers are explained, never converted into simulated coverage. Section effects remain necessary conditions.
- Existing panel, typography, controls, explicit save, approval and publication retained. Only the authorized internal planning panel changes wording/source label and permits explicit engine-decision application without a simulated preview. Historical impact validation stays available. The session measures impact only after an actual T4b regeneration; no autosave.

## Files changed by T6b

- `shared/programacion-academica-api.{mjs,d.mts}`; extended `shared/programacion-academica-advisor.test.mjs`.
- `backend/src/programacion-academica/{planning-engine.client,demo-proposal.service}.ts`; new `backend/test/programacion-academica-advisor.spec.ts`.
- `client/src/data/{planningSession,academicAdvisor.test}.ts`, `client/src/screens/PlanningStatusBar.tsx`.
- New `client/scripts/verify-planning-advisor-decisions.mjs` and this report.

Several listed files already contained T7/T4b changes; this is a scoped incremental edit, not replacement of those files. No solver/candidate/jobs/main/correlation/profile/report files were edited. Student screens, module chooser and shared student tokens are untouched.

## Acceptance matrix

| Criterion | Independently synthetic scenario/check | Expected | Actual |
| --- | --- | --- | --- |
| Source/traces/legacy | Shared advisor validator suite: invalid mode/source, empty/blank/duplicate/stale decision IDs, legacy record | Reject malformed/stale; read legacy | PASS |
| Exact conversion | Backend advisor suite: load configuration, afternoon-only window, split, formal exception, additional teacher | Exact patches with current decision IDs; formal exception has no patch | PASS |
| No second analysis | Fetch spy throws on any network; own engine proxy records paths | No advisor, LLM, normative or simulation calls for advice | PASS |
| Missing/empty analysis | Missing decisions, empty complete, empty inconclusive | Honest distinct descriptions; no invented recommendations | PASS |
| Authorization/cap/version | Backend excessive/missing cap; client absent/present declaration, exact previous cap, period/duration; obsolete backend profile revision | Legal exact increases only; stale context rejects | PASS |
| References | Missing/duplicate catalog IDs; unknown/duplicate patch IDs; incomplete teacher/room references; repeated inclusion | No fictitious resource/availability/category/authorization; no duplicate identities | PASS |
| Selection/CAS | Empty, unknown, duplicate selection; obsolete proposal edit version | Empty selection accepted; unknown/duplicate/stale rejects | PASS |
| Lifecycle gate | Advisor synthetic running/failed-cleanup ownership states, existing T4b job and session suites | Advice/edit/save remain gated until cleanup confirmed | PASS |
| Explicit apply and actual impact | New default session/data adapter → own NestJS → own Python stack | Analysis doesn't mutate; apply starts jobs; outcome belongs to new real proposal; no save | PASS |
| No coverage promise | Incorporate incomplete catalog reference then real regeneration | Zero load/empty availability cannot establish coverage | PASS |
| Stale configuration | Edit demand after result then apply with old proposal identity | Reject before application | PASS |
| T7 publication and T4b regression | Existing backend normative/publication/jobs suites and all client data tests | Preserve publication and cancellation guarantees | PASS |
| Design scope | Source diff, client build/lint | Existing internal panel/composition/tokens retained | Static PASS; DOM/focus/keyboard/zoom/visual NOT EXECUTED |

## Commands and actual results

All commands used explicit workdirs in this integration checkout. Direct local binaries avoid pnpm's automatic dependency verification. Initial `pnpm --dir backend build` unexpectedly attempted its automatic pre-script install, which failed because the node_modules hoist link is not a real directory; the build itself passed. No explicit install command was run and no dependency/lock file changed. Subsequent commands used existing local executables.

- Root: `node --test shared/programacion-academica-advisor.test.mjs shared/programacion-academica-api.test.mjs shared/programacion-academica-publication.test.mjs` — 18/18 PASS.
- Backend: `SUM_PLANNING_ENGINE_URL=off ./node_modules/.bin/vitest run test/programacion-academica-advisor.spec.ts test/programacion-academica-jobs.spec.ts test/programacion-academica-normative.spec.ts test/programacion-academica-normative-publication.spec.ts test/programacion-academica-publication.spec.ts` — 5 files, 49/49 PASS. Final focused advisor repeat after the profile-version assertion: 5/5 PASS.
- Backend: `./node_modules/.bin/nest build` and `./node_modules/.bin/oxlint --type-aware src/ test/` — PASS; four pre-existing unbound-method warnings in `test/local-profile-session.spec.ts`. Vitest reports the pre-existing vite-tsconfig-paths native-resolution advisory.
- Client equivalent of `test:data`: `./node_modules/.bin/tsc -p tsconfig.data-tests.json` then `node --experimental-strip-types --test --test-isolation=none src/data/*.test.ts` — 341/341 PASS, including existing lifecycle/cancellation and new reference/authorization tests.
- Client: `./node_modules/.bin/tsc -b`, `./node_modules/.bin/vite build`, `./node_modules/.bin/eslint .` — PASS. Build warns about two existing CSS `@reference` rules, >500 kB bundles and plugin timing; no fixes outside scope.
- Root: `node --experimental-strip-types client/scripts/verify-planning-advisor-decisions.mjs` — PASS. Uses the real default session/client, own fresh Python/Nest processes, HTTP proxy recording engine paths, ephemeral ports, independent synthetic configuration, environment allowlist and temp draft directory. First run ports: engine 39569, proxy 35881, API 42671. Final repeat after the retained-report explanation and profile-version guards also PASS: engine 37375, proxy 42821, API 38701. Only tracked child processes receive SIGTERM (bounded SIGKILL fallback), proxy closes, temporary state removed in finally. No frontend server/browser or operator service is needed.

All authored behavioral tests were green on first execution; no red application regression was encountered. Two shell authoring attempts used root-relative paths while the explicit cwd was a child folder, yielding FileNotFoundError/no such file; they made no source changes and were rerun from the explicit integration root. No claim of a red/green diagnosis cycle is made. No T8 scale benchmarks or giant browser suites rerun.

## Limits and integration notes

This is local product behavior, supported by the fixed T6b contract/ADR and retained PA-ENGINE-2 fields, not observed SUM evidence. Reference catalogs remain the existing explicitly synthetic prototype catalogs. Incorporation requires the operator to complete actual resource configuration and evidence; a teacher with no availability/cap is deliberately unusable. No new regulatory authorization is inferred. The formal registration action remains in the existing queue/editor, without a redundant advisor control.

Real session/API/Python integration passed; React DOM rendering, focus restoration, keyboard, 200% zoom, narrow layout and visual fidelity remain unverified in this maintenance task. Existing panel structure is preserved by source inspection/build only. T4b's in-memory retention/restart limitations and T8's search/optimality limits remain as documented in their untouched reports. No universal scheduling, normative publication or visual guarantee follows from these tests.

## Independent audit and principal corrections (2026-11-11)

The auditor confirmed two P2 defects: composed reference incorporation could exceed the
existing resource limit before generation, and SuggestionCard still labelled an already
authorized engine adjustment as an externally authorized simulation. Principal corrected
both directly; no further implementation delegate.

- `planningSession.ts`: validate the entire composed resources before invalidating or
  committing session state. The existing reducer remains atomic on validation failure.
- `SuggestionCard.tsx` gains optional sourceMode; PlanningStatusBar passes the actual source.
  Engine-decision load adjustments explicitly state that the cap is already authorized and
  no new formal authorization is required. Legacy simulation warnings remain unchanged.
- New data regression checks teacher/room maximum boundaries, over-limit rejection and
  unchanged state identity; rendered component regression checks both engine and legacy text.

Both new regressions failed on the original code. A test-fixture correction was required:
rooms have the same existing limit of 128, not the assumed 64; tests now read PLANNING_LIMITS
instead of repeating the numbers. One authoring command used a duplicated child-relative
path and failed before writing; corrected with the absolute checkout path.

Principal verification: client data-test compiler and test:data equivalent **342/342 PASS**;
`node --test client/scripts/test-normative-components.mjs`: **15/15 PASS**. The DOM test worker
was notified to reload the current source before asserting wording. This rendered test is
SSR, not a browser interaction or visual acceptance. No backend/engine change was needed.

## Integrated DOM acceptance (2026-11-11, principal)

The delegated test worker ended without a result; its only run had failed in setup. The
principal took over `client/scripts/verify-planning-integrated-acceptance.mjs` and its
evidence folder. Script-only corrections, no application change:

- hashed source path `client/src/components/ai-elements/SuggestionCard.tsx` (was a nonexistent path);
- launch the installed Playwright headless shell (the forced full-Chromium path is not installed);
- VRAP hours field is labelled `Horas lectivas máximas` (`Máximo autorizado` is a read-only cap);
- the teacher sheet is modal, so the scenario closes it (`Cerrar ficha`) before opening another teacher;
- the rejection assertion targets the visible `No se publicó la propuesta…` message instead of a hidden list item.

Prior checks on this tree: `nest build` PASS, `oxlint --type-aware src/ test/` PASS (four known
warnings), client `tsc -b` and `eslint .` PASS. `vite build` not rerun after the two P2 fixes.

Run: `node client/scripts/verify-planning-integrated-acceptance.mjs` — **6/6 PASS** on an owned
stack (Python engine, recording proxy, NestJS, Vite, headless Chromium; ephemeral ports,
independent SYN resources over the demo catalog, temp draft dir removed, external requests blocked).
Evidence: `evidence/local/planning-integrated-2026-11-11/` (`acceptance.json` + 10 screenshots).

| Criterion | Scenario | Result |
| --- | --- | --- |
| Job starts, live schedule/progress, save blocked while running, keyboard cancel keeps witness | jobs-cancel | PASS (80/80 sessions live; focus-visible ring on Cancelar; no /propuestas or /guardar POST) |
| Authorization draft does not carry across teachers | teacher-isolation | PASS (B reference/hours empty, B service hours 20) |
| Advisor uses engine decisions, explicit apply regenerates | advisor-explicit-regenerate | PASS (`source.mode = engine-decisions`; engine saw only `/v1/solve-jobs`, never `/v1/advisor`; no save) |
| Save → reload → review → approve → publish | lifecycle-success | PASS (draft → in-review → ready-for-approval → approved → published) |
| Publication rejected without lective-hour duration | normative-blocker | PASS (409 `NORMATIVE_VALIDATION_REQUIRED`, gap `LECTIVE_HOUR_MINUTES_MISSING`, visible message) |
| No horizontal overflow at 360/390/720/800/1100/1440; first Tab focus visible | responsive-keyboard | PASS |

Limits and open observations (not repaired in this stage):

- Every scenario logs one `GET …/borradores/:id/vista-previa` → 422 with a console error when a
  draft is resumed. Not diagnosed; needs a decision on whether the client should request it for
  an unpublishable draft.
- After cancellation the `Editar horario` control was not found within 10 s (recorded as
  `editControlGap`, non-failing). Unverified whether a cancelled witness is meant to be editable.
- The "200% zoom" step sets CSS `zoom` and is not real browser zoom; treat zoom as unverified.
- Screenshots are local evidence only; no visual-parity claim against the design references
  (no equivalent viewport/state/content comparison was made). Focus restoration after dialogs
  and full keyboard traversal are not covered.

### Preview 422 diagnosed and fixed (2026-11-11, principal)

Cause: `AcademicPublicationPanel` stays mounted while its stage is hidden and requested
`GET …/borradores/:id/vista-previa` for every resumed saved draft. A draft without a complete
schedule correctly answers 422 `RELEASE_INCOMPLETE`, so each resume logged a console error.
Pre-existing behavior, not introduced by T6b; the backend response is correct and unchanged.

Fix: new optional `active` prop (default `true`); `AcademicScheduling` passes
`currentStage === 'aprobacion'`, so the draft preview is requested only when the approval
stage is shown. No visual or contract change. Client `tsc -b` and `eslint` on both files PASS.
Acceptance rerun: **6/6 PASS**; the only remaining HTTP error is the expected 409 of
`normative-blocker`, and no scenario logs the 422 any more. The other open observations above stand.
