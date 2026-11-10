# Plan 006: The planning acceptance scripts drive the redesigned interface

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report; do not improvise.
> When done, update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: this plan is written before plans 001–005 are
> executed. It describes the interface they produce. Before editing, confirm
> each "New interface" fact below with the grep given beside it. A fact that
> does not hold is a STOP condition for the scripts that rely on it.

## Status

- **Priority**: P1 (it is the verification baseline for the redesign)
- **Effort**: M
- **Risk**: LOW (test code only)
- **Depends on**: plans 001, 002, 003, 004 and 005, all DONE
- **Category**: tests
- **Planned at**: commit `53f9251` plus the uncommitted working tree of branch `feat/planning-shadcn`, 2026-11-09

## Ground rules (apply to every step)

- Work in the existing checkout on branch `feat/planning-shadcn`. **Do not**
  commit, stash, reset, checkout, clean or create a worktree.
- `datos-reales/` is forbidden: do not read, list, search or index it. Do not
  attach to any server that is already running, and do not inspect API
  responses, screenshots or caches of unknown origin.
- **You do not run these scripts.** They need a browser and a dedicated
  synthetic stack that only the orchestrator starts. Your checks are
  `node --check` and grep.
- Edit only files under `client/scripts/`. Never change application code to
  make a script pass; report the mismatch instead.
- Keep each script's safety guards exactly as they are (for example
  `if (process.env.SUM_CHAT_SYNTHETIC !== '1') throw ...`, environment
  allowlists, own-process startup and shutdown).

## Why this matters

Plans 001–005 replace the sidebar, the assistant panel, the page header and
the result bar. The Playwright scripts under `client/scripts/` still look
for the old headings, labels, ids and panel modes, so they can no longer
show whether the planning flows work. Until they are updated there is no
executable acceptance check for the redesign.

## Current state

Scripts and the selectors that the redesign removes:

| Script | Outdated selector or step |
|---|---|
| `verify-academic-teacher-review.mjs`, `verify-academic-week.mjs`, `verify-academic-persistence.mjs`, `verify-academic-publication.mjs`, `verify-academic-scheduling.mjs`, `verify-cycle-complete.mjs` | `page.getByRole('heading', { name: 'Programación académica asistida', exact: true }).waitFor()` |
| `verify-academic-persistence.mjs` (about lines 86, 151, 159) | `page.getByLabel('Estado de la propuesta', { exact: true })` with `.selectOption('ready-for-review')` and `.inputValue()`; `page.locator('.academic-scheduling__draft-bar').screenshot(...)` |
| `verify-planning-redesign.mjs` (about lines 113-121) | `page.locator('#planning-theme').selectOption(...)` and `.inputValue()` |
| `verify-planning-redesign.mjs` (about lines 245-248, 301) | button "Abrir menú de navegación", navigation "Navegación móvil", `.planning-sidebar__nav a > span` |
| `verify-planning-shell.mjs` (criterion AC4, about lines 111-125) | focuses `#planning-theme` and asserts the theme selector and back link are in the scope header |
| `verify-planning-chat.mjs` | `getByRole('complementary', { name: 'Asistente normativo' })`, buttons "Colapsar chat", "Abrir chat", "Expandir chat al ancho completo", "Convertir en ventana flotante", "Mover chat con las flechas o arrastrar", "Fijar como sidebar", and `data-mode` assertions |

Find every occurrence before editing:

```sh
grep -n "Programación académica asistida\|Estado de la propuesta\|academic-scheduling__draft-bar\|planning-theme\|Abrir menú de navegación\|Navegación móvil\|planning-sidebar__nav\|planning-stage-actions\|Colapsar chat\|Abrir chat\|ventana flotante\|Mover chat\|Fijar como sidebar\|data-mode\|Panel general\|Propuesta sin confirmar\|Reintentar búsqueda\|planning-tour-" client/scripts/*.mjs
```

## New interface (confirm each before relying on it)

| Fact | Confirm with |
|---|---|
| The page title is inside `#planning-page-title` and is one of "Resumen de preparación", "Cursos", "Docentes y ambientes", "Horario", "Revisión docente", "Aprobación y publicación" | `grep -n "planning-page-title" client/src/screens/PlanningScopeHeader.tsx` |
| The proposal status badge has class `planning-scope-header__draft-state` and attribute `data-draft-state` with values `draft`, `ready-for-review`, `in-review`, `ready-for-approval`, `approved`, `published` | `grep -n "data-draft-state" client/src/screens/PlanningScopeHeader.tsx` |
| Marking ready for review is a button named "Marcar lista para revisión"; the reverse is "Volver a borrador" | `grep -n "Marcar lista para revisión\|Volver a borrador" client/src/screens/AcademicScheduling.tsx` |
| The proposal row is `#planning-tour-proposal` | `grep -n "planning-tour-proposal" client/src/screens/PlanningScopeHeader.tsx` |
| The header next-step button, when present, is `#planning-tour-primary` | `grep -n "planning-tour-primary" client/src/screens/AcademicScheduling.tsx` |
| The theme is changed from a button whose accessible name starts with "Cambiar tema de interfaz", then a menu item "Claro (Light)", "Oscuro (Dark)" or "Sistema (System)"; the result is `data-theme` on `.planning-root` | `grep -n "Cambiar tema\|Claro (Light)" client/src/components/mode-toggle.tsx` |
| The sidebar is toggled by a button named "Mostrar u ocultar el menú"; below 1024px it opens as a dialog | `grep -n "Mostrar u ocultar el menú" client/src/screens/PlanningScopeHeader.tsx` |
| Navigation links are named "Resumen", "Cursos", "Docentes y ambientes", "Horario", "Revisión docente", "Aprobación y publicación" | `grep -n "label:" client/src/components/PlanningShell.tsx` |
| The assistant is `getByRole('region', { name: 'Asistente normativo' })`, opened and closed by `#planning-toggle-chat`, with buttons "Expandir al ancho completo", "Restaurar tamaño" and "Cerrar asistente"; there is no floating or collapsed mode | `grep -n "aria-label" client/src/screens/PlanningContextPanel.tsx` |
| "Reintentar búsqueda" opens a confirmation dialog whose confirm button is also named "Reintentar búsqueda" | `grep -n "confirmLabel" client/src/screens/PlanningStatusBar.tsx` |
| The page scrolls inside `.planning-workspace__content`, not the window | `grep -n "planning-workspace__content" client/src/screens/PlanningContextPanel.css` |

## Commands you will need

Run from `/home/ubuntu/projects/SUM-reverse`.

| Purpose | Command | Expected on success |
|---|---|---|
| Syntax | `for f in client/scripts/*.mjs; do node --check "$f" || echo FAIL $f; done` | no `FAIL` line |
| Lint | `pnpm --dir client lint` | exit 0 |

## Scope

**In scope**: `client/scripts/verify-academic-*.mjs`, `verify-cycle-complete.mjs`,
`verify-planning-redesign.mjs`, `verify-planning-shell.mjs`, `verify-planning-chat.mjs`.

**Out of scope**: everything under `client/src/`, `backend/`, `shared/`;
`verify-planning-redesign-stack.mjs` and any other script that starts or
stops processes; `client/scripts/verify.mjs` (student screens).

## Steps

### Step 1: Heading waits

In the six `verify-academic-*` / `verify-cycle-complete` scripts replace the
heading wait with `await page.locator('#planning-page-title').waitFor()`,
keeping indentation.

**Verify**: `grep -c "Programación académica asistida" client/scripts/*.mjs | grep -v ":0"` → no output.

### Step 2: Proposal state in `verify-academic-persistence.mjs`

- `.selectOption('ready-for-review')` on "Estado de la propuesta" becomes
  `await page.getByRole('button', { name: 'Marcar lista para revisión', exact: true }).click()`.
- Each `assert.equal(await page.getByLabel('Estado de la propuesta', ...).inputValue(), X)`
  becomes
  `assert.equal(await page.locator('.planning-scope-header__draft-state').getAttribute('data-draft-state'), X)`
  with the same `X`.
- `.academic-scheduling__draft-bar` becomes `#planning-tour-proposal`.

**Verify**: `grep -c "Estado de la propuesta\|academic-scheduling__draft-bar" client/scripts/verify-academic-persistence.mjs` → `0`.

### Step 3: Theme and navigation in `verify-planning-redesign.mjs` and `verify-planning-shell.mjs`

- Add a helper at the top of each script that uses the theme:

```js
const setTheme = async (page, item) => {
  await page.getByRole('button', { name: /^Cambiar tema de interfaz/ }).first().click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
}
```

  Replace `page.locator('#planning-theme').selectOption('light' | 'dark' | 'system')`
  with `setTheme(page, 'Claro (Light)' | 'Oscuro (Dark)' | 'Sistema (System)')`.
  Replace the `inputValue()` assertion for `'system'` with
  `assert.equal(await page.evaluate(() => localStorage.getItem('planning-theme')), 'system')`.
- Mobile navigation: "Abrir menú de navegación" becomes the button
  "Mostrar u ocultar el menú"; `getByRole('navigation', { name: 'Navegación móvil' })`
  becomes `page.getByRole('dialog')`; link names follow the table above
  ("Panel general" is now "Resumen", "Programación" is now "Horario").
- `.planning-sidebar__nav a > span` becomes `[data-sidebar="menu-button"] span`.
- `verify-planning-shell.mjs` criterion AC4 asserted that the theme selector
  and the back link live in the scope header. They now live in the sidebar
  footer. Rewrite AC4 to: focus the theme button, assert it has a visible
  focus indicator using the script's existing `focusedFacts` helper, then
  assert the "Módulos" link is reachable by keyboard and navigates. Update
  the criterion's description string to match.

**Verify**: `grep -c "planning-theme'\|Navegación móvil\|Abrir menú de navegación" client/scripts/verify-planning-redesign.mjs client/scripts/verify-planning-shell.mjs` → both `0`.

### Step 4: `verify-planning-chat.mjs`

- `panel` becomes `page.getByRole('region', { name: 'Asistente normativo', exact: true })`.
- Check `collapse-expand-fullwidth-preserve-conversation`: close with
  "Cerrar asistente", assert `#planning-chat-body` is not visible, reopen
  with `page.locator('#planning-toggle-chat').click()`, click "Expandir al
  ancho completo", assert the panel's bounding-box width is greater than
  1400, and assert the turn count is still 1. Remove the `data-mode`
  assertion.
- Delete the check `floating-pointer-and-keyboard-movement`.
- In `mobile-sidebar-and-context-reset`, replace the "Fijar como sidebar"
  click with a click on "Restaurar tamaño", then keep the viewport change
  and the remaining assertions.
- Rename check ids that mention removed modes so the report stays truthful.

**Verify**: `grep -c "flotante\|Colapsar chat\|data-mode\|Fijar como sidebar" client/scripts/verify-planning-chat.mjs` → `0`.

### Step 5: Sweep and syntax

Run the "find every occurrence" grep from "Current state" again. Resolve
each remaining match using the "New interface" table, or list it in your
report with the reason it could not be mapped. For any script step that
clicks "Reintentar búsqueda", add a second click on the dialog's confirm
button: `await page.getByRole('alertdialog').getByRole('button', { name: 'Reintentar búsqueda', exact: true }).click()`.
Replace any `window.scrollTo` / `window.scrollY` used on planning pages with
the same call on `document.querySelector('.planning-workspace__content')`.

**Verify**: the syntax loop prints no `FAIL`; `pnpm --dir client lint` exits 0.

## Test plan

These files are the tests. The orchestrator runs them, one at a time, on its
own synthetic stack and records the results. In your report, give per script:
lines changed, checks removed (with the reason), and anything left unmapped.

## Done criteria

- [ ] The syntax loop prints no `FAIL`
- [ ] `pnpm --dir client lint` exits 0
- [ ] The "find every occurrence" grep prints only matches you listed as unmapped in your report, or `planning-tour-*` ids that still exist in `client/src`
- [ ] `git status --short` shows no change under `client/src/` made by you
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- A "New interface" fact does not hold.
- A script's safety guard or process handling would have to change.
- Making a check pass would require editing application code.
- A script turns out to target student screens.

## Maintenance notes

- The scripts were not executed by the author of this plan or by the
  executor. Treat the first orchestrated run as the real validation and
  expect follow-up fixes.
- Prefer role and accessible-name selectors, `data-draft-state` and
  `data-status` over CSS classes in future checks.
