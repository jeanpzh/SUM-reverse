# Program: internal planning product, PDF gaps and visual direction

Date: 2026-11-07. Owner: orchestrator. Request: the user asked to build what is missing from the proposal PDF ("Propuesta: programación académica y matrícula en tres etapas", v1.0, 2026-10-29) and to lead the internal visual direction ([design direction](../../design-direction.md)). Slice 1 (shell and tokens) is PR #38.

The PDF is a design requirement (`local-only`), not a norm and not observed SUM behavior. FISI parameter values stay pending with the faculty (PDF §13). Every rule value below is a profile parameter with a source label, never a hard-coded universal default (root `AGENTS.md` §7).

## Gap matrix: PDF section → current code → disposition

Status was checked with CodeGraph and `grep` against `feat/planning-shell` on 2026-11-07, not against the older baseline in [ciclo-completo-fase3](ciclo-completo-fase3.md) §2.

| PDF | Requirement | Current code | Disposition |
| --- | --- | --- | --- |
| 4.2.1–2 | Estimated demand, sections = demand ÷ cap | `estimateAcademicDemand`, `calculateRequiredSections` | Exists. Visual track only (Demanda view). |
| 4.2.3 | Solver with hard constraints and weighted preferences; infeasibility cause | Bounded generator, `schedule-validator.ts`, per-cycle window `isAllowedPlanningInterval` (FISI-PLANNING-1), room kind enforced, `impossible`/`search-limit` states | Exists. Visual track: exception-first status bar, inspector. No CP-SAT replacement. |
| 4.2.4 | Teacher confirmation by **rounds**: accepted sections stay fixed, objections become constraints, solver regenerates only pending, **max 3 rounds**, per-round **deadline**, school decides the rest | `teacher-review.ts`, `saved-draft.service.ts`: rounds, fingerprints, `conformity`/`changes-requested`, free-text observation. **No** round limit, deadline, fixing of accepted sections, closed objection list or partial regeneration | **Implement** (functional ticket F-R). Limit and deadline are profile parameters. Deadlines are recorded dates, with no active timer or automatic escalation (design direction, honest states). |
| 4.2.4 | LangGraph agents AG-01..AG-04 | none | **Out of scope.** User rule: deterministic core first, AI as a removable layer; PDF §7 "si se apaga la IA, el sistema sigue". |
| 4.2.5 | Director approves and publishes v1; versions immutable | approval and publication with CAS and immutable versions | Exists. Visual track (C's dossier). |
| 4.3 | E2: clashes, credit range 12–26 (art. 13.p), prerequisites, failed courses included (art. 18); "sugerir combinación sin cruces"; no seat reservation | `prematricula.service.ts`: `SCHEDULE_CONFLICT`, `PREREQUISITE_NOT_MET`; credits summed, **no range check**; no art. 18 inclusion; no suggestion | **Implement** credit range and art. 18 as profile rules in E2 validation (F-E2). The suggestion and any student-screen change are on SUM student screens: the backend comes first, and UI changes need user approval (root fidelity rule). |
| 4.4 | **S-5 readjustment** at E2 close: compare intention with section capacity; propose open section / expand classroom cap to room capacity / keep lab; school approves; publish v2 before E3; notify | publication versions and intention aggregates exist; **no** readjustment proposal | **Implement** (F-S5): server computes the proposal from the published version and the E2 aggregates; school accepts actions into a new draft; the existing approve/publish produces v2. Notification = a visible change notice on the student's E2 view (backend flag first; UI per the fidelity rule). |
| 4.5 | E3: preloaded, revalidation, **show only what changed**, alternatives with seats and no clash, all-or-nothing | precarga via intention import, revalidation, idempotent all-or-nothing confirmation exist; change-only view and alternatives not confirmed | Gap check done: [prematricula-rules.md](../contracts/local-api/prematricula-rules.md) §10 (change-only partially exists in the E3 transfer; alternatives absent). SUM student screen, so UI only with evidence or approval. |
| 5 | Python/FastAPI/CP-SAT, LangGraph, Redis, API gateway, OSUM export | NestJS + TypeScript generator, local stores, PostgreSQL simulator | **Out of scope.** The stack difference does not justify replacing working, verified parts. |
| 6 | Versioned rule profiles per faculty/plan/period | `academic-planning-policy.mjs` FISI-PLANNING-1, `matricula-regular/rules.ts` | Extend through F-R, F-E2 and F-S5 parameters; no new engine. |
| 8 | Roles (alumno, docente, programador, director, admin); teacher sees only own schedule; audit | simulated role selector with a disclaimer | Keep simulated and labelled. Teacher view filtered to own assignments is a visual-track item. **Real auth out of scope** (AGENTS §7). |
| 9 | NF-1..NF-4 load | PostgreSQL simulator and P1/P2 performance work | Out of this program (perf work closed at P2-02 by user decision). |
| 11 | Indicators K-1..K-6 | not computed | Reserve a place; compute only K-3/K-4/K-5 from existing data once F-R and F-E2 land. |

## Two tracks

**Visual track (report §8 steps 3–6, direction A).** The stages stay inside the single route `/local/programacion-academica`, selected with a validated search param, so `isAcademicSchedulingRoute`, the AGENTS §1 exception and the design direction need no change.

| ID | Ticket | Depends on |
| --- | --- | --- |
| V1 | Scope header (Sistemas / 2027-I, "Demo · datos sintéticos", draft revision and save state) and stage navigation Preparación / Horario / Revisión docente / Aprobación; move existing panels into stages without changing API effects | PR #38 |
| V2 | Sections table grouped by course with row inspector and exception-first status bar | V1 |
| V3 | Semana view (B's interaction): the same selection as Tabla, adjusting an existing block via the existing adjustment request | V2 |
| V4 | Demanda and Recursos views: demand table with disclosure; resource master list and availability grid | V1 |
| V5 | Approval dossier and publication (C's structure) and the version timeline | V1, then F-R and F-S5 to fill their parts |

**Functional track (contracts in `shared/` and `docs/reverse-engineering/contracts/local-api/` first, then backend, then client inside the stage views).**

| ID | Ticket | Depends on |
| --- | --- | --- |
Contracts (fixed 2026-11-07): [PA-ROUNDS-1 and F-0](../contracts/local-api/planning-rounds.md), [PA-READJUST-1](../contracts/local-api/planning-readjustment.md), [ENR-RULES-1 and the F-E3 gap check](../contracts/local-api/prematricula-rules.md). Exclusive files, acceptance criteria and roles are in each contract's ticket and acceptance sections.

| ID | Ticket | Depends on | Role · model | ACs |
| --- | --- | --- | --- | --- |
| F-0 | Planning core: generator seed (fixed assignments, excluded teachers and rooms), per-section capacity, `regenerateRetention` | contract | Backend · Sonnet 5.5 high | 5 (R1–R5) |
| F-R.1 | Shared rounds module: profile, DTOs, objection→operation mapping, record validator, `isRoundReviewReady` | contract | Backend · Sonnet 5.5 high | 4 (R7, R9–R11, shared part) |
| F-R.2 | Server rounds: deadline, limit, objections, school decision, partial regeneration, resolution after the limit, migration | F-0, F-R.1 | Backend · Sonnet 5.5 high | 15 (R6–R9, R11–R21) |
| F-R.3 | Rounds UI in the Revisión docente stage | F-R.2, V1 | UI · Gemini 3.8 Flash high | 3 (R22–R24) |
| F-S5.1 | Shared readjustment rules and validators, schedule-change notice validator | contract | Backend · Sonnet 5.5 high | 2 (S1–S2) |
| F-S5.2 | Server readjustment: proposal, basis CAS, acceptance into a new draft | F-0, F-S5.1, F-R.2 (shared files); soft F-E2.2 | Backend · Sonnet 5.5 high | 8 (S3–S10) |
| F-S5.3 | Readjustment UI in the Aprobación stage | F-S5.2, V5 | UI · Gemini 3.8 Flash high | 2 (S12–S13) |
| F-S5.4 | Student schedule-change notice endpoint (no UI) | F-S5.1, F-E2.2 | Backend · Sonnet 5.5 high | 1 (S11) |
| F-E2.1 | Shared rule profile and pure credit and retake evaluators | contract | Backend · Sonnet 5.5 high | 4 (E1–E4) |
| F-E2.2 | Server E2 validation and demand with the profile; scenario fixtures raised to ≥12 credits | F-E2.1; **merge blocked on ER-Q1/ER-Q2** | Backend · Sonnet 5.5 high | 5 (E5–E9) |
| F-E2.3 | Optional: E3 `rules.ts` adopts the shared evaluators | F-E2.1 | Backend · Sonnet 5.5 high | 1 (E10) |
| F-E2.4 | Student-visible issue presentation | **blocked on user approval** | UI · Gemini 3.8 Flash high | — |
| F-E3 | Change-only view and alternatives | F-S5; **unplanned** pending ER-Q3 (gap check: change-only partially exists in the E3 transfer, alternatives absent) | — | — |

Dependency graph (an arrow means "must be integrated before"):

```text
PR #38 ─► V1 ─┬─► V2 ─► V3
              ├─► V4
              ├─► F-R.3 ◄── F-R.2
              └─► V5 ─► F-S5.3 ◄── F-S5.2

F-0 ───┬─► F-R.2 ─► F-S5.2
F-R.1 ─┘            ▲
F-S5.1 ─────────────┤
F-S5.1 ─► F-S5.4 ◄── F-E2.2 ◄── F-E2.1 ─► F-E2.3
F-E2.2 ┄┄► F-S5.2   (soft: demand baselines)
F-S5 ┄┄► F-E3       (unplanned)
```

Ready immediately, in parallel and with disjoint files: F-0, F-R.1, F-S5.1, F-E2.1. F-R.2 and F-S5.2 both edit `shared/programacion-academica-api.mjs`, `saved-draft.service.ts` and `academic-release.ts`, so they run in that order. F-E2.2 and F-S5.4 both edit `prematricula.service.ts`, so they also run in that order. The backend tickets do not touch the client files owned by the V queue.

## Ownership rules

- `client/src/screens/AcademicScheduling.tsx` and `client/src/data/academicScheduling.ts` have one owner at a time. V1 owns them first.
- Every UI ticket keeps the accessible names and selectors used by `client/scripts/verify-academic-*.mjs` (for example `Docente revisión …`, `Día revisión …`, `Aplicar ajuste`, `Rol simulado de revisión`, `.academic-scheduling__manual-components`), or updates those scripts in the same ticket.
- Functional contracts live in new `shared/` modules where possible. Where F-R and F-S5 must edit the same existing files (`programacion-academica-api.mjs`, `saved-draft.service.ts`, `academic-release.ts`), they are serialized, with F-R.2 first.
- Student SUM screens (E2/E3) change only with evidence or explicit user approval.

## Status

| ID | State | Notes |
| --- | --- | --- |
| Slice 1 | PR #38 open | AC8 passes; awaiting user review and merge |
| V1, V2 | integrated on `feat/planning-program` | V2 integration restored the pending-components list and added `data-section-id` rows |
| F-0, F-R.1, F-S5.1, F-E2.1 | integrated | Backend suite 808/808, shared 78/78 |
| F-R.2, V3 | dispatched 2026-11-07 | Backend · Sonnet high; UI · Gemini Flash high |
| F-S5.2, F-S5.4, F-E2.2, F-E2.3, V4, V5 | ready or waiting | F-S5.2 after F-R.2; F-E2.2 merge blocked on ER-Q1/ER-Q2 |
| F-R.3, F-S5.3 | contract fixed | Wait for F-R.2 and V5 respectively |
| F-E2.4, F-E3 | blocked | User decisions ER-Q1–ER-Q3 in [prematricula-rules.md](../contracts/local-api/prematricula-rules.md) §11 |
| Script debt | pending | `verify-academic-erp` and `verify-academic-compose` are stale since #35/#36 (no stage switch, roster count) |
