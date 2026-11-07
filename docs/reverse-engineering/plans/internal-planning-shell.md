# Plan: internal planning shell and `--planning-*` tokens (slice 1)

Date: 2026-11-07. Author: orchestrator (planned inline, medium size). Source: [design direction](../../design-direction.md), report §7 and §8 step 2 of [academic-planning-2026-11-07](../../design/academic-planning-2026-11-07/README.md). Base: branch `feat/planning-shell`, stacked on PR #37.

## Goal

Give `/local/programacion-academica` its own shell and token scope in A's visual language, with no visual change to any other route. The screens inside are not restructured in this slice. They pick up A's palette and type scale through a scoped, transitional bridge of the existing `--color-sum-*` and `--text-*` variables.

## Design

- **Where:** `AcademicLocalShell` is the root `shellComponent`, so its imports load on every route. When `isAcademicSchedulingRoute(pathname)` is true it renders the new `PlanningShell`. The `isLocalAcademicArea` branch (`/`, `/local/modulos`) and the `ProfileAwareShell` branch stay as they are.
- **Structure:** `.planning-root` contains a `nav.planning-rail` labelled "Programación académica" and a `main.planning-main` holding the children.
  - The rail has the product name "Programación" and one item, "Programaciones" (the report's §6 name), linking to the current route with `aria-current="page"`. At the bottom is the existing "← Módulos locales" link to `/local/modulos`.
  - No other destinations appear until they exist.
- **Tokens:** every rule in the new CSS is scoped under a `.planning-` selector.
  1. The `--planning-*` values come from report §7: canvas `#F5F6F5`, surface `#FFFFFF`, text `#202925`, muted `#52625A`, rail `#202A25`, primary `#175C3B`, selected `#EAF2ED`, border `#D7DED9`, warning `#805300` on `#FFF4DC`, error `#A12622` on `#FDECEB`. Spacing uses a 4px base. Radius is 4px for controls and panels and 8px for floating surfaces.
  2. A clearly labelled *transitional bridge* block on `.planning-root` re-points `--color-sum-*`, `--text-meta` (13px), `--text-data` (14px), `--text-body`, `--radius-panel` and `--radius-control` to the planning values. A later slice deletes it.
  3. `.planning-root` declares its own `font-family`, because overriding `--font-sans` alone does not change text that already inherits Poppins. With no new dependency, the font is a system sans-serif stack; IBM Plex Sans is still an open decision. Tables inside the scope use tabular numerals.
- **Layout:** at 1024px and wider, the rail is a fixed column of about 176px beside a flexible main area. Below 1024px, the rail becomes a top bar. The page has no horizontal scroll caused by the shell.
- **Out of bounds:** `theme.css`, `index.css`, `Common.tsx`, `WeeklySchedule.tsx`, any screen `.tsx` or `.css`, `LocalModules`, `shared/` and `backend/`.

## Exclusive files

- `client/src/components/AcademicLocalShell.tsx` (branch only)
- `client/src/components/AcademicLocalShell.css` (only if the existing back-link rule must move)
- `client/src/components/PlanningShell.tsx` (new)
- `client/src/components/PlanningShell.css` (new)

## Acceptance criteria

| ID | Criterion | Check |
| --- | --- | --- |
| AC1 | Student routes and the module chooser are unchanged | Before and after screenshots at 1440px on the synthetic stack for `/local/modulos`, `/alumnoWebSum/v2/inicio` and `/alumnoWebSum/v2/reportes/horarios`; no `.planning-root` in the DOM; computed font is still Poppins |
| AC2 | No global CSS leakage | Every selector in `PlanningShell.css` starts with `.planning-`; no edits to out-of-bounds files (`git diff --name-only`) |
| AC3 | The scheduling route renders in A's shell | `.planning-root`, a labelled `nav` and one `main` are present; canvas and rail colors and the planning font are computed; table text is 14px |
| AC4 | Keyboard and semantics | The rail links are reachable by Tab with a visible focus ring; the active item has `aria-current="page"`; there is exactly one `main` landmark |
| AC5 | Responsive | At 800px the rail is a top bar and the shell causes no horizontal page scroll |
| AC6 | Feature flag off is unchanged | The flag-off path still renders the existing disabled message through `ProfileAwareShell` |
| AC7 | Static checks | `pnpm --dir client build`, `lint` and `test:data` pass |
| AC8 | Existing academic flow still works | `verify-academic-manual.mjs` passes against the synthetic stack; its evidence output is restored afterwards, not committed |

Roles: the UI worker owns the exclusive files and AC2 and AC7. The orchestrator owns the browser checks (AC1, AC3–AC6 and AC8) and integration. The Auditor reviews the integrated diff.
