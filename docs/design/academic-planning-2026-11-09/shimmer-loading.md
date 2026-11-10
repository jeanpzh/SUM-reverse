# Fetch loading states

User-selected dependency: `@shimmer-from-structure/react` 2.4.6, installed with this repository's pnpm package manager. API checked against upstream documentation and installed types/source.

PlanningFetchLoading centralizes the package's measured skeleton rendering, neutral palette, screen-reader status and inert, aria-hidden measurement content. Three pure presentation templates describe result tables, cards and answers; they contain no requests, controls, fixtures or domain decisions. The library measures their rendered structure. This is not a claim of exact layout parity with every result payload. Reduced-motion CSS disables the animated wave.

Applied to initial catalog (course table and other preparation views), saved-proposal fetches, potential-demand estimates, intention-demand queries, publication history/preview, normative chat answers, legacy normative form and advisor results. Explicit action labels, cancellation, failure/retry controls and existing API contracts remain in place. Scope: internal academic planning only.

Validation: client build/lint and 297 data tests pass. Focused synthetic Playwright verification (`SUM_CHAT_SYNTHETIC=1 pnpm --dir client exec node scripts/verify-planning-shimmer.mjs`) holds the local catalog request, verifies measured dimensions, status/inert content, reduced motion and eventual disappearance; delays/aborts a normative query and verifies the skeleton is replaced by retryable error UI. No browser exceptions. The stack is the root-owned synthetic Vite5436/API3436/engine3437, never an operator snapshot server. No visual acceptance of every individual panel is claimed.
