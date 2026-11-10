# Plan 003: Every view shows where you are, which proposal you are editing and the next step

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report; do not improvise.
> When done, update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: the in-scope files are modified but uncommitted
> in the working tree, and plans 001 and 002 have edited some of them. Open
> each and compare with "Current state", allowing for the changes those two
> plans describe. On any other mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `advisor-plans/002-sidebar-workflow-navigation.md` (the Sidebar carries the synthetic-data notice on every screen size and the `planning-tour-nav` id), then `advisor-plans/001-fluid-workspace-right-rail.md` (same file, `AcademicScheduling.tsx`). Run after both.
- **Category**: tech-debt (UX / information architecture)
- **Planned at**: commit `53f9251` plus the uncommitted working tree of branch `feat/planning-shadcn`, 2026-11-09

## Ground rules (apply to every step)

- Work in the existing checkout on branch `feat/planning-shadcn`. **Do not**
  commit, stash, reset, checkout, clean or create a worktree.
- `datos-reales/` is forbidden: do not read, list, search or index it, and do
  not inspect any running server, API response, screenshot or cache.
- Do not start servers or browsers. Do not run or edit `client/scripts/verify*`
  scripts; plan 006 rewrites them for the new interface.
- The operator lifted the project's "keep existing structure, ids and texts"
  convention for this redesign: you may replace controls and labels as the
  steps say. API effects and academic rules must not change.
- Only `/local/programacion-academica` is in scope. Student SUM screens and
  `/local/modulos` must not change. `client/src/components/Common.tsx` is a
  shared student component: do not edit it.
- Code style: TypeScript, React function components, two-space indent, single
  quotes, **no semicolons**. Reuse `client/src/components/ui/` primitives. No
  new dependencies. Never add `!important`.
- Business rules do not change: which action is "primary" still comes from
  `view.primaryAction(stage)` in `client/src/data/planningSession.ts`; saving
  stays explicit; no handler's effect changes.

## Why this matters

The page heading reads "Programación académica asistida" on all six views, so
it never says where the user is. The proposal's name, its state and the
"Propuestas" list are visible only in the Preparación stage, although the
proposal is edited in all four. The state is a `<select>` whose options are
almost always disabled, so a read-only status looks like a control. The
primary action sits in a different place in each stage: under the summary, at
the top of the panel, or in the header. The built-in guide points two of its
five steps at elements that were removed, and a step without a target renders
nothing.

After this plan the header shows the view's title, the proposal row is
visible everywhere, the next step always appears in the same place beside
"Guardar", and the guide's targets exist.

## Current state

- `client/src/screens/PlanningScopeHeader.tsx` (122 lines) — title row and save row.
- `client/src/screens/AcademicScheduling.tsx` — owns state, the proposal bar, stage panels and the guide.
- `client/src/screens/PlanningPreparationSummary.tsx` — the Resumen view; has its own `<h2>`.
- `client/src/components/PlanningShell.tsx` — the Sidebar-based shell from plan 002.

`PlanningScopeHeader.tsx:42-56`:

```tsx
      <div className="planning-scope-header__title-row flex min-w-0 flex-wrap items-center justify-between gap-3 [&_.page-title]:m-0">
        <div className="planning-scope-header__context flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <PageTitle>Programación académica asistida</PageTitle>
          <span className="planning-scope-header__scope rounded-planning-control border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {school} · {period}
          </span>
          <Badge
            variant="secondary"
            className="text-xs"
            title="No es una pantalla oficial SUM y no requiere ni otorga permisos administrativos."
          >
            Prototipo local · datos sintéticos
            <span className="sr-only">. No es una pantalla oficial SUM y no requiere ni otorga permisos administrativos.</span>
          </Badge>
        </div>
```

`PlanningScopeHeader.tsx:88-119` is the second row: a `Badge` with
`role="status"` showing `draftStateText`, then on the right the optional
`disabledReason` text and the save `Button` with `id="planning-tour-save"`.

`PageTitle` (`client/src/components/Common.tsx:6-12`) renders
`<article className="page-title"><h2>{children}</h2></article>` and accepts
only `children`.

`AcademicScheduling.tsx`, proposal bar, currently the first child of the
Preparación stage panel (about lines 244-299):

```tsx
      <section className="academic-scheduling__draft-bar" aria-label="Propuestas locales">
        <div className="academic-scheduling__draft-heading">
          <div className="academic-scheduling__draft-field"><Label htmlFor="planning-proposal-title">Propuesta</Label>
            <Input id="planning-proposal-title" aria-label="Nombre de la propuesta" ... />
          </div>
          <div className="academic-scheduling__draft-field"><Label htmlFor="planning-proposal-state">Estado</Label>
            <NativeSelect id="planning-proposal-state" aria-label="Estado de la propuesta" disabled={lockedDraft || draftBusy} value={view.displayedDraftState}
              onChange={(event) => markDraftState(event.currentTarget.value as AcademicDraftState)}>
              <option value="draft">Borrador</option>
              <option value="ready-for-review" disabled={!proposal || proposal.status !== 'complete' || !proposal.coverageComplete || proposal.assignments.length === 0}>Lista para revisión</option>
              <option value="in-review" disabled>En revisión docente</option>
              ...
            </NativeSelect>
          </div>
          <div className="academic-scheduling__draft-actions">
            <Button ... id="planning-tour-proposals" ...><FolderKanban .../><span>Propuestas</span></Button>
          </div>
        </div>
        <Dialog open={draftListOpen} onOpenChange={setDraftListOpen}> ... </Dialog>
      </section>
```

Primary actions rendered today in `AcademicScheduling.tsx`:

- Preparación, inside the "Generar propuesta" section:
  `<div id={preparationAction?.id === 'generate' ? 'planning-tour-primary' : undefined} className="academic-scheduling__actions">`
  containing `<Button ... variant={primaryVariant(preparationAction?.id === 'generate')} disabled={!validDemands || generating || lockedDraft || draftBusy} onClick={() => void generate()}>{generating ? 'Generando…' : 'Generar horarios'}</Button>`.
- Preparación, after that section:
  `{preparationAction?.id === 'review-offer' && <Button id="planning-tour-primary" type="button" variant="default" onClick={() => onPreparationViewChange('cursos')}>{preparationAction.label}</Button>}`
- Horario, Revisión and Aprobación each start with a
  `<div className="planning-stage-actions">` holding conditional buttons for
  `back-preparation`, `submit-review`, `back-schedule`, `to-approval`, `back-review`.

The action ids and labels come from `derivePlanningPrimaryAction`
(`client/src/data/planningSession.ts:577-610`). Full id list: `review-offer`,
`generate`, `back-preparation`, `resolve-pending`, `save`, `submit-review`,
`record-response`, `to-approval`, `back-schedule`, `back-review`, `approve`,
`publish`. `AcademicScheduling.tsx` already computes
`const currentAction = currentStage === 'preparacion' ? preparationAction : ...`.

The guide (`AcademicScheduling.tsx`, about lines 591-614) maps five tuples to
`<TourStep target={`#planning-tour-${target}`}>`: `stages`, `preparation`,
`save`, `primary` (or `preparation`), `proposals`. The ids
`planning-tour-stages` and `planning-tour-preparation` no longer exist in
`client/src`. `client/src/components/ui/Tour.tsx:1197` returns `null` for a
step whose target element is missing. `openGuide` first navigates to
Preparación/Resumen and `restoreGuideContext` navigates back.

`PlanningPreparationSummary.tsx:34-45`:

```tsx
    <section
      className="planning-preparation-summary min-w-0 text-foreground"
      aria-labelledby="planning-preparation-summary-title"
    >
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2
          className="m-0 text-base font-semibold text-foreground tracking-tight sm:text-lg"
          id="planning-preparation-summary-title"
        >
          Resumen de preparación
        </h2>
      </div>
```

Plan 002 added `<SidebarTrigger />` as the first child of the
`planning-scope-header__context` div. Keep it there, before the title.

## Commands you will need

Run from `/home/ubuntu/projects/SUM-reverse`.

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck + build | `pnpm --dir client build` | exit 0 (a ">500 kB chunk" warning is pre-existing) |
| Lint | `pnpm --dir client lint` | exit 0 |
| Data tests | `pnpm --dir client test:data` | all pass (no data file changes; this guards against accidental edits) |

## Scope

**In scope**:

- `client/src/screens/PlanningScopeHeader.tsx`
- `client/src/screens/AcademicScheduling.tsx`
- `client/src/screens/AcademicScheduling.css` (only `.academic-scheduling__draft-*` rules)
- `client/src/screens/PlanningPreparationSummary.tsx`
- `client/src/components/PlanningShell.tsx` (only the fallback wrapper described in step 5, if needed)

**Out of scope** (do NOT touch):

- `client/src/data/planningSession.ts` — the primary-action rules are correct.
- `client/src/screens/AcademicTeacherReview.tsx`, `AcademicPublicationPanel.tsx`, `PlanningStatusBar.tsx` — they render `record-response`, `approve`, `publish` and `resolve-pending` in context, with their own confirmations. Leave those four actions where they are.
- `client/src/components/ui/Tour.tsx`.
- `client/src/components/Common.tsx`.

## Steps

### Step 1: Title per view and a proposal row in the header

In `PlanningScopeHeader.tsx`:

- Add props `title: string`, `proposalControls?: ReactNode`, `nextAction?: ReactNode`.
- Title row: wrap the title as `<div id="planning-page-title"><PageTitle>{title}</PageTitle></div>`.
  Remove the `Badge` "Prototipo local · datos sintéticos" from this row and
  move the `{school} · {period}` span to the second row (below). Keep the
  "Asistente" and "Guía" buttons unchanged.
- Second row: give the container
  `id="planning-tour-proposal"` and replace its classes
  `border-0 bg-transparent py-1` with
  `rounded-planning-panel border border-solid border-border bg-background p-3`.
  Order of children, left to right:
  1. `{proposalControls}`
  2. the `{school} · {period}` span
  3. the existing status `Badge` (unchanged, keeps `role="status"`)
  4. in the right-aligned wrapper: existing `disabledReason` text, then
     `{nextAction}`, then the existing save button (unchanged, keeps
     `id="planning-tour-save"`).
- Remove the now-unused `Badge` import only if no `Badge` remains (one does).

In `AcademicScheduling.tsx` pass the title:

```tsx
const pageTitle = currentStage === 'horario' ? 'Horario'
  : currentStage === 'revision' ? 'Revisión docente'
    : currentStage === 'aprobacion' ? 'Aprobación y publicación'
      : preparationView === 'cursos' ? 'Cursos'
        : preparationView === 'recursos' ? 'Docentes y ambientes' : 'Resumen de preparación'
```

**Verify**: `pnpm --dir client build` → exit 0.

### Step 2: Show the proposal controls in every stage

In `AcademicScheduling.tsx`:

- Cut the `<div className="academic-scheduling__draft-heading">...</div>`
  element out of the Preparación panel and pass it as
  `proposalControls={...}` to `PlanningScopeHeader`.
- Move the `<Dialog open={draftListOpen} ...>...</Dialog>` element to be a
  sibling right after `<PlanningScopeHeader />`.
- Delete the now-empty `<section className="academic-scheduling__draft-bar" aria-label="Propuestas locales">` wrapper.
- State control: delete the `Estado` field (label plus `NativeSelect
  id="planning-proposal-state"`). A status is not a form field, and four of
  its six options were always disabled. The status badge in the same row
  shows the state; add `data-draft-state={view.displayedDraftState}` to that
  badge (pass it to `PlanningScopeHeader` as a new prop `draftState`) so
  tests have a stable hook. The one transition the user could make becomes
  an explicit button in the `academic-scheduling__draft-actions` div, before
  "Propuestas":

```tsx
{!lockedDraft && view.proposalComplete && view.displayedDraftState === 'draft' && (
  <Button type="button" variant="outline" disabled={draftBusy} onClick={() => markDraftState('ready-for-review')}>
    Marcar lista para revisión
  </Button>
)}
{!lockedDraft && view.displayedDraftState === 'ready-for-review' && (
  <Button type="button" variant="ghost" disabled={draftBusy} onClick={() => markDraftState('draft')}>
    Volver a borrador
  </Button>
)}
```

  `markDraftState` is the existing handler (`commands.edit({ type: 'setDraftState', state })`);
  the reducer and its rules are unchanged. `view.proposalComplete` equals the
  condition that enabled the old `ready-for-review` option.
- In `AcademicScheduling.css`, delete the `.academic-scheduling__draft-bar`
  rule (line 15) and change `.academic-scheduling__draft-field` from
  `flex: 1 1 200px` to `flex: 0 1 16rem` so the name field does not stretch
  across the row.

**Verify**: `grep -c "academic-scheduling__draft-bar" client/src/screens/AcademicScheduling.tsx client/src/screens/AcademicScheduling.css` → both `0`.

### Step 3: One place for the next step

In `AcademicScheduling.tsx`, build the header action from `currentAction`
and pass it as `nextAction`:

```tsx
const stageLink = (search: { etapa: PlanningStage; vista?: PlanningPreparationView }, label: string) => (
  <Button asChild size="sm" id="planning-tour-primary">
    <Link to="/local/programacion-academica" search={search}>{label}</Link>
  </Button>
)
let nextAction: ReactNode = null
if (currentAction) {
  switch (currentAction.id) {
    case 'review-offer':
      nextAction = preparationView === 'cursos' ? null
        : <Button type="button" size="sm" id="planning-tour-primary" onClick={() => onPreparationViewChange('cursos')}>{currentAction.label}</Button>
      break
    case 'generate':
      nextAction = <Button type="button" size="sm" id="planning-tour-primary"
        disabled={!validDemands || generating || lockedDraft || draftBusy}
        onClick={() => void generate()}>{generating ? 'Generando…' : currentAction.label}</Button>
      break
    case 'submit-review':
      nextAction = <Button type="button" size="sm" id="planning-tour-primary"
        disabled={lockedDraft || draftBusy} onClick={() => void submitTeacherReview()}>{currentAction.label}</Button>
      break
    case 'back-preparation': nextAction = stageLink({ etapa: 'preparacion' }, currentAction.label); break
    case 'back-schedule': nextAction = stageLink({ etapa: 'horario' }, currentAction.label); break
    case 'to-approval': nextAction = stageLink({ etapa: 'aprobacion' }, currentAction.label); break
    case 'back-review': nextAction = stageLink({ etapa: 'revision' }, currentAction.label); break
    default: nextAction = null // resolve-pending, save, record-response, approve, publish stay in their panels
  }
}
```

Import `type ReactNode` from `react`. Then remove the old copies:

- Delete all three `<div className="planning-stage-actions">...</div>` blocks.
- Delete the `{preparationAction?.id === 'review-offer' && <Button id="planning-tour-primary" ...>}` element.
- In the "Generar propuesta" section keep the button (its options live
  there) but make it secondary: `variant="outline"`, and remove the `id={...}`
  attribute from its wrapping `div`. Delete `primaryVariant` if it is no
  longer used.

Exactly one element may carry `id="planning-tour-primary"` at a time; the
switch guarantees it.

**Verify**: `grep -c "planning-stage-actions" client/src/screens/AcademicScheduling.tsx` → `0`.

### Step 4: Remove the duplicate summary heading

In `PlanningPreparationSummary.tsx`, delete the `<div className="mb-4 ...">`
that wraps the `<h2 id="planning-preparation-summary-title">` and change the
section's `aria-labelledby="planning-preparation-summary-title"` to
`aria-label="Resumen de preparación"`. The header now carries that title.

**Verify**: `grep -c "planning-preparation-summary-title" client/src/screens/PlanningPreparationSummary.tsx` → `0`.

### Step 5: Repair the guide

- Plan 002 put `id="planning-tour-nav"` on the Sidebar. Confirm with
  `grep -n "planning-tour-nav" client/src/components/PlanningShell.tsx`. If
  the `Sidebar` component does not forward `id` to a rendered element, wrap
  the `SidebarContent` children in `<div id="planning-tour-nav">` in
  `PlanningShell.tsx` (the only edit allowed in that file).
- In `AcademicScheduling.tsx` replace the guide data and its open/close logic:

```tsx
const GUIDE_STEPS = [
  ['nav', 'Recorrido', 'El menú sigue el orden del trabajo: preparar la oferta, programar, revisar y publicar.'],
  ['proposal', 'Propuesta', 'Aquí ves qué propuesta editas y su estado. Puedes renombrarla o abrir otra guardada.'],
  ['save', 'Guardar', 'Guarda explícitamente la versión que quieres conservar.'],
  ['primary', 'Siguiente paso', 'Este botón indica la acción que sigue según el estado de la propuesta.'],
] as const
```

  Declare `GUIDE_STEPS` at module level. Add state
  `const [guideSteps, setGuideSteps] = useState<ReadonlyArray<readonly [string, string, string]>>([])`.
  `openGuide` becomes synchronous:

```tsx
const openGuide = () => {
  setGuideSteps(GUIDE_STEPS.filter(([target]) => {
    const element = document.getElementById(`planning-tour-${target}`)
    return Boolean(element && element.getClientRects().length > 0)
  }))
  setTourStep(0)
  setTourOpen(true)
}
```

  The visibility test matters: below 1024px the sidebar is `display: none`,
  and a hidden target would produce an empty step.
- Map `guideSteps` instead of the inline array, and replace both
  `index === 4` comparisons with `index === guideSteps.length - 1`.
- Delete `guideOrigin`, `restoreGuideContext` and `hasGuidePrimaryTarget`.
  The Tour's `onCloseAutoFocus` becomes
  `(event) => { event.preventDefault(); document.getElementById('planning-tour-guide')?.focus({ preventScroll: true }) }`.
- Update the header prop to `onGuide={openGuide}`.

**Verify**: `grep -c "planning-tour-stages\|planning-tour-preparation\|guideOrigin" client/src/screens/AcademicScheduling.tsx` → `0`.

### Step 6: Final checks

**Verify**: `pnpm --dir client build && pnpm --dir client lint && pnpm --dir client test:data` → all exit 0.

In your report, list the selectors this plan removed so plan 006 can update
the scripts: the heading "Programación académica asistida", the label
"Estado de la propuesta", the class `academic-scheduling__draft-bar`, and
the class `planning-stage-actions`.

## Test plan

No new unit tests: no data-layer logic changes, and `test:data` must stay
green. In your report list, for the reviewer, the manual matrix: for each of
the six destinations, the title shown; and for each `PlanningPrimaryActionId`,
where its button appears (header for the seven handled ids, in-panel for
`resolve-pending`, `save`, `record-response`, `approve`, `publish`).

## Done criteria

- [ ] `pnpm --dir client build` exits 0
- [ ] `pnpm --dir client lint` exits 0
- [ ] `pnpm --dir client test:data` exits 0
- [ ] `grep -rn "planning-stage-actions\|planning-tour-stages\|planning-tour-preparation" client/src --include=*.tsx` returns no matches
- [ ] `grep -rn "Programación académica asistida\|planning-proposal-state" client/src` returns no matches
- [ ] `grep -c 'id="planning-tour-primary"' client/src/screens/AcademicScheduling.tsx` prints `4` (three buttons and the `stageLink` helper)
- [ ] Only in-scope files differ from the `git status --short` you recorded before step 1
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts do not match beyond what plans 001 and 002 describe.
- Plan 002 has not landed (`grep -c "NAV_GROUPS" client/src/components/PlanningShell.tsx` prints `0`): removing the header badge would then leave mobile without the synthetic-data notice.
- `view.proposalComplete` does not exist on the session view.
- Replacing the state select would require changing the `setDraftState` reducer case in `planningSession.ts`.
- A handled action seems to need a confirmation dialog that the old button did not have.
- A step seems to require a file outside the in-scope list.

## Maintenance notes

- A new `PlanningPrimaryActionId` must be added either to the header switch
  or to a panel, never both. `client/src/components/ui/README.md` rule "One
  primary Button per stage" still holds: the header button is that primary.
- `resolve-pending` remains the primary button of `PlanningStatusBar`; plan
  005 keeps it that way.
- Reviewer: check that "Generar horarios" in the options section and
  "Generar propuesta" in the header call the same `generate()` and share the
  same disabled condition.
