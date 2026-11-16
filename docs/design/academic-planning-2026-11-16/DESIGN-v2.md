# DESIGN v2 — internal academic planning product

Status: **proposed** (2026-11-16). It takes effect only after the user approves it. Approval would supersede the visual decisions in [docs/design-direction.md](../../design-direction.md) and the [2026-11-10 redesign spec](../academic-planning-2026-11-10/redesign-spec.md). This proposal does not change the interaction rules they set (Tabla/Semana, Semana editing, approval and publication, honest states). Those rules remain binding and are restated in [handoff.md](handoff.md).

High-fidelity screens: [Design canvas](https://claude.ai/artifact/PbvSpCSH7aTfE1wLJeLPPi) (private until shared). Tokens: [theme.css](theme.css).

## Scope

- **Applies to:** `/local/programacion-academica` and its panels.
- **Does not apply to:** the student SUM screens, the `--sum-*` tokens, the shared student components, or the module chooser (`/`, `/local/modulos`). The SUM fidelity rule in the root `AGENTS.md` still governs those screens, and this brief does not lift it. The root `DESIGN.md` remains the student SUM specification.

## Sources and how they were weighed

| Source | Used for | Not used for |
| --- | --- | --- |
| Product code, glossary, contracts, lifecycle table | What the product does: entities, flows, states, constraints | Layout, tokens, component shapes |
| Supplied `DESIGN.md` (warm editorial monochrome) | Visual language: palette, type voices, pill action, hairline depth, surface tiers | Marketing layout (80px sections, 40px card padding, 48–72px display headings, no sidebar) |
| Supplied `theme.css` | Concrete values | Its namespace mistakes (see theme.css §Adaptations) |
| AWS console screenshot | Patterns: scoped header, dense tables, master–detail, contextual toolbar, status with text, dismissible flash | Its chrome, colors, type, three-column assistant layout and service-menu depth |

## 1. Users and mental model

The primary user is a **school planner**: an operator who prepares one term's course offer for one school and turns it into an approved, published timetable. Approvers and the teacher review appear as stages of that work, not as separate applications.

The planner thinks in **one proposal moving through four stages**:

`Preparación (oferta, docentes y ambientes) → Horario → Revisión docente → Aprobación y publicación`

Inside the proposal the planner keeps returning to three questions:

1. *What is missing?* Pending sections, data to correct, unsaved changes.
2. *Why?* The engine's cause, the advisor's diagnosis, a server rejection.
3. *What do I do next?* One primary action per view.

The interface answers these questions in the same place on every screen.

## 2. Problems in the current product

1. **Chrome before content.** The header stack, proposal card and result card push the table below the fold. *v2:* one 52px scope bar, a two-line page head and a single result strip.
2. **Duplicated navigation semantics.** Numbered groups wrap single items, and Resumen duplicates what Cursos must fix. *v2:* five destinations, and Resumen becomes the readiness strip on every preparation view (§4).
3. **Competing rails.** The inspector and the assistant shared one rail through tabs. *v2:* section detail is a lower pane of the table (master–detail). The right rail holds only assistance: Consejero and Normativa.
4. **Primary action drift.** The primary action moved between header and panels. *v2:* exactly one filled pill per view, always in the page head. A modal editing task (Ajustar bloque) temporarily owns the primary, and the page head demotes its own to ghost.
5. **Status by stat tiles.** Five tiles described readiness. *v2:* one inline sentence-strip with facts separated by hairlines, each fact linking to the fix.
6. **Two visual systems.** The SUM-blue primary did not separate the internal tool from the student portal. *v2:* a monochrome ink action that cannot be confused with SUM.

## 3. Structural options explored

| Option | Description | Verdict |
| --- | --- | --- |
| A. Stage wizard | Full-screen step pages with Next/Back | Rejected. Planners jump between Horario and resources while fixing pendings, and a wizard forces linear travel. |
| B. Console (AWS-like) | Service nav + list + bottom detail + always-on assistant column | Partially adopted. Master–detail and dense tables fit. Three persistent columns at 1440px leave the table about 700px, and an always-on assistant is noise when nothing is pending. |
| C. Document workspace | The proposal as a document with stage sections on one long page | Rejected. Long scroll loses the table's sticky context and hides the next action. |
| **D. Proposal workspace (chosen)** | Persistent scope bar + stage rail + page head with the single action + result strip + table with lower detail pane + **on-demand** assistance rail | Best task efficiency: every fix is at most one click from the strip, and the selection survives view switches. Discoverability comes from the strip linking to causes. It has the lowest cognitive load of the four. |

## 4. Information architecture

```
Scope bar      [Planificación académica] | FISI · Sistemas · 2027-I ▾ | Propuesta base 2027-I [v4 · Borrador] ▾ | Ir a… ⌘K | Guía | Asistente
Stage rail     PREPARACIÓN   Oferta de cursos (n por corregir) · Docentes y ambientes
               PROGRAMACIÓN  Horario (n pendientes) · Revisión docente · Aprobación y publicación
               footer        Datos sintéticos · local   ← Módulos
```

- **Scope bar.** School/term and proposal switchers are the top of the hierarchy. The proposal chip carries version and state in mono. "Propuestas" becomes the proposal switcher's dropdown, which removes a button.
- **Stage rail.** Each item can carry one count, the number of things needing work, colored by status and labeled for screen readers. A done stage shows `✓` with the text "completado". There are no numbered step chips.
- **Resumen is removed as a destination** (decided 2026-11-16). The readiness facts move into the result strip of "Oferta de cursos" and "Docentes y ambientes", and every fact links to its fix. When every check passes, the strip shows the success state "Oferta lista para generar" with a "Ver resumen" disclosure listing each satisfied check.
- **"Ir a… ⌘K"** jumps to a course, teacher or room *inside the current proposal*. It is navigation only, with no new data contract: it searches the lists already loaded.

## 5. Visual language

**"Ink, paper and one action."** Warm white paper, near-black ink, cream and sand surface tiers, and mono for anything technical: codes, times, versions, counts.

### Color roles

| Role | Light | Dark | Notes |
| --- | --- | --- | --- |
| `ink` text and primary action | `#0a0a0a` | `#ededeb` | Never `#000` |
| `steel` secondary text | `#545454` | `#c2c2bf` | |
| `fog` meta text | **`#6b6b6b`** | `#a3a3a3` | **AA adaptation.** Supplied `#858585` is 3.7:1 on white and fails for text. `#6b6b6b` is 5.3:1 on paper, 5.0 on cream and 4.6 on sand. |
| `pewter` | `#9d9d9d` | — | Decorative only (2.7:1). Never text. |
| `dove` divider | `#d5d9e2` | `#2e3036` | Dividers and ghost-button rings only (1.4:1, decorative) |
| `control-border` | **`#8a8f99`** | `#6b7079` | **AA adaptation.** Inputs, checkboxes and selects need 3:1 (WCAG 1.4.11). Measured 3.25:1. |
| `paper` canvas | `#ffffff` | `#111111` | |
| `cream` surface | `#f9f8f6` | `#191919` | Panels, cards, hovered rows |
| `sand` emphasis surface | `#f2ede5` | `#24211c` | Selected row, current nav item, the "current" block. Always paired with a non-color cue. |
| `charcoal` inverse | `#151515` | — | Bulk-action bar, toast |
| `success` / bg | `#1a7f37` / `#eef6ef` | `#5cc679` / `#0f2416` | **Justified exception** to the monochrome rule. Status needs a semantic channel, and the color is always paired with an icon and a word. |
| `warning` / bg | `#8a5a00` / `#fbf3e2` | `#e3b55a` / `#2a2010` | 5.4:1 on its bg |
| `danger` / bg | `#b42318` / `#fdeeec` | `#ff8a80` / `#2c1210` | 5.8:1 on its bg |
| `focus` | `#0a0a0a` | `#ededeb` | 2px outline, 2px offset. Never Dove. |

Ember, sunbeam and sprout are dropped. Terminal dots and gradient orbs have no job in an operational tool.

### Typography

Three voices, no fourth:

| Voice | Family (substitute) | Use |
| --- | --- | --- |
| Sans | universalSans → **Inter** 400/500 | All UI copy. 400 reads, 500 emphasizes. Never bold. |
| Display | universalSansDisplay → **Inter** 400, tracking −0.025em | Page titles 30/36, section and detail titles 24/32, state titles 20/26. Quiet weight, size carries hierarchy. |
| Mono | **Geist Mono** 400/500 | Codes (`SI-404`), times, versions, counts, column headers and eyebrows (11px, +0.04em, uppercase) |

Scale inside the app: 11 (mono labels only) · 12/16 meta · 13/18 dense secondary · 14/20 body and cells · 20/26 · 24/32 · 30/36. The 48–72 display sizes are reserved for documentation and empty-state covers, never inside the working view. Body never goes below 14px except meta (12) and mono labels (11).

### Shape and depth

Radii follow one rule: **things you press are pills, things you type in are 6, and containers grow with their size.** That gives pill (buttons, chips, segmented controls, nav items), 6 (inputs, selects), 8 (week blocks), 12 (strips, inline panels) and 16 (floating dialogs, popovers, sheets). This replaces the source's contradictory "binary 9999/16" claim and its 3px token.

Depth comes from tone first (cream on paper), then a hairline (`dove`). One shadow, `--shadow-float`, is used only on floating surfaces. Shadows are never stacked.

### Spacing and density

4px base. The app uses 4/8/12/16/20/24/32. Page gutters are 32px (wide), 24px (<1280px) and 16px (<720px). Table rows are 40px and controls 32px (44px on touch layouts). The supplied 80px section gap and 40px card padding are marketing values. They are kept only for empty-state covers.

## 6. Component patterns

- **Page head:** a mono eyebrow (proposal · version · save state), the title (30/36), and to the right a tertiary text action, Guardar (ghost) and the single primary pill.
- **Result strip:** a 12px-radius tinted band in the status color's background. It reads left to right as the status icon and word (bold, `role="status"`), then hairline-separated facts, then a right-aligned text action ("Ver avisos (3)"). It is the only place a stage summarizes itself, and it is the same component in Horario, Preparación, Revisión and Aprobación.
- **Toolbar:** search (min 192px) → existing filters → count sentence → right-aligned Tabla/Semana segmented control. It wraps instead of shrinking.
- **Bulk bar:** when one or more rows are checked, the toolbar is replaced by a charcoal pill bar: "n seleccionados · actions · Cancelar selección". It is a contextual toolbar, AWS's best pattern, and inverse color makes the mode change obvious.
- **Table:** sticky mono headers, 40px rows, mono for codes, times and numbers (right-aligned, tabular). Unassigned values read *"Por asignar"* in italic fog. Status always shows icon and word (`✓ Completa`, `◐ Parcial`, `○ Pendiente`). The selected row is sand **plus** a 3px ink inset bar plus `aria-selected`.
- **Detail pane (master–detail):** on wide layouts the selected row opens a lower pane with a drag handle. It shows the title (24/32), the actions "Ver en Semana", "Editar horario" and close, and component cards (cream, 12px) with label/value pairs and the engine's cause verbatim. Below 1024px it becomes a bottom sheet.
- **Assistance rail (on demand):** closed by default and opened from the scope bar or from "Consultar consejero". It has a segmented control *Consejero / Normativa*, plus full-width and close. Consejero shows numbered findings, then recommendations as checkable cream cards, each tagged with its kind (Carga docente, Habilitación, Excepción horaria, Modalidad). The commit, "Aplicar n seleccionadas y regenerar", is a ghost button so that the page keeps one primary. A fixed footnote says the advisor never assigns timetables.
- **Week grid:** a 56px time column plus one column per day with configured availability. Unavailable time is hatched, not hidden. Blocks are tinted by component type and always labeled in mono caps (TEORÍA, LAB., PRÁCTICA). The *current* block has a 2px ink ring, and the *proposed* placement is a dashed ink outline labeled "Propuesto · sin validar".
- **Adjustment panel:** current → proposed summary, then the Docente, Ambiente, Día and Inicio fields. Duración is shown read-only, with the server-validation sentence and *Aplicar ajuste* (primary) / *Descartar*. A server rejection appears inline in danger tone and states that the saved schedule is unchanged.
- **Lifecycle steps (approval):** four steps with a 2px top rule, in ink for done and current and dove for upcoming. Each step shows a mono label and a one-line fact, and the current step has `aria-current="step"`.
- **Toast:** a charcoal pill, polite live region, 6s, paused on focus, with a close control. It only confirms what the server accepted.
- **Dialogs:** paper, 16px radius, float shadow. The title asks the question ("¿Publicar la versión 5?") and the confirm button repeats the verb and object.

## 7. Interaction rules

1. One filled primary per view, in the page head. A modal sub-task owns it while open.
2. Selection is shared by Tabla, Semana and the detail pane. Switching views keeps filters, selection and scroll.
3. Every fact in a result strip links to the place where it is fixed.
4. Every pointer interaction has a form equivalent. Dragging a block only fills the form.
5. Progressive disclosure: generation options sit in a popover, evidence in `<details>`, and the advisor's rail opens on demand.
6. Unsaved state is visible in the eyebrow ("cambios sin guardar", warning tone) and on the Guardar control. Switching scope with unsaved changes asks first.
7. Destructive or irreversible steps (publish, remove from offer) use a confirmation dialog that names the object.
8. Honest states: see the lifecycle board. There is no percent progress, no "impossible" wording for a search limit, no timers or escalation, and no AI resolution. "Sin motivo registrado" appears when no reason exists.

## 8. Accessibility rules

- WCAG 2.2 AA. Every text pair in the token table was measured, and the adapted values are marked.
- Status never relies on color alone: icon + word, and selection uses bar + `aria-selected`.
- Visible 2px ink focus ring on every control. Dove is never a focus indicator.
- Hit targets are at least 24×24 on desktop (32px controls) and at least 44×44 on touch layouts.
- The availability grid is a set of toggle buttons with `aria-pressed` and text ("Sí/No"), navigable with arrow keys.
- Live regions: the result status (`role="status"`), the generating message, toasts (polite) and server errors (`role="alert"`).
- 200% zoom and 320px reflow: the stage rail becomes a sheet, the detail pane becomes a bottom sheet, the week becomes a day agenda, and tables scroll inside their own box.
- `prefers-reduced-motion`: no skeleton shimmer and no pane slide animations.

## 9. Responsive behavior

| Width | Layout |
| --- | --- |
| ≥1280 | Scope bar · 216px stage rail · content · optional 360px assistance rail (resizable 320–560) |
| 1024–1279 | The assistance rail overlays as a sheet, and the detail pane stays a lower pane |
| 720–1023 | The stage rail collapses to a menu button and the sheet. The detail pane becomes a bottom sheet. |
| <720 | Table rows render as two-line list items. Semana becomes a day agenda with day tabs. A sticky footer holds Guardar and the primary pill. Touch targets are 44px. |

## 10. Dark theme

Kept by user decision (2026-11-16). There is a derived dark set (see table, `theme.css` and the Dark board). Light is the default, and a stored explicit choice wins. Dark keeps the same hierarchy: the action pill inverts to light ink on dark paper, and status colors switch to their dark pairs, which are measured at ≥4.5:1 on their backgrounds before shipping.
