---
name: sum-react-implement
description: Implement a specified SUM replica screen or behavior in the React client from existing local evidence and contracts. Use for client implementation, not evidence discovery or backend work.
---

# Implement a specified React client change

Read `client/AGENTS.md` and the assigned specification, scenarios, and local API contract before editing. Reuse existing components and data-layer patterns; keep the change within assigned client files.

- Trace each visible requirement to observed evidence or an explicit local-only decision. Preserve gaps as unverified instead of filling them with guessed SUM behavior.
- Follow the current React, TanStack Router, TypeScript and Vite patterns. Keep routes/components focused, reuse existing styling, and implement semantic, keyboard-accessible controls.
- Keep transport and adaptation in `src/data/`. Validate runtime responses at the boundary and use only the independent local API via the configured same-origin proxy in `local` mode. Never call or proxy SUM endpoints. Keep mock mode compatible with its contract.
- Implement only states required by the specification. Do not add backend behavior, new dependencies, unrelated screens, or invented persistence.
- Run the client build and lint for code changes. Run `test:data` or `verify` only when requested or authorized; `verify` uses Playwright and writes evidence. Report changed files, criteria covered, commands/results, local assumptions, and unverified gaps.

For client-to-backend scenarios, leave integration verification to the root `sum-fullstack-verify` workflow. Do not take over the shared browser unless explicitly assigned.
