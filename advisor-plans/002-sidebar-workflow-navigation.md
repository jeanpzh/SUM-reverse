# Plan 002: The shell is built on the shadcn Sidebar and shows workflow progress

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report; do not improvise.
> When done, update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: the in-scope files are modified but uncommitted
> in the working tree. Open each and compare with "Current state". On a
> mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none. **This plan runs first.**
- **Category**: tech-debt (UX / navigation, component reuse)
- **Planned at**: commit `53f9251` plus the uncommitted working tree of branch `feat/planning-shadcn`, 2026-11-09

## Ground rules (apply to every step)

- Work in the existing checkout on branch `feat/planning-shadcn`. **Do not**
  commit, stash, reset, checkout, clean or create a worktree: the tree holds
  about 100 uncommitted files of earlier work.
- `datos-reales/` is forbidden: do not read, list, search or index it, and do
  not inspect any running server, API response, screenshot or cache.
- Do not start servers or browsers. Do not run or edit `client/scripts/verify*`
  scripts; plan 006 rewrites them.
- Only `/local/programacion-academica` is in scope. Student SUM screens and
  `/local/modulos` must not change visually.
- The operator explicitly lifted the project's "no new dependencies" and
  "keep existing structure" conventions for this redesign. You may add the
  dependency named below and replace the hand-written shell. You may **not**
  change API calls, validation, save semantics or academic rules.
- Code style: TypeScript, React function components, two-space indent, single
  quotes, **no semicolons**. Never add `!important`.

## Why this matters

The planning sidebar is hand-written: a fixed 224px `<aside>`, a second copy
of the same navigation inside a mobile `Sheet`, no collapse, no tooltips, and
a visually hidden theme `<select>` that takes keyboard focus invisibly. The
six destinations are a flat list, so nothing shows that the work is a
four-step sequence or which step the proposal has reached. The first item is
called "Panel general" while its page is titled "Resumen de preparación".

After this plan the shell uses the official shadcn Sidebar (collapsible to
icons with tooltips, off-canvas on narrow screens, `Ctrl/Cmd+B`), the
navigation is defined once and grouped into four numbered steps, and each
step shows whether it is done, current or still ahead, derived from the real
session state.

## Current state

- `client/src/components/PlanningShell.tsx` (315 lines) — the shell. Exports `PlanningShell`, `PlanningShellControls` (unused), `ThemeMode`.
- `client/src/components/PlanningShell.css` (417 lines) — tokens on `.planning-root`, the hand-written sidebar layout, bridges.
- `client/src/components/AcademicLocalShell.tsx:11` — mounts it: `if (isAcademicSchedulingRoute(pathname)) return <PlanningShell>{children}</PlanningShell>`.
- `client/src/data/planningSession.ts` — session store and derived view. `usePlanningSession()` (line 902) creates the store with `useState`, loads the catalog in an effect and disposes on unmount.
- `client/src/screens/AcademicScheduling.tsx:46` — the only caller: `const { state, view, commands } = usePlanningSession()`.
- `client/src/components/ui/` — the local shadcn kit, PascalCase files with relative imports (there is **no** `@/` path alias). `Sheet.tsx`, `Button.tsx`, `Input.tsx`, `Separator.tsx`, `DropdownMenu.tsx` exist. `Tooltip` and `Sidebar` do not.
- `client/src/components/ui/planningPortal.ts` — `usePlanningPortalContainer()`; every portalled primitive must mount into it (see `Sheet.tsx:14-17`), otherwise it renders outside `.planning-root` and loses its tokens.
- `client/src/styles/theme.css` — Tailwind v4 theme. The `@theme inline { ... }` block maps shadcn color names to `--planning-*` variables.

`PlanningShell.tsx:65-74`, first of six nav items (the others have the same shape):

```tsx
const NAV_ITEMS: readonly NavItemConfig[] = [
  {
    id: 'resumen',
    label: 'Panel general',
    icon: LayoutDashboard,
    to: '/local/programacion-academica',
    search: { etapa: 'preparacion', vista: 'resumen' },
    isActive: (stage, vista) => stage === 'preparacion' && (vista === 'resumen' || !vista),
  },
```

Ids in order: `resumen`, `cursos`, `recursos` (all `etapa: 'preparacion'`),
`horario`, `revision`, `aprobacion`.

`PlanningShell.tsx:143-159` — the root and the hidden select:

```tsx
    <div className="planning-root" data-theme={resolvedTheme}>
      <PlanningControlsContext.Provider value={{ mode: theme, setMode: setTheme }}>
        <PlanningPortalContext.Provider value={portal}>
          {/* Synchronized accessible theme selector for automation and fallback */}
          <select id="planning-theme" className="sr-only" ...>
```

and near the end (lines 293-299):

```tsx
              <main id="planning-main-content" className="planning-main" tabIndex={-1}>
                {children}
              </main>

              <div className="planning-portal-container" ref={setPortal} />
              <Toaster theme={resolvedTheme} />
```

`planningSession.ts` types used below: `PlanningSessionState` has
`proposal: AcademicProposal | null` and `draft.savedState` of type
`AcademicDraftState` (`'draft' | 'ready-for-review' | 'in-review' |
'ready-for-approval' | 'approved' | 'published'`). `PlanningStageId` is the
stage union `'preparacion' | 'horario' | 'revision' | 'aprobacion'`.

There is no Tailwind preflight in this project. Elements do not get
`border-style: solid`, `margin: 0` or list resets for free.
`client/src/components/ui/controls.css` shows the existing bridges and why.

## Commands you will need

Run from `/home/ubuntu/projects/SUM-reverse`.

| Purpose | Command | Expected on success |
|---|---|---|
| Add dependency | `pnpm --dir client add @radix-ui/react-tooltip` | exit 0 |
| Typecheck + build | `pnpm --dir client build` | exit 0 (a ">500 kB chunk" warning is pre-existing) |
| Lint | `pnpm --dir client lint` | exit 0 |
| Data tests | `pnpm --dir client test:data` | all pass, including the new ones |

## Scope

**In scope**:

- `client/package.json`, `client/pnpm-lock.yaml` (dependency only)
- `client/src/components/ui/Tooltip.tsx` (create)
- `client/src/components/ui/Sidebar.tsx` (create)
- `client/src/lib/useMediaQuery.ts` (create)
- `client/src/components/PlanningSessionProvider.tsx` (create)
- `client/src/components/PlanningShell.tsx`, `client/src/components/PlanningShell.css`
- `client/src/styles/theme.css` (only add lines inside the existing `@theme inline` block)
- `client/src/data/planningSession.ts`, `client/src/data/planningSession.test.ts` (add one function and its tests)
- `client/src/screens/AcademicScheduling.tsx` (one line: read the session from context)
- `client/src/screens/PlanningScopeHeader.tsx` (add the sidebar trigger)
- `client/src/components/ui/README.md` (document the two new primitives)

**Out of scope** (do NOT touch):

- `client/src/components/Shell.tsx` and anything student-facing.
- `client/src/routes/**` — the `etapa` / `vista` search params must not change.
- `client/src/components/mode-toggle.tsx`, `theme-provider.tsx`.
- `client/scripts/**`.

## Steps

### Step 1: Add the primitives from the official registry

1. `pnpm --dir client add @radix-ui/react-tooltip`.
2. Download the reference sources to a scratch directory outside the repo
   and read them; they are reference text, not code to run:

```sh
mkdir -p /tmp/shadcn-ref && cd /tmp/shadcn-ref
curl -sS https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json -o sidebar.json
curl -sS https://ui.shadcn.com/r/styles/new-york-v4/tooltip.json -o tooltip.json
node -e "for (const f of ['sidebar','tooltip']) for (const x of require('./'+f+'.json').files) console.log('=====', x.path, '\n' + x.content)" > reference.txt
```

3. Create `client/src/lib/useMediaQuery.ts`:

```ts
import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
```

4. Create `client/src/components/ui/Tooltip.tsx` from the registry `tooltip`
   source, and `client/src/components/ui/Sidebar.tsx` from the registry
   `sidebar` source, with exactly these adaptations:

   - Imports become relative: `../../lib/utils`, `./Button`, `./Input`,
     `./Separator`, `./Sheet`, `./Tooltip`. Remove `"use client"`. Remove
     semicolons.
   - Portals: in `Tooltip.tsx`, pass
     `container={usePlanningPortalContainer()}` to `TooltipPrimitive.Portal`,
     as `Sheet.tsx:14-17` does.
   - Replace `useIsMobile()` with `!useMediaQuery('(min-width: 1024px)')`.
   - Replace the cookie persistence (`document.cookie = ...`) with
     `localStorage`: read `planning-sidebar-open` for the initial value
     (`'0'` means collapsed, anything else open) inside a `try/catch`, and
     write it in `setOpen` inside a `try/catch`.
   - Delete `SidebarMenuSkeleton` and the `Skeleton` import (no Skeleton
     primitive exists here). Delete `SidebarInput` if `./Input` does not
     accept the props it passes.
   - No preflight: wherever a class list contains a `border`, `border-r`,
     `border-l`, `border-t` or `border-b` utility, add `border-solid`. Add
     `m-0 list-none p-0` to the `ul` and `li` elements (`SidebarMenu`,
     `SidebarMenuItem`, `SidebarMenuSub`, `SidebarMenuSubItem`). Add
     `border-0 bg-transparent font-[inherit] cursor-pointer` to elements
     rendered as `<button>` (`SidebarMenuButton`, `SidebarRail`,
     `SidebarGroupAction`, `SidebarMenuAction`), and `no-underline` to
     `SidebarMenuButton`.
   - Keep every `data-slot` and `data-sidebar` attribute from the registry.

5. In `client/src/styles/theme.css`, inside the existing `@theme inline { ... }`
   block, add:

```css
  --color-sidebar: var(--planning-surface);
  --color-sidebar-foreground: var(--planning-text);
  --color-sidebar-primary: var(--planning-primary);
  --color-sidebar-primary-foreground: var(--planning-primary-foreground);
  --color-sidebar-accent: var(--planning-selected);
  --color-sidebar-accent-foreground: var(--planning-text);
  --color-sidebar-border: var(--planning-border);
  --color-sidebar-ring: var(--planning-primary);
```

**Verify**: `pnpm --dir client build && pnpm --dir client lint` → both exit 0.

### Step 2: Share the planning session with the shell

Create `client/src/components/PlanningSessionProvider.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react'
import { usePlanningSession } from '../data/planningSession'

type PlanningSessionValue = ReturnType<typeof usePlanningSession>

const PlanningSessionContext = createContext<PlanningSessionValue | null>(null)

export function PlanningSessionProvider({ children }: { children: ReactNode }): ReactNode {
  const value = usePlanningSession()
  return <PlanningSessionContext.Provider value={value}>{children}</PlanningSessionContext.Provider>
}

export function usePlanningSessionContext(): PlanningSessionValue {
  const value = useContext(PlanningSessionContext)
  if (!value) throw new Error('usePlanningSessionContext requires PlanningSessionProvider')
  return value
}
```

If lint reports `react-refresh/only-export-components`, move the hook to
`client/src/components/usePlanningSessionContext.ts` and export the context
from the provider file.

In `AcademicScheduling.tsx` replace
`const { state, view, commands } = usePlanningSession()` with
`const { state, view, commands } = usePlanningSessionContext()` and fix the
imports. The store must now be created exactly once, in the provider.

**Verify**: `grep -rn "usePlanningSession()" client/src --include=*.tsx` → one match, in `PlanningSessionProvider.tsx`.

### Step 3: Derive workflow progress, with tests

Add to `client/src/data/planningSession.ts`, next to `derivePlanningPrimaryAction`:

```ts
export type PlanningStepStatus = 'done' | 'current' | 'upcoming'

// Local-only indicator for navigation. It reflects the saved state and the
// presence of a usable proposal; it grants nothing and blocks nothing.
export function derivePlanningProgress(state: Pick<PlanningSessionState, 'proposal' | 'draft'>): Record<PlanningStageId, PlanningStepStatus> {
  const saved = state.draft.savedState
  const order: PlanningStageId[] = ['preparacion', 'horario', 'revision', 'aprobacion']
  if (saved === 'published') return { preparacion: 'done', horario: 'done', revision: 'done', aprobacion: 'done' }
  const current: PlanningStageId = saved === 'approved' || saved === 'ready-for-approval' ? 'aprobacion'
    : saved === 'in-review' ? 'revision'
      : state.proposal && state.proposal.status !== 'invalid-input' ? 'horario' : 'preparacion'
  const index = order.indexOf(current)
  return Object.fromEntries(order.map((stage, position) =>
    [stage, position < index ? 'done' : position === index ? 'current' : 'upcoming'])) as Record<PlanningStageId, PlanningStepStatus>
}
```

Add tests to `client/src/data/planningSession.test.ts`, following the style
of the existing `derivePlanningPrimaryAction` tests in that file (they build
states from `initialPlanningSessionState()`). Cases:

1. initial state → `preparacion: 'current'`, the rest `'upcoming'`.
2. a state with a non-null proposal and `savedState: 'draft'` → `preparacion: 'done'`, `horario: 'current'`.
3. `savedState: 'in-review'` → `revision: 'current'`, the two before it `'done'`.
4. `savedState: 'ready-for-approval'` and `'approved'` → `aprobacion: 'current'`.
5. `savedState: 'published'` → all `'done'`.

**Verify**: `pnpm --dir client test:data` → all pass, with 5 more tests than before (record the count first).

### Step 4: Rebuild `PlanningShell` on the Sidebar

Rewrite `PlanningShell.tsx`. Keep: `ThemeProvider defaultTheme="dark"
storageKey="planning-theme"`, the `systemDark` / `resolvedTheme` logic, the
`.planning-root` element with `data-theme`, `PlanningPortalContext.Provider`,
the skip link, `<main id="planning-main-content" className="planning-main" tabIndex={-1}>`,
the `.planning-portal-container` div and `<Toaster />`.

Remove: `PlanningShellControls`, `PlanningControlsContext`, the hidden
`<select id="planning-theme">`, the hand-written `<aside>`, the
`.planning-mobile-header` block and its `Sheet`, and the `mobileOpen` state.

Navigation data:

```tsx
const NAV_GROUPS: readonly { step: number; stage: PlanningStage; label: string; items: readonly NavItemConfig[] }[] = [
  { step: 1, stage: 'preparacion', label: 'Preparar la oferta', items: [/* resumen → label 'Resumen', cursos, recursos */] },
  { step: 2, stage: 'horario', label: 'Programar', items: [/* horario → label 'Horario' */] },
  { step: 3, stage: 'revision', label: 'Revisar', items: [/* revision */] },
  { step: 4, stage: 'aprobacion', label: 'Aprobar y publicar', items: [/* aprobacion */] },
]
```

Keep each item's `id`, `to`, `search`, `icon`, `isActive` unchanged.

Structure (inside the portal provider):

```tsx
<PlanningSessionProvider>
  <SidebarProvider>
    <a href="#planning-main-content" className="planning-skip-link">Saltar al contenido principal</a>
    <PlanningSidebar stage={stage} vista={vista} />
    <SidebarInset className="planning-main-wrapper">
      <main id="planning-main-content" className="planning-main" tabIndex={-1}>{children}</main>
    </SidebarInset>
  </SidebarProvider>
  <div className="planning-portal-container" ref={setPortal} />
  <Toaster theme={resolvedTheme} />
</PlanningSessionProvider>
```

`PlanningSidebar` (same file):

```tsx
function PlanningSidebar({ stage, vista }: { stage: PlanningStage; vista: PlanningPreparationView }): ReactNode {
  const { state } = usePlanningSessionContext()
  const progress = derivePlanningProgress(state)
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon" id="planning-tour-nav" aria-label="Navegación de planificación">
      <SidebarHeader>
        {/* brand: 'FISI – UNMSM' / 'Planificación académica'; hide the text when collapsed with group-data-[collapsible=icon]:hidden */}
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.step}>
            <SidebarGroupLabel>
              <span className="planning-step" data-status={progress[group.stage]} aria-hidden="true">
                {progress[group.stage] === 'done' ? <Check className="size-3" /> : group.step}
              </span>
              <span>{group.label}</span>
              <span className="sr-only">
                {progress[group.stage] === 'done' ? ' (completado)' : progress[group.stage] === 'current' ? ' (en curso)' : ''}
              </span>
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = item.isActive(stage, vista)
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to} search={item.search} aria-current={active ? 'page' : undefined}
                        onClick={() => { if (isMobile) setOpenMobile(false) }}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {/* provenance: Info icon + 'Datos sintéticos' + 'Prototipo local; no es una pantalla oficial SUM.' (text hidden when collapsed) */}
        {/* SidebarMenu with one SidebarMenuButton asChild → <Link to="/local/modulos"> ArrowLeft + 'Módulos', tooltip 'Módulos' */}
        {/* <ModeToggle /> */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
```

In `PlanningScopeHeader.tsx`, import `SidebarTrigger` and render
`<SidebarTrigger aria-label="Mostrar u ocultar el menú" />` as the first
child of the `planning-scope-header__context` div. Change nothing else there.

**Verify**: `pnpm --dir client build` → exit 0.

### Step 5: Clean the shell CSS

In `PlanningShell.css`:

- Delete the rules for `.planning-shell-layout`, `.planning-sidebar`,
  `.planning-sidebar__brand`, `.planning-sidebar__nav` (both), the
  `.planning-sidebar__footer` rule, `.planning-mobile-header`, the
  `@media (max-width: 1023.98px)` declarations for `.planning-sidebar` and
  `.planning-mobile-header` (keep the `.planning-main` padding inside that
  query), and the last block of the file (`.planning-root .planning-sidebar__nav a > span`,
  `.planning-scope-header .planning-shell-controls`, `.planning-stage-nav__item`).
- Keep `.planning-sidebar__provenance*`, `.planning-main-wrapper`,
  `.planning-main`, `.planning-skip-link`, tokens, focus and table rules.
- Add:

```css
.planning-step {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 1.25rem;
  height: 1.25rem;
  margin-right: 0.5rem;
  border: 1px solid var(--planning-border);
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}
.planning-step[data-status='current'] { border-color: var(--planning-primary); color: var(--planning-text); }
.planning-step[data-status='done'] { background: var(--planning-success-surface); border-color: var(--planning-success); color: var(--planning-success); }
```

The status is never color alone: `done` shows a check mark instead of the
number and both `done` and `current` carry screen-reader text.

**Verify**: `grep -c "planning-mobile-header\|planning-shell-layout" client/src/components/PlanningShell.css client/src/components/PlanningShell.tsx` → both `0`.

### Step 6: Document and run all checks

Add two rows to the table in `client/src/components/ui/README.md`
(`Tooltip`, `Sidebar`: "shadcn registry, adapted: relative imports, planning
portal, no-preflight resets, localStorage instead of a cookie") and replace
the **Shell** paragraph with one sentence describing the Sidebar-based shell.

**Verify**: `pnpm --dir client build && pnpm --dir client lint && pnpm --dir client test:data` → all exit 0.

## Test plan

- Unit: the five `derivePlanningProgress` cases in step 3.
- For the reviewer (list in your report): collapse and expand with the rail,
  the trigger and `Ctrl/Cmd+B`; tooltips appear only when collapsed; state
  survives reload; below 1024px the sidebar opens as a sheet and closes after
  navigating; `aria-current="page"` on the active item; theme switch still
  works from the footer; dark and light.

## Done criteria

- [ ] `pnpm --dir client build`, `lint` and `test:data` exit 0
- [ ] `grep -c "derivePlanningProgress" client/src/data/planningSession.test.ts` prints at least `5`
- [ ] `grep -rn 'id="planning-theme"\|PlanningShellControls\|Panel general' client/src` returns no matches
- [ ] `grep -c "SidebarProvider" client/src/components/PlanningShell.tsx` prints at least `1`
- [ ] `grep -rn "usePlanningSession()" client/src --include=*.tsx` prints exactly one match
- [ ] `git diff --stat -- client/src/components/Shell.tsx client/src/App.css` shows no change made by you
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- "Current state" excerpts do not match.
- The registry download fails or the `sidebar` source imports a module not covered by the adaptation list.
- After step 1, `pnpm --dir client build` fails on a Tailwind class from the registry source twice.
- Moving the session into the provider makes any existing data test fail.
- The student shell (`Shell.tsx`) would need a change because of the theme tokens.

## Maintenance notes

- `derivePlanningProgress` is a navigation hint. It must never gate an
  action; gating stays in `derivePlanningPrimaryAction` and the server.
- New portalled primitives must use `usePlanningPortalContainer()`.
- The hidden `#planning-theme` select was an automation hook. Scripts that
  used it are rewritten by plan 006.
- Reviewer: confirm the catalog request still fires once on load (the
  provider now owns the effect that `AcademicScheduling` used to own).
