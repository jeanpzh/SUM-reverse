# Feature002 — global local synthetic profile dashboard

**Revision:** LPD-SPEC-1 · **Date:**2026-10-14 · **Status:** READY for implementation dispatch, reconciled with [LPD-DEC-1](../../docs/reverse-engineering/plans/local-profile-dashboard-decisions.md); not implemented.
**Authority:** accepted local direction in task_f82812f52590; [design](../../docs/superpowers/specs/2026-10-14-local-profile-dashboard-design.md), [contract](../../docs/reverse-engineering/contracts/local-api/local-profile-dashboard.md). No new SUM observations.

## User stories and measurable criteria

1. As a local demo user I choose one of SYN-SIS-A/B or SYN-SOFT-A/B, enter once and see that actor throughout the current system.
2. As that actor I navigate16 routes, open Ver matrícula in the existing shell, register only when academic gates allow, and see only my actually committed report/schedule.
3. As a user I can explicitly renew or leave, understand expiry/reload/reset, and recover an uncertain submission without duplicate enrollment.

| ID | Requirement / scenario | Expected synthetic check |
| --- | --- | --- |
| LP-A01 | Fresh entry, all four actors, double click | Chooser outside shell is the user-approved simple access form with one radio group of the four profiles and local-only text, no password or SUM look-alike (D7); no anonymous formulario fetch; catalog exactly4; one MR create per entry, current actor/formulario agrees across header/home/profile. No auth claim. |
| LP-A02 | Navigate all16 existing routes for each actor |64 route visits retain run/actor/session/startedAt/expiresAt; all data HTTP from isolated API or explicitly static Home/Manuales resources; no mock/anonymous/other-actor fallback. |
| LP-A03 |15-minute session boundary | Server t+899999 active, t+900000 expired (consultas/submit/renew409); visible HH:mm:ss decreases with elapsed time; client deadline never ends before the server deadline and at0 the store is expired; client Date changes grant no lifetime. |
| LP-A04 | Renewal (rev. 2026-10-14, L-07) | Renewal keeps ID/startedAt, expiry=serverNow+900000. Triggers: full reload (resume), return to a visible tab and the post-success redirect to the report. GET, router navigation and timer ticks do not renew. Expired renewal 409. No explicit renew button. |
| LP-A05 | Reload and direct protected URL (rev. 2026-10-14, L-07) | The tab's sessionStorage keeps only {runId, actorId, sessionId} under `lp:session`; reload renews it before routing. A missing, invalid, expired or other-run identity clears the key and shows login. A new tab has no identity and shows login. |
| LP-A06 | Logout and actor switch, delayed responses | Logout is client-only with zero HTTP calls (server session expires naturally, D3); UI/caches clear immediately; old pending fetch resolutions are discarded by generation; the next actor never sees prior actor data. A submit already in flight may still commit; no academic rollback. |
| LP-A07 | Ver matrícula integration and entry gates | Profile-mode matricula-informacion link labelled “Ver matrícula” opens /local/matricula-regular (local-only decision; observed SUM #irRepMat→reportes discrepancy recorded in D5). Same existing Shell and active actor/session; no nested chooser or new session. enabled/scope/window/known eligibility govern entry, not downloaded/existing report. Unknown profile/window/institutional data stays gap/no commit. |
| LP-A08 | Reports and schedules | Before accepted: empty local state, no seed. After accepted: exact committed actor/run/request/course/section/credits/meetings; offers changed later do not rewrite report. SIS/SOFT and A/B isolation. |
| LP-A09 | Lost commit response/recovery after expiry/logout/relogin | A uncertain → logout → B enters and submits (only B's key written) → A re-enters: A's intent restored and manual consult issues one GET, zero POST. Preserve MR2 intent by actor/run; manual lookup/replay only; exactly one enrollment/report/capacity effect; changed run warns/clears without resending. |
| LP-A10 | Protocol/correlation failures | Extra/missing/duplicate/invalid inputs400; wrong run409; missing actor/session404; mismatched session409; malformed/nonJSON/wrong identity payload errors have no fallback. |
| LP-A11 | Clock/provenance/private separation | Isolated module graph and independently constructed fixture factories only; advancing August clock, F6 rows/unknown hours unchanged; no operator env/AppModule/private APIs/files loaded. |
| LP-A12 | Multi-cause response / accessibility / legacy boundaries | Real simultaneous known causes validate instead of500; empty/error/loading/retry states truthful; keyboard chooser/renew/logout/navigation/report accessible; root preserves old001 counts and reports scope separately. |

All criteria are mandatory for local feature completion; local application tests are planned, not run in documentation stage. LP-A12 is targeted keyboard/focus acceptance, not full WCAG/old170 certification. No pixel parity criterion is asserted because equivalent current reference states are unavailable.

## Scope and non-goals

The16 URLs are exactly those in client/src/data/routes.ts (home, perfil, historial, formulario-datos, ficha-socioeconomica, matricula-informacion, programacion-asignaturas, reportes-prematricula, reportes-matricula, reportes-horarios, reportes-evaluaciones, reportes-deudas, asistencia, tutoria, plan-estudios, manuales). Keep them and integrate /local/matricula-regular and its report child. Enrollment/recovery remain MR-CONTRACT-2. No real auth, payments, health verification, official document generation, persistent session, private dataset integration, export, migrations or production inspection.

Profile/model/scope decisions are local-only. Normative evidence remains FISI2026-II F1/F2/F6 as reviewed in design; N1 demonstration does not establish N2 enforcement completeness or N3 parity. Unknown official plan/history/institutional facts are explicit gaps or empty synthetic fixture records with explanatory labels, never invented official statuses. Personal profile facts are an explicit unavailable state (`perfil` payload null). Approval/testimony provenance is preserved.

## State and acceptance ownership

Server owns time, sessions, actor/run and committed state. Client memory owns current session identity, view, generation and transient selection; nothing about the session or active actor is persisted. MR2 sessionStorage owns only pending synthetic intent keyed by run/actor, not session/records. Root verifies real React→Vite proxy→Nest→state effects using isolated bootstrap; layer checks alone do not establish integration. Preserve extensive dirty tree and exclusive-file boundaries. [Tasks](tasks.md) are new002 work, not replacement or recount of001’s51 tasks.
