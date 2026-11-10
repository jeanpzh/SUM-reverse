# Integral UX/UI redesign of the internal planning product

Status: **binding for this redesign**, decided by the root orchestrator on 2026-11-10 under the user's instruction to redesign the whole experience autonomously, without preserving earlier decisions by inertia. Scope: `/local/programacion-academica` only. Student SUM screens, `/local/modulos`, backend contracts, validation, explicit save, version checks and academic rules do not change.

Target reference: [horario-target.png](horario-target.png), a mockup the user produced on 2026-11-09 for the "Horario" screen (light theme, operational console style). It is design direction, not SUM evidence. Its numbers, names and rows are illustrative: render the real synthetic API data. Do not add what it shows but the product lacks (a cycle filter in Horario, a university crest, a "showing 10 of 166" pager).

Where this file conflicts with `docs/design-direction.md` on theme default, palette, header layout, sidebar grouping or where the section inspector lives, **this file wins**. The interaction rules of `docs/design-direction.md` ("Tabla and Semana", "Semana", "Approval and publication", "Honest states") remain binding.

## 1. Problems being solved

1. The header spends about 200px on a bordered proposal card before any content.
2. The Horario result is a card with 28px metrics, a headline, a paragraph and three buttons; the timetable starts below the fold.
3. The primary action lives in the header on some stages and inside panels on others.
4. The sidebar wraps single destinations in numbered groups ("2 Programar → Horario"), doubling every label.
5. The section inspector and the assistant share one rail through tabs, so inspecting a section hides the assistant and the other way round.
6. Dark is the default although the tool is a dense daytime data application; the dark palette has very low border contrast.
7. Preparation shows five stat cards where a short readiness list would say what is missing and link to it.

## 2. Design language

Operational console: compact toolbars, disciplined alignment, dense readable tables, few containers. A border or a background separates regions; cards are not nested and are not used for single values. No decorative gradients, illustrations, charts or badges for plain facts. Status is always text plus an icon; color is supporting.

### Tokens (set on `.planning-root`, light is the default theme)

| Token | Light | Dark |
| --- | --- | --- |
| `--planning-canvas` | `#ffffff` | `#0f141a` |
| `--planning-surface` | `#ffffff` | `#161d26` |
| `--planning-surface-subtle` | `#f6f6f9` | `#1b232d` |
| `--planning-text` | `#0f141a` | `#dedee3` |
| `--planning-muted` | `#424650` | `#a4a4ad` |
| `--planning-border` | `#c6c6cd` | `#424650` |
| `--planning-primary` | `#006ce0` | `#42b4ff` |
| `--planning-primary-foreground` | `#ffffff` | `#0f141a` |
| `--planning-selected` | `#e6f3ff` | `#001a3a` |
| `--planning-focus-ring` | `#006ce0` | `#42b4ff` |
| `--planning-success` / surface | `#00802f` / `#effff1` | `#2bb534` / `#001401` |
| `--planning-warning` / surface | `#855900` / `#fffef0` | `#fbd332` / `#191100` |
| `--planning-error` / foreground / surface | `#db0000` / `#ffffff` / `#fff5f5` | `#ff7a7a` / `#0f141a` / `#1f0000` |

Radii: controls 8px, panels 8px, floating 8px. Shadows only on floating surfaces. Every text/background pair used must meet WCAG 2.2 AA (4.5:1 text, 3:1 for control borders and focus rings); adjust a value minimally if `pnpm --dir client check:planning-contrast` fails and record the change.

`ThemeProvider` default becomes `light`. A stored explicit choice (`planning-theme` in localStorage) still wins. The theme menu stays.

### Typography

Open Sans (already self-hosted, variable 300–800). Root weight 400; headings and emphasis 700; no synthesized faces.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Page title (h1 of each view) | 24 / 30 | 700 |
| Container heading | 20 / 24 | 700 |
| Section heading | 18 / 22 | 700 |
| Small heading | 16 / 20 | 700 |
| Body, controls, table cells | 14 / 20 | 400 |
| Metadata | 12 / 16 | 400 |

Map these onto the existing `--planning-text-*` tokens (`xs` 12, `sm` and `base` 14, `lg` 16, `xl` 18, `2xl` 20, `3xl` 24). No font size below 12px and no literal font sizes outside the token definitions.

### Spacing

4, 8, 12, 16 and 24px only. Page padding 24px (16px below 1024px, 12px below 640px). Controls are 32px high; table rows 40px.

## 3. Shell

- Sidebar about 13rem, collapsible to icons (keep the shadcn Sidebar, its tooltips, `Ctrl/Cmd+B`, and the off-canvas sheet on narrow screens).
- Brand: two text lines, "FISI · UNMSM" (12px, muted) and "Planificación académica" (14px, bold). No logo image.
- Navigation: one group labelled "Preparación" with Resumen, Cursos, Docentes y ambientes; then three ungrouped items: Horario, Revisión docente, Aprobación y publicación. Remove the numbered step chips and the labels "Programar", "Revisar", "Aprobar y publicar".
- Progress: keep `derivePlanningProgress`. A stage that is `done` shows a small check icon at the end of its item (for Preparación, at the end of the group label) with screen-reader text "completado". Nothing else is added for `current` or `upcoming`.
- Footer: one muted 12px line "Datos sintéticos · prototipo local" (with the existing full sentence as `title` and screen-reader text), the "Módulos" link and the theme button. No bordered box.

## 4. Page header (all views)

Two rows, no surrounding card, 16px below it, a bottom border separating it from content.

- **Row A:** sidebar trigger; view title; then right-aligned, in this order: the stage's primary action (default button), "Guardar" (outline, keeps `id="planning-tour-save"`), a slot for one stage-specific tertiary action rendered as a link-style button, then icon buttons for the assistant and the guide (with tooltips, as today).
- **Row B (context, 32px high, wraps on narrow screens):** proposal name as a borderless inline input (14px bold; border appears on hover and focus; keeps `id="planning-proposal-title"`, label and validation attributes); a vertical divider; "Sistemas · 2027-I" as plain text; a status indicator made of a colored dot plus the existing status text (keeps `role="status"`, class `planning-scope-header__draft-state` and `data-draft-state`); "Marcar lista para revisión" / "Volver a borrador" as link-style buttons under the existing conditions; "Propuestas" as a ghost button with its icon (keeps `id="planning-tour-proposals"`). The disabled-save reason appears as 12px muted text at the right end of this row. Row B keeps `id="planning-tour-proposal"`.

One primary button is rendered per view, always in Row A. The existing rule set (`view.primaryAction(stage)`) decides which.

## 5. Horario

Order, top to bottom, inside the scrolling content panel:

1. **Result strip:** one row with a subtle background and 8px radius. Left: status icon and status text in bold ("Programación completa", "Programación parcial", "Propuesta parcial", "Sin solución completa", "Entrada inválida", using the existing wording rules). Then inline facts separated by thin vertical dividers: "{complete} de {total} secciones completas", "{n} por completar", "{n} cruces en lo asignado". Right end: "Ver avisos ({n})" as a link-style button when there are notices, and "Consultar consejero" (outline, small) when sections are pending. Where a status has an explanatory sentence (search limit, invalid input), show it as one 12px muted line under the strip. The strip keeps `data-status`, `id="academic-scheduling-result"` on the status text, and `role="status"` only on the status text.
2. **Header actions for this stage:** "Revisar {n} pendientes" is the primary action in Row A when sections are pending (same handler as today's button in the result card, which is removed). "Reintentar búsqueda" is the tertiary link-style action in Row A and keeps its confirmation dialog.
3. **Toolbar:** one row: search field, teacher filter, and at the right a "Tabla / Semana" segmented control. Only filters that exist today; do not add a cycle filter. **Tabla is the default view**, because it lists pending sections and assigned ones together.
4. **Table / week grid** filling the available width. Status cell shows an icon and text ("Completa", "Parcial", "Pendiente"). The selected row uses `--planning-selected`. Unassigned values read "Por asignar" in muted italics or an em dash.
5. **"Detalles de búsqueda"** collapsible under the table, closed by default, with today's content.
6. **Section detail pane:** when a section is selected on wide layouts (≥1024px), the content panel splits vertically with a resizable horizontal divider and the section inspector occupies the lower pane: heading "{curso} · Sección {n}" (20px), a close button, the section's blocks as inline label/value facts (Docente, Aula, Día, Horario), pending components, and "Editar horario" (outline) which opens the existing edit form inside the same pane. Below 1024px the inspector remains the existing Sheet.

The right rail holds **only the assistant**; remove the "Sección / Asistente" tabs. The rail stays resizable and closable, and full-width mode and the narrow-screen Sheet stay as they are.

## 6. Preparación

- **Resumen:** replace the five stat tiles with a "Lista de preparación": one bordered list, each row with a status icon, a sentence and a link-style action at the right. Rows: "{n} cursos seleccionados" → "Revisar cursos"; "{n} cursos con datos por corregir" (warning when n > 0, otherwise success "Demanda y capacidad completas") → "Corregir"; "{n} docentes" and "{n} ambientes" → "Revisar recursos"; final row "Oferta lista para generar" or "Oferta incompleta". Keep "Seleccionar los {n} cursos del catálogo" when nothing is selected. Below it, a section "Opciones de generación" containing today's advanced options (schedule exceptions, allocation criterion), collapsed by default. The in-section "Generar horarios" button is removed: generation is the Row A primary action ("Generar propuesta"); when the offer is not valid, keep the existing explanatory sentence next to the list. Reduce the paragraph about in-memory changes to one 12px muted line.
- **Cursos** and **Docentes y ambientes:** same toolbar pattern as Horario (search and filters in one row, bulk actions at the right), tables at 14px with 40px rows, section headings from the type scale, no nested cards. Keep every field, validation message, bulk action and the demand-estimate flow. The course detail panel becomes a lower detail pane on wide layouts, like the section inspector, and stays a drawer on narrow ones.

## 7. Revisión docente and Aprobación y publicación

Same header rules. Content as one column of sections separated by borders: a one-row readiness summary (inline facts, same component style as the Horario result strip), then the table of teachers or versions with the same table rules, then evidence on demand in collapsibles. Approve is the only primary action and sits in Row A when available; publishing remains a separate later confirmation; "Volver a …" links are Row A primary only when the rules say so today. Read-only notices become one 12px muted line. Do not add reasons, diffs, timers or roles the contract does not provide.

## 8. Responsive behavior

- Content panel is the scroll container; no document-wide horizontal overflow at 360, 390, 720, 800, 1100 and 1440px, or with 200% text size.
- Row A wraps actions under the title below 720px; icon buttons stay on the title line.
- Toolbars wrap to two rows instead of shrinking the search field below 12rem.
- Wide tables scroll inside their own container. The week grid switches to the agenda by container width, as today.

## 9. Acceptance for every ticket

1. `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data` and `pnpm --dir client check:planning-contrast` pass.
2. No change under `backend/`, `shared/`, student screens, `client/src/data/` rules, or to requests sent.
3. One primary button per view, in Row A. No literal font sizes, no `!important`, no spacing outside the scale in new or rewritten rules.
4. Keyboard path and visible focus for every control added or moved; status never by color alone.
5. Stable hooks kept or listed as changed for the acceptance scripts: `#planning-page-title`, `#planning-tour-proposal`, `#planning-tour-save`, `#planning-tour-primary`, `#planning-toggle-chat`, `.planning-scope-header__draft-state[data-draft-state]`, `.planning-status-bar[data-status]`, `#planning-chat-body`.
6. Integrated browser acceptance on a dedicated synthetic stack is run by the root in the final ticket; a worker never attaches to a running server.
