# Student Frontend Implementation

The React client implements the 16 observed route destinations using TanStack Router's file-based routing. The Vite plugin generates the typed route tree and splits route components. `Link` handles clickable navigation, active state, direct URLs, browser history, and scroll restoration. `/` redirects to the student home.

## Shared Architecture

- `client/src/components/Shell.tsx`: sidebar, expandable navigation groups, header, and route outlet.
- `client/src/components/Common.tsx`: page title, student summary, data table, download control, and navigation icons.
- `client/src/screens/`: home cards, profile, academic/report tables, enrollment information, manuals, and long read-only forms.
- `client/src/data/`: route inventory, fictional student/course values, and local CSV downloads.
- `client/scripts/verify.mjs`: Chromium checks for all routes, safe local interactions, screenshots, and absence of external HTTP requests.

The local frontend makes no SUM requests and uses no account-derived values. Poppins is served locally under its bundled OFL license. Institutional branding and icon assets were not retained during discovery and are approximated.

## Installed Router Skills

Official skills from `TanStack/router` were installed in `.codex/skills/router-core/` and `.codex/skills/react-router/`. The core package includes navigation, type-safety, routing, and related sub-skills. Their routing and navigation guidance was used for this implementation.

## Evidence Limits

Fourteen screens lack a reference image. They have candidate screenshots and measurement comparisons, but cannot be certified as visually equivalent. Form section names are observed; detailed field labels/counts are not fully reproduced. The enrollment article uses a paraphrase of the observed section subjects. Unknown action states remain disabled; home shortcut destinations, header dropdown behavior, hover styling, and narrow layouts use local conventions and require future source confirmation.
