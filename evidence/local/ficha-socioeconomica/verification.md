# ficha-socioeconomica Verification

Viewport: 1536 × 735 CSS pixels. Candidate: `candidate.png`. Source observations: `../../sum/ficha-socioeconomica/`.

Main origin: (280, 70); dimensions: 1240 × 9151 px.

The shared sidebar width (280 px), header height (64 px), route title, and direct route rendering were checked.

No sanitized reference screenshot is available. Structural coverage does not establish visual equivalence.

## Playwright local — 2026-10-08

- **Resultado:** cumple localmente para ruta, 13 secciones, controles read-only y encabezados de tabla familiar. Captura: `candidate.png` (1536 × 735).
- **Comprobaciones:** la réplica usa datos sintéticos; se verificaron 13 formularios, cero controles habilitados y diez encabezados. La tabla local presenta una fila vacía para representar el estado visible sin retener contenido.
- **Visual:** bloqueado; no hay captura SUM sanitaria comparable.
- **Privacidad:** captura generada con fixture de demostración; no contiene información socioeconómica real.
