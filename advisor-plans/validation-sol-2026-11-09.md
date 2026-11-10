# Continuation with Sol — validation record

Scope: complete the accepted plans in `advisor-plans/README.md`, preserving student SUM screens and the module chooser, existing contracts, validation, explicit save, version checks and approval/publication effects. No commits, resets, stashes or new checkout. Existing uncommitted work preserved.

## Changes in this continuation

- Plan 003: confirmed the obsolete `PlanningStageNav` has no consumers and removed only its obsolete tour target. The current sidebar already owns `planning-tour-nav`. This isolated root correction resolves the overly broad grep that blocked the prior executor without deleting the legacy component.
- Plan 005: deduplicated result badges/counts; the live region covers the result line rather than all interactive content. Retry uses the existing confirmation component. Diagnostic wording and advisor effects retained.
- Plan 004: 145 literal font-size declarations converted to seven planning-only tokens. Final census: zero numeric `font-size` declarations in the plan's CSS scope. Arbitrary small Tailwind sizes replaced according to the accepted table. No font-family, root weight, color or layout change in this step; no student stylesheet modified.
- Plan 006: migrated heading, proposal-state, theme-menu, sidebar, chat and scroll selectors. Chat floating-window checks were removed because that mode was explicitly withdrawn; close/reopen/full-width/history coverage remains. The desktop inspector now uses the docked selector, while the mobile test retains the sheet selector. The font check follows the accepted Geist sans choice rather than the historical Serif-only fixture.
- Integration correction: closing the full-width assistant did not reliably restore focus. `AcademicScheduling.tsx` now handles `onCloseAutoFocus` explicitly, returning focus to `planning-toggle-chat` after the Sheet closes. The test waits for that lifecycle to complete.
- `docs/design-direction.md` reconciled with the already accepted sans/blue choice documented in the plan index; no new visual choice introduced. Root weight 450 is unchanged.

## Deterministic checks

| Criterion | Check | Expected | Actual |
| --- | --- | --- | --- |
| Type safety and production bundle | `pnpm --dir client build` | Exit 0 | Passed; log `/tmp/sol-resume-build.log` |
| Lint | `pnpm --dir client lint` | Exit 0 | Passed; `/tmp/sol-resume-lint.log` |
| Session and adapter regression | `pnpm --dir client test:data` | All pass | 302 passed; `/tmp/sol-resume-data.log` |
| Token contrast | `pnpm --dir client check:planning-contrast` | All configured pairs pass | Passed before and after; `/tmp/sol-resume-contrast.log` |
| Type scale | Plan 004 census | No numeric font-size in scoped CSS | Zero, from 145 |
| Test syntax | `node --check` for all `client/scripts/*.mjs` | No syntax failure | Passed; final redesign script checked again after edits |
| Result layout | `node scripts/verify-planning-result.mjs` from client | Full result width, no overflow at 1440/1100/637/390/320, normal/enlarged text | Passed; `/tmp/sol-resume-result.log` |

Build retains a planning chunk above 500 kB (555.38 kB minified). This continuation does not address code splitting.

The isolated result test uses rendered component HTML and production CSS, without hydration or API calls. It does not establish integrated interaction correctness.

## Integrated acceptance

Run only through a root-owned fresh synthetic stack. `client/scripts/verify-planning-redesign-stack.mjs` creates its own draft directory, starts Python/Nest/Vite with an environment allowlist, disables LLMs and shuts down owned children. It never attaches to an operator server. Browser ownership remains sequential.

Final result is recorded in `evidence/local/planning-redesign-2026-11-09/acceptance.json` and `/tmp/sol-resume-browser-final.log`. Consult the actual final result rather than treating historical reports or intermediate successes as a complete pass.

Early runs caught old script expectations (Serif font, floating/sheet inspector, readiness based on an internal generation heading) and the real focus-restoration issue described above. One direct shell-run was terminated before producing its final report. A supervised run is used for the final acceptance; its transient systemd unit is `sum-sol-redesign-final.service`.

The legacy `verify-planning-shell.mjs` and individual academic verification scripts were migrated and syntax/lint checked; they have not all been executed as separate suites in this continuation. The shell suite requires its own full synthetic Compose environment for student sign-in; the scheduling-only stack does not establish that fixture. Do not report those suites passed.

No claim of full WCAG 2.2 conformance, pixel parity, production SUM behavior or a new audit of the large resource/review/publication panels. Evidence here concerns the accepted redesign scope.

## Final combined result

`evidence/local/planning-redesign-2026-11-09/acceptance-combined-sol.json`: **12/12 passed**, combining nine functional checks from the core run with three subsequent isolated viewport/student-isolation/browser-error checks. This is not a claim that the original single long browser session completed: that session timed out after repeated viewport/navigation checks, without a captured JS exception. The isolated viewport run passed every stage at 800, 390, 720 and 360 CSS px, plus 1440 px with enlarged root text. 360 CSS px models 400% zoom of a 1440px viewport; it is not native browser zoom.

Verified integrated scenarios include real generation, course editing, table/week filter preservation, a persisted server adjustment, explicit save, stage navigation preserving the proposal, normative abstention/error, assistant history across full-width/close/reopen, mobile agenda and keyboard navigation, and advisor preview invalidation. Closing the contextual rail returns width to main content. Cancelling retry sends no generation request.

The contrast check covers configured token pairs, not every rendered text/icon state. Keyboard coverage is scenario-specific, not a full screen-reader or WCAG audit. Separate individual academic suites remain unexecuted as noted above.

Chat regression: `client/scripts/verify-planning-chat.mjs` ran against a separate fresh synthetic stack via `/tmp/sol-planning-chat-stack.mjs`: **6/6 passed** (no query on mount; real API response/history; close/reopen/full-width; mobile context reset; transport error/retry; cancellation). Evidence: `evidence/local/planning-chat-2026-11-09/acceptance.json`; log `/tmp/sol-chat.log`. Owned services stopped after completion.
