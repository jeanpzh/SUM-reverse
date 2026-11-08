# Design direction: internal academic planning product

Status: **binding**. Decided by the user on 2026-11-07 and not open for redesign. Source exploration: [academic-planning-2026-11-07](design/academic-planning-2026-11-07/README.md), cited below as "the report". This file states the decisions. The report holds the reasoning, the images and the detailed tables, which are not repeated here.

## Scope

- **Applies to:** the internal administration product for academic scheduling, timetable adjustment, teacher review, approval and publication. Today that is only `/local/programacion-academica` (the route matched by `isAcademicSchedulingRoute`) and the panels embedded in it. The local module chooser (`/`, `/local/modulos`) also leads into student flows, so it is out of scope and keeps its current look.
- **Does not apply to:** student SUM screens. Those keep [DESIGN.md](../DESIGN.md), the `--sum-*` tokens, the student components and the root SUM fidelity rule.
- **Integration with SUM:** only through data contracts (`shared/`, backend modules). The two products do not share a visual identity, and SUM-observed evidence is not required for internal screens.

## The decision

| Concept | What we adopt | What we do not adopt |
| --- | --- | --- |
| **A, Operational Workbench** ([image](design/academic-planning-2026-11-07/images/operational-workbench.png), report §2) | The visual language of the whole internal product: typography, color, spacing, navigation rail, scope header, stage navigation, the grouped section table with a row inspector, and the exception-first status bar. | The image's flaws: a 2-hour Redes01 block, the taller canvas, and demand values shown per section. |
| **B, Visual Planning Studio** ([image](design/academic-planning-2026-11-07/images/visual-planning-studio.png), report §3) | Only its calendar interactions: the **Semana** view and adjustment of an existing block, drawn in A's visual language. | B's horizontal navigation, palette and unassigned tray as a separate layout. |
| **C, Institutional Platform** ([image](design/academic-planning-2026-11-07/images/institutional-platform.png), report §4) | Only its decision structure: the approval dossier, approval kept separate from publication, and an immutable version timeline, drawn in A's visual language. | C's palette and process outline as navigation, duplicated readiness counts, and change reasons the system does not record. |

Never mix the visual identities of A, B and C. A screen built from B's interaction or C's structure still uses only A's tokens and components.

## Visual system (A)

Use the tokens from report §7 as the starting values, scoped as `--planning-*` on the internal root element. Do not edit `--sum-*`, the global reset or font rules, or the student components. Check contrast on rendered states before treating any value as final.

- **Type:** a readable sans-serif. IBM Plex Sans is the candidate, pending a check of local availability and licensing. Tables and body text 14px, labels 13px, section titles 18px, page titles 24px. Use tabular numerals, and never set essential text below 12px.
- **Color:** a charcoal rail, white working surfaces and a forest-green primary for the next valid transition. Amber means unresolved work, red means an error. Status is never shown by color alone.
- **Layout:** 4px spacing scale, thin row separators, no nested cards and no decorative shadows. Use shadow only on overlays.
- **No navigation rail (user decision, 2026-11-08):** the rail held a single destination, so it was removed. The theme selector and the link back to the local modules live in the scope header. Color follows a 60-30-10 split: neutral surfaces, then muted text, borders and secondary controls, and the forest-green primary only on the next valid transition.
- **Text:** no secondary descriptions or captions that restate the layout. A disabled gate shows its reason next to the control.

## Interaction rules

- **Tabla and Semana** are two views of the same proposal and the same selection. Switching between them keeps filters, selection and scroll.
- **Semana (from B)** edits only an *existing assigned* block: teacher, room, day and start. Duration is read-only. The preview shows the current and the proposed placement until the server accepts the change, through the existing adjustment request. Dragging is optional and only fills the same form, and the form always works without a pointer. Days with configured availability, including weekends, stay reachable. Narrow screens show a day agenda or list, not a shrunken grid.
- **Approval and publication (from C)** show one readiness summary, with evidence on demand. The single primary decision is to approve; publishing is a separate, later confirmation. A published version is read-only, and changes start a new draft. Show no semantic diff and no "Motivo" until a contract supplies them; show `Sin motivo registrado` when no reason was recorded.
- **Honest states:** follow the lifecycle table in report §6. A search limit never claims the schedule is impossible. A client role selector never grants authorization. Never show timers, escalation or AI resolutions that the backend does not implement.

## Engineering constraints

- Reuse the existing adapters (`client/src/data/academicScheduling.ts`), the shared validators and contracts, expected-version/CAS checks and explicit save. A visual change must not alter API effects.
- Reuse `DataTable` and `WeeklySchedule` logic only through planning-specific rendering. Do not restyle the shared student components. Record any incompatibility before introducing a replacement.
- No new dependencies unless a ticket justifies them, and the font is the first candidate to evaluate.
- Report §8 holds the implementation sequence. The first slice is to isolate the internal shell and the `--planning-*` tokens.

## Acceptance criteria for any internal-UI change

1. The screen uses only A's tokens and components. A screen that draws on B or C uses only the interaction or structure listed above.
2. Student SUM screens show no regression at equivalent viewport, content and state.
3. Client build, lint and `test:data` pass. Changed flows also pass real local React to NestJS scenarios with synthetic data.
4. Keyboard path, visible focus, 200% zoom and the narrow layout are checked. Status never relies on color alone.
5. Every state the change touches matches the lifecycle table in report §6.
