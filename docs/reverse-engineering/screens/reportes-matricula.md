# Reporte de Matrícula

- **Ruta:** `/alumnoWebSum/v2/reportes/matricula`.
- **Interfaz observada:** resumen, período, control Descargar y tabla con ciclo, asignatura, créditos, sección y docente asignado.
- **Interacciones:** acceso por ruta; descarga no activada; filas/período no retenidos.
- **Evidencia:** `evidence/sum/reportes-matricula/{structure,interactions,measurements}.md`; contrato candidato `raw-types/reporte-matricula.ts`.
- **Límite:** ningún valor académico retenido; sin captura de referencia. Método HTTP y estados alternativos no están documentados.
- **Confianza:** media para estructura y columnas; baja para contrato y resultado de descarga.


## Alcance funcional local React–NestJS (2026-10-08)

Estado de especificación: **lista para implementación propia**, con [contrato reportes-api-v1](../contracts/local-api/reportes.md) y [plan compartido](../plans/reportes.md). Se conserva la evidencia/limitaciones anteriores. La imagen del menú proporcionada se registra en `evidence/sum/reportes-menu/`; no constituye referencia visual de esta pantalla.

- Decisión `local-only`: consulta POST de `matricula` contra NestJS propio en `backend/`, usando el modo `local` y proxy `/api`. Resumen común obtenido del endpoint formulario del mismo servidor.
- Decisión `local-only`: 3 asignaturas sintéticas en 5 columnas y período del resumen común.
- Decisión `local-only`: CSV local con las cinco columnas y filas visibles; solo headers si vacío.
- Estados propios: carga, éxito, vacío HTTP 200, error y reintento accesible. Repetir/recargar/reiniciar conserva el catálogo sintético, sin modificar SUM ni otros datos.
- Fidelidad pendiente: filas/reglas, transporte, errores y comportamiento de referencia SUM; no atribuir los nuevos contratos a producción.

| Criterio | Resultado esperado | Fuente | Método local | Obligatorio |
| --- | --- | --- | --- | --- |
| reportes-matricula-01 | Ruta existente y acceso desde menú Reportes; estructura y columnas documentadas | Notas históricas + imagen de menú proporcionada | Navegación local y captura sintética, R-UI | Sí |
| reportes-matricula-02 | 3 asignaturas sintéticas en 5 columnas y período del resumen común | Contrato propio `local-only` | HTTP y navegador contra NestJS real, R-HTTP/R-UI | Sí |
| reportes-matricula-03 | Vacío y error diferenciados, reintento recupera resultado y recarga vuelve a consultar | Contrato propio `local-only` | R-EMPTY/R-RETRY/R-REPEAT | Sí |
| reportes-matricula-04 | CSV local con las cinco columnas y filas visibles; solo headers si vacío | Contrato propio `local-only`, control visible cuando corresponde | R-CSV o ausencia de controles nuevos | Sí |

Verificación y registro: [ejecución compartida](../workflows/reportes.md), con resultados en `evidence/local/reportes/`. La aceptación funcional local no certifica paridad visual ni backend privado SUM.
