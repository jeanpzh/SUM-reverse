# Formulario de Datos Personales

- **Ruta / estado:** `/alumnoWebSum/v2/informacion/formularioDatos`, estado inicial de solo lectura.
- **Especificación:** lista para secciones, sanitizadas etiquetas/tipos observados y estado inicial; bloqueada para fidelidad visual completa y edición/descarga.
- **Observado históricamente en SUM:** título, navegador lateral con Datos Personales, Colegio de Procedencia, Dependencia Económica, Recursos de Estudio, Transporte, Salud, Interés Académico y Contacto, además de Descargar Formulario. Se registraron 8 formularios, 61 textboxes, 80 comboboxes y 4 botones; campos y valores se omitieron. Controles inicialmente deshabilitados y acciones «Modificar». Medidas: viewport 1536 × 735, sidebar 280 × 735, header 1256 × 64, columna 850 px y navegador 330 × 392.
- **Criterios respaldados:** ocho secciones en el orden observado y 64 controles visibles: 17 inputs text, 1 date, 1 email, 42 selects y 3 textareas. Todos estaban deshabilitados salvo «Especifique el grupo étnico:». El menú Salud navega a su ancla. La réplica presenta etiquetas y control apropiado con valores sintéticos; no permite enviar cambios. Descargar Formulario es un prototipo local no contrastado con SUM.
- **Interacciones observadas:** se siguió la ancla Salud; no se editó el único campo habilitado ni se accionaron Modificar/descarga.
- **Evidencia:** `evidence/sum/mi-informacion/observations-2026-10-08.md`; `evidence/local/formulario-datos/verification.md` y `candidate.png` (réplica local).
- **Pendiente/bloqueado:** selección/validación de opciones, comportamiento de modificación/descarga y comparación visual completa. La evidencia no incluye valores ni opciones de listas. `raw-types/matricula-formulario-datos.ts` no confirma contrato.
- **Confianza:** alta para secciones, rótulos y tipos del estado observado; no verificado para estados condicionales.


## Backend propio Mi Información

Contrato listo para lectura sintética: [mi-informacion-api-v1](../contracts/local-api/mi-informacion.md). Tipos, valores, escenarios vacíos/errores y persistencia son decisiones `local-only`; no elevan evidencia a contratos SUM. Esta tarea implementa backend, sin modificar UI ni acreditar integración React. Criterios MI-* y resultado en [workflow](../workflows/mi-informacion-backend.md).
