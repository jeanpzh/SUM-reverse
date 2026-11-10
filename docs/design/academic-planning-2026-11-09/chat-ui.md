# Internal normative chat

User revision, 2026-11-09: replace the current assistance UI using [shadcn AI Elements Chat](https://ui.shadcn.com/docs/ai-elements/base/chat), preserving copilot display modes. This supersedes the pending CopilotKit onboarding; no CopilotKit dependency/account is needed by this implementation.

The existing assistant was a single-question Card/Sheet form. The new composition keeps the existing request adapter, runtime-validated response and `NormativeAdvice` citation rendering, with local in-memory turns. The backend receives each question independently with explicit FISI/period/date/regime context; the displayed history is not sent as model memory. Changing date/regime clears the conversation; changing the academic period remounts it. Closing or changing presentation retains the conversation. Leaving the route discards it. No mount query or scheduling write is introduced.

## Components and source

Four additive, locally owned components were adapted from the official MIT shadcn base-nova registry, fetched on 2026-11-09: [Message Scroller](https://ui.shadcn.com/r/styles/base-nova/message-scroller.json), [Message](https://ui.shadcn.com/r/styles/base-nova/message.json), [Bubble](https://ui.shadcn.com/r/styles/base-nova/bubble.json), [Input Group](https://ui.shadcn.com/r/styles/base-nova/input-group.json). Shared student controls were reused without modification. Adaptations replace registry imports with the existing Button/Input/Textarea, `cn`, and Lucide icons. Message Scroller uses `@shadcn/react`; Bubble's polymorphic content uses `@base-ui/react`. These two dependencies support the requested upstream components rather than a second domain UI implementation.

`PlanningContextPanel` controls three modes: fixed right sidebar, draggable floating window, and full-width viewport panel. The header controls remain available when collapsed. Dragging supports pointer capture and arrow keys; Escape collapses and restores focus. Sidebar is full width on narrow screens. Planning's palette, font and portal scope remain in effect. The old Card/Sheet composition was removed from this panel, and its obsolete CSS rules were removed.

## Acceptance

Build and lint passed; 297 data tests passed. Build reports a planning chunk above 500 kB (approximately 512 kB minified / 149 kB gzip); no runtime speed improvement is claimed.

The focused Playwright script `client/scripts/verify-planning-chat.mjs` requires `SUM_CHAT_SYNTHETIC=1` and uses only the root-owned synthetic stack at 5436 (API3436, engine3437). It checks no request on mount, real API results/history, collapse/full width, pointer/keyboard dragging, mobile width, context invalidation, transport error/retry and cancellation. Evidence and actual results: `evidence/local/planning-chat-2026-11-09/acceptance.json`. One intermediate run failed because the engine process had stopped (502); the root restarted the same explicitly synthetic engine before repeating the scenario.

The earlier broad redesign harness includes Card/Sheet assistant selectors from before this revision; its previous results do not validate this replacement. Screenshots in the new chat evidence directory cover full width, floating mode and mobile. Root inspected the floating and mobile captures for wrapping and control visibility.
