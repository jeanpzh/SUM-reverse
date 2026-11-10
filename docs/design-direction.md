# Design direction: internal academic planning product

Status: **binding**, revised by the user on 2026-11-09. The current direction below supersedes the earlier visual decisions from 2026-11-07/08 within the same internal-product scope. Source exploration: [academic-planning-2026-11-07](design/academic-planning-2026-11-07/README.md), cited below as "the report". This file states the decisions. The report holds the reasoning, the images and the detailed tables, which are not repeated here.

## Scope

- **Applies to:** the internal administration product for academic scheduling, timetable adjustment, teacher review, approval and publication. Today that is only `/local/programacion-academica` (the route matched by `isAcademicSchedulingRoute`) and the panels embedded in it. The local module chooser (`/`, `/local/modulos`) also leads into student flows, so it is out of scope and keeps its current look.
- **Does not apply to:** student SUM screens. Those keep [DESIGN.md](../DESIGN.md), the `--sum-*` tokens, the student components and the root SUM fidelity rule.
- **Integration with SUM:** only through data contracts (`shared/`, backend modules). The two products do not share a visual identity, and SUM-observed evidence is not required for internal screens.

## Current visual direction (2026-11-09)

The binding [2026-11-10 redesign specification](design/academic-planning-2026-11-10/redesign-spec.md) supersedes this direction on the theme default, palette, header layout, sidebar grouping and inspector placement. Its scope remains the internal academic planning route; the interaction rules below continue to apply.

The user explicitly requested a major UX/UI redesign inspired by five supplied images, then required building on **shadcn/ui**, and supplied a neutral gray palette. This authorizes replacing the previous A visual language and restoring a useful navigation sidebar within the existing internal route. It does not authorize changes to student screens, the module chooser, backend contracts or academic rules.

References (user-provided design inspiration, not SUM evidence):

- [Courses and teachers](design/academic-planning-2026-11-09/courses-and-teachers.png)
- [Weekly planning](design/academic-planning-2026-11-09/weekly-planning.png)
- [Planning and conflicts](design/academic-planning-2026-11-09/planning-and-conflicts.png)
- [Change review](design/academic-planning-2026-11-09/change-review.png)
- [Scenario comparison](design/academic-planning-2026-11-09/scenario-comparison.png)

Adopt the references' information density, persistent navigation, strong page hierarchy, compact tables, prominent timetable and contextual assistance. User revision on 2026-11-09: use the shadcn AI Elements Chat composition (Message Scroller, Message, Bubble, Input Group) for normative assistance. Offer a resizable right rail that is a panel of the workspace and can be closed, plus a full-width mode; the section inspector shares that rail. The draggable floating window was withdrawn by the user on 2026-11-09 because it covered the content. Keep the conversation while changing display mode. Narrow screens use the viewport width with collapse always available. This replaces the earlier Card/Sheet assistant composition and the proposed CopilotKit onboarding. The compact form discloses its scope filters on demand and never sends a query on mount. Use existing preparation, courses, resources, schedule, review and approval destinations. Do not add nonfunctional navigation or invented comparison/report capabilities. Reference numbers, people, explanations and outcomes are illustrative; render actual synthetic API results.

### Palette and components

- Build on the existing shadcn/Radix kit in `client/src/components/ui/`: Button, Card, Badge, Table, Tabs, Sheet, Dialog, Collapsible and form controls. Reuse current domain tables and calendar logic. New layout compositions are allowed; parallel primitive libraries are not.
- Scope all tokens to `.planning-root` / `--planning-*`. Keep student tokens and components intact.
- User palette: bright snow `#f8f9fa`, platinum `#e9ecef`, alabaster `#dee2e6`, slate-light `#ced4da`, slate `#adb5bd`, slate gray `#6c757d`, iron `#495057`, gunmetal `#343a40`, carbon black `#212529`, with their supplied shades for surfaces and borders. The input repeated `pale_slate`; retain both as separate tokens.
- Default to a deliberate dark workspace on first visit; preserve existing explicit light/dark/system choices. Provide a complete light theme.
- User revision during the usability redesign (2026-11-09, recorded in `advisor-plans/README.md`): retain the current blue primary actions on neutral surfaces. This supersedes the earlier monochrome-action decision. Reserve semantic green, amber and red for actual status, warnings and errors, with text. Calendar component types may use restrained distinguishable colors and explicit type labels.
- Thin borders, 6–12px radii, calm surfaces, no decorative gradients, glows, sparkles or charts without a meaningful metric. Use Lucide icons (one shared dependency, justified for navigation and controls).
- Desktop sidebar collapses into a shadcn Sheet on narrow screens. Keep all destinations, keyboard navigation and focus restoration available. No document-wide horizontal overflow.
- User revision after evaluating AWS references (2026-11-09): Asistente and Guía in the planning header use icon buttons with tooltips on hover/focus and accessible names. Academic actions retain visible text. This changes only the header tools; typography and the student interface are unchanged.
- Concise headings and useful inline explanations. Keep disabled reasons and explicit local/synthetic provenance without repeating large disclaimer cards.
- User revision during the usability redesign (2026-11-09): retain the current self-hosted Geist sans family (Regular 400 and Medium 500), with the planning-only type scale in `PlanningShell.css`. Keep `font-display: swap`, fallbacks, no global preload and no synthesized faces. The previously requested root CSS weight 450 remains unchanged pending a separate decision. Student typography stays intact. The earlier [serif research](design/academic-planning-2026-11-09/font-loading-research.md) is historical.

### Preserved structure

The existing Semana interactions and approval/publication separation remain binding. This is an interface redesign of the existing product, not an implementation of every feature illustrated in the references. API validation, save semantics, version checks, diagnostic honesty, selection and filters remain unchanged.

## Interaction rules

- **Tabla and Semana** are two views of the same proposal and the same selection. Switching between them keeps filters, selection and scroll.
- **Semana (from B)** edits only an *existing assigned* block: teacher, room, day and start. Duration is read-only. The preview shows the current and the proposed placement until the server accepts the change, through the existing adjustment request. Dragging is optional and only fills the same form, and the form always works without a pointer. Days with configured availability, including weekends, stay reachable. Narrow screens show a day agenda or list, not a shrunken grid.
- **Approval and publication (from C)** show one readiness summary, with evidence on demand. The single primary decision is to approve; publishing is a separate, later confirmation. A published version is read-only, and changes start a new draft. Show no semantic diff and no "Motivo" until a contract supplies them; show `Sin motivo registrado` when no reason was recorded.
- **Honest states:** follow the lifecycle table in report §6. A search limit never claims the schedule is impossible. A client role selector never grants authorization. Never show timers, escalation or AI resolutions that the backend does not implement.

## Engineering constraints

- Reuse the existing adapters (`client/src/data/academicScheduling.ts`), the shared validators and contracts, expected-version/CAS checks and explicit save. A visual change must not alter API effects.
- Reuse `DataTable` and `WeeklySchedule` logic only through planning-specific rendering. Do not restyle the shared student components. Record any incompatibility before introducing a replacement.
- No new dependencies unless a ticket justifies them, and the font is the first candidate to evaluate.
- The current implementation and validation scope is recorded in [the redesign plan](design/academic-planning-2026-11-09/plan.md).

## Acceptance criteria for any internal-UI change

1. The screen uses the current neutral palette and shadcn components. The calendar and approval flow preserve the interaction and structure listed above.
2. Student SUM screens show no regression at equivalent viewport, content and state.
3. Client build, lint and `test:data` pass. Changed flows also pass real local React to NestJS scenarios with synthetic data.
4. Keyboard path, visible focus, 200% zoom and the narrow layout are checked. Status never relies on color alone.
5. Every state the change touches matches the lifecycle table in report §6.
