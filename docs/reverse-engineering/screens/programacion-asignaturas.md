# Programación de Asignaturas

## Revisión actual: 2026-10-08, MC-CONTRACT-1

REA autorizado observó GET/200, ocho columnas, modal visible por fila y búsqueda/vacío/restauración sin nueva consulta. El JS público usa row.horarios para el modal, campo extra s para la primera columna y agrupación en orden por ciclo (99→0). PDF y laboratorios sólo se identificaron estáticamente. [Evidencia](../../../evidence/sum/matricula-compatibility/behavior.md).

La réplica presenta ocho columnas, códigos/nombres y agrupación; utiliza alumno de su respuesta para el resumen, busca en memoria y abre el horario de la fila seleccionada. Campo s ausente queda vacío y codAula vacío no recibe un valor inventado. Descargar CSV local exporta todas las filas DTO aun con filtro activo. El envelope raw se conserva y valida íntegro. [Contrato](../contracts/local-api/matricula-compatibility.md) y [aceptación sintética](../../../evidence/local/matricula-compatibility/fullstack-verification.md). Las notas siguientes son históricas; la apertura del modal sí se verificó en esta revisión, sin afirmar igualdad de filas personales o visual integral.

- **Ruta:** `/alumnoWebSum/v2/matricula/programacion`.
- **Interfaz observada:** resumen, descarga y tabla larga con asignatura, créditos, sección, docente, cupo, matriculados y acción Horarios. Notas registran múltiples botones de fila.
- **Interacciones:** no se activaron acciones del SUM. La forma del modal de horarios se transcribió de una imagen entregada por el operador, no retenida por incluir identificación.
- **Evidencia:** `evidence/sum/programacion-asignaturas/{structure,interactions,measurements}.md`; tipo candidato `raw-types/programacion-asignaturas.ts`.
- **Límite:** los datos de cursos son académicos; no se conservaron filas. El modal local se puede validar con fixtures, pero su enlace con la respuesta SUM no se demostró.
- **Confianza:** media para tabla y geometría; media-baja para modal, baja para resultado de acción/descarga.
- **Navegación:** la captura de sidebar suministrada por el operador muestra este rótulo como segunda opción de “Matrícula”; el destino `/alumnoWebSum/v2/matricula/programacion` ya está documentado.
- **Verificación local:** REA controlled replay `ev_24144edb2ccf4a7956fc60a2d95f6d7bfbd9341ecd7642d4da5104aaaa470560` llegó desde el menú local y observó título, descarga y las siete columnas etiquetadas. La columna indicadora mencionada en la nota histórica no tiene contenido ni forma respaldados; permanece pendiente. No hay captura SUM sanitizada para comparación visual.

