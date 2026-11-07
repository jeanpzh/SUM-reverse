# PA-READJUST-1: post-prematrícula readjustment (F-S5)

Date: 2026-11-07. Owner: Planner. Status: **fixed local contract**, ready for implementation tickets. Program: [planning-product-program](../../plans/planning-product-program.md). Depends on the F-0 planning core in [planning-rounds.md](planning-rounds.md) §2 and reads demand through [E2-DEMAND-1](prematricula-intention.md).

The proposal PDF (v1.0, 2026-10-29, §4.4 and §11 K-5) is a design requirement (`local-only`). It is neither a norm nor observed SUM behavior. Section caps and readjustment dates stay pending with the faculty (PDF §13.3 and §13.5). Nothing here is attributed to the official SUM.

## 1. Sources

| ID | Claim | Source class | Reference |
| --- | --- | --- | --- |
| PROP-4.4 | After prematrícula, the system compares demand per section with its cap. It opens a section without moving what is published, widens a classroom section's cap up to the room capacity, and keeps laboratory sections. The director publishes v2, and students are notified and may choose again | design requirement (`local-only`) | PDF §4.4 table |
| PROP-11-K5 | Readjustment is the fifth stage, after prematrícula and before matrícula | design requirement (`local-only`) | PDF §11 |
| PROP-8 | The programmer cannot publish; the director approves and publishes | design requirement (`local-only`) | PDF §8 |
| PROP-13 | Readjustment dates and section caps are faculty parameters | open faculty question | PDF §13.3, §13.5 |
| L-READJ-1 | The system proposes and a person accepts each action. Accepting creates a new draft that then follows the existing approve and publish flow | local decision (design direction: suggestions are never applied silently) | this file |
| L-READJ-2 | Course demand is the E2-DEMAND-1 count for the current publication. Section demand is the count of intentions that chose that section | local decision | [prematricula-intention.md](prematricula-intention.md) |
| L-READJ-3 | Sections are identified across publications by course and ordinal (`section:["courseId",n]`) | local decision; follows the generator's section ID rule | `backend/src/programacion-academica/generator-input.ts` |

Out of scope: the student notification channel, automatic re-registration of intentions, a second demand estimator, any proposal for a past publication, and any change to E3 matrícula rules.

## 2. Concepts

For the current publication P (version v) and its E2 demand:

- `T`: the course's `targetCapacity` in P's request (default from `planningDefaults`).
- `n`: the number of sections of the course in P.
- `K_c`: the sum of the effective section capacities of the course in P (F-0 §2.2).
- `D_c`: the E2-DEMAND-1 count for the course (valid latest intentions for publication version v).
- `n_s`: the number of those intentions that chose section s.
- `k_s`: the effective capacity of section s.
- `minRoom(s)`: the smallest `capacity` among the rooms assigned to any session of s.

**Basis fingerprint:** `sha256(canonical({ publicationId, publicationVersion, demand }))`, where `demand` is the full `E2Demand` response used to compute the proposal. It acts as the compare-and-set token between proposal and acceptance.

## 3. Proposal rules

The proposal is deterministic and pure: for the same publication and demand it returns the same actions in the same order, sorted by course ID and then by section ordinal.

| Condition | Action | Reason code |
| --- | --- | --- |
| `D_c > K_c` | `open-section` with `count = ceil((D_c − K_c) / T)`, new ordinals `n+1 … n+count` | `COURSE_DEMAND_EXCEEDS_CAPACITY` |
| `n_s > k_s`, every room of s has `kind: 'classroom'`, and `minRoom(s) > k_s` | `widen-cap` to `min(minRoom(s), 1000)`. `remainingExcess = max(0, n_s − newCap)` | `SECTION_DEMAND_EXCEEDS_CAP` |
| `n_s > k_s` and any room of s has `kind: 'laboratory'` | `keep` | `LABORATORY_SECTION` |
| `n_s > k_s`, classroom rooms only, `minRoom(s) ≤ k_s` | `keep` | `ROOM_AT_CAPACITY` |
| `n_s > k_s` and any room of s has no `kind` | `keep` | `ROOM_KIND_UNKNOWN` |

- Course and section actions are independent, and both may appear for the same course. The UI shows them together so the school can choose. Whether widening should be preferred over opening is an open question (RJ-Q3), so no preference is applied.
- `keep` is information only and cannot be accepted.
- A course with `D_c ≤ K_c` and no section over its cap produces no action. A publication with no action returns an empty list with `status: 'no-change'`.
- Demand excluded by E2-DEMAND-1 (stale versions, invalid intentions) is reported in `excluded` and never counted.

## 4. Endpoints

Base path `/api/local/programacion-academica/v1`. The module is registered only when both `SUM_ACADEMIC_SCHEDULING=1` and `SUM_LOCAL_SCENARIOS=1` are set, because it reads prematrícula demand. The dedicated planning server (`local-main.ts`) does not serve these routes, so integration scenarios use the full local app. The PA-DEMO-1 access barriers and error envelope apply unchanged. DTO validators live in `shared/programacion-academica-readjustment.mjs` and run at both boundaries.

### 4.1 `POST publicaciones/:publicationId/reajuste/propuesta`

DTO `{}`; any other key returns `400 INVALID_REQUEST`.

1. Outside the planning store lock, call `PrematriculaService.getDemand` for the current publication. `SavedDraftStore.exclusive` is a non-reentrant promise queue, and `getDemand` takes that lock through `SavedDraftService.getPublication`, so nesting would deadlock.
2. Read the publication and check that `publicationId` is the current publication. Otherwise return `409 PUBLICATION_NOT_CURRENT`. An unknown ID returns `404 PUBLICATION_NOT_FOUND`.
3. Compute the proposal (§3) and the basis fingerprint.

Response 200:

```ts
type AcademicReadjustmentProposal = {
  revision: 'PA-READJUST-1'
  publicationId: string
  publicationVersion: number
  basisFingerprint: string
  status: 'actions' | 'no-change'
  demand: { counted: number, excluded: number }
  actions: Array<
    | { id: string, type: 'open-section', courseId: string, demand: number, capacity: number, targetCapacity: number, count: number, ordinals: number[], reason: 'COURSE_DEMAND_EXCEEDS_CAPACITY' }
    | { id: string, type: 'widen-cap', courseId: string, sectionId: string, demand: number, capacity: number, newCapacity: number, remainingExcess: number, reason: 'SECTION_DEMAND_EXCEEDS_CAP' }
    | { id: string, type: 'keep', courseId: string, sectionId: string, demand: number, capacity: number, reason: 'LABORATORY_SECTION' | 'ROOM_AT_CAPACITY' | 'ROOM_KIND_UNKNOWN' }
  >
}
```

Action IDs are deterministic: `open:<courseId>`, `widen:<sectionId>` and `keep:<sectionId>`. The proposal is not stored, so calling the endpoint twice with unchanged inputs returns identical bodies.

### 4.2 `POST publicaciones/:publicationId/reajuste/aceptar`

DTO:

```ts
{ expectedCurrentId: string, expectedBasisFingerprint: string, acceptedActionIds: string[], title?: string }
```

- `acceptedActionIds` holds 1–64 unique IDs of type `open` or `widen`. A `keep` ID or an unknown ID returns `422 READJUSTMENT_ACTION_INVALID`. `title` holds 1–120 characters; by default it is `Reajuste de <publication title>`.
- Demand is computed outside the lock, as in §4.1. Inside `SavedDraftStore.exclusive` the server:
  1. checks that the current publication ID equals both `expectedCurrentId` and `:publicationId`. Otherwise it returns `409 PUBLICATION_NOT_CURRENT`.
  2. recomputes the basis fingerprint from that demand and compares it with `expectedBasisFingerprint`. A mismatch returns `409 READJUSTMENT_BASIS_CHANGED`, and the client must request a new proposal.
  3. builds the new request from the published request:
     - for each accepted `open` action: `estimatedDemand := clamp(D_c, (n + count − 1) · T + 1, (n + count) · T)`, so the course has exactly `n + count` sections and existing ordinals keep their identity (L-READJ-3)
     - for each accepted `widen` action: a `sectionCapacities` entry `{ ordinal, capacity: newCapacity }` (F-0 §2.2), keeping any existing entries for other ordinals
  4. calls `DemoProposalService.regenerateRetention` with a seed whose `fixedAssignments` are **all assignments of P**. Published sections never move. New sections are placed around them, and widened sections keep their placements.
  5. If the result is not `complete`, the server returns `422 READJUSTMENT_PLACEMENT_FAILED` with the generator status and diagnostics in the message body. No draft is created.
  6. Otherwise it writes one new saved draft:
     - `version: 1`, `state: 'draft'`
     - `origin: { draftId, version, publicationVersion }` of P, as `fork()` does
     - no `review` and no `rounds`
     - the optional `readjustment` record (§5)

Response 201: `{ draft: AcademicSavedDraft }`.

The new draft then follows the existing flow: teacher review (a full new round under [planning-rounds.md](planning-rounds.md), with no conformity carried over from P), approval and publication as v+1. Publishing v+1 makes it current. E2 intentions registered for v stay valid only for v, and each student must register again (E2-INTENT-1 rule, unchanged).

### 4.3 Schedule-change notice (student flag, backend only)

`POST /api/local/prematricula/v1/intencion/aviso` (prematricula controller, local scenarios only). DTO `{ identity: E2Identity }`, the same identity shape and access checks as the intention endpoints.

```ts
type E2ScheduleChangeNotice = {
  revision: 'E2-NOTICE-1'
  actorId: string
  registered: { publicationId: string, publicationVersion: number } | null
  current: { publicationId: string, publicationVersion: number } | null
  changed: boolean
  affected: Array<{ courseId: string, sectionId: string, change: 'section-removed' | 'schedule-changed' | 'course-removed' }>
  newSectionCourseIds: string[]
}
```

- `changed` is true when the student's latest intention points to a publication version other than the current one.
- `affected` compares each chosen section with the section of the same ID in the current publication. `schedule-changed` means the set of session intervals or the delivery mode differs.
- `newSectionCourseIds` lists the courses the student chose that gained sections in the current publication.
- The notice is computed on read and never stored. It has no UI in this program: showing it on SUM student screens requires user approval and SUM evidence ([prematricula-rules.md](prematricula-rules.md) §8). Validator: `shared/prematricula-schedule-notice.mjs`.

## 5. Persisted state

`AcademicSavedDraft` gains one optional top-level key, `readjustment`. It is present only on drafts created by §4.2:

```ts
type AcademicReadjustmentRecord = {
  revision: 'PA-READJUST-1'
  basisFingerprint: string
  publicationId: string
  publicationVersion: number
  acceptedActions: Array<{ id: string, type: 'open-section' | 'widen-cap', courseId: string, sectionId?: string, count?: number, newCapacity?: number }>
  createdAt: string
}
```

- The record is immutable after creation. A manual save keeps it unchanged, and `fork()` does not copy it.
- `approvalFingerprint` (`academic-release.ts`) includes `readjustment` **only when present**, for the same reason given in [planning-rounds.md](planning-rounds.md) §8: an unconditional `undefined` key would change every existing approval hash and break publication readers and E2.
- `validateAcademicSavedDraft` adds `readjustment` to its optional keys. This edit is serialized after F-R.2, which adds `rounds` to the same list.
- Every existing saved draft and publication stays valid without migration.

## 6. Errors

| HTTP | Code | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Malformed DTO |
| 404 | `PUBLICATION_NOT_FOUND` | Unknown publication |
| 409 | `PUBLICATION_NOT_CURRENT` | Not the current publication, or `expectedCurrentId` is stale |
| 409 | `READJUSTMENT_BASIS_CHANGED` | Demand changed between proposal and acceptance |
| 422 | `READJUSTMENT_ACTION_INVALID` | A `keep` action, an unknown action, or an action no longer in the recomputed proposal |
| 422 | `READJUSTMENT_PLACEMENT_FAILED` | The generator could not place the new sections around the fixed published schedule |
| 429 | `DRAFT_CAPACITY` | The existing 50-draft capacity is reached |

## 7. Internal UI constraints (for F-S5.3)

The UI follows [design-direction](../../../design-direction.md) and lives in the Aprobación and publicación stage created by V5.

- Show each action with the demand and capacity numbers it is based on, and `keep` actions with their reason in plain terms.
- Accepting is a deliberate action on selected items. It creates a draft and navigates to it, and the draft shows `Reajuste de la publicación vN` and the accepted actions.
- A changed basis shows `La demanda cambió; vuelva a calcular la propuesta`. It never retries automatically.
- `READJUSTMENT_PLACEMENT_FAILED` shows the honest generator status. `search-limit` is never presented as impossible.
- Do not show timers, notifications sent, automatic acceptance or AI text.

## 8. Synthetic scenario constraints

E2 demand comes only from the regular-scenario actors (SYN-SIS-A, SYN-SIS-B), so `D_c ≤ 2`. Scenarios therefore publish courses with `targetCapacity: 1`, which makes one or two intentions exceed a cap. Room fixtures need one classroom of capacity ≥ 2 and one laboratory. No scenario adds actors or reads private data.

## 9. Tickets

All tickets share these constraints:
- Never read, list, search or use `datos-reales/`.
- Use synthetic fixtures only.
- Use no live SUM.
- Do not change SUM student screens.
- The internal UI follows the design direction.
- Reuse the existing publication, fork and CAS code paths.
- Workers run `codegraph init` if the index is missing, after checking `codegraph.json`.
- Workers do not delegate.

| Ticket | Scope | Exclusive files | Depends on | Role · model (AGENTS §5) |
| --- | --- | --- | --- | --- |
| **F-S5.1** | §3 pure rules, §4 DTO and response validators, §5 record validator, notice validator | new `shared/programacion-academica-readjustment.mjs`, `.d.mts`, `.test.mjs`; new `shared/prematricula-schedule-notice.mjs`, `.d.mts`, `.test.mjs` | this contract | Backend worker · `claudeAgent` `claude-sonnet-5-5` high (alt. `codex` `gpt-6-luna` high) |
| **F-S5.2** | §4.1, §4.2, §5, §6 on the server | new `backend/src/planning-readjustment/` (module, controller, service), `backend/src/app.module.ts` (registration under both flags); in `shared/programacion-academica-api.mjs` and `.d.mts`, the `readjustment` optional key; `saved-draft.service.ts` (an internal `createReadjustmentDraft` entry point that runs inside the store lock); `academic-release.ts` (conditional key); new `backend/test/planning-readjustment.spec.ts` | F-0, F-S5.1, F-R.2 (same files, serialized); soft: F-E2.2, which changes the demand baselines | Backend worker · Sonnet 5.5 high |
| **F-S5.3** | §7 client in the Aprobación stage | `client/src/data/academicScheduling.ts` and its test (readjustment adapter), V5 stage component files, new `client/scripts/verify-academic-readjustment.mjs` | F-S5.2, V5; single-owner queue for `AcademicScheduling.tsx` | UI worker · `antigravity` `gemini-3.8-flash` high (alt. `codex` `gpt-6-luna` high) |
| **F-S5.4** | §4.3 notice endpoint | `backend/src/prematricula/prematricula.controller.ts`; a `getScheduleNotice` method in `prematricula.service.ts` (serialized after F-E2.2, which owns the same file); new `backend/test/prematricula-schedule-notice.spec.ts` | F-S5.1, F-E2.2 | Backend worker · Sonnet 5.5 high |

## 10. Acceptance criteria

Checks: backend vitest (`pnpm --dir backend test`), shared tests (`node --test shared/<file>.test.mjs`), backend build and lint, client build, lint and `test:data`, and real local React→NestJS scenarios against the full local app started with both flags and synthetic data only.

| # | Criterion | Synthetic scenario | Check | Ticket |
| --- | --- | --- | --- | --- |
| S1 | Each proposal rule yields its action | Tables of D, K, n_s, k_s and room kinds: course over capacity; classroom section with spare room; lab section; room at capacity; room with no kind | shared test (pure rules, deterministic ordering and IDs) | F-S5.1 |
| S2 | Validators reject malformed DTOs and responses | Extra keys, a `keep` ID, 65 IDs, empty title | shared test | F-S5.1 |
| S3 | The proposal reflects E2 demand for the current publication only | Publish v1 (course A, `targetCapacity: 1`); SYN-SIS-A and SYN-SIS-B register A; a stale intention for an earlier version exists | vitest: `open:A` with `count: 1`, `excluded: 1`; identical bodies on repeat | F-S5.2 |
| S4 | A non-current publication is refused | Publish v2, then request a proposal for v1 | vitest `409 PUBLICATION_NOT_CURRENT` | F-S5.2 |
| S5 | Acceptance creates a draft and never moves published sections | Accept `open:A` and a `widen` | vitest: new draft version 1, `state: draft`, origin set, `readjustment` stored; every assignment of v1 deep-equal in the draft; new ordinal placed; widened section capacity changed | F-S5.2 |
| S6 | A changed basis is refused | Proposal, then SYN-SIS-B changes its intention, then accept | vitest `409 READJUSTMENT_BASIS_CHANGED`; no draft written | F-S5.2 |
| S7 | Failed placement creates nothing | No free room or window for the new section | vitest `422 READJUSTMENT_PLACEMENT_FAILED`; draft count unchanged | F-S5.2 |
| S8 | No lock deadlock | Two concurrent acceptances with the same basis | vitest: one 201, the other `409 PUBLICATION_NOT_CURRENT` or `READJUSTMENT_BASIS_CHANGED`, or both 201 as separate drafts; both settle within the test timeout | F-S5.2 |
| S9 | Existing drafts and publications are unaffected | Existing publication fixtures | vitest: approval fingerprints and publication listing unchanged; existing publication and E2 specs pass | F-S5.2 |
| S10 | The readjusted draft publishes as v2 | Accept, full review round, approve, publish | vitest: publication version 2 is current; `getDemand` for v2 starts at zero | F-S5.2 |
| S11 | The notice reports changes | Student registered on v1; v2 changes that student's section schedule and adds a section to another chosen course | vitest: `changed: true`, `schedule-changed`, `newSectionCourseIds` | F-S5.4 |
| S12 | The client validates and presents the proposal | Malformed proposal responses | `pnpm --dir client test:data` | F-S5.3 |
| S13 | Browser flow | From publication v1 with demand: compute, accept one action, open the new draft | `verify-academic-readjustment.mjs`, React→NestJS, keyboard-only path, honest error states | F-S5.3 |

## 11. Gaps and open questions

- **RJ-Q1** (user): should unchanged teacher conformities carry over from v1 into the readjustment draft? Currently no: a full new round is required.
- **RJ-Q2** (user): should intentions that are unaffected by v2 carry over automatically? Currently no: E2-INTENT-1 requires each student to register again.
- **RJ-Q3** (user): when both actions apply to a course, should widening be preferred over opening a section?
- **RJ-Q4** (user): is matching sections across publications by ordinal acceptable (L-READJ-3)?
- **RJ-Q5** (faculty, PDF §13.3, §13.5): readjustment dates and real section caps.
- **Gap:** how students learn about v2 on SUM screens. No SUM evidence exists, so §4.3 has no UI.
