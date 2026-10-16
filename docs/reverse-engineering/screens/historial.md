# Historial Académico

- **Ruta / estado:** `/alumnoWebSum/v2/informacion/historial`, estado inicial.
- **Especificación:** lista para el resumen, buscador observado y encabezados; bloqueada para estados poblados/alternativos y fidelidad visual integral.
- **Observado históricamente en SUM:** título, resumen «RESUMEN DEL HISTORIAL ACADÉMICO», resumen de Promedio Ponderado y tabla con Ciclo, Plan, Tipo, Asignatura, Calificación, Créditos, Sección y Acta. La tabla empieza debajo del viewport inicial; no se retuvieron valores académicos. Medidas históricas: viewport 1536 × 735, shell sidebar 280 × 735 y header 1256 × 64.
- **Criterios respaldados:** renderizar jerarquía de resumen y tabla con los ocho encabezados citados; mantener valores y filas sintéticos; no atribuir a SUM el fixture vacío local.
- **Interacciones observadas:** navegación directa; el DOM mostró el control de búsqueda, que no se utilizó. No se abrieron registros ni se activaron descargas.
- **Evidencia:** `evidence/sum/mi-informacion/observations-2026-10-08.md` (sesión autorizada, sanitizada); `evidence/local/historial/verification.md` y `candidate.png` (réplica, no referencia SUM).
- **Pendiente/bloqueado:** filas y estados vacío/error de SUM, relación de datos, posibles controles y comparación visual sanitaria. No existe tipo API de historial en `raw-types/`.
- **Confianza:** alta para jerarquía, búsqueda y encabezados; baja para datos y estados no observados.


## Backend propio Mi Información

Contrato listo para lectura sintética: [mi-informacion-api-v1](../contracts/local-api/mi-informacion.md). Tipos, valores, escenarios vacíos/errores y persistencia son decisiones `local-only`; no elevan evidencia a contratos SUM. Esta tarea implementa backend, sin modificar UI ni acreditar integración React. Criterios MI-* y resultado en [workflow](../workflows/mi-informacion-backend.md).
