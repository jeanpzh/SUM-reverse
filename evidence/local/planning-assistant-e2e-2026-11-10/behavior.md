# E2E del asistente: hallazgos y correcciones

Fecha: 2026-11-10. Clase `observed`, solo entorno local sintético. Ámbito:
chat normativo y consejero de `/local/programacion-academica`. Se mantienen
`docs/design-direction.md`, las pantallas SUM, contratos, régimen por defecto,
abstención, validación y guardado/publicación explícitos.

## Procedencia y condiciones

Cada corrida arranca React/Vite 5746 → NestJS 3746 → Python 3747 con el launcher
propio, directorio temporal de borradores nuevo y fixtures incorporadas
explícitamente sintéticas. LLM desactivado; corpus normativo público revisado.
Errores/demoras se inyectan únicamente en Playwright sobre rutas locales.
Viewports 1440×1000 y 390×844. No hay snapshots privados, cuentas SUM ni llamadas
Bedrock reales. El navegador compartido abrió únicamente el stack propio y se
cerró al terminar la inspección; los procesos de cada corrida se detienen solos.

## Hallazgos reproducidos

| ID / severidad local | Síntoma y causa confirmada | Corrección |
| --- | --- | --- |
| A1 / P2 | Reintentar chat solo rellenaba el campo; no había una segunda petición. Además reemplazaba un borrador nuevo sin enviar. El manejador llamaba a setQuestion. | Reenviar el turno fallido por el mismo flujo HTTP, reemplazando ese turno y conservando el borrador independiente. |
| A2 / P2 | Tras fallar una simulación, Reintentar consejero omitía selectedRecommendationIds y volvía a valores predeterminados. También convertía [] en una selección implícita distinta. | Conservar una copia de la selección de la petición fallida y reenviar exactamente su variante. |
| A3 / P2 | Doble clic en Enviar cancelaba la consulta: el segundo click llegaba al mismo botón ya convertido en Cancelar. La captura muestra Consulta cancelada. | Ignorar el segundo click de esa secuencia en Cancelar; mantener cancelación por click sencillo y teclado. |

Reproducción original: `before/acceptance.json`: 4/7 PASS; el tercer fallo de esa
corrida era un selector de prueba incorrecto (Fecha de consulta normativa en vez
de Fecha de consulta), separado de los hallazgos del producto.
Reproducción minimizada repetida: `repro/acceptance.json`: 0/3 PASS (A1, A2 con
selección y A2 con selección vacía), antes de cambiar código de aplicación.
Tras corregir A1/A2: `fixed-repro/acceptance.json`: 3/3 PASS.
Ampliación de cobertura: `after/acceptance.json`: 10/11 PASS; identificó A3.
Corrección minimizada A3: `double-click-fixed/acceptance.json`: 1/1 PASS.
Corrida final: `final/acceptance.json`: 11/11 PASS y cero pageerrors.
Regresión previa: `regression/acceptance.json`: 6/6 PASS.
Cancelación por teclado: `keyboard-cancel/acceptance.json`: 1/1 PASS.

## Criterios → escenarios → resultados finales

| Escenario sintético | Esperado | Real |
| --- | --- | --- |
| Consulta normal/cambio de régimen | Respuesta correlacionada; fuentes aplicables al filtro; contexto limpia historial | PASS |
| Reintento de turno fallido | Segunda petición, mismo turno, borrador nuevo intacto | PASS |
| Doble clic en Enviar | Una petición pendiente y ninguna cancelación involuntaria | PASS |
| Error HTTP 503 y reintento | Error explícito y recuperación con API real | PASS |
| Cancelar y nueva consulta | Cancelación explícita y nueva respuesta; sin bloqueo | PASS |
| Payload de respuesta de otra pregunta | Rechazo por validador; ninguna respuesta ajena renderizada | PASS |
| Fecha vacía/móvil/cerrar y abrir | Envío desactivado sin fecha; historial retenido; sin overflow | PASS |
| Cambio de recomendaciones | Invalidar impacto y bloquear Aplicar hasta nueva simulación | PASS |
| Aplicar recomendaciones | Solo regenerar tras click explícito; propuesta nueva; ningún guardado/publicación implícito | PASS |
| Reintentar simulación con IDs | Payload idéntico a la petición fallida | PASS |
| Reintentar simulación con [] | Conservar selección vacía explícita | PASS |

## Repetición

Con dependencias instaladas, backend compilado y entorno Python preparado:

```sh
SUM_REDESIGN_API_PORT=3746 SUM_REDESIGN_ENGINE_PORT=3747 SUM_REDESIGN_WEB_PORT=5746 \
  pnpm --dir client verify:planning-assistant
```

Para una reproducción focalizada, añade SUM_ASSISTANT_CASES con los nombres de
caso separados por comas. El runner rechaza una selección sin casos. El launcher
solo acepta scripts de verificación de una allowlist y comprueba puertos libres;
no se conecta a un backend preexistente. CI ejecuta la suite y adjunta artefactos
sintéticos solo si falla. No se modifican dependencias.

## Límites

Esto verifica integración cliente/API/motor y manejo de fallos de transporte con
datos sintéticos; no mide calidad del LLM ni permisos de una clave Bedrock real.
No acredita comportamiento SUM. No se probaron datasets privados ni persistencia
del chat entre recargas (su historial sigue siendo estado local de la sesión).

## Checks finales

Cliente build y lint: PASS. Tests de datos: 302/302 PASS. Componentes normativos y
consejero SSR: 12/12 PASS. Sintaxis de scripts y git diff --check: PASS.
Permanece el aviso existente de chunks cliente mayores de 500 kB. No se ejecutan
pruebas Python/backend adicionales porque esta corrección no modifica esas capas;
los E2E sí ejercitan API y motor reales en el stack sintético.
