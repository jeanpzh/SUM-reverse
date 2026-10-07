---
name: sum-visual-verification
description: >
  Compare a local React reconstruction against its SUM reference
  screenshot, identify visual mismatches, correct the local client and
  iterate until major discrepancies are resolved.
---

# SUM Visual Verification

This skill modifies only the local React application.

Never modify SUM during verification.

## Step 1 — Match conditions

Verify that reference and candidate use equivalent:

- viewport width;
- viewport height;
- screen state;
- scroll position;
- expanded/collapsed state.

Do not compare screenshots captured under substantially different
conditions.

## Step 2 — Compare macro geometry

Compare:

- header height;
- sidebar width;
- content origin;
- page width;
- major card dimensions;
- large whitespace regions.

Fix major geometry first.

## Step 3 — Compare component geometry

Check:

- alignment;
- widths;
- heights;
- gaps;
- padding;
- margins.

## Step 4 — Compare typography

Check:

- family;
- size;
- weight;
- line height;
- wrapping;
- alignment.

## Step 5 — Compare appearance

Check:

- colors;
- borders;
- radii;
- shadows;
- icons;
- backgrounds.

## Step 6 — Create mismatch ledger

Record important differences.

Example:

```md
| Element          |   SUM | Local | Status |
| ---------------- | ----: | ----: | ------ |
| Sidebar width    | 376px | 360px | FIX    |
| Header height    |  87px |  80px | FIX    |
| Main card radius |  20px |  12px | FIX    |
```
