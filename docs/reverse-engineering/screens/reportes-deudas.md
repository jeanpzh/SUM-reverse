# Reporte de Deudas

- **Ruta:** `/alumnoWebSum/v2/reportes/deudas`.
- **Interfaz observada:** título, resumen y tabla con fecha de registro, periodo, concepto, monto inicial/final y observación; se observó una fila sin conservar valores.
- **Interacciones:** no había controles visibles en el contenido principal.
- **Evidencia:** `evidence/sum/reportes-deudas/{structure,interactions,measurements}.md`; acción declarada en `raw-types/README.md`.
- **Límite:** no se encontró un archivo `reporte-deudas.ts`; importes/filas omitidos. La réplica local muestra “datos no verificables”, que es una decisión segura, no estado fuente verificado.
- **Confianza:** media en tabla; baja en contrato y estado sin deudas.


## Alcance funcional local React–NestJS (2026-10-08)

Estado de especificación: **lista para implementación propia**, con [contrato reportes-api-v1](../contracts/local-api/reportes.md) y [plan compartido](../plans/reportes.md). Se conserva la evidencia/limitaciones anteriores. La imagen del menú proporcionada se registra en `evidence/sum/reportes-menu/`; no constituye referencia visual de esta pantalla.

- Decisión `local-only`: consulta POST de `deudas` contra NestJS propio en `backend/`, usando el modo `local` y proxy `/api`. Resumen común obtenido del endpoint formulario del mismo servidor.
- Decisión `local-only`: 1 deuda local tipada en 6 columnas, fecha 10/08/2026 e importes S/ 100.00; sin pagos ni cálculo de saldos.
- Decisión `local-only`: Sin nuevas descargas ni controles no observados.
- Estados propios: carga, éxito, vacío HTTP 200, error y reintento accesible. Repetir/recargar/reiniciar conserva el catálogo sintético, sin modificar SUM ni otros datos.
- Fidelidad pendiente: filas/reglas, transporte, errores y comportamiento de referencia SUM; no atribuir los nuevos contratos a producción.

| Criterio | Resultado esperado | Fuente | Método local | Obligatorio |
| --- | --- | --- | --- | --- |
| reportes-deudas-01 | Ruta existente y acceso desde menú Reportes; estructura y columnas documentadas | Notas históricas + imagen de menú proporcionada | Navegación local y captura sintética, R-UI | Sí |
| reportes-deudas-02 | 1 deuda local tipada en 6 columnas, fecha 10/08/2026 e importes S/ 100.00; sin pagos ni cálculo de saldos | Contrato propio `local-only` | HTTP y navegador contra NestJS real, R-HTTP/R-UI | Sí |
| reportes-deudas-03 | Vacío y error diferenciados, reintento recupera resultado y recarga vuelve a consultar | Contrato propio `local-only` | R-EMPTY/R-RETRY/R-REPEAT | Sí |
| reportes-deudas-04 | Sin nuevas descargas ni controles no observados | Contrato propio `local-only`, control visible cuando corresponde | R-CSV o ausencia de controles nuevos | Sí |

Verificación y registro: [ejecución compartida](../workflows/reportes.md), con resultados en `evidence/local/reportes/`. La aceptación funcional local no certifica paridad visual ni backend privado SUM.
