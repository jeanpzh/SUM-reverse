# Mis Asistencias

- **Ruta:** `/alumnoWebSum/v2/asistencia`.
- **Interfaz observada:** título, descarga y tabla de asignatura/sección/clases con grupos de presentes, tardanzas, faltas y total, en número y porcentaje; se documentaron tres enlaces de calendario.
- **Interacciones:** descarga y enlaces de calendario quedaron inactivos.
- **Evidencia:** `evidence/sum/asistencia/{structure,interactions,measurements}.md`; tipo candidato `raw-types/mis-asistencias.ts`.
- **Límite:** captura fuente estaba desplazada; no se guardaron filas ni se conoció qué abre cada enlace. No hay comparación visual persistida.
- **Confianza:** media-alta en encabezados; baja en acciones y scroll inicial.


## Alcance funcional propio

Contrato [asistencia-api-v1](../contracts/local-api/asistencia.md) listo: backend readonly sintético, cliente modo local conectado, porcentajes/conteos validados, loading/vacío/error/reintento y CSV local. Criterios A-* en contrato; calendario/detalle y paridad visual SUM no verificados. Registro [workflow](../workflows/asistencia.md).

Estado implementación: backend/cliente integrados localmente y criterios A-* aprobados. [Informe](../../../evidence/local/asistencia-integracion/fullstack-verification.md). REA/CDP utilizado sobre réplica sintética; cobertura de eventos parcial. No se elevan supuestos a conducta SUM.
