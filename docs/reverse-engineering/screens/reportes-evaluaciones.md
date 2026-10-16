# Reporte de Evaluaciones

- **Ruta:** `/alumnoWebSum/v2/reportes/evaluaciones`.
- **Interfaz observada:** título, resumen y tabla de ciclo, asignatura, tipo de evaluación, calificación y fórmula; una fila estaba presente, sin copiar valores.
- **Interacciones:** no se observaron acciones en el contenido principal.
- **Evidencia:** `evidence/sum/reportes-evaluaciones/{structure,interactions,measurements}.md`; tipo `raw-types/reporte-evaluaciones.ts` declara elementos `unknown[]`.
- **Límite:** datos sensibles excluidos, sin imagen persistida; tipo no describe fila ni reglas de calificación.
- **Confianza:** media para encabezados y layout; baja para contrato y resultados vacíos.


## Alcance funcional local React–NestJS (2026-10-08)

Estado de especificación: **lista para implementación propia**, con [contrato reportes-api-v1](../contracts/local-api/reportes.md) y [plan compartido](../plans/reportes.md). Se conserva la evidencia/limitaciones anteriores. La imagen del menú proporcionada se registra en `evidence/sum/reportes-menu/`; no constituye referencia visual de esta pantalla.

- Decisión `local-only`: consulta POST de `evaluaciones` contra NestJS propio en `backend/`, usando el modo `local` y proxy `/api`. Resumen común obtenido del endpoint formulario del mismo servidor.
- Decisión `local-only`: 1 evaluación local tipada en 5 columnas, nota 16.00 y fórmula literal; sin calcular notas académicas.
- Decisión `local-only`: Sin nuevas descargas ni controles no observados.
- Estados propios: carga, éxito, vacío HTTP 200, error y reintento accesible. Repetir/recargar/reiniciar conserva el catálogo sintético, sin modificar SUM ni otros datos.
- Fidelidad pendiente: filas/reglas, transporte, errores y comportamiento de referencia SUM; no atribuir los nuevos contratos a producción.

| Criterio | Resultado esperado | Fuente | Método local | Obligatorio |
| --- | --- | --- | --- | --- |
| reportes-evaluaciones-01 | Ruta existente y acceso desde menú Reportes; estructura y columnas documentadas | Notas históricas + imagen de menú proporcionada | Navegación local y captura sintética, R-UI | Sí |
| reportes-evaluaciones-02 | 1 evaluación local tipada en 5 columnas, nota 16.00 y fórmula literal; sin calcular notas académicas | Contrato propio `local-only` | HTTP y navegador contra NestJS real, R-HTTP/R-UI | Sí |
| reportes-evaluaciones-03 | Vacío y error diferenciados, reintento recupera resultado y recarga vuelve a consultar | Contrato propio `local-only` | R-EMPTY/R-RETRY/R-REPEAT | Sí |
| reportes-evaluaciones-04 | Sin nuevas descargas ni controles no observados | Contrato propio `local-only`, control visible cuando corresponde | R-CSV o ausencia de controles nuevos | Sí |

Verificación y registro: [ejecución compartida](../workflows/reportes.md), con resultados en `evidence/local/reportes/`. La aceptación funcional local no certifica paridad visual ni backend privado SUM.
