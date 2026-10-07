---
name: sum-frontend-implementation
description: >
  Implement a previously observed SUM screen inside the React client
  using collected evidence as the source of truth, without accessing or
  changing SUM backend behavior.
---

# SUM Frontend Implementation

Target directory:

`client/`

Use this workflow only after sufficient reference evidence exists.

## Step 1 — Read evidence

Before editing code read:

`evidence/sum/<screen>/structure.md`

`evidence/sum/<screen>/measurements.md`

`evidence/sum/<screen>/interactions.md`

and inspect the reference screenshot.

Also inspect shared frontend documentation.

Do not begin implementation based only on memory.

## Step 2 — Inspect existing React architecture

Before creating new components inspect:

- existing layout;
- existing reusable components;
- current styling approach;
- routing;
- existing assets.

Reuse components when their observed purpose matches.

Do not duplicate existing infrastructure unnecessarily.

## Step 3 — Implement structural geometry

Implement first:

- page shell;
- header;
- sidebar;
- major containers;
- content grid.

Do not begin with cosmetic details.

## Step 4 — Implement components

Implement visible controls and content.

Use synthetic data where backend data would normally be required.

Never call SUM endpoints from the replica.

## Step 5 — Implement interaction states

Reproduce observed safe frontend interactions.

Examples:

- sidebar expansion;
- active navigation state;
- hover behavior;
- dropdown state;
- scrolling;
- modal appearance.

Backend-dependent effects may be represented by local fixtures or
frontend state.

## Step 6 — Render

Launch the client.

Render the target route using the reference viewport.

Capture:

`evidence/local/<screen>/candidate.png`

## Step 7 — Hand off to verification

Do not declare completion.

Run visual verification against the SUM reference.