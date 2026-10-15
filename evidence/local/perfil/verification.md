# perfil Verification

Viewport: 1536 × 735 CSS pixels. Candidate: `candidate.png`. Source observations: `../../sum/perfil/`.

Main origin: (280, 70); dimensions: 1240 × 931 px.

The shared sidebar width (280 px), header height (64 px), route title, and direct route rendering were checked.

No sanitized reference screenshot is available. Structural coverage does not establish visual equivalence.

## Playwright local — 2026-10-08

- **Resultado:** ruta, once rótulos personales, transición a Académica y nueve rótulos académicos comprobados. Fixture sintético `DEMO-001`; `candidate.png` muestra Personal y `academic-candidate.png` Académica (1536 × 735).
- **Comprobaciones:** se mantienen visibles las tres pestañas; Académica funciona en el prototipo. Contraseña sigue deshabilitada localmente porque está fuera de alcance y su panel no fue inspeccionado.
- **Visual:** pendiente; solo el sidebar tiene referencia sanitaria comparable. Esta vista es réplica local.
- **Privacidad:** el fixture está rotulado como demostración y no contiene datos de una persona real.
