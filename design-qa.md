# Internal planning redesign — 2026-11-09

final result: passed

This is acceptance of the requested adaptation of the supplied images to the existing product and the user's neutral palette. It is not a claim of pixel equality or implementation of every feature illustrated in the references.

## Sources and capture conditions

- Visual direction: user-supplied five PNGs in `docs/design/academic-planning-2026-11-09/`; primary comparison source `planning-and-conflicts.png`. These are design references, not observed SUM behavior.
- Binding scope/palette: `docs/design-direction.md`, revised by the user's explicit 2026-11-09 instructions to build on shadcn and use the gray palette.
- Implementation: `evidence/local/planning-redesign-2026-11-09/timetable-dark-1672.png`, `overview-dark-1672.png`, `overview-light-1672.png`, `courses-dark-1672.png`, `normative-docked-abstention-dark-1672.png` and responsive captures in the same directory.
- Desktop source and implementation: 1672×941 pixels, CSS viewport 1672×941, deviceScaleFactor 1. No density resampling for comparison.
- Route: `/local/programacion-academica`, stages selected with existing `etapa`/`vista` search parameters. Desktop main captures use scroll origin; timetable has its own scroll container.
- State differs intentionally: reference shows illustrative groups, people, conflicts and an answered assistant; the local calendar shows an actual synthetic split-course proposal, and the assistant is empty before a user query. Reference violet/glows are replaced with the user's gray palette. No reference statistics or conversations were fabricated to match pixels.
- Full-view combined input: `evidence/local/planning-redesign-2026-11-09/comparison-timetable.png` (3344×977 includes two native-size panels and a label strip).
- Focused combined input: `comparison-calendar-detail.png` (two 640×650 native-density crops plus label strip). Navigation comparison: `comparison-navigation.png`.
- Additional acceptance: 800px, 390px, 720×450 zoom-equivalent, and 1440×900 at 200% root text size. Mobile references were not supplied; those layouts are local responsive design choices.

## Findings and iterations

1. Initial new summary labels inherited student `dt` width/color and broke inside nested metric boxes. Restored scoped widths/colors and replaced the inner boxes with one status band. The grid now adapts to text size.
2. Initial semantic error colors and light muted text failed contrast. Corrected them using the supplied gray shades and restrained semantic colors. The checker now merges actual theme overrides instead of treating the default dark block as the light theme. All 24 checked pairs pass; normal text pairs meet 4.5:1, with separate component-boundary thresholds.
3. Independent Standards review found a P2: one-hour blocks could clip their time after component chips were added. Course/time now precede details, short blocks have compact rendering and full details remain in the inspector. The real synthetic split-course scenario verifies that the time rectangles fit within their duration-based blocks.
4. The first implementation used only an on-demand normative Sheet. Comparing it to the supplied references showed a substantive composition mismatch. Desktop now has a fixed right assistant column using shadcn Card and the existing normative form. Narrow layouts use the shadcn Sheet; larger text wraps the desktop composition rather than compressing controls.
5. Initial fixed-pixel sidebar and summary tracks were inadequate at 200% text size. The sidebar now scales in rem, labels wrap and its navigation can scroll. Metric and workspace layouts reflow. Final captures and geometry checks show no document overflow or clipped sidebar labels.
6. Early browser attempts sampled unloaded catalogs and one loaded-state wait timed out without enough diagnostics to establish its cause. The test now waits for catalog-dependent content and records API statuses. A separate cancellation race was reproduced with two failing synthetic unit tests, then corrected: obsolete catalog requests cannot end a current load or reset later edits. Final data tests and the complete fresh-stack browser run pass. The earlier timeout is not claimed to have been explained by that race.

## Required visual surfaces

- **Typography:** existing local/system sans, clear heading/body/table hierarchy, tabular numerical data. Essential timetable text is at least 12px. Full reference typeface equality is not claimed.
- **Layout:** desktop navigation/content/assistant composition follows the references; existing preparation, calendar, review and publication destinations remain. Duplicate save controls and repeated status wording were reduced. Mobile menu, agenda, visible focus and enlarged-text layouts were inspected.
- **Colors:** user gray palette governs surfaces, text, borders and primary actions. Green/amber/red carry actual named status, with restrained labeled calendar type tints. Light and dark were captured.
- **Assets:** real Lucide icons through the existing shadcn kit. The reference university crest was not approximated; the interface uses an institutional text wordmark. There are no generated decorative images, gradients or static fake chat.
- **Content:** actual synthetic API counts/results, no invented compliance percentages or scenario comparisons. Search limits remain inconclusive. Approval/publication, explicit save and recommendation preview gating remain distinct.

## Verification

- `pnpm --dir client build`: passed.
- `pnpm --dir client lint`: passed.
- `pnpm --dir client test:data`: 297 passed, including the two new cancellation regressions.
- `node client/scripts/test-normative-components.mjs`: 6 passed; uses synthetic SSR fixtures, no backend/browser/external access.
- `pnpm --dir client check:planning-contrast`: 24 pairs passed.
- `pnpm --dir client verify:planning-redesign`: 11/11 passed after the final correction. Starts its own NestJS, Python engine and Vite with a minimal environment, fresh temporary synthetic drafts, disabled LLM provider and extractive local normative generation, then closes them.
- Real browser scenarios cover generate, table/week shared filters, short split blocks, adjustment/CAS version, save, stage navigation, docked normative abstention, Sheet keyboard close/focus restoration, deliberately injected normative transport error, mobile navigation/agenda, partial-proposal advisor and invalidated preview gating.
- Final browser exceptions: 0. External page requests: 0. Responses and results: `evidence/local/planning-redesign-2026-11-09/acceptance.json`.
- Independent review: Standards identified the corrected short-block P2; Spec established no additional deviation. Root performed the final composition/visual review and diagnosed the isolated cancellation correction.

## Limits and follow-up polish

No actionable P0/P1/P2 remains in the inspected final adaptation. This is not a clone of all five mockups: hypothetical comparisons, metrics and unimplemented actions were not added. High-density faculty-wide calendars retain the existing teacher/search/day filters and horizontal lane scrolling; the simpler reference content is not equivalent to every local dataset. Mobile layout and empty assistant state are local design decisions. Live Bedrock, production SUM and private operator data were not used for acceptance.
