# programacion-asignaturas Verification

Viewport: 1536 × 735 CSS pixels. Candidate: `candidate.png`. Source observations: `../../sum/programacion-asignaturas/`.

Main origin: (280, 70); dimensions: 1240 × 7364.625 px.

The shared sidebar width (280 px), header height (64 px), route title, and direct route rendering were checked.

No sanitized reference screenshot is available. Structural coverage does not establish visual equivalence.

## Re-verification 2026-10-08

- REA controlled replay `ev_24144edb2ccf4a7956fc60a2d95f6d7bfbd9341ecd7642d4da5104aaaa470560` opened this route through the local Matrícula menu. It observed the page title, Descargar control, and seven labeled table columns at 1536 × 735 CSS px, with no page errors.
- The Playwright suite passed the direct-route row/action checks and local schedule-dialog checks before reaching the newly added menu-flow assertion. The second menu link was independently confirmed by REA; the suite stopped earlier on the Information assertion race.
- The historical notes also describe a leading indicator column, whose rendering and meaning are not captured in retained evidence. It remains unverified and is not synthesized as a value.
- No sanitized SUM table screenshot exists for visual comparison. Course rows, CSV download, and the row-to-dialog behavior use local demo data.
