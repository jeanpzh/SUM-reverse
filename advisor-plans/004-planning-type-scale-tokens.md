# Plan 004: Planning screens use one type scale defined as tokens

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report; do not improvise.
> When done, update this plan's row in `advisor-plans/README.md`.
>
> **Drift check (run first)**: the in-scope files are uncommitted and plans
> 001, 002, 003 and 005 edit several of them. This plan is mechanical and
> tolerant of that drift: it is driven by the grep commands below, not by line
> numbers. Run the "census" command in step 1 and continue with whatever it
> returns.

## Status

- **Priority**: P2
- **Effort**: M (mechanical)
- **Risk**: LOW–MED (visual only; many files)
- **Depends on**: plans 001, 002, 003 and 005 (run last so it does not conflict with their CSS edits)
- **Category**: tech-debt (design system)
- **Planned at**: commit `53f9251` plus the uncommitted working tree of branch `feat/planning-shadcn`, 2026-11-09

## Ground rules (apply to every step)

- Work in the existing checkout on branch `feat/planning-shadcn`. **Do not**
  commit, stash, reset, checkout, clean or create a worktree.
- `datos-reales/` is forbidden: do not read, list, search or index it, and do
  not inspect any running server, API response, screenshot or cache.
- Do not start servers or browsers. Do not run `verify*` scripts.
- Only the internal planning product is in scope. **Student screens must not
  change**: do not edit `client/src/styles/theme.css`, `client/src/App.css`,
  or any CSS file not listed under "In scope".
- Change `font-size` (and `line-height` only where a step says so). Do not
  change colors, spacing, layout, font family or font weight.
- Never add `!important`.

## Why this matters

The planning screens declare 24 different literal font sizes across 17 CSS
files (for example `13px`, `13.5px`, `14px`, `0.9375rem`, `15px`, `16px`,
`17px`, `18px`, `1.1875rem`, `20px`, `21px`), plus arbitrary Tailwind sizes
such as `text-[10px]` and `text-[11px]`. Only three size tokens exist. The
result is a hierarchy nobody can predict, and some labels are 10–11px, below
a comfortable reading size.

After this plan every planning font size is one of seven tokens, and no text
is smaller than 12px.

## Current state

`client/src/components/PlanningShell.css:87-89`, inside `.planning-root { ... }`:

```css
  --text-meta: 0.875rem;
  --text-data: 0.9375rem;
  --text-body: 0.9375rem;
```

These override the student values from `client/src/styles/theme.css` only
inside `.planning-root`. `--text-section` (1.125rem) and `--text-page`
(1.5rem) are inherited from `theme.css` unchanged. About 70 declarations
already use `var(--text-meta)`, `var(--text-data)`, `var(--text-body)` or
`var(--text-section)`; they stay as they are.

Tailwind's built-in utilities used in planning TSX are `text-xs` (12px),
`text-sm` (14px), `text-base` (16px), `text-lg` (18px) and `text-xl` (20px).
They already sit on the scale below and are not changed.

## Commands you will need

Run from `/home/ubuntu/projects/SUM-reverse`.

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck + build | `pnpm --dir client build` | exit 0 (a ">500 kB chunk" warning is pre-existing) |
| Lint | `pnpm --dir client lint` | exit 0 |
| Contrast (static, no browser) | `pnpm --dir client check:planning-contrast` | exit 0 |

## Scope

**In scope** (modify only these):

- CSS: `client/src/components/PlanningShell.css`, `client/src/components/PlanningFetchLoading.css`,
  `client/src/components/ai-elements/NormativeAdvice.css`,
  `client/src/components/ui/Sonner.css`, `client/src/components/ui/controls.css`,
  `client/src/screens/Planning*.css`, and these `client/src/screens/Academic*.css`
  files: `AcademicScheduling.css`, `AcademicPreparationCourses.css`,
  `AcademicResourceEditor.css`, `AcademicTeacherReview.css`,
  `AcademicPublicationPanel.css`, `AcademicIntentionDemandPanel.css`.
- TSX (class names only): `client/src/components/PlanningShell.tsx`,
  `client/src/screens/PlanningScopeHeader.tsx`, `client/src/screens/PlanningNormativeChat.tsx`,
  `client/src/components/ai-elements/NormativeAdvice.tsx`.

**Out of scope** (do NOT touch):

- `client/src/screens/AcademicHistory.css` — despite the name it is a student screen.
- `client/src/styles/theme.css`, `client/src/styles/typeset.css`, `client/src/App.css`.
- `font-weight`. See "Maintenance notes" for why it is deferred.
- Spacing values. A spacing scale is a separate piece of work.

## Steps

### Step 1: Define the scale

In `client/src/components/PlanningShell.css`, inside the first
`.planning-root { ... }` block, replace the three lines shown in "Current
state" with:

```css
  /* Type scale. Every planning font-size uses one of these tokens. */
  --planning-text-xs: 0.75rem;    /* 12px: captions, badges, counters */
  --planning-text-sm: 0.875rem;   /* 14px: secondary text, table meta, controls */
  --planning-text-base: 0.9375rem;/* 15px: body and table data */
  --planning-text-lg: 1.125rem;   /* 18px: section headings */
  --planning-text-xl: 1.25rem;    /* 20px: panel headlines */
  --planning-text-2xl: 1.625rem;  /* 26px: page title */
  --planning-text-3xl: 1.75rem;   /* 28px: headline metrics */
  --planning-leading-tight: 1.3;
  --planning-leading-normal: 1.5;
  /* Legacy aliases, still used by about 70 declarations. */
  --text-meta: var(--planning-text-sm);
  --text-data: var(--planning-text-base);
  --text-body: var(--planning-text-base);
  --text-section: var(--planning-text-lg);
```

Record the census before changing anything else:

```sh
grep -rnE "font-size:\s*[0-9.]+(px|rem)" client/src/components/PlanningShell.css client/src/components/PlanningFetchLoading.css client/src/components/ai-elements/NormativeAdvice.css client/src/components/ui/Sonner.css client/src/components/ui/controls.css client/src/screens/Planning*.css client/src/screens/AcademicScheduling.css client/src/screens/AcademicPreparationCourses.css client/src/screens/AcademicResourceEditor.css client/src/screens/AcademicTeacherReview.css client/src/screens/AcademicPublicationPanel.css client/src/screens/AcademicIntentionDemandPanel.css
```

Expect roughly 145 matches. Call this command **CENSUS**.

**Verify**: `pnpm --dir client build` → exit 0.

### Step 2: Replace every literal with a token

For every CENSUS match, replace the literal value using this table. Sizes
round **up** to the next step except where noted, so no text gets smaller
than it is today by more than 1px.

| Literal today | Replace with |
|---|---|
| `10px`, `11px`, `12px`, `0.6875rem`, `0.75rem` | `var(--planning-text-xs)` |
| `13px`, `13.5px`, `0.8125rem`, `14px`, `0.875rem` | `var(--planning-text-sm)` |
| `15px`, `0.9375rem`, `16px`, `1rem` | `var(--planning-text-base)` |
| `17px`, `18px`, `1.125rem`, `1.1875rem` | `var(--planning-text-lg)` |
| `20px`, `21px`, `1.25rem` | `var(--planning-text-xl)` |
| `1.5rem`, `1.625rem` | `var(--planning-text-2xl)` |
| `28px`, `1.75rem` | `var(--planning-text-3xl)` |

Rules:

- `16px` and `1rem` become 15px. That is the only downward change and it is
  intentional: 15px is this product's body size.
- Do not touch the four `@font-face` blocks or the token definitions from step 1.
- If a rule is declared twice for the same selector in one file with
  different sizes (for example `.planning-root .planning-status-bar__headline`
  appears with `17px` and later `20px` in `PlanningStatusBar.css`), convert
  both by the table; do not merge or delete rules.
- A value not in the table (for example `1.375rem`, `24px`, an `em` or `%`
  value) is a STOP condition: report the file, line and value.

Work one file at a time and run `pnpm --dir client build` after every three
or four files.

**Verify**: run CENSUS again → the only matches are the seven
`--planning-text-*` definitions in `PlanningShell.css` (they are custom
properties, not `font-size:` declarations, so the expected output is **empty**).

### Step 3: Replace arbitrary Tailwind sizes

Find them:

```sh
grep -rnE "text-\[[0-9.]+(px|rem)\]" client/src/components/PlanningShell.tsx client/src/screens/PlanningScopeHeader.tsx client/src/screens/PlanningNormativeChat.tsx client/src/components/ai-elements/NormativeAdvice.tsx
```

Replace inside the class strings: `text-[10px]`, `text-[11px]`, `text-[12px]`
→ `text-xs`; `text-[13px]` → `text-sm`; `text-[15px]` →
`text-[length:var(--planning-text-base)]`. Change nothing else in those
strings.

**Verify**: the same grep → only matches containing `var(--planning-text-base)`.

### Step 4: Final checks

**Verify**: `pnpm --dir client build && pnpm --dir client lint && pnpm --dir client check:planning-contrast` → all exit 0.

## Test plan

No behavior changes, so no new tests. The grep checks are the regression
guard. In your report give the CENSUS count before and after, and list any
value you could not map.

## Done criteria

- [ ] CENSUS prints nothing
- [ ] The step 3 grep prints only `var(--planning-text-base)` matches
- [ ] `grep -c "planning-text-" client/src/components/PlanningShell.css` prints at least `11`
- [ ] `pnpm --dir client build`, `pnpm --dir client lint` and `pnpm --dir client check:planning-contrast` exit 0
- [ ] `git diff --stat -- client/src/styles client/src/App.css client/src/screens/AcademicHistory.css` shows no change made by you (compare with the `git status --short` recorded before step 1)
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- A CENSUS value is not in the mapping table.
- `check:planning-contrast` fails after your change but passed before it (run it once before step 1 to know).
- A build error mentions a Tailwind class from step 3.
- You find yourself wanting to edit `theme.css` to make a token available: the tokens are plain CSS custom properties on `.planning-root` and need no Tailwind theme entry.

## Maintenance notes

- New planning CSS must use the `--planning-text-*` tokens; reviewers can
  run CENSUS to check.
- **Font weight was deliberately left alone and needs an operator decision.**
  `.planning-root` sets `font-weight: 450` with `font-synthesis: none`, and
  the `Geist` family ships only 400 and 500. By the CSS font-matching rules
  450 resolves to the 500 file, and so do 600 and 700. Body text and "bold"
  text therefore render with the same face, so weight carries no hierarchy at
  all. Setting the root to 400 would restore the Regular/Medium contrast, but
  the operator asked for 450 explicitly, so it is not changed here.
- `docs/design-direction.md` still names Geist Serif as the planning
  typeface while the CSS loads Geist first. That document needs the
  operator's ruling; this plan does not edit it.
- Portalled surfaces (dialogs, sheets, toasts) render inside
  `.planning-portal-container`, which is a descendant of `.planning-root`, so
  the tokens resolve there too.
