# Client instructions

These instructions apply to `client/` and inherit the repository-root `AGENTS.md`. Use the root file for evidence classification, production authorization, privacy, and task reporting. Client ownership covers `client/` only; do not edit backend, root configuration, evidence, or contracts unless the task assigns them.

## Local skills and dispatch

Use this folder's skills for client work. The root coordinates shared contracts, handoffs and integration:

| Task | Local skill |
| --- | --- |
| Implement React | [sum-react-implement](.agents/skills/sum-react-implement/SKILL.md) |
| Verify frontend/UI | [sum-react-verify](.agents/skills/sum-react-verify/SKILL.md) |

Implementation uses `sum-implementer` or `sum-executor`, both GPT-6 Luna High. Workers do not delegate.

## Scope and implementation

- Build the independent React interface in `src/`. Follow existing routes, shared components, data adapters, CSS conventions, and visual evidence. Keep changes limited to the assigned screen/flow; do not apply a generic redesign.
- Keep screen rendering in components, route behavior in TanStack Router routes, and requests/response adaptation in `src/data/`. Use the existing React 19, TanStack Router, TypeScript 6 and Vite setup; do not add frameworks or dependencies without an explicit requirement.
- Treat source provenance explicitly: SUM-observed, inferred, unverified, or local-only. Reuse supplied specifications, scenarios and contracts. Mark local prototypes as such; never invent SUM behavior to fill a gap.
- Runtime-validate HTTP JSON at the data boundary before UI use. TypeScript types alone are insufficient. Use explicit local DTOs and envelopes; do not silently coerce malformed responses or fall back to mocks after a local API failure. Preserve existing mock behavior where the contract requires it.
- `mock` is the default data mode. `local` mode uses only this project's API through Vite's same-origin `/api` proxy; its configuration and DTOs must not call, proxy, or mimic connectivity to production SUM. Do not modify `backend/` or its contracts unless separately assigned.
- Keep loading, empty and error states grounded in evidence or label them as local behavior. Preserve accessible semantics, keyboard operation and existing navigation patterns.
- The root `sum-fullstack-verify` workflow owns client-to-backend integration verification. A client worker may run local checks and inspect the local app; it must not navigate a shared browser unless explicitly assigned browser ownership. Never inspect production SUM without the root authorization gate.

## Commands

Run from repository root (or use the equivalent `pnpm run <script>` inside `client/`):

| Command | Scope |
| --- | --- |
| `pnpm --dir client dev` | Start Vite in the configured default mode. |
| `pnpm --dir client dev:local` | Start Vite in local API mode with `/api` base URL; requires the separately running local API. |
| `pnpm --dir client build` | Type-check and create the Vite production build. |
| `pnpm --dir client lint` | Run ESLint over the client. |
| `pnpm --dir client test:data` | Run TypeScript and Node tests under `src/data/`; use when requested or authorized. |
| `pnpm --dir client verify` | Run the scripted local UI verification; it launches Playwright and writes local evidence. Run only when requested or authorized, and respect shared-browser ownership. |
| `pnpm --dir client preview` | Serve an existing build. |

For assigned code changes, run build and lint. Do not run app tests or `verify` unless the task authorizes verification; documentation and skill changes need only their relevant deterministic validators.
