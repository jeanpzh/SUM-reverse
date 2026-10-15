# Ficha Socioeconómica

- **Ruta / estado:** `/alumnoWebSum/v2/informacion/fichaSocioeconomica`, estado inicial de solo lectura.
- **Especificación:** lista para 13 secciones observadas, rótulos sanitizados observables y encabezados de tabla; bloqueada para contenido de filas y fidelidad visual completa.
- **Observado históricamente en SUM:** 12 formularios, 107 textboxes, 76 comboboxes y 15 botones; ficha dividida en secciones sobre datos del estudiante, colegio previo, soporte económico, contacto de emergencia, salud, interés académico, transporte, salud familiar, recursos de estudio, vivienda, situación económica, recreación y aptitudes/habilidades. Tabla familiar con columnas de nombre, edad, parentesco, educación, ocupación, empleo, contribución, enfermedad, discapacidad y acción. No se retuvieron valores. Medidas: viewport 1536 × 735, sidebar 280 × 735, header 1256 × 64, columna 850 px; tabla familiar cerca de y=4985.
- **Criterios respaldados:** orden visible de 13 secciones: Datos Alumno, Colegio de Procedencia, Dependencia Económica, Contacto, Salud, Interés Académico, Transporte, Familia Salud, Recursos de Estudio, Datos Vivienda, Situación Económica, Recreación, Aptitudes y Habilidades. Tabla familiar con 10 encabezados: Nombre, Edad, Parentesco, Grado, Ocupación, Condición Laboral, Aporte Económico(S/.), Enfermedad, Tipo Discapacidad y Acción. Los controles observados estaban deshabilitados. La réplica usa valores de demostración y fila vacía.
- **Interacciones observadas:** navegación de lectura al estado inicial; no se activaron Modificar, descarga, paginación ni acción de fila.
- **Evidencia:** `evidence/sum/mi-informacion/observations-2026-10-08.md`; `evidence/local/ficha-socioeconomica/verification.md` y `candidate.png` (réplica local). El DOM mostró una fila estructural; valores no observados/retendidos.
- **Pendiente/bloqueado:** tamaño/jerarquía visual de las secciones internas, estados condicionales y contenido/acciones de filas; comparación visual integral sin referencia sanitaria de pantalla completa. No existe contrato candidato en `raw-types/`.
- **Confianza:** alta en orden de secciones y encabezados; parcial en campos mostrados en la réplica, porque labels internos de algunos grupos se tomaron del DOM sin asociar todos los controles condicionales.


## Backend propio Mi Información

Contrato listo para lectura sintética: [mi-informacion-api-v1](../contracts/local-api/mi-informacion.md). Tipos, valores, escenarios vacíos/errores y persistencia son decisiones `local-only`; no elevan evidencia a contratos SUM. Esta tarea implementa backend, sin modificar UI ni acreditar integración React. Criterios MI-* y resultado en [workflow](../workflows/mi-informacion-backend.md).
