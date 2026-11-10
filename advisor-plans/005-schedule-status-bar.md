# Plan 005: The timetable result bar states each fact once

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report; do not improvise.
> When done, update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: the in-scope files are modified but uncommitted
> in the working tree. Open them and compare with "Current state". On a
> mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of 001–003; must land before 004)
- **Category**: tech-debt (UX / cognitive load, accessibility)
- **Planned at**: commit `53f9251` plus the uncommitted working tree of branch `feat/planning-shadcn`, 2026-11-09

## Ground rules (apply to every step)

- Work in the existing checkout on branch `feat/planning-shadcn`. **Do not**
  commit, stash, reset, checkout, clean or create a worktree.
- `datos-reales/` is forbidden: do not read, list, search or index it, and do
  not inspect any running server, API response, screenshot or cache.
- Do not start servers or browsers. Do not run `verify*` scripts.
- Code style: TypeScript, two-space indent, single quotes, **no semicolons**.
  Reuse `client/src/components/ui/` primitives. No new dependencies.
- Honest states are binding (`docs/design-direction.md`): "A search limit
  never claims the schedule is impossible." Do not reword `headline`,
  `diagnosisText` or any diagnostic message.

## Why this matters

The result bar above the timetable is the first thing the user reads after
generating. Today it shows a status badge, a second badge "Propuesta sin
confirmar", a headline that often repeats the first badge word for word, a
sentence with the section and conflict counts, and then three metric tiles
with the same counts again. Below that come three buttons, a permanent
warning paragraph about "Reintentar búsqueda", and a details toggle. The
whole block is one `role="status"` live region, so assistive technology may
announce buttons and details as status text.

After this plan each number appears once, the destructive retry is guarded by
a confirmation instead of a permanent paragraph, and only the result line is
a live region.

## Current state

File: `client/src/screens/PlanningStatusBar.tsx` (470 lines). Only lines
129-220 are affected. `client/src/screens/PlanningStatusBar.css` needs no
change.

Lines 129-154 compute `badgeText`, `headline`, `subtext`, `diagnosisText`:

```tsx
  let badgeText = 'Completa'
  let headline = 'Programación completa'
  let subtext = `${coverage.complete}/${totalSections} secciones completas · ${conflicts} cruces en lo asignado`
  let diagnosisText: string | null = null

  if (proposal.status === 'search-limit') {
    badgeText = 'Programación parcial'
    headline = 'La programación aún tiene secciones por completar'
    subtext = 'La búsqueda se detuvo antes de completar la programación. Revisa las secciones pendientes o ajusta las restricciones.'
    ...
  } else if (proposal.status === 'impossible') {
    ...
    badgeText = partial ? 'Propuesta parcial' : 'Sin solución completa'
    headline = badgeText
    subtext = `${coverage.complete}/${totalSections} secciones completas · ${conflicts} cruces en lo asignado${notices > 1 ? ` · ${notices} avisos` : ''}`
    ...
  } else if (proposal.status === 'invalid-input') {
    badgeText = 'Entrada inválida'
    headline = 'Demanda fuera de los límites del generador'
    subtext = 'Corrige la configuración de demanda o capacidades para continuar.'
  }
```

Lines 157-220 render:

```tsx
    <section
      className="planning-status-bar box-border flex min-w-0 flex-col gap-3 rounded-planning-panel border border-solid border-border bg-background px-4 py-3 text-foreground [overflow-wrap:anywhere]"
      aria-labelledby="academic-scheduling-result"
      data-status={proposal.status}
      role="status"
    >
      <div className="planning-status-bar__header flex min-w-0 flex-col gap-2">
        <div className="planning-status-bar__state-row flex min-w-0 flex-wrap items-center gap-2">
          {proposal.status === 'complete' ? <CalendarCheck2 size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
          <Badge variant={proposal.status === 'complete' ? 'success' : proposal.status === 'invalid-input' ? 'destructive' : 'warning'}>
            {badgeText}
          </Badge>
          {isDraft && <Badge variant="outline">Propuesta sin confirmar</Badge>}
          <h3 id="academic-scheduling-result" className="planning-status-bar__headline ...">
            {headline}
          </h3>
        </div>
        <p className="planning-status-bar__subtext m-0 text-sm text-muted-foreground tabular-nums">
          {subtext}
        </p>
        {proposal.diagnostics.length > 0 && <Button ... onClick={() => setDiagnosticsOpen(true)}>Ver avisos</Button>}
      </div>

      <dl className="planning-status-bar__metrics" aria-label="Resultado de programación">
        <div><dt>Secciones completas</dt><dd>{coverage.complete}<span> / {totalSections}</span></dd></div>
        <div><dt>Secciones por completar</dt><dd>{coverage.partial + coverage.pending}</dd></div>
        <div><dt>Cruces en lo asignado</dt><dd>{conflicts}</dd></div>
      </dl>

      <div className="planning-status-bar__actions flex min-w-0 flex-wrap items-center gap-2">
        ... "Revisar N pendientes" (variant default), "Consultar consejero" (outline),
        {onRegenerate && (
          <Button type="button" variant="outline" disabled={isLocked} onClick={onRegenerate}>
            Reintentar búsqueda
          </Button>
        )}
      </div>
      {onRegenerate && <p className="planning-status-bar__subtext m-0 text-muted-foreground">
        Reintentar usa la configuración actual y reemplaza esta propuesta, incluidos sus ajustes manuales. Guarda antes si deseas conservarla.
      </p>}
```

`data-status` on the section is a stable hook used by verification scripts.
Keep it and keep `id="academic-scheduling-result"`.

The confirmation helper lives in `client/src/components/ui/ConfirmDialog.tsx`.
Usage, as in `client/src/screens/AcademicScheduling.tsx`:

```tsx
const [confirmElement, confirm] = useConfirm()
// render {confirmElement} once inside the component's JSX
if (!(await confirm({ title: 'Descartar cambios', description: '...', confirmLabel: 'Descartar cambios', destructive: true }))) return
```

The draft/unsaved state is already shown by the status badge in the page
header (`PlanningScopeHeader`), so the "Propuesta sin confirmar" badge here
repeats it.

## Commands you will need

Run from `/home/ubuntu/projects/SUM-reverse`.

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck + build | `pnpm --dir client build` | exit 0 (a ">500 kB chunk" warning is pre-existing) |
| Lint | `pnpm --dir client lint` | exit 0 |

## Scope

**In scope**: `client/src/screens/PlanningStatusBar.tsx` only.

**Out of scope** (do NOT touch):

- The diagnostics `Dialog` and the advisor `Sheet` in the same file (lines 302-467).
- The "Detalles de búsqueda" `Collapsible` content.
- `client/src/screens/AcademicScheduling.tsx` — the `onRegenerate` and
  `onApplyAdvisorPatches` callbacks it passes are unchanged.
- `client/scripts/**` — do not edit; step 5 only reports.

## Steps

### Step 1: Remove the duplicated counts and the duplicated badge

- For `complete` and `impossible`, the counts in `subtext` repeat the metric
  tiles. Change the two template-literal assignments so that:
  - initial value: `let subtext: string | null = null`
  - `impossible` branch: `subtext = null`
  - `search-limit` and `invalid-input` keep their explanatory sentences.
  Render the paragraph only when `subtext` is not null.
- In the `impossible` branch the notice count moves to the button: change the
  "Ver avisos" label to `Ver avisos ({proposal.diagnostics.length})`.
- Render the status `Badge` only when `badgeText !== headline` **and** the
  status is not `complete`. For `complete` the icon and the headline
  "Programación completa" already state the result in text.
- Delete `{isDraft && <Badge variant="outline">Propuesta sin confirmar</Badge>}`.
  If the `isDraft` parameter is then unused inside the function, keep it in
  `PlanningStatusBarProps` (the parent still passes it) but remove it from the
  destructuring so lint passes.

**Verify**: `grep -c "Propuesta sin confirmar\|cruces en lo asignado\${" client/src/screens/PlanningStatusBar.tsx` → `0`.

### Step 2: Narrow the live region

Remove `role="status"` from the outer `<section>` and add `role="status"` to
`<div className="planning-status-bar__state-row ...">`, which holds only the
icon, the optional badge and the headline. Keep `aria-labelledby` and
`data-status` on the section.

**Verify**: `grep -c 'role="status"' client/src/screens/PlanningStatusBar.tsx` → the same count as before this step (record it first; the advisor sheet has its own).

### Step 3: Guard the retry with a confirmation

- Import `useConfirm` from `'../components/ui/ConfirmDialog'` and add
  `const [confirmElement, confirm] = useConfirm()`. Render `{confirmElement}`
  as the first child of the outer `<section>`.
- Replace the retry button's `onClick={onRegenerate}` with:

```tsx
onClick={() => void (async () => {
  if (!(await confirm({
    title: 'Reemplazar esta propuesta',
    description: 'Reintentar usa la configuración actual y reemplaza esta propuesta, incluidos sus ajustes manuales. Guarda antes si deseas conservarla.',
    confirmLabel: 'Reintentar búsqueda',
    destructive: true,
  }))) return
  onRegenerate()
})()}
```

- Delete the `{onRegenerate && <p className="planning-status-bar__subtext ...">Reintentar usa ...</p>}` paragraph: its text now lives in the dialog.

**Verify**: `grep -c "Reintentar usa la configuración actual" client/src/screens/PlanningStatusBar.tsx` → `1`.

### Step 4: Build and lint

**Verify**: `pnpm --dir client build && pnpm --dir client lint` → both exit 0.

### Step 5: Report script impact (read-only)

Run:

```sh
grep -rn "Reintentar búsqueda\|Propuesta sin confirmar\|Completa'\|secciones completas ·" client/scripts
```

Do not edit the scripts. Include the output in your report so the reviewer
can update any script that clicks "Reintentar búsqueda" (it now needs a
second click on the dialog's confirm button) or reads removed text.

## Test plan

No data-layer change, so no new unit tests. For the reviewer, list the four
`proposal.status` values (`complete`, `search-limit`, `impossible`,
`invalid-input`) and what the bar shows for each after the change: icon,
badge or no badge, headline, subtext or none, metrics, buttons.

## Done criteria

- [ ] `pnpm --dir client build` exits 0
- [ ] `pnpm --dir client lint` exits 0
- [ ] `grep -c "Propuesta sin confirmar" client/src/screens/PlanningStatusBar.tsx` prints `0`
- [ ] `grep -c "useConfirm" client/src/screens/PlanningStatusBar.tsx` prints at least `2`
- [ ] The outer `<section className="planning-status-bar ...">` opening tag has no `role` attribute
- [ ] Only `client/src/screens/PlanningStatusBar.tsx` differs from the `git status --short` recorded before step 1
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts do not match.
- `useConfirm` has a different signature from the usage shown.
- Removing a badge would leave a status expressed by color or icon alone (check each of the four statuses: each must keep a text headline).
- A step seems to require editing `AcademicScheduling.tsx`.

## Maintenance notes

- "Revisar N pendientes" stays the single `variant="default"` button of this
  bar; it is the Horario stage's primary action (`resolve-pending`).
- Applying advisor patches already confirms before discarding manual
  adjustments (in `AcademicScheduling.tsx`). The retry confirmation here uses
  the same component so both destructive regenerations behave alike.
- Plan 004 later replaces the literal font sizes in `PlanningStatusBar.css`.
