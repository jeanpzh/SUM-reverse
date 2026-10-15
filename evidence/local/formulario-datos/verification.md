# formulario-datos Verification

Viewport: 1536 × 735 CSS pixels. Candidate: `candidate.png`. Source observations: `../../sum/formulario-datos/`.

Main origin: (280, 70); dimensions: 1240 × 5588 px.

The shared sidebar width (280 px), header height (64 px), route title, and direct route rendering were checked.

No sanitized reference screenshot is available. Structural coverage does not establish visual equivalence.

## Playwright local — 2026-10-08

- **Resultado:** cumple localmente para ruta, ocho secciones, mapa sanitizado observado y ancla Salud. Captura: `candidate.png` (1536 × 735).
- **Comprobaciones:** 8 formularios; 64 controles según referencia (17 texto, 1 fecha, 1 correo, 42 select, 3 textarea); el campo étnico es el único control inicialmente habilitado en SUM. El prototipo lo muestra habilitado, pero `readOnly` como decisión local, pues no se probó la edición en SUM. Valores sintéticos.
- **Visual:** bloqueado; no hay captura SUM sanitaria comparable.
- **Privacidad:** captura generada con fixture local de demostración; no contiene datos reales.
