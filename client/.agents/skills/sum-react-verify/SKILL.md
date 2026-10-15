---
name: sum-react-verify
description: Verify an implemented SUM replica screen against local specifications using deterministic client checks and authorized local UI evidence. Use for frontend verification, not production discovery.
---

# Verify a React client change

Read `client/AGENTS.md`, the relevant specification/scenarios, and the implementation diff. Use only local or sanitized provided artifacts, and distinguish observed results from assumptions.

- Check the assigned criteria against the exact route and states. When comparing visuals, align viewport, scroll, interaction state, and content; report structural mismatches without claiming pixel parity from incomparable captures.
- Run `pnpm --dir client build` and `pnpm --dir client lint`. Run `test:data` or `verify` only if requested or authorized; `verify` runs Playwright and writes evidence. Keep the shared browser single-owner and sequential; do not navigate it unless assigned ownership.
- For interactive local checks, use synthetic data and the local app. Do not inspect production SUM, issue requests to SUM, or treat mode `api` as production authorization.
- Client checks do not establish client/server integration. The root `sum-fullstack-verify` workflow owns API and persistence scenarios.
- Report each criterion as passed, failed, or unverified with the command/evidence supporting it. Include real command outcomes, important mismatches, and any remaining gap; do not repair files outside the assigned client scope.
