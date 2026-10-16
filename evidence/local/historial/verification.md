# historial Verification

Viewport: 1536 × 735 CSS pixels. Candidate: `candidate.png`. Source observations: `../../sum/historial/`.

Main origin: (280, 70); dimensions: 1240 × 840 px.

The shared sidebar width (280 px), header height (64 px), route title, and direct route rendering were checked.

No sanitized reference screenshot is available. Structural coverage does not establish visual equivalence.

## Playwright local — 2026-10-08

- **Resultado:** cumple para ruta, jerarquía de resumen, búsqueda visible y ocho encabezados de tabla. Captura: `candidate.png` (1536 × 735), con fixture sintético.
- **Comprobaciones:** aparecen «RESUMEN DEL HISTORIAL ACADÉMICO», «Promedio Ponderado», búsqueda y columnas documentadas. No se usó la búsqueda; las filas son fixture local y no validan registros SUM.
- **Visual:** bloqueado; no hay captura SUM sanitaria comparable.
- **Privacidad:** la imagen usa valores de demostración; no se copiaron calificaciones reales.
