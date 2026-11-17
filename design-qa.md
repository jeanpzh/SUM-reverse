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


---

# Consejero normativo · Dirección A · revisión de integración

Fecha: 2026-11-17. Superficie autorizada: consejero y conversación normativa de `/local/programacion-academica`. Aplicación local, catálogo y borradores construidos sintéticamente; proveedor LLM deshabilitado. Sin inspección de servidores del operador ni de SUM.

## Referencia y normalización

- Fuente visual: archivo del usuario «Consejero Normativo.html», componente «Dirección A · Hilo con decisión fija». Se desempaquetó fuera del repositorio; no se importó su runtime, sus temporizadores ni sus cifras de demostración a la aplicación.
- Captura fuente: [source-initial.png](docs/design/academic-planning-2026-11-16/advisor-direction-a/source-initial.png), 420 × 900 px, viewport CSS 420 × 900, DPR 1, estado inicial oscuro.
- Captura implementada: [rail-initial.png](docs/design/academic-planning-2026-11-16/advisor-direction-a/rail-initial.png), 419 × 900 px del panel dentro de viewport 1440 × 952, DPR 1, estado inicial oscuro. La diferencia de 1 px corresponde al límite del panel y su separador. No se escalaron las imágenes.
- Comparación conjunta de la superficie completa: [comparison.png](docs/design/academic-planning-2026-11-16/advisor-direction-a/comparison.png). La superficie revisada es el rail completo; no hizo falta otra ampliación de una subregión para la comparación inicial.
- Estados implementados capturados: [análisis](docs/design/academic-planning-2026-11-16/advisor-direction-a/rail-analyzed.png), [expandido](docs/design/academic-planning-2026-11-16/advisor-direction-a/expanded.png), [simulación vigente](docs/design/academic-planning-2026-11-16/advisor-direction-a/rail-simulated.png), [estrecho con selección invalidada](docs/design/academic-planning-2026-11-16/advisor-direction-a/narrow-stale.png).

La fuente ilustra FISI 2026-II, v4 y conteos falsos. La aplicación muestra el periodo y los datos reales de su sesión sintética (en la aceptación, 2027-I y borrador sin guardar). Solo se compara composición y tratamiento visual entre estados equivalentes, sin afirmar igualdad de contenido ni paridad de píxeles.

## Hallazgos e iteraciones

1. P2: el encabezado conservaba pestañas y un segundo bloque de contexto que desplazaban la entrada del hilo respecto a la referencia. Se ocultó la pestaña redundante cuando hay un consejero activo y se movieron los filtros al compositor, plegados. Se conserva la pantalla normativa independiente antes de generar una propuesta. La captura final conjunta refleja la corrección.
2. P2: el autoscroll del chat también desplazaba el análisis nuevo hasta las últimas opciones, ocultando el diagnóstico. Se desactiva el autoscroll en el consejero hasta que hay mensajes; la prueba de presentación comprueba la posición visible del diagnóstico. La captura final de análisis muestra el encabezado y el diagnóstico al comienzo.
3. P2: en 360 px los rótulos largos de Simular y Aplicar deshabilitado consumían demasiado alto. Se acortaron los rótulos visibles manteniendo sus nombres accesibles y la explicación de deshabilitación. Se verificaron foco y ausencia de overflow a 360/720 px.
4. P2: los motivos extensos heredados ocupaban el alto del rail antes de mostrar opciones. Se resumieron en filas de conteo y título, con una sola apertura de evidencia que advierte el posible solapamiento. La captura final de análisis corresponde a esa composición compacta.
5. Adaptaciones funcionales: se conserva un acceso discreto a filtros junto al compositor; las preguntas sugeridas y las cifras reflejan el contrato y la sesión actuales. Se mantienen las fuentes y tokens de planificación existentes, sin modificar los del alumno. El mapa porcentual y las ideas de gestión del prototipo no se dibujan sin datos de contrato. No son capacidades implementadas ni verificadas.

## Criterios revisados

- Encabezado con identidad, expansión y cierre; ancho inicial 420 px redimensionable, hilo y decisión en dos columnas al expandir.
- Tipografía 400/500, superficies oscuras y claras, hairlines, tarjetas de 12 px, botones pill, entrada de 6 px y Lucide existente. No se requieren activos raster ni nuevos iconos.
- Una acción principal del consejero según su estado; Aplicar exige impacto vigente y queda deshabilitado con motivo tras cambiar la selección. El estado usa texto, no solo color.
- Consulta sin envío al montar ni CP-SAT automático, selección exacta, modo degradado honesto, respuesta normativa real, expansión/restauración, cancelación de transporte, error/reintento, regeneración sin guardar/publicar.
- Se inspeccionaron las capturas y la comparación conjunta. Las pruebas de navegador comprueban que no haya excepciones de página; el catálogo, API y solver son servicios propios sintéticos. Los avisos de tamaño de chunks del build y deprecación de LangChain son preexistentes y no acreditan fallos visuales.

## Límites

No se probaron proveedores LLM vivos, porcentajes de ocupación ni ideas no incluidas en el contrato. 720 px comprueba reflujo equivalente a la mitad de 1440 px, sin afirmar un cambio de zoom del navegador. Las pantallas SUM del alumno no se modificaron y no se hizo comparación visual de ellas. No quedan hallazgos visuales accionables P0/P1/P2 dentro de la superficie implementada; queda como P3 la adaptación editorial de textos a una densidad distinta cuando cambie el catálogo.

final result: passed
