# Reporte de Prematrícula

- **Ruta:** `/alumnoWebSum/v2/reportes/prematricula`.
- **Interfaz observada:** resumen, título, descarga y tabla de ocho columnas sobre plan, ciclo, asignatura, créditos, repitencias/equivalencias y etapa.
- **Interacciones:** se llegó por navegación; descarga no activada. Valores de filas omitidos.
- **Evidencia:** `evidence/sum/reportes-prematricula/{structure,interactions,measurements}.md`; contrato candidato `raw-types/reporte-pre-matricula.ts`.
- **Límite:** una sola vista con datos de cuenta; no hay captura SUM persistida ni estado vacío/error. Método de API no declarado en README.
- **Confianza:** media para encabezados/estructura; baja para comportamiento y contrato de transporte.


## Alcance funcional local React–NestJS (2026-10-08)

Estado de especificación: **lista para implementación propia**, con [contrato reportes-api-v1](../contracts/local-api/reportes.md) y [plan compartido](../plans/reportes.md). Se conserva la evidencia/limitaciones anteriores. La imagen del menú proporcionada se registra en `evidence/sum/reportes-menu/`; no constituye referencia visual de esta pantalla.

- Decisión `local-only`: consulta POST de `prematricula` contra NestJS propio en `backend/`, usando el modo `local` y proxy `/api`. Resumen común obtenido del endpoint formulario del mismo servidor.
- Decisión `local-only`: 3 registros sintéticos en 8 columnas; créditos/repitencias/etapa recibidos por HTTP.
- Decisión `local-only`: CSV local con las ocho columnas y filas visibles; solo headers si vacío.
- Estados propios: carga, éxito, vacío HTTP 200, error y reintento accesible. Repetir/recargar/reiniciar conserva el catálogo sintético, sin modificar SUM ni otros datos.
- Fidelidad pendiente: filas/reglas, transporte, errores y comportamiento de referencia SUM; no atribuir los nuevos contratos a producción.

| Criterio | Resultado esperado | Fuente | Método local | Obligatorio |
| --- | --- | --- | --- | --- |
| reportes-prematricula-01 | Ruta existente y acceso desde menú Reportes; estructura y columnas documentadas | Notas históricas + imagen de menú proporcionada | Navegación local y captura sintética, R-UI | Sí |
| reportes-prematricula-02 | 3 registros sintéticos en 8 columnas; créditos/repitencias/etapa recibidos por HTTP | Contrato propio `local-only` | HTTP y navegador contra NestJS real, R-HTTP/R-UI | Sí |
| reportes-prematricula-03 | Vacío y error diferenciados, reintento recupera resultado y recarga vuelve a consultar | Contrato propio `local-only` | R-EMPTY/R-RETRY/R-REPEAT | Sí |
| reportes-prematricula-04 | CSV local con las ocho columnas y filas visibles; solo headers si vacío | Contrato propio `local-only`, control visible cuando corresponde | R-CSV o ausencia de controles nuevos | Sí |

Verificación y registro: [ejecución compartida](../workflows/reportes.md), con resultados en `evidence/local/reportes/`. La aceptación funcional local no certifica paridad visual ni backend privado SUM.
