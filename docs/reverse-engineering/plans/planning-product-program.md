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
| 4.5 | E3: preloaded, revalidation, **show only what changed**, alternatives with seats and no clash, all-or-nothing | precarga via intention import, revalidation, idempotent all-or-nothing confirmation exist; change-only view and alternatives not confirmed | Check further in F-E3 planning; SUM student screen, so UI only with evidence or approval. |
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
| F-R | Teacher rounds: limit, recorded deadline, fixed accepted sections, closed objection list as constraints, regenerate pending only, school decision after the limit | contract |
| F-S5 | Readjustment by demand and v2 publication | contract |
| F-E2 | Credit range and art. 18 inclusion as profile rules in E2 validation | contract |
| F-E3 | Change-only view and alternatives (gap check first) | F-S5 |

## Ownership rules

- `client/src/screens/AcademicScheduling.tsx` and `client/src/data/academicScheduling.ts` have one owner at a time. V1 owns them first.
- Every UI ticket keeps the accessible names and selectors used by `client/scripts/verify-academic-*.mjs` (for example `Docente revisión …`, `Día revisión …`, `Aplicar ajuste`, `Rol simulado de revisión`, `.academic-scheduling__manual-components`), or updates those scripts in the same ticket.
- Functional contracts live in new `shared/` modules where possible, so F-R and F-S5 do not share files.
- Student SUM screens (E2/E3) change only with evidence or explicit user approval.

## Status

| ID | State | Notes |
| --- | --- | --- |
| Slice 1 | PR #38 open | AC8 script repair in progress (pre-existing failure on `master`) |
| V1 | dispatched | UI worker |
| F-R, F-S5, F-E2 | planning | Planner writes the contracts and tickets |
