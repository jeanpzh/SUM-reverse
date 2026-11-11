# T3: normative generation and publication integration

Date: 2026-11-10. Internal academic-planning product, local-only implementation.
No screen, component, CSS, student code, production SUM, private snapshot or Python-engine change.
Existing interfaces and the A/B/C direction in `docs/design-direction.md` are preserved.

## Sources and implementation

- `academic-normative-profile.mjs/.d.mts`, revision `UNMSM-AAD-2026-04`: reused unchanged as the only regulatory authority.
- `../docs/adr/0003-regulated-load-exceptions-and-lexicographic-prelation.md`, the T1/T2 results and PA-ENGINE-2 contract in `../docs/reverse-engineering/plans/programacion-academica-normative-engine.md`, and `../planning-engine/README.md`.
- `../docs/domain/fisi/2026-II/planning-teaching-load-norms-2026-11-10.md`: normative sources OF-02/OF-07 and their explicitly unresolved/inferred limits. This integration does not independently verify these sources or establish SUM behavior.
- Existing independently synthetic catalog, tests and prototype reference profiles. The 60-minute demo duration is an explicit local parameter, because synthetic sessions are multiples of 60. FISI's actual duration remains unverified. Contract/unknown-resource fallback caps remain explicitly synthetic data.

The shared contract adds optional workspace/request lective duration and request academic period, optional engine evidence and normative proposal reports. Existing teacher-load validation is reused by the schedule validator. The shared prototype profiles now store planning terminology once and derive the unchanged chat exports.

Backend resolves the authorized minimum of declared and regulatory caps before either generator, sends finite next-exception caps only as analytical options, and forwards priorities and engine evidence. Exception decisions gain the profile's requirements and source IDs. Reports aggregate gaps and calculate blockers from actual assigned minutes; manual changes recompute them. A resumed proposal retains its workspace context in memory. Publication independently recalculates blockers from the configured teachers and published assignments and returns HTTP 409 / `LOAD_AUTHORIZATION_REQUIRED` with the blocker list. Approval/conformity cannot clear this requirement.

Persistence accepts the exact previous synthetic catalog fingerprint as a compatibility case, while retaining checksum, request, resource, schedule, retention and approval validation. Newly written documents use the current fingerprint.

Client changes are limited to data: preserve teacher fields, use consistent synthetic profiles/defaults, carry the explicit duration through generation/save/resume and translate the conflict into a human message.

## Acceptance: criterion → synthetic test → actual result

| Criterion | Test / expected behavior | Actual |
| --- | --- | --- |
| 1. DE/TC caps and analytical exception | `backend/test/programacion-academica-normative.spec.ts`: both regime cases and injected-fetch adapter test. Declared 9999 → 720, next exception 1200 / voluntary declaration; recorded declaration → 1200 with no finite larger exception. | Pass, included in final 6 normative tests and 55 targeted tests. |
| 2. Missing data and old periods | Same regime cases: missing regime retains 9999 and `REGIME_MISSING` contains `SYN-T`; missing duration retains 9999 and reports `LECTIVE_HOUR_MINUTES_MISSING`; 2026-I retains declared cap and reports the resolver's period gap. Fallback has no engine-only evidence. | Pass. |
| 3. Teacher fields and old drafts | `programacion-academica-persistence.spec.ts`: regulated draft validation/save/resume preserves every teacher field; pre-normative persisted fingerprint and proposal without metadata resumes. `academicPlanningNormative.test.ts` covers local/reference copies; `planningSession.test.ts` covers generation/save context and hydration. | Pass: persistence 15 tests; client data 310 tests. |
| 4. Proposal evidence | `programacion-academica-normative.spec.ts`: mocked engine proof/certificate/decisions/prelation survive; load exception has `requires`/`sourceIds`; future window/split decisions survive. `shared/programacion-academica-api.test.mjs` validates accepted and malformed shapes. | Pass. |
| 5. Publication authorization and leave | `programacion-academica-normative-publication.spec.ts`: same synthetic 960-minute schedule after conformity/approval is rejected against 720, succeeds with the recorded declaration, and blocks on leave with no required authorization kind. | Pass: 5 publication tests. |
| 6. Unregulated maxima | Same publication suite: contract, part-time and missing regime publish without blockers and have teacher-specific gaps. | Pass. |
| 7. One synthetic profile source | `client/src/data/academicPlanningNormative.test.ts`: all 91 reference teachers agree with chat appointment/dedication mapping and demo caps. Existing `prototypeTeacherProfiles.test.ts` remains unchanged. | Pass, included in 310 client data tests. |
| 8. Regression and static checks | Commands and real output excerpts below. R1's fixture now passes the same academic period to initial generation and regeneration; the complete equality assertion remains. | Passed across full run plus targeted repairs; initial failures are recorded below. |

Additional coverage: manual reassignment respects resolved caps and revalidates the report; a resumed legacy request with duration only in the workspace retains that duration after a manual adjustment.

Publication tests use an explicitly synthetic historical-source adapter to reproduce old generation with declared caps. Review, approval, publication, runtime validation and filesystem persistence use the real services. No live engine or browser is used to establish this result.

## Executed checks

All commands ran with `nice`. No browser downloads or Docker images. Dependencies were initially missing; pnpm automatically materialized them from the existing lockfiles/shared store, without lockfile changes. Disk: 2.1 GB initially, 1.8 GB minimum observed, 1.9 GB at final verification.

1. `nice node --test shared/programacion-academica-*.test.mjs shared/academic-normative-profile.test.mjs`

   ```text
   tests 70
   pass 70
   fail 0
   duration_ms 2715.833
   ```

   After statement-format cleanup, targeted `nice node --test shared/programacion-academica-api.test.mjs shared/academic-normative-profile.test.mjs`: `tests 20`, `pass 20`, `fail 0`.

2. `nice pnpm --dir backend exec vitest run programacion-academica --maxWorkers=1`

   ```text
   Test Files  1 failed | 22 passed (23)
        Tests  1 failed | 351 passed (352)
     Duration  59.83s
   ```

   Only R1 failed: the baseline request omitted its period, whereas regeneration obtained it from the workspace, producing different normative reports. The fixture now carries the same period in both operations; no assertion was relaxed. Targeted regeneration retry: `1 passed (1)` file, `25 passed (25)` tests.

   A subsequently added legacy-resume/manual-adjustment test exposed lost workspace duration. The in-memory retention now carries its normative context. Final targeted command:

   `nice pnpm --dir backend exec vitest run test/programacion-academica-normative.spec.ts test/programacion-academica-persistence.spec.ts test/programacion-academica-manual-review.spec.ts test/programacion-academica-regeneration.spec.ts --maxWorkers=1`

   ```text
   Test Files  4 passed (4)
        Tests  55 passed (55)
     Duration  17.07s
   ```

   New normative-publication suite separately: `1 passed (1)` file, `5 passed (5)` tests. The full suite was not repeated after these targeted repairs. An earlier literal glob passed to Vitest selected no tests; it was replaced by the `programacion-academica` filter above and is not counted as validation.

3. `nice pnpm --dir backend build`: exit 0 (`nest build`). Repeated once after the diagnosed legacy-context correction; final result also exit 0.
4. `nice pnpm --dir backend lint`: exit 0. Four existing `typescript(unbound-method)` warnings in untouched `test/local-profile-session.spec.ts` at lines 52, 68, 89 and 135. After the final correction, targeted `oxlint --type-aware` on `demo-proposal.service.ts`, `programacion-academica-normative.spec.ts` and `programacion-academica-regeneration.spec.ts`: exit 0, no diagnostics.
5. `nice pnpm --dir client test:data`:

   ```text
   tests 310
   suites 8
   pass 310
   fail 0
   duration_ms 893.144617
   ```

   A new session test initially failed compilation because it referenced a helper outside its fixture scope. Its fixture was corrected and the command above rerun successfully.
6. `nice pnpm --dir client exec eslint src/data/academicResources.ts src/data/academicScheduling.ts src/data/planningSession.ts src/data/academicPlanningNormative.test.ts src/data/planningSession.test.ts`: exit 0, no diagnostics.
7. `nice pnpm --dir client build`: exit 0; `3347 modules transformed`, `built in 22.18s`. Existing chunk-size advisory and plugin timing notices remain.
8. `git diff --check`: exit 0.

## Changed files

Shared:

- `programacion-academica-api.mjs`, `.d.mts`, `.test.mjs`
- `academic-planning-policy.mjs`, `.d.mts`
- `prototype-teacher-profiles.mjs`, `.d.mts`
- This execution record.

Backend (`../backend/src/programacion-academica/`):

- `normative-planning.ts` (new)
- `demo-proposal.service.ts`
- `generator.types.ts`
- `planning-engine.client.ts`
- `saved-draft.service.ts`
- `schedule-validator.ts`
- `schedule.types.ts`
- `synthetic-catalog-adapter.ts`

Backend tests (`../backend/test/`):

- `programacion-academica-normative.spec.ts` (new)
- `programacion-academica-normative-publication.spec.ts` (new)
- `programacion-academica-persistence.spec.ts`
- `programacion-academica-regeneration.spec.ts`

Client (`../client/src/data/`):

- `academicPlanningNormative.test.ts` (new)
- `academicResources.ts`
- `academicScheduling.ts`
- `planningSession.ts`, `planningSession.test.ts`

## Follow-up and deviations

- The existing generation endpoint accepts `AcademicRequest`, not a workspace. Optional `academicPeriod`/`lectiveHourMinutes` on that existing request are the necessary data seam; the client sends the same context on generation and save. No parallel endpoint or contract was introduced.
- Exact previous-catalog fingerprint compatibility was necessary to meet old-draft loading after changing demo defaults.
- The final backend rebuild and narrowly scoped lint/tests were necessary after diagnosing the legacy-context loss. No repeated stack launches or broad retesting followed it.
- UI ticket T5 must display decisions, their proof/basis and formal requirements, teacher-scoped gaps and blockers, and provide deliberate recording of authorization references (and VRAP maximum). Approved/published drafts retain their existing immutability: authorization changes follow the existing new-draft workflow. Conformity/approval alone must never grant authorization.
- Real Python-engine integration and the 56-course end-to-end scenario were not executed here; engine response forwarding is covered with synthetic mocked output. T6a window/split shapes are accepted now for later integrated verification. No visual or SUM-reference fidelity claim is made.
- No outstanding T3 implementation blocker. The normative source's existing unverified/inferred limits remain explicit in reports.
