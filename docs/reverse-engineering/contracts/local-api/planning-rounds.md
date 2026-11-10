# PA-ROUNDS-1: teacher confirmation rounds (F-R) and planning core (F-0)

Date: 2026-11-07. Owner: Planner. Status: **fixed local contract**, ready for implementation tickets. Program: [planning-product-program](../../plans/planning-product-program.md). This contract extends [PA-DEMO-1](programacion-academica-demo.md) (teacher review, persistence, publication) without replacing it.

The proposal PDF ("Propuesta: programación académica y matrícula en tres etapas", v1.0, 2026-10-29) is a design requirement (`local-only`). It is not a norm and it is not observed SUM behavior. FISI values stay pending with the faculty (PDF §13.5: "plazos de las rondas docentes"). Nothing here is attributed to the official SUM.

## 1. Sources

| ID | Claim | Source class | Reference |
| --- | --- | --- | --- |
| PROP-4.2.4 | Rounds: accepted sections stay fixed, objections become constraints, the solver regenerates only what is pending, maximum three rounds, the school decides the rest | design requirement (`local-only`) | PDF §4.2.4 |
| PROP-7 | Closed objection list: franja no disponible, exceso de carga, aula inadecuada, otra; validated by the engine; a person confirms | design requirement (`local-only`) | PDF §7 |
| PROP-12 | Deadline per round; when it passes, the school decides | design requirement (`local-only`) | PDF §12 |
| PROP-13.5 | Round deadlines are a faculty parameter | open faculty question | PDF §13.5 |
| L-ROUNDS-1 | The deadline is a date the school enters at submission; it is optional and has no timer or automatic effect | local decision (user brief 2026-11-07, design direction "honest states") | this file |
| L-ROUNDS-2 | Regenerated sections never go to a teacher whose conformity or school resolution is current | local decision | this file, §5.3 |
| L-ROUNDS-3 | Manual adjustment of an accepted section stays possible and invalidates that teacher's conformity (existing PA-DEMO-1 behavior) | local decision, compatibility | [PA-DEMO-1](programacion-academica-demo.md) teacher review |

Out of scope: LangGraph agents AG-01..AG-04, the conciliator, AI-written objections, notifications, a teacher portal, real authentication and any timer or automatic escalation.

## 2. F-0 foundation: fixed placements and per-section capacity

F-R and F-S5 both need to regenerate part of a schedule while keeping the rest exactly in place. F-S5 also needs a capacity per section. Neither exists today. The generator starts from an empty assignment list (`generator-input.ts`, `assignments: []`), and section capacity is uniform per course: it is checked in `DemoProposalService.matchesProposalConfiguration` and `validateRetainedView`. F-0 adds both capabilities once. [planning-readjustment.md](planning-readjustment.md) relies on this section.

### 2.1 Generator seed (backend only, no wire change)

```ts
type GeneratorSeed = {
  fixedAssignments: AcademicAssignment[]      // kept byte-identical in the result
  excludedTeacherIds: string[]                // never candidates for non-fixed sections
  sectionRoomExclusions: Array<{ sectionId: string, roomIds: string[] }>
}
generateAcademicSchedule(input: unknown, options?: GeneratorExecutionOptions, seed?: GeneratorSeed): GeneratorResult
```

- `seed` absent: the behavior is identical to the current generator. This includes results, statistics and diagnostics for the same input.
- A section is *fixed* when it has at least one fixed assignment. Every required session of a fixed section must be among the fixed assignments. Otherwise the result is `invalid-input` with diagnostic `FIXED_SECTION_INCOMPLETE`.
- Fixed assignments are validated first with `validateAcademicSchedule` and `validateSectionDelivery`. If they violate a hard constraint, the result is `invalid-input` with `FIXED_ASSIGNMENT_INVALID`, and the conflicting session IDs are listed.
- The search creates units only for non-fixed sections. Candidates are checked against the fixed assignments for teacher, room, section, cohort and course-group clashes, load and section limits. Fixed sections count toward teacher load and section limits.
- An excluded teacher is never chosen for a non-fixed section. A room listed for a section in `sectionRoomExclusions` is never chosen for any session of that section.
- Status semantics do not change. `complete` requires full coverage of every requirement. `search-limit` never claims impossibility. `impossible` keeps its proven-necessary diagnostics, and the new diagnostic `FIXED_PLACEMENTS_BLOCK` reports when the fixed assignments are the observed blocking cause. That diagnostic is an observation, not a proof.
- The seed is **not** part of `GeneratorInput`, `AcademicRequest` or `TrustedDraftRetention`. Retention equality (`validateDraftRetention`) therefore keeps working: the regenerated full schedule becomes both `automaticView` and `view` of the new retention.

### 2.2 Per-section capacity override (wire change, `PA-DEMO-1` additive)

`AcademicRequest.demands[]` gains an optional key:

```ts
sectionCapacities?: Array<{ ordinal: number, capacity: number }>
```

- At most 32 entries, with unique `ordinal` values. Each `ordinal` is an integer from 1 to the computed section count, where the count is `ceil(estimatedDemand / targetCapacity)`. Each `capacity` is an integer from 1 to 1000. An ordinal above the count returns `400 INVALID_REQUEST` at the HTTP boundary. Inside a saved draft it returns `422 DRAFT_CONFIGURATION_INVALID`.
- `prepareGeneratorInput` assigns the override to section `section:["<courseId>",<ordinal>]` and keeps `targetCapacity` for the other sections. The section count rule does not change.
- `matchesProposalConfiguration` and `validateRetainedView` compare each section with its effective capacity. The existing `ROOM_CAPACITY` check applies to the effective capacity.
- An absent key means the current behavior. Existing saved drafts, retentions, fingerprints and approval hashes stay valid without migration.

### 2.3 Regeneration service entry point

```ts
DemoProposalService.regenerateRetention(workspace: AcademicWorkspace, seed: GeneratorSeed):
  { status: GeneratorResult['status'], retention: TrustedDraftRetention | null, view: AcademicProposal, diagnostics: GeneratorDiagnostic[] }
```

- It validates the workspace with `validateDraftWorkspace`, runs the generator with the seed and builds the view exactly as `createProposal` does: same section, assignment, preference and planning-exception diagnostics.
- `retention` is non-null only when `status === 'complete'` and coverage is complete. Then `automaticView = view`, `editVersion = 0` and `manuallyAdjustedSectionIds = []`.
- It does not add an entry to the in-memory proposal map and does not count toward the 20-proposal limit. Persistence belongs to the caller (`SavedDraftService`).

## 3. Round profile

Profiles are versioned records in the new module `shared/programacion-academica-rounds.mjs`. The source shape reuses `Source` from `backend/src/matricula-regular/profile.types.ts` (`id, origin, class, reference, date, status`).

```ts
type AcademicRoundProfile = {
  revision: 'PA-ROUNDS-PROFILE-1'
  profileId: string                       // 'SYN-SIS-2027-I-ROUNDS-1'
  scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', academicPeriod: PlanningPeriod }
  maxRounds: { value: number, sourceIds: string[] }                  // integer 1..10
  deadline: { mode: 'school-entered', required: boolean, sourceIds: string[] }
  sources: Source[]
}
resolvePlanningRoundProfile(scope: { schoolId: string, academicPeriod: string }): AcademicRoundProfile | null
validateAcademicRoundProfile(value: unknown): asserts value is AcademicRoundProfile
```

The registry holds exactly one synthetic profile:

| Field | Value | Source |
| --- | --- | --- |
| `profileId` | `SYN-SIS-2027-I-ROUNDS-1` | local |
| `scope` | FISI / SISTEMAS / 2027-I | synthetic demo scope |
| `maxRounds.value` | 3 | PROP-4.2.4 (`local-only`, FISI value pending, PROP-13.5) |
| `deadline.mode` | `school-entered` | L-ROUNDS-1 (FISI value pending, PROP-13.5) |
| `deadline.required` | `false` | L-ROUNDS-1, which keeps current clients and scripts working |

The scope comes from the saved draft's `configuration.schoolId` and `configuration.academicPeriod` (`AcademicWorkspace`); the faculty is FISI for every planning draft. Any other scope resolves to `null`. Submitting such a draft fails with `422 ROUND_PROFILE_MISSING`, an explicit gap with no fallback to another profile (root `AGENTS.md` §7). Every existing test and script uses 2027-I, so no current flow loses submission. `isPlanningPeriod` accepts any `20xx-I|II`, so a 2026-II draft can be saved and the path is reachable through the API.

A `fixed-days` deadline mode is a later revision once the faculty gives a value. It is not part of `PA-ROUNDS-PROFILE-1`.

## 4. Derived concepts

Review stays **per teacher**: one decision covers all of that teacher's assignments, as in PA-DEMO-1. Section acceptance is derived from it.

- **Resolved teacher:** a teacher whose review entry has `status === 'conformity'`, or who has a school resolution (§6.6) recorded for the current fingerprint.
- **Fixed section:** every section whose assignments all belong to a resolved teacher. It is computed when needed and never stored as a separate list.
- **Pending section:** every other section of the saved proposal.
- **Rounds-enabled draft:** a draft with `rounds` present. It gains the key at its first submission after F-R lands.
- **Legacy draft:** a draft with `review` but no `rounds`. It keeps PA-DEMO-1 behavior until its next submission (§9).

Teacher fingerprints (`teacherFingerprints` in `teacher-review.ts`) do not change. They already include the teacher's resources, assignments, the capacity of their sections and the full records of the rooms they use. Any change to those invalidates the teacher, as today.

## 5. Lifecycle

1. **Submit round n** (existing route): the server records the round and an optional deadline. Teachers with an identical current conformity keep it (PA-DEMO-1). The others become `pending`.
2. **Teachers respond** (existing route): conformity, or `changes-requested` with a structured objection (§6.3). An objection gets a deterministic *proposed operation* (§7).
3. **The school decides each proposed operation:** confirm or reject (§6.4). Nothing applies without that confirmation.
4. **The school regenerates the pending sections** (§6.5). Confirmed operations are applied in the same atomic step, fixed sections stay byte-identical, and a complete result is saved as a new draft version. An incomplete result saves nothing.
5. **Submit round n+1**, which is blocked once `n = maxRounds` (§6.2).
6. **After the limit**, the school records a resolution for each unresolved teacher (§6.6). Approval then follows PA-DEMO-1 with the extended readiness rule (§8).

The deadline is information only. Teachers can still respond after it, and the system closes nothing automatically. The school acts through steps 3 to 6 whenever it decides.

### 5.1 Constraints on regeneration

- Scope = all pending sections. There is no scope parameter. If no section is pending, the request fails with `422 REGENERATION_NOTHING_PENDING`.
- Seed: `fixedAssignments` = all assignments of fixed sections. `excludedTeacherIds` = all resolved teachers (L-ROUNDS-2), so their fingerprints and conformities survive. `sectionRoomExclusions` = every confirmed or applied `exclude-section-rooms` operation whose sections are pending.
- The workspace is the saved configuration with every `confirmed` resource operation applied (§7). On success those operations become `applied`.
- Teachers whose assignments or resources changed are invalidated through the existing `synchronizeReview` (`outdated` plus an `invalidated` event). Resolved teachers stay unchanged by construction.

## 6. Endpoints

Base path `/api/local/programacion-academica/v1`. The PA-DEMO-1 access barriers apply unchanged: loopback or the exact proxy address, loopback `Origin` for POST, exact JSON, the opt-in module and the error envelope `{error:{code,message}}`. Every mutation runs inside `SavedDraftStore.exclusive`, checks `expectedVersion`, rejects locked drafts with `409 DRAFT_LOCKED`, increments `version` by 1 and writes once atomically. All new DTO validators live in `shared/programacion-academica-rounds.mjs` and run at both boundaries.

### 6.1 `GET borradores/:id/rondas/perfil`

Returns `AcademicRoundProfile` for the draft scope. A missing profile returns `422 ROUND_PROFILE_MISSING`, and a missing draft `404 DRAFT_NOT_FOUND`. The client calls it before showing the submission form.

### 6.2 `POST borradores/:id/revision/enviar` (revised)

DTO `{ expectedVersion: number, deadline?: string }`. `deadline` is a calendar date `YYYY-MM-DD` and nothing else.

- When `rounds` is absent, the server creates it with the profile snapshot and `legacyRounds = review?.round ?? 0`.
- If `review.round + 1 > profile.maxRounds.value`, the request fails with `422 ROUND_LIMIT_REACHED`.
- `deadline` absent while `profile.deadline.required` is true: `422 DEADLINE_REQUIRED`. A malformed date: `400 INVALID_REQUEST`. A date before the submission's calendar date in America/Lima (UTC−05:00), or more than 366 days after it: `422 DEADLINE_OUT_OF_RANGE`.
- Rounds-enabled drafts are also blocked when:
  - an objection is still `proposed`: `422 ROUND_OBJECTIONS_UNDECIDED`
  - an operation is `confirmed` but not applied: `422 ROUND_OPERATIONS_UNAPPLIED`
  - the saved schedule or configuration violates an applied or confirmed operation: `422 ROUND_CONSTRAINT_VIOLATED`. This covers a section placed in an excluded room, or a resource operation that a later save reverted.
- `otra` objections never block submission.
- On success the server appends `{ round, submittedVersion, deadline: deadline ?? null }` to `rounds.rounds`. All PA-DEMO-1 effects (review entries, the `submitted` event, derived state) do not change.

The request `{expectedVersion}` alone stays valid under the synthetic profile, so current clients and scripts keep working.

### 6.3 `POST borradores/:id/revision/responder` (revised)

DTO `AcademicReviewDecision` gains an optional `objection` key:

```ts
type AcademicRoundObjectionInput =
  | { kind: 'franja-no-disponible', sectionIds: string[], intervals: AcademicInterval[] }
  | { kind: 'exceso-de-carga', sectionIds: string[], limit: { maxWeeklyMinutes: number } | { courseId: string, maxSections: number } }
  | { kind: 'aula-inadecuada', sectionIds: string[], roomIds: string[] }
  | { kind: 'otra', sectionIds: string[] }
```

- Shape rules (`400 INVALID_REQUEST`):
  - `objection` may appear only with `decision: 'changes-requested'`.
  - `sectionIds`: 1–32 unique IDs.
  - `intervals`: 1–8 valid intervals.
  - `roomIds`: 1–8 unique IDs.
  - `maxWeeklyMinutes` and `maxSections` are non-negative integers.
  - Exactly one `limit` variant.
  - `observation` keeps its PA-DEMO-1 rules: required for `changes-requested`, at most 1000 characters, stored as data and never interpreted.
- Semantic rules (`422 OBJECTION_INVALID`, with a specific message):
  - every section belongs to the teacher's current assignments
  - each interval lies fully inside the teacher's declared availability
  - `maxWeeklyMinutes` is below the teacher's current maximum
  - for the section variant: `courseId` is among the teacher's courses and among the objected sections, and `maxSections` is below the number of that course's sections the teacher currently holds
  - every room serves at least one session of the objected sections
- A legacy draft rejects `objection` with `422 ROUNDS_NOT_ENABLED`. Plain `changes-requested` behaves as in PA-DEMO-1.
- A rounds-enabled draft records an objection for every `changes-requested` decision. Without `objection`, it records kind `otra` over all of the teacher's sections, which keeps the current client working.
- Any earlier `proposed` or `recorded` objection of the same teacher in the same round becomes `superseded`. A later conformity supersedes it in the same way.
- All existing PA-DEMO-1 checks and errors apply unchanged: round mismatch, outdated teacher, teacher not assigned.

### 6.4 `POST borradores/:id/rondas/objeciones/:objectionId/decidir`

DTO `{ expectedVersion: number, decision: 'confirm' | 'reject', reason: string }`. `reason` holds 0–500 characters without surrounding spaces and is required for `reject`.

- An unknown ID returns `404 OBJECTION_NOT_FOUND`. A status other than `proposed` returns `409 OBJECTION_ALREADY_DECIDED`.
- On `confirm` the server revalidates the operation against the current saved configuration and proposal. It fails with `422 OPERATION_STALE` when the operation no longer applies: for example, the interval left the availability, the limit is no longer lower, or the room no longer serves the section. It fails with `422 OPERATION_TARGETS_FIXED` when the target teacher is now resolved or the target section is now fixed.
- Success sets `status`, `decidedVersion`, `decidedAt` and `reason`. The configuration and proposal do not change.

### 6.5 `POST borradores/:id/rondas/regenerar`

DTO `{ expectedVersion: number }`. It requires a rounds-enabled draft in `in-review` or `ready-for-approval` with a complete proposal. Otherwise it returns `422 ROUNDS_NOT_ENABLED` or `422 REVIEW_INCOMPLETE`.

Response, HTTP 200 in both outcomes:

```ts
type AcademicRoundRegeneration = {
  draft: AcademicSavedDraft
  regeneration: {
    status: 'complete' | 'impossible' | 'search-limit' | 'invalid-input'
    saved: boolean
    fixedSectionIds: string[]
    regeneratedSectionIds: string[]
    appliedObjectionIds: string[]
    diagnostics: Array<{ code: string, message: string, sessionIds: string[] }>
  }
}
```

- `saved: true` only when the status is `complete` with full coverage. In that case:
  - the configuration (with operations applied), the proposal and the retention are saved in one write
  - the applied objections are marked `applied`, with `appliedVersion` set to the new version
  - one entry is appended to `rounds.regenerations`
  - the review is synchronized and the state derived
- `saved: false` returns the unchanged draft at the same version. The client must present `search-limit` as "no se encontró solución dentro del límite", never as impossible.

### 6.6 `POST borradores/:id/rondas/resolver`

DTO `{ expectedVersion: number, teacherId: string, reason: string }`. `reason` holds 1–500 characters.

- It requires a rounds-enabled draft with `review.round >= profile.maxRounds.value`. Otherwise it returns `422 ROUND_LIMIT_NOT_REACHED`.
- The teacher must be assigned (`422 TEACHER_NOT_ASSIGNED`) and must not already be in `conformity` (`422 TEACHER_ALREADY_CONFORMING`).
- Teachers in `pending`, `changes-requested` and `outdated` can all be resolved.
- The server appends `{ teacherId, fingerprint: <current>, version, at, reason }` to `rounds.resolutions`. A later change to that teacher's fingerprint voids the resolution. Entries are never deleted.
- The response is `{ draft }` with the derived state recomputed.

## 7. Objection kinds and operations

| Kind | Operation (deterministic) | Effect when applied at regeneration |
| --- | --- | --- |
| `franja-no-disponible` | `{ type: 'remove-teacher-availability', teacherId, intervals }` | The teacher's `availability` minus the intervals, using interval subtraction with the result sorted and merged. More than 32 resulting intervals returns `422 OPERATION_STALE`. |
| `exceso-de-carga` (minutes) | `{ type: 'limit-teacher-load', teacherId, maxWeeklyMinutes }` | Sets `maxWeeklyMinutes`. |
| `exceso-de-carga` (sections) | `{ type: 'limit-teacher-sections', teacherId, courseId, maxSections }` | Inserts or lowers that entry in `sectionLimits`. |
| `aula-inadecuada` | `{ type: 'exclude-section-rooms', sectionIds, roomIds }` | Seed `sectionRoomExclusions`. The resource model has no per-section room restriction, so the rule lives in `rounds` and is checked again at each submission. |
| `otra` | `{ type: 'manual' }` | None. The objection's status is `recorded` and it needs no decision. The school uses manual adjustment, regeneration or a resolution after the limit. |

Operations only target teachers and sections that are not resolved or fixed. The mapping is pure and shared, with a test for each kind.

## 8. Readiness and approval

Readiness becomes: the proposal is complete and non-empty, the review has teachers, and **every teacher is resolved** (§4). In a legacy draft, or before the limit, that reduces to the PA-DEMO-1 rule that every teacher has conformity. All five places that compute readiness must use the same shared helper `isRoundReviewReady(review, rounds)`:

1. `validateAcademicSavedDraft`: the gate for `ready-for-approval`, `approved` and `published`
2. `isReviewReady` in `teacher-review.ts`
3. `reviewMatchesSnapshot` in `teacher-review.ts`, which also covers locked drafts that `isValidPayload` normalizes to `ready-for-approval`
4. `SavedDraftService.approve`
5. state derivation after save, decision, regeneration and resolution

`approvalFingerprint` (`academic-release.ts`) includes `rounds` **only when present**, with a conditional spread. `canonical(undefined)` produces the text `'undefined'`, so adding the key unconditionally would change the hash of every approved or published draft. They would then fail `isValidPayload`, `readPublicationRecords` would throw `DRAFT_CORRUPT` for the whole publication list, and E2 would break.

## 9. Persisted state

`AcademicSavedDraft` gains one optional top-level key, `rounds`. No existing structure changes: `AcademicTeacherReview`, its events, `PersistedDraft` and `TrustedDraftRetention` all keep their exact key checks.

```ts
type AcademicRoundControl = {
  revision: 'PA-ROUNDS-1'
  profile: AcademicRoundProfile                          // snapshot at creation, immutable
  legacyRounds: number                                   // review.round when created (0..200)
  rounds: Array<{ round: number, submittedVersion: number, deadline: string | null }>
  objections: AcademicRoundObjection[]                   // at most 200
  regenerations: Array<{ version: number, at: string, fixedSectionIds: string[], regeneratedSectionIds: string[], appliedObjectionIds: string[] }>  // at most 200
  resolutions: Array<{ teacherId: string, fingerprint: string, version: number, at: string, reason: string }>  // at most 200
}
type AcademicRoundObjection = AcademicRoundObjectionInput & {
  id: string                                             // `objection-<decisionVersion>`
  round: number
  teacherId: string
  fingerprint: string                                    // teacher fingerprint at the decision
  decisionVersion: number
  operation: AcademicRoundOperation
  status: 'proposed' | 'confirmed' | 'rejected' | 'applied' | 'recorded' | 'superseded'
  decidedVersion: number | null
  decidedAt: string | null
  reason: string
  appliedVersion: number | null
}
```

`validateAcademicRoundControl(value, review, version)` checks the following:

- `rounds.rounds` has `review.round − legacyRounds` entries. They are numbered consecutively from `legacyRounds + 1`, and each `submittedVersion` matches a `submitted` event in `review.history`.
- Each objection matches a `decision` event of `changes-requested`, with the same teacher, version, round and fingerprint.
- Status transitions only move forward: `proposed → confirmed | rejected | superseded`, `confirmed → applied`, `recorded → superseded`. Every version is ≤ the draft version.
- Each `appliedVersion` matches a `regenerations` entry.
- Resolutions exist only once `review.round >= profile.maxRounds.value`.
- Exceeding a capacity returns `429 ROUND_RECORD_LIMIT`. Nothing is dropped silently.

History is append-only. The existing 200-event review history limit (`429 REVIEW_HISTORY_LIMIT`) still applies.

`fork()` copies neither `rounds` nor `review`: a new draft starts at round 0 under the profile in force at its first submission.

## 10. Migration notes for existing saved drafts

| Existing document | Behavior after F-R |
| --- | --- |
| `draft`, `ready-for-review`, no review | Unchanged. The first submission creates `rounds` with `legacyRounds: 0`. |
| `in-review` or `ready-for-approval` without `rounds` (legacy) | It validates exactly as before. Responses follow PA-DEMO-1, and `objection` is rejected. The next submission creates `rounds` with `legacyRounds = review.round`, and those earlier rounds count toward the limit with no recorded deadline. A draft already past the limit cannot be resubmitted, but the school can resolve its teachers. |
| `approved` or `published` | Immutable and unchanged. With no `rounds` key, the approval fingerprint is unchanged. Publication readers and E2 are unaffected. |
| Retention, catalog fingerprint, `schemaVersion` | Unchanged: no store migration and no rewrite on read. |

Write a migration test that loads at least one persisted fixture of each row, built with today's code, and asserts `isValidPayload` true, identical publication listing and identical approval fingerprints.

## 11. Internal UI constraints (for F-R.3)

The UI follows [design-direction](../../../design-direction.md) (A's visual language, inside the Revisión docente stage that V1 creates).

- Show the round number, `Ronda n de N` (N from the profile), and the recorded deadline as a date. Show `Sin plazo registrado` when it is null. A static `Plazo vencido` label is allowed when the local date is after the deadline. There is no countdown, no auto-refresh and no automatic action.
- An objection shows its kind label, the sections, the proposed operation in plain terms and the confirm or reject controls. The teacher's observation is shown as quoted data. `otra` shows `Requiere acción manual de la escuela`.
- Regeneration shows `fixedSectionIds` as unchanged and `regeneratedSectionIds` as changed. It shows the honest status from the response and never claims optimality.
- A disabled submission shows its reason next to the control: limit reached, undecided objections, unapplied operations, or a violated constraint.
- After the limit, the only available action per unresolved teacher is `Resolver por la escuela` with a reason.
- Do not show AI suggestions, a conciliator, an escalation or a notification. The simulated role selector keeps its disclaimer.

## 12. Tickets

All tickets share these constraints:
- Never read, list, search or use `datos-reales/`.
- Use synthetic fixtures only.
- Use no live SUM.
- Preserve SUM student screens untouched.
- The internal UI follows the design direction and reuses the existing adapters, validators, CAS and explicit save.
- Workers run `codegraph init` if the index is missing, after checking `codegraph.json`.
- Workers do not delegate.

| Ticket | Scope | Exclusive files | Depends on | Role · model (AGENTS §5) |
| --- | --- | --- | --- | --- |
| **F-0** | §2: generator seed, per-section capacity, `regenerateRetention` | `backend/src/programacion-academica/schedule-generator.ts`, `generator.types.ts`, `generator-input.ts`, `demo-proposal.service.ts`; `validateAcademicRequest` and `AcademicRequest` in `shared/programacion-academica-api.mjs` and `.d.mts`; new `backend/test/programacion-academica-regeneration.spec.ts`, `shared/programacion-academica-section-capacity.test.mjs` | this contract | Backend worker · `claudeAgent` `claude-sonnet-5-5` high (alt. `codex` `gpt-6-luna` high) |
| **F-R.1** | §3, §6 DTOs, §7 mapping, §9 validators, `isRoundReviewReady` | new `shared/programacion-academica-rounds.mjs`, `.d.mts`, `.test.mjs` | this contract | Backend worker · Sonnet 5.5 high |
| **F-R.2** | §5–§10 on the server | `backend/src/programacion-academica/saved-draft.service.ts`, `teacher-review.ts`, `academic-release.ts`, `demo.controller.ts`; in `shared/programacion-academica-api.mjs` and `.d.mts`: the `rounds` key on the saved draft, the `objection` key on the decision, the `deadline` key on the submission and the readiness gate; new `backend/src/programacion-academica/teacher-rounds.ts`, `backend/test/programacion-academica-rounds.spec.ts`, `backend/test/programacion-academica-rounds-migration.spec.ts` | F-0, F-R.1 | Backend worker · Sonnet 5.5 high |
| **F-R.3** | §11 client inside the Revisión docente stage | `client/src/data/academicScheduling.ts` and its test (rounds adapters), the stage component files created by V1 for review, new `client/scripts/verify-academic-rounds.mjs` | F-R.2, V1; single-owner queue for `AcademicScheduling.tsx` | UI worker · `antigravity` `gemini-3.8-flash` high (alt. `codex` `gpt-6-luna` high) |

F-R.2 owns the F-R edits to `programacion-academica-api.mjs` and `saved-draft.service.ts`. F-S5.2 edits the same files and is therefore serialized after F-R.2 ([planning-readjustment.md](planning-readjustment.md) §9). Test preparation for F-R.2 may run in parallel on disjoint test files: Test worker, `claude-haiku-5-5` medium.

## 13. Acceptance criteria

Checks: backend vitest (`pnpm --dir backend test`), shared tests (`node --test shared/<file>.test.mjs`), `pnpm --dir backend build` and `lint`, `pnpm --dir client build`, `lint` and `test:data`, and real local React→NestJS scenarios (`client/scripts/verify-academic-*.mjs` against the dedicated planning API with synthetic data). Every scenario uses the synthetic catalog and resources only.

| # | Criterion | Synthetic scenario | Check | Ticket |
| --- | --- | --- | --- | --- |
| R1 | Generating without a seed is identical to today | The existing proposal fixtures, generated with and without an empty seed | backend vitest (deep-equal result) and all existing generator specs | F-0 |
| R2 | Fixed assignments are never moved | Fix all sections of course A; regenerate | vitest: fixed assignments are deep-equal before and after | F-0 |
| R3 | Excluded teachers and rooms are never used for non-fixed sections | Exclude T1 and room R2 for section S | vitest: no assignment of S uses T1 or R2 | F-0 |
| R4 | Fixed placements that block every slot give an honest status | The fixed assignments fill the only room in every window | vitest: status `impossible` with `FIXED_PLACEMENTS_BLOCK`, or `search-limit` without an impossibility claim | F-0 |
| R5 | The per-section capacity override is validated and enforced | ordinal 0, ordinal > count, capacity 1001, duplicate ordinal; a valid override above the room capacity | shared test (`400`); vitest `ROOM_CAPACITY` | F-0 |
| R6 | Existing drafts stay valid | Persisted fixtures of every state (§10) | `programacion-academica-rounds-migration.spec.ts`: `isValidPayload` true, same approval fingerprint, same publication list | F-R.2 |
| R7 | The profile resolves only for its scope | 2027-I resolves; 2026-II returns null; submitting a 2026-II draft | shared test; vitest `422 ROUND_PROFILE_MISSING` | F-R.1, F-R.2 |
| R8 | The fourth submission is blocked under `maxRounds = 3` | Submit three times, then a fourth | vitest `422 ROUND_LIMIT_REACHED`; version unchanged | F-R.2 |
| R9 | Deadline validation and recording | absent, `2027-02-30`, a date before submission, a date more than 366 days later, a valid date | shared test (`400`); vitest: `422 DEADLINE_OUT_OF_RANGE`, valid date stored, absent stored as `null` | F-R.1, F-R.2 |
| R10 | Each objection kind maps to its operation | One input per kind | shared test (pure mapping) | F-R.1 |
| R11 | Invalid objections are rejected | Someone else's section, an interval outside availability, a limit not lower, a room not serving the section, an objection with conformity | vitest `422 OBJECTION_INVALID` and `400`; shared test | F-R.1, F-R.2 |
| R12 | Plain `changes-requested` becomes `otra` and does not block | Current client DTO without `objection`, then resubmit | vitest: status `recorded`, submission succeeds | F-R.2 |
| R13 | Undecided or unapplied operations block submission | Objection proposed, then confirmed without regeneration | vitest `422 ROUND_OBJECTIONS_UNDECIDED`, then `422 ROUND_OPERATIONS_UNAPPLIED` | F-R.2 |
| R14 | Confirming revalidates | Edit the configuration so the interval leaves availability, then confirm | vitest `422 OPERATION_STALE` | F-R.2 |
| R15 | Regeneration keeps accepted sections and conformities | T1 conformity, T2 objects (franja), confirm, regenerate | vitest: T1 sections deep-equal, T1 still `conformity`, T2 `outdated`, objection `applied`, version +1, configuration availability reduced | F-R.2 |
| R16 | An incomplete regeneration saves nothing | The confirmed operation leaves no feasible slot | vitest: `saved: false`, draft version and file unchanged | F-R.2 |
| R17 | Room exclusions persist across manual adjustment | Excluded room confirmed and applied, manual save moves the section back, then submit | vitest `422 ROUND_CONSTRAINT_VIOLATED` | F-R.2 |
| R18 | Resolution after the limit enables approval | Three rounds; T2 never conforms; resolve T2; approve and publish | vitest: approve succeeds; published draft validates; resolving before the limit returns `422 ROUND_LIMIT_NOT_REACHED` | F-R.2 |
| R19 | A resolution is voided by a later change | Resolve T2, then manually adjust a T2 section | vitest: state `in-review`; approve returns `422 APPROVAL_NOT_READY` | F-R.2 |
| R20 | CAS and history | Stale `expectedVersion` on each new endpoint; 201st record | vitest `409 VERSION_MISMATCH`; `429 ROUND_RECORD_LIMIT`; no entry removed | F-R.2 |
| R21 | Existing review and publication flows still pass | No change to scripts | existing specs and `verify-academic-teacher-review.mjs`, `verify-academic-publication.mjs`, `verify-cycle-complete.mjs` | F-R.2 |
| R22 | The client validates the new responses at runtime | Malformed `rounds` or regeneration responses | `pnpm --dir client test:data` | F-R.3 |
| R23 | Full round flow in the browser | Submit with a deadline, teacher objects (franja), school confirms, regenerates, resubmits; after round 3 the school resolves and approves | `verify-academic-rounds.mjs`, React→NestJS, keyboard-only path | F-R.3 |
| R24 | Honest UI states | Deadline date with no countdown; search-limit text; disabled reasons beside the controls; no AI or escalation text | `verify-academic-rounds.mjs` assertions; 200% zoom and narrow layout; design-direction acceptance criteria 1–5 | F-R.3 |

## 14. Gaps and open questions

- **FR-Q1** (faculty, PROP-13.5): the real round limit and deadline policy. The synthetic profile uses 3 and an optional school-entered date until the faculty answers.
- **FR-Q2** (user): should a regenerated section be allowed to go to a teacher who already conformed, at the cost of re-opening that teacher's review? L-ROUNDS-2 says no for now.
- **FR-Q3** (user): should manual adjustment of an accepted section be blocked during review, instead of invalidating the conformity (L-ROUNDS-3)?
- **FR-Q4** (user): should regeneration offer a narrower scope, for example only objected sections, instead of all pending sections?
- **FR-Q5** (user): does a teacher-only view of their own schedule (PDF §8) belong to the visual track (V2) or to F-R.3?
- **Gap:** responses after the deadline are accepted and are not marked late. A `late` flag would need a new review event type.
