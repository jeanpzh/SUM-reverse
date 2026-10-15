# Workflow: Matrícula

- **Fecha:** 2026-10-08
- **Modo:** ejecutar
- **Objetivo:** completar/verificar la réplica local de Matrícula: menú, Información de Matrícula y Programación de Asignaturas.
- **Decisión visual:** no se pidió fidelidad visual como gate obligatorio. Se inspeccionaron capturas locales; no existe captura SUM comparable para el artículo o la tabla.
- **Gate de fuente:** se reutilizaron notas existentes y la imagen de sidebar proporcionada por el operador. Se mantuvo la restricción previa de no acceder a producción. REA y Chromium se conectaron únicamente a la réplica local.
- **Clasificación:** media / incertidumbre media / impacto bajo. Dos pantallas y navegación, evidencia estructural suficiente, estados de acción no confirmados.
- **Delegación:** `sum-explorer` auditó especificaciones/evidencia/cobertura existente (solo lectura). No se delegó implementación: los componentes de las dos pantallas ya estaban implementados; el cambio necesario fue ampliar la comprobación Playwright del menú.

## Etapas

| Etapa | Estado | Evidencia/decisión |
| --- | --- | --- |
| Reutilizar evidencia | completada | Especificaciones y notas en `evidence/sum/{matricula-informacion,programacion-asignaturas}/`; rutas locales documentadas. Auditoría del subagente confirmó cinco secciones, tabla/descarga/acciones y límites. |
| REA local | completada | `ev_8408d7501e82732e71a7d462facbaffb14321b211d5bc1eb19d28809b580130b`: menú → “Matrícula Vía Internet” → artículo de cinco secciones. `ev_24144edb2ccf4a7956fc60a2d95f6d7bfbd9341ecd7642d4da5104aaaa470560`: menú → “Programación de Asignaturas” → título, Descargar y siete etiquetas de columna. Viewport 1536×735; Chromium local aislado; sin errores de página. |
| Especificación | completada incrementalmente | Añadida trazabilidad del rótulo del primer enlace y la brecha de columna indicadora; el destino del primer enlace queda como decisión local. |
| Implementación | ya satisfecha | Se conservaron las pantallas y el menú existentes; `client/scripts/verify.mjs` ahora comprueba los dos textos, expansión y rutas desde el menú. No se inspeccionó ni llamó SUM producción. |
| Playwright local | parcial | La suite recorrió 16 rutas y validó la tabla/modal, luego llegó a Información desde el menú. Falló al contar sus cinco secciones inmediatamente tras el cambio de URL (línea 263); REA independiente observó y confirmó las cinco secciones. Se consumió un ciclo de reparación al corregir aserciones que contaban submenús ocultos; no se reintentó la aserción de montaje. |
| Build/lint | aprobadas | `pnpm --dir client build`, `pnpm --dir client lint`, `git diff --check`: código de salida 0. |

## Disposición

Estado `parcial`. REA confirma ambos enlaces y contenidos en la réplica. No declarar la verificación Playwright completa ni comparación visual aprobada hasta resolver la espera de montaje y obtener referencias sanitizadas comparables. Descarga/filas/modal usan fixtures y comportamiento local de demostración; no se afirman como comportamiento SUM observado.
