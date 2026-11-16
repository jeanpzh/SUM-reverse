# Planning v2 — implementation handoff

Status: proposed (2026-11-16). Companion to [DESIGN-v2.md](DESIGN-v2.md) and [theme.css](theme.css). Screens: [Design canvas](https://claude.ai/artifact/PbvSpCSH7aTfE1wLJeLPPi). Nothing here is implemented yet, and no production code changed in this phase.

Scope is `/local/programacion-academica` only. Student SUM screens, `/local/modulos`, `backend/`, `shared/` and the academic rules in `client/src/data/` are out of scope.

## 1. Legacy UI assumptions to replace

| Legacy assumption (current code / 2026-11-10 spec) | v2 replacement |
| --- | --- |
| Blue primary `#006ce0`, operational-console palette `--planning-*` | Ink pill primary. Warm neutrals and semantic status from `theme.css` (`--plan-*`). |
| Open Sans (or Geist) as the planning font | Inter 400/500 + Geist Mono 400/500, self-hosted, `font-display: swap`, no synthesized bold |
| 8px radius on every control | Role radii: pill for pressables, 6 for inputs, 8/12/16 for containers |
| Sidebar group "Preparación" with Resumen, Cursos, Docentes y ambientes | Two preparation destinations: *Oferta de cursos* and *Docentes y ambientes*. Resumen's readiness list becomes the result strip on both. |
| Row B proposal context (title input, school, status, Propuestas button) | Scope bar switchers: school/term ▾, then proposal ▾ with a mono version/state chip. Renaming the proposal moves into the proposal switcher menu. |
| Assistant toggled into a rail that can also show the inspector | Rail = assistance only (*Consejero / Normativa*), closed by default. Section inspector = lower detail pane (≥1024) or bottom sheet. |
| Advisor reached from the result strip's "Consultar consejero" | Same entry. The advisor's commit becomes a ghost button so the page keeps one primary. |
| Toolbar search + teacher filter + view switch | Unchanged set of filters (no new ones) and a count sentence. A bulk mode replaces the toolbar on Cursos only, where bulk actions already exist. |
| Disabled-save reason as muted text at the end of Row B | The reason goes in the eyebrow ("cambios sin guardar" / reason) and in `aria-describedby` on Guardar |
| Stat tiles or headline result cards | Result strip (one component across all stages) |
| Theme default light, explicit choice persisted | Kept. Dark values replaced by the derived v2 dark set. |

### Where every existing action lives in v2

| Existing action (source) | v2 location |
| --- | --- |
| Generar propuesta / Generar horarios (preparation) | Primary pill in the page head of both preparation views |
| Schedule exceptions, allocation criterion (preparation advanced options) | "Opciones de generación" popover beside the primary |
| Seleccionar los n cursos del catálogo | Empty state of Oferta de cursos (States board 03) |
| Guardar | Ghost button in every page head (`#planning-tour-save`) |
| Propuestas (open / switch / rename proposal) | Proposal switcher in the scope bar |
| Marcar lista para revisión / Volver a borrador (`AcademicScheduling.tsx`) | Horario page head, tertiary text slot, under the same conditions as today. When both a retry and a review transition apply, the transition takes the slot and "Reintentar búsqueda" moves into the "Ver avisos" panel. |
| Revisar n pendientes, Reintentar búsqueda (with confirmation), Ver avisos, Consultar consejero | Horario page head and result strip |
| Aplicar seleccionadas y regenerar (advisor) | Assistance rail, Consejero tab |
| Aplicar ajuste / Descartar (Semana) | Adjustment panel (sheet on narrow layouts) |
| Enviar a revisión (`AcademicTeacherReview.tsx`, Escuela view) | Primary pill of Revisión docente when no round is open for the saved version |
| Registrar respuesta, Solicitar cambios, Dar conformidad; "Vista simulada" role selector | Revisión docente: row action, then the teacher detail pane. The role selector stays labeled as a simulation (Review board). |
| Editar horario (from review) | Revisión docente page head, text action |
| Aprobar | Primary pill of Aprobación y publicación |
| Publicar (separate confirmation) | Ghost button in the same page head, disabled with its reason until approved, then a confirmation dialog |
| Crear borrador / Crear nuevo borrador (from a version) | Row action in the Versiones table |
| Consultar publicación, Actualizar publicaciones, Actualizar vista previa / Reintentar vista previa | Publicaciones section toolbar (Approval board) |
| Actualizar ofertas operativas, Activar publicación seleccionada (both confirmed) | "Alcance de la activación" disclosure in Publicaciones |
| Agregar / incorporar / retirar docentes and ambientes, edit fields, availability | Docentes y ambientes master–detail |
| Estimar demanda, bulk selection actions on courses | Cursos bulk bar and course detail pane |
| Theme menu, Guía, Módulos | Scope bar (Guía, theme in the user/settings menu) and rail footer (Módulos) |

## 2. Functional contracts that must remain intact

These rules come from `docs/design-direction.md`, the GLOSSARY and the lifecycle table. The v2 visuals depend on them and must not alter them.

1. **Adapters and effects.** Reuse `client/src/data/academicScheduling.ts` and the existing session module. Requests, payloads, explicit save, and expected-version/CAS checks stay unchanged.
2. **Tabla and Semana** are views of one proposal and one selection. Switching keeps filters, selection and scroll.
3. **Semana editing** applies only to existing *assigned* blocks: teacher, room, day and start. Duration is read-only. The current and the proposed placement both show until the server accepts. A rejection keeps the saved schedule. Dragging only fills the form, and the form works without a pointer. Days with configured availability (weekends included) stay reachable.
4. **Approval and publication:** approve is the single primary action, and publishing is a separate later confirmation. Published versions are read-only, and changes start a new draft. Show no semantic diff and no change reason ("Motivo") unless a contract supplies one, and show "Sin motivo registrado" where a reason slot exists without data. A teacher's observation is real data and is shown as recorded, with "—" when empty.
5. **Honest states:** no percent progress or cancel during generation. A search limit reads "Búsqueda inconclusa" and never claims impossibility. No timers, escalation or AI resolutions. A client role selector never grants authorization. A CAS conflict preserves the local draft and never overwrites silently.
6. **Consejero** diagnoses and suggests recommendations of the kinds carga docente, habilitación de curso, excepción horaria and modalidad de entrega. The planner confirms them, and the deterministic engine regenerates. The advisor never assigns timetables.
7. **Data provenance:** the "Datos sintéticos · local" marker stays visible in the shell.
8. **No invented capability:** no cycle filter, no pager, no scenario comparison, no reports. The ⌘K jump searches only data already loaded and has no new endpoint.

## 3. Stable hooks for acceptance scripts

| Hook (2026-11-10 §9) | v2 location | Action |
| --- | --- | --- |
| `#planning-page-title` | Page-head `h1` | Keep |
| `#planning-tour-primary` | The single primary pill in the page head | Keep |
| `#planning-tour-save` | Guardar (ghost) in the page head | Keep |
| `#planning-toggle-chat` | Assistance button in the scope bar | Keep |
| `#planning-chat-body` | Assistance rail body | Keep |
| `.planning-status-bar[data-status]` | Result strip root | Keep the class and attribute on the strip |
| `#planning-tour-proposals` | Proposal switcher button in the scope bar | Keep the id on the new control |
| `#planning-tour-proposal` | Was Row B | **Changed:** move to the proposal switcher's container |
| `#planning-proposal-title` | Was the inline title input | **Changed:** rename field inside the proposal switcher menu (same label and validation) |
| `.planning-scope-header__draft-state[data-draft-state]` | Version/state chip in the scope bar | Keep the class and attribute on the chip and keep `role="status"` |
| `#academic-scheduling-result` | Status word in the result strip | Keep |

Update `client/scripts/` selectors only for the two **Changed** rows.

## 4. Transition plan

Each ticket is independently shippable behind the same route. Before any of them starts, the user approves DESIGN-v2 and `docs/design-direction.md` gets a supersession pointer to it.

| # | Ticket | Depends on | Notes |
| --- | --- | --- | --- |
| 1 | Import `theme.css` under `.planning-root`. Self-host Inter and Geist Mono. Swap the font tokens. | — | Run `check:planning-contrast` with the new pairs, and update that script's pair list. |
| 2 | Shell: scope bar with switchers, two-group stage rail with counts, footer marker | 1 | Moves the Row B hooks (§3). The proposal switcher reuses the existing proposals dialog data. |
| 3 | Page head + result strip as one shared component across all stages | 2 | Enforces one primary per view through the existing `view.primaryAction(stage)` |
| 4 | Horario: table restyle, lower detail pane with resizable divider, bottom sheet below 1024 | 3 | Replaces the inspector-in-rail. Reuses `PlanningInspector` content. |
| 5 | Assistance rail: Consejero / Normativa segmented control, closed by default | 4 | Reuses the AI Elements chat and the advisor components. Ghost commit button. |
| 6 | Semana: grid restyle, current and proposed rendering, adjustment panel | 4 | Visual only; adjustment requests unchanged |
| 7 | Preparación: merge Resumen into the strip, generation-options popover, Cursos bulk bar, course detail pane | 3 | Keeps every field, validation and the demand-estimate flow |
| 8 | Docentes y ambientes: tabs, master–detail, availability toggle grid | 3 | The grid becomes `aria-pressed` buttons with arrow-key navigation |
| 9 | Revisión docente and Aprobación: lifecycle steps, readiness list, versions table, publish dialog | 3 | Approve remains the only primary |
| 10 | Narrow layouts (<720): list rows, day agenda, sticky action footer | 4–9 | |
| 11 | Acceptance scripts and integrated synthetic run | all | Root-owned, on a dedicated synthetic stack |

**Acceptance per ticket:** client `build`, `lint`, `test:data` and `check:planning-contrast` pass. Nothing changes under `backend/`, `shared/` or student screens, and requests sent stay the same. There is one primary per view, keyboard focus is visible, and status never relies on color alone. Reflow has no document-wide horizontal overflow at 360, 390, 720, 1024, 1280 and 1440px or at 200% zoom. The only `!important` is the reduced-motion override in `theme.css`.

## 5. Decisions (user, 2026-11-16)

1. **Resumen** is dropped as a destination, as recommended. The readiness strip replaces it on both preparation views. When something is missing, the strip is a warning listing what to fix. When everything is OK, it turns into the success state "Oferta lista para generar", with a "Ver resumen" disclosure listing each satisfied check (Dark board). The overview the user wanted once all steps pass is therefore still one click away, without a page that duplicates the fixes.
2. **Proposal rename** moves into the proposal switcher menu (`#planning-proposal-title` keeps its label and validation there).
3. **Dark theme** stays, with the derived set in `theme.css` §dark and the Dark board as reference. Light remains the default, and a stored explicit choice wins.
