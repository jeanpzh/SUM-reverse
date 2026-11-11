# Planning decisions: coverage state, decision queue, teacher regulatory data

Source class: `observed` (local synthetic run), collected 2026-11-11. Not a SUM observation: this is the internal
academic-planning product (`/local/programacion-academica`), so no SUM fidelity claim is made.
Provenance: own synthetic stack started by `client/scripts/verify-planning-decisions.mjs` (React/Vite → NestJS
`backend/dist` → Python planning engine), fresh temporary draft directory, no `*_SNAPSHOT_DIR`, LLM disabled,
catalog of 56 courses / 166 sections / 91 teachers (synthetic). Ran once at the end (8 of 8 checks passed); earlier
runs during development are not evidence. Engine interpreter came from the main checkout's virtualenv via
`SUM_PLANNING_ENGINE_PYTHON` (no venv exists in the worktree).

## Scenario and measured results

| Step | Observed (visible text) |
| --- | --- |
| Select all 56 courses, generate the default proposal | `Búsqueda inconclusa` · 120 de 166 secciones completas · 46 por completar · `Carga autorizada cubre 136 de 166` · 0 cruces |
| Decision queue (screenshots `coverage-and-queue-*`, `*-narrow`) | `20 decisiones cubren 30 secciones`; groups: Dictado partido (1, hasta 18 sec.), Ampliación de franjas (1, hasta 18 sec.), Excepciones de carga docente (12, libera 16 sec.), Docentes adicionales (8, libera 14 sec.); window and split labelled as alternatives, not added |
| Queue action `Habilitar y regenerar` on "Habilitar tardes (lunes a viernes)" (labelled testimony, no located regulation) | Proposal regenerated through the advisor-patch path: `Faltante comprobado` · 136 de 166 completas (120 → 136) · 30 por completar (`after-afternoon-regeneration.png`) |
| Queue action `Registrar autorización` on a load exception | Opens Preparación → Docentes y ambientes, that teacher's inspector, focus on the reference field. Empty reference refused with "Indica la referencia del documento…". After recording `SYN-DECLARACION-001`: Máximo autorizado 720 min (12 h) → 1200 min (20 h) (`teacher-load-editor-light.png`) |
| `Igualar la carga semanal al máximo autorizado`, back to Horario | Queue kept as "propuesta anterior … desactualizada" with the recorded authorization marked (`queue-outdated-after-authorization.png`); `Generar propuesta` regenerates: 138 de 166 completas, `Carga autorizada cubre 138 de 166` (`after-authorization-regeneration.png`) |

Other checks in the same run: SSR render of the status bar (three coverage states with distinct text; a proposal without
`coverageProof`/`capacityCertificate` shows no coverage chip and keeps the previous wording), the queue, the publication
panel with a blocker fixture (blockers listed, explanation shown), and the teacher limits; keyboard Tab reaches the first
decision group with a visible focus ring; no document overflow at 390 px and at 720 px (200 % zoom of 1440 px), light and
dark; no external requests and no page errors.

## Unverified / not covered here

- Publication blockers against the real server: the engine never assigns beyond the authorized load, so no real blocker
  appears in the default scenario; blockers and the `LOAD_AUTHORIZATION_REQUIRED` body are covered by data-layer tests
  (fake `fetch` and fake session client) and by the SSR fixture only.
- Screen-reader behaviour was not exercised; semantics are native (`details`, buttons, labelled fieldsets, `role="status"`
  and `role="alert"`).
- The FISI lective-hour duration stays unverified; the demo default of 60 minutes is a synthetic assumption.
- The outcome card after a queue action reuses the advisor wording ("Resultado de aplicar 1 recomendación").
