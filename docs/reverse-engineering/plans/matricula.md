# Plan: módulo Matrícula

- **ID:** `matricula-2026-10-08`
- **Objetivo:** verificar y completar localmente el grupo Matrícula, Información de Matrícula y Programación de Asignaturas con fuentes existentes, sin inspeccionar producción.
- **Alcance:** menú “Matrícula”, las dos rutas de navegación documentadas, artículo informativo y tabla/modal con fixtures sintéticos.
- **Aceptación:** rótulos del menú; navegación a las dos rutas; artículo con cinco secciones y sin controles de matrícula; tabla de programación y modal accesible con datos sintéticos; build y lint. La fidelidad visual no es obligatoria y queda sin verificar por falta de capturas SUM sanitizadas comparables.
- **Restricciones:** respetar “No accedas a producción SUM”, indicado previamente por el solicitante. REA se usó exclusivamente con una réplica local en `http://127.0.0.1:5173`, Chromium aislado y sin capturar cuerpos de red ni datos de SUM.
- **Evidencia:** `docs/frontend/routes.md`; `docs/reverse-engineering/screens/{matricula-informacion,programacion-asignaturas}.md`; `evidence/sum/{matricula-informacion,programacion-asignaturas}/`; captura de sidebar proporcionada por el operador en la conversación; capturas locales sintéticas.
- **Clasificación:** complejidad media (dos rutas y navegación compartida); incertidumbre media (estructura descrita, referencias visuales ausentes y columna indicadora sin detalle); impacto bajo (réplica local de lectura).
- **Enrutamiento:** principal coordinó ejecución/verificación; `sum-explorer` perfil Luna Low auditó evidencia y criterios relacionados, sin cambios ni inspección de browser. No se despachó implementador porque el código de pantallas ya satisfacía el alcance documentado; se añadió cobertura de navegación local.
- **REA:** inspecciones controladas locales `ev_8408d7501e82732e71a7d462facbaffb14321b211d5bc1eb19d28809b580130b` e `ev_24144edb2ccf4a7956fc60a2d95f6d7bfbd9341ecd7642d4da5104aaaa470560`; ambas completaron sus pasos sin errores de página.
- **Reparaciones automáticas:** 1 ciclo. Playwright reveló una consulta antigua que incluía submenús ocultos; se ajustó a `:visible`. La siguiente ejecución se detuvo por una aserción inmediata antes del montaje del contenido. No se realizó otra reparación automática.

| ID | Tarea / dependencias | Archivos | Resultado |
| --- | --- | --- | --- |
| MAT-01 | Reutilizar evidencia/specs y auditar implementación. | Especificaciones, evidencia, código existente | Completado; artículo y tabla ya implementados con fixtures; menú ya tenía las dos rutas locales. |
| MAT-02 | Verificar rutas desde el menú con REA local. Depende de MAT-01. | Ninguno | Completado: ambos enlaces abrieron su ruta y contenido local correspondiente. |
| MAT-03 | Añadir cobertura Playwright de navegación al menú. Depende de MAT-01. | `client/scripts/verify.mjs` | Parcial: test añadido; suite llegó a Información desde el menú, pero falló la aserción de montaje inmediato en la línea 263. La ruta/estructura fue confirmada en REA. |
| MAT-04 | Build, lint y registro persistente. Depende de MAT-01–03. | Documentación y evidencia local | Build, lint y `git diff --check` aprobados. Aceptación global parcial. |

## Pendientes

1. Corregir la espera de montaje en la aserción de navegación Playwright antes de repetir la suite; el límite de reparación automática para esta corrida ya se alcanzó.
2. No se retuvo una referencia sanitizada comparable para las dos pantallas; no declarar fidelidad visual.
3. La nota de estructura de Programación indica una columna indicadora inicial; contenido, semántica y apariencia no están documentados y no se inventaron.
4. Descarga CSV y vínculo entre filas/modal son comportamiento local de demostración; SUM no fue activado.
