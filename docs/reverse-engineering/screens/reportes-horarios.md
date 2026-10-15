# Reporte de Horarios

- **Ruta:** `/alumnoWebSum/v2/reportes/horarios`.
- **Interfaz observada:** título, resumen de estudiante y cuadrícula semanal con encabezados de días y área de horario.
- **Interacciones:** no se registraron controles visibles en el estado capturado.
- **Evidencia:** `evidence/sum/reportes-horarios/{structure,interactions,measurements}.md`; tipo candidato `raw-types/reporte-horario.ts`.
- **Límite:** eventos/datos de horario no retenidos; solo una posición medida y sin imagen de referencia. `numDia` y forma de presentación local son inferencias de la réplica.
- **Confianza:** media en layout; baja en semántica, posicionamiento y estado sin eventos.


## Alcance funcional local React–NestJS (2026-10-08)

Estado de especificación: **lista para implementación propia**, con [contrato reportes-api-v1](../contracts/local-api/reportes.md) y [plan compartido](../plans/reportes.md). Se conserva la evidencia/limitaciones anteriores. La imagen del menú proporcionada se registra en `evidence/sum/reportes-menu/`; no constituye referencia visual de esta pantalla.

- Decisión `local-only`: consulta POST de `horarios` contra NestJS propio en `backend/`, usando el modo `local` y proxy `/api`. Resumen común obtenido del endpoint formulario del mismo servidor.
- Decisión `local-only`: 6 eventos sintéticos repartidos en una semana de 7 días; curso, sección, tipo y horas recibidos por HTTP.
- Decisión `local-only`: Sin nuevas descargas ni controles no observados.
- Estados propios: carga, éxito, vacío HTTP 200, error y reintento accesible. Repetir/recargar/reiniciar conserva el catálogo sintético, sin modificar SUM ni otros datos.
- Fidelidad pendiente: filas/reglas, transporte, errores y comportamiento de referencia SUM; no atribuir los nuevos contratos a producción.

| Criterio | Resultado esperado | Fuente | Método local | Obligatorio |
| --- | --- | --- | --- | --- |
| reportes-horarios-01 | Ruta existente y acceso desde menú Reportes; estructura y columnas documentadas | Notas históricas + imagen de menú proporcionada | Navegación local y captura sintética, R-UI | Sí |
| reportes-horarios-02 | 6 eventos sintéticos repartidos en una semana de 7 días; curso, sección, tipo y horas recibidos por HTTP | Contrato propio `local-only` | HTTP y navegador contra NestJS real, R-HTTP/R-UI | Sí |
| reportes-horarios-03 | Vacío y error diferenciados, reintento recupera resultado y recarga vuelve a consultar | Contrato propio `local-only` | R-EMPTY/R-RETRY/R-REPEAT | Sí |
| reportes-horarios-04 | Sin nuevas descargas ni controles no observados | Contrato propio `local-only`, control visible cuando corresponde | R-CSV o ausencia de controles nuevos | Sí |

Verificación y registro: [ejecución compartida](../workflows/reportes.md), con resultados en `evidence/local/reportes/`. La aceptación funcional local no certifica paridad visual ni backend privado SUM.
