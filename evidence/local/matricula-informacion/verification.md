# matricula-informacion Verification

Viewport: 1536 × 735 CSS pixels. Candidate: `candidate.png`. Source observations: `../../sum/matricula-informacion/`.

Main origin: (280, 70); dimensions: 1240 × 665 px.

The shared sidebar width (280 px), header height (64 px), route title, and direct route rendering were checked.

No sanitized reference screenshot is available. Structural coverage does not establish visual equivalence.

## Re-verification 2026-10-08

- REA controlled replay `ev_8408d7501e82732e71a7d462facbaffb14321b211d5bc1eb19d28809b580130b` opened this route through the expanded local Matrícula menu. It observed the article heading and five sections at 1536 × 735 CSS px, with no page errors.
- The Playwright suite passed this screen's direct-route structure and position checks. The added menu-flow assertion later stopped immediately after the URL changed, before the article mounted; see `../matricula-menu/verification.md`.
- No sanitized SUM page reference exists for visual comparison. Paragraph copy remains a local paraphrase.
