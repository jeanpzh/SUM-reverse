# Internal academic planning redesign

Source: explicit user design decision, 2026-11-09. Local product only; the five neighboring PNG files are inspiration, not evidence of SUM behavior. Palette and shadcn override generic skill preferences. `improve-ui` is an audit-only skill and does not implement this request; Taste's landing-page heroes, effects and random palette selection do not apply to this operational app.

## Fixed interfaces and ownership

Contract revision: current working-tree `shared/programacion-academica-api.mjs` and `client/src/data/planningSession.ts`, unchanged by this redesign. Preserve their effects and reuse existing interfaces. Student SUM screens and the module chooser must remain unchanged. Root owns integration, documentation, package manifest/lockfile and verification. No private data, production inspection or existing unknown local servers.

1. Gemini 3.8 Flash high (user explicitly authorized replacing unavailable Flash 5.8): shell, palette, responsive sidebar, scope header, stage navigation and preparation overview. Exclusive: `client/src/components/PlanningShell.tsx`, `PlanningShell.css`, `client/src/screens/PlanningScopeHeader.tsx`, `PlanningStageNav.tsx`, `PlanningPreparationSummary.tsx`, `PlanningPreparationSummary.css`, and new `PlanningOverview.css` if needed. Dependencies: existing shadcn primitives plus root-installed `lucide-react`. Do not edit AcademicScheduling or other workers' files.
2. Codex: schedule presentation and contextual assistance. Exclusive: `client/src/screens/PlanningWeekView.tsx`, `PlanningWeekView.css`, `PlanningStatusBar.tsx`, `PlanningStatusBar.css`, `AcademicScheduling.tsx`, and new `PlanningContextPanel.tsx`/`.css` if needed. Keep calendar algorithms and advisor contracts unchanged; use shadcn for new surfaces. Mount actual normative assistance through the existing component rather than static invented chat. No backend/data/shared changes. Dependencies: the fixed existing contract, shadcn kit and planning tokens.
3. Root integrates the shared checkout sequentially, checks the diff and resolves only isolated diagnosed integration issues. A fresh review follows implementation, plus deterministic checks and actual React → NestJS synthetic scenarios. No commit or push requested.

## Acceptance

| Criterion | Check / synthetic scenario | Expected | Actual |
| --- | --- | --- | --- |
| Current palette and shadcn | Inspect rendered dark/light shell and DOM primitives | Neutral palette, consistent kit, no decorative AI chrome | Passed: rendered dark/light captures; scoped shadcn kit; 24 token contrast pairs pass |
| Useful navigation | Open summary, courses, resources, timetable, review and approval | Correct existing URL state, persistent working proposal | Passed: actual router links, mobile Sheet and saved proposal survive stage navigation |
| Workflow preserved | Select courses, generate timetable, switch table/week, select/edit block, save | Real local API requests; honest errors and unchanged CAS/save effects | Passed: actual generation, split one-hour blocks, shared filters, editVersion increment and explicit save |
| Assistance | Open contextual normative query and advisor | Existing validated service, loading/error/abstention and explicit confirmation | Passed: docked query plus Sheet, real abstention, injected transport error, partial-proposal advisor and preview invalidation |
| Responsive and keyboard | Desktop, 800px, 390px, 720px zoom-equivalent; Sheet and keyboard paths | No document overflow; all destinations reachable; visible focus | Passed: 800/390/720px stage captures, keyboard Sheet/agenda/skip path and 200% text sizing |
| Student isolation | Existing synthetic student login/routes and module chooser | No planning root or visual tokens on student screens | Passed: no planning root on student entry routes or chooser; no student source edits in redesign |
| Static/data checks | client build, lint, test:data | Pass | Passed: client build/lint, 297 data tests; 6 normative render tests; synthetic stack 11/11 |

Workers run build/lint after their own edits and report actual results. Root owns browser session and full acceptance. Browser targets must be fresh dedicated synthetic processes with private snapshot environment variables absent; never inspect an operator server.

## Root integration corrections

- Corrected error, muted-text and semantic-success token contrast; fixed the contrast checker to merge actual light/dark overrides instead of checking the dark defaults twice.
- Removed nested metric-cell boxes, restored scoped `dt` width/color, and made the metric grid reflow with text size. Sidebar labels wrap and its content can scroll at 200% zoom.
- Removed the repeated schedule-save control; the existing scope-header save becomes primary only when the session selects save as the next action. Removed implementation wording from the generation panel.
- Corrected a P2 from the independent Standards audit: short duration-based blocks prioritize course/time, with compact type tags and the remaining data in the existing inspector. A real synthetic split course exercises the one-hour geometry.
- User asked whether the result follows the supplied images. Root comparison found the on-demand desktop assistant too far from their composition; integrated a fixed desktop right column using the existing `NormativeQuestionForm` with an optional compact presentation. This extends the existing component rather than creating another query contract. Mobile/tablet retain the shadcn Sheet. Root integration also owns `client/src/components/ai-elements/NormativeAdvice.tsx` and the semantic-success mapping in `client/src/styles/theme.css`.
- Added a first-focus skip link, preserved all mobile destinations through the Sheet, and removed duplicate mobile header theme controls (the same settings are available in the menu).
- Added `verify:planning-redesign`: starts and stops its own three processes with an environment allowlist, fresh temporary drafts and disabled LLMs. Tests never attach to an unknown server.

Independent code-review axes: Standards found the short-block P2 above; Spec found no additional issue. Root handles the diagnosed correction and subsequent real-browser acceptance; no additional review delegate was needed for that small correction.

The desktop sidebar uses 14rem (224px at the default size), so enlarged text does not force its labels into clipped fixed-pixel tracks. The desktop content/assistant composition wraps under enlarged text rather than compressing task controls.

### Diagnosed catalog cancellation correction

The final readiness checks exposed intermittent cold-navigation waits. A fresh read-only Codex diagnosis confirmed that no code clears an already loaded catalog; the persistent timeout's cause was not established from the initial capture. It did identify a separate real cancellation race. Two new synthetic regressions failed before the fix: an aborted obsolete request cleared the active loading flag, and an obsolete success reset course selection/demand entered after a newer response. Root corrected only these proven cases in `client/src/data/planningSession.ts` and added the regressions to its existing test file. Aborted responses now cannot mutate the store; the header says `Cargando catálogo local…` while loading. Public interfaces, contracts, requests and academic rules are unchanged. This is a diagnosed isolated correction under the root integration exception, not a new parallel data adapter.

The browser acceptance script now awaits the actual catalog-dependent generation node before taking loaded-state captures, and records API response statuses for future diagnosis. It does not treat a route render or a snapshot of an unloaded state as functional acceptance.

Final acceptance: `pnpm --dir client verify:planning-redesign` passed 11/11 on its own fresh stack after the cancellation correction. Evidence and HTTP statuses: `evidence/local/planning-redesign-2026-11-09/acceptance.json`. The wrapper shut down all its service processes. A previous cold-load wait timeout was not attributed to the cancellation bug; the final loaded-state pass and API diagnostics are the evidence for this delivery.
