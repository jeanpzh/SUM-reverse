# Mi Perfil

- **Ruta / estado:** `/alumnoWebSum/v2/informacion/perfil`, estado inicial con Información Personal.
- **Especificación:** implementable para resumen, pestañas Personal/Académica y campos observados; bloqueada para Contraseña, descarga y fidelidad visual integral.
- **Observado históricamente en SUM:** shell compartido, resumen del estudiante, acción «Descargar Perfil», pestañas Información Personal, Información Académica y Cambio de Contraseña; solo se vio el contenido personal inicial. Medidas: viewport 1536 × 735, sidebar 280 × 735, header 1256 × 64 y panel personal 790 × 701.
- **Criterios respaldados:** Información Personal inicia seleccionada y su panel tiene 11 rótulos; al seleccionar Información Académica se muestra el panel de 9 rótulos verificados. Cambiar panel es interacción local respaldada. La réplica usa datos sintéticos y no persiste valores observados. La acción de descarga local continúa siendo prototipo.
- **Interacciones observadas:** Personal ↔ Académica por clic de solo lectura. Cambio de Contraseña y Descargar no se activaron.
- **Evidencia:** `evidence/sum/mi-informacion/observations-2026-10-08.md` y REA IDs de ese registro; `evidence/local/perfil/verification.md` y `candidate.png` (réplica local).
- **Pendiente/bloqueado:** contenido/conducta de Cambio de Contraseña y descarga; comparación visual de pantalla completa sin una captura de referencia sanitaria comparable. Contrato candidato `raw-types/mi-perfil.ts` no prueba contrato de servidor.
- **Confianza:** alta en etiquetas/paneles abiertos; baja en controles no accionados.


## Backend propio Mi Información

Contrato listo para lectura sintética: [mi-informacion-api-v1](../contracts/local-api/mi-informacion.md). Tipos, valores, escenarios vacíos/errores y persistencia son decisiones `local-only`; no elevan evidencia a contratos SUM. Esta tarea implementa backend, sin modificar UI ni acreditar integración React. Criterios MI-* y resultado en [workflow](../workflows/mi-informacion-backend.md).
