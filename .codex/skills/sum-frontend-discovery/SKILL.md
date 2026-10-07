---
name: sum-frontend-discovery
description: >
  Inspect the authenticated SUM frontend with Playwright MCP and collect
  structured, sanitized evidence about screens, routes, components,
  measurements and safe interaction states without modifying SUM data.
---

# SUM Frontend Discovery

Use this skill when evidence must be collected from the real
authenticated SUM frontend.

Do not implement React during this workflow unless explicitly asked.

## Step 1 — Establish target

Identify:

- target screen;
- current route;
- viewport width;
- viewport height;
- current UI state.

Do not begin broad exploration when a specific screen has been
requested.

## Step 2 — Capture reference

Capture a screenshot of the target state.

Ensure personal information is not persisted without sanitization.

Save the sanitized reference under:

`evidence/sum/<screen>/reference.png`

## Step 3 — Inspect hierarchy

Identify:

- application shell;
- header;
- sidebar;
- primary content region;
- sections;
- cards;
- forms;
- tables;
- overlays.

Document:

`evidence/sum/<screen>/structure.md`

## Step 4 — Measure

Measure significant elements.

Prioritize:

- viewport;
- header;
- sidebar;
- content boundaries;
- large cards;
- tables;
- primary controls;
- repeated spacing;
- typography.

Use browser-derived measurements instead of screenshot estimation.

Write:

`evidence/sum/<screen>/measurements.md`

## Step 5 — Inspect styles

For visually important elements inspect relevant computed properties.

Examples:

- font-family
- font-size
- font-weight
- line-height
- color
- background-color
- padding
- margin
- gap
- border
- border-radius
- box-shadow
- overflow

Do not dump all computed CSS.

Collect only values useful for reconstruction.

## Step 6 — Inspect safe interactions

Test safe frontend-only states when useful:

- hover;
- sidebar expansion;
- dropdown expansion;
- active menu item;
- tab changes;
- scrolling;
- accordion expansion.

Do not submit forms or execute state-changing actions.

Document:

`evidence/sum/<screen>/interactions.md`

## Step 7 — Update shared knowledge

When discoveries affect multiple screens, update as appropriate:

`docs/frontend/navigation.md`

`docs/frontend/routes.md`

`docs/frontend/components.md`

`docs/frontend/unknowns.md`

## Step 8 — Stop

Report:

- evidence captured;
- confirmed reusable patterns;
- unknown behavior;
- potentially unsafe interactions requiring human assistance.

Do not automatically proceed to implementation unless requested.