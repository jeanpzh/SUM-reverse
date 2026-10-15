# asistencia-api-v1

Fecha: 2026-10-08. Estado: listo para implementación React/NestJS. Alcance: Mis Asistencias `/alumnoWebSum/v2/asistencia`, lectura y descarga local CSV. Todos los datos/reglas/contrato son `local-only`. Fuentes históricas sanitizadas: `evidence/sum/asistencia/{structure,interactions,measurements}.md`, `raw-types/mis-asistencias.ts` candidato, pantalla/adaptador/mocks existentes. No confirman backend ni comportamiento de calendario/descarga SUM.

## Consulta propia

POST `/alumnoWebSum/v2/asistencia?accion=obtenerResumenAsistencia`. Query únicamente accion literal única; body ausente o `{}`. Reutilizar `backend/src/common/readonly-query.ts`, prioridad/action, query y body con errores HTTP400 INVALID_ACTION/INVALID_QUERY/INVALID_BODY, textos/envelope existentes y detección text/plain no parseado. Éxito200 `{message:null,codError:null,data:AsistenciaRow[]}`. No parámetros alumno/periodo/fixture ni endpoints de escritura/detalle calendario. Rutas/métodos no implementados404. JSON malformado400 del parser, sin garantizar envelope propio.

Fila: exactamente la forma de `raw-types/mis-asistencias.ts` Datum, implementada como tipo local backend independiente; frontend puede reutilizar el tipo candidato JSON ya existente al validar localmente. Campos: strings codAlumno,codSemestre,desEspecialidad,codPlan,codAsignatura,desAsignatura; null apellidoMaterno,apellidoPaterno,nombreAlumno; enteros no negativos codFacultad,codEscuela,codEspecialidad,codSeccion,numClases,cantPresentes,cantFaltas,cantTardanzas,cantAsistencias; números finitos [0,100] porcentajePresentes,porcentajeFaltas,porcentajeTardanzas,porcentajeAsistencias. codSeccion positivo, códigos/textos requeridos no vacíos tras trim. Identidad/periodo/especialidad/plan coherentes con ReportesRepository.readFormulario().alumno (DEMO-001/2026-2); importar ReportesModule, no duplicar provider ni datos de identidad ni imports runtime frontend.

Reglas locales explícitas: presentes+tardanzas+faltas=numClases; cantAsistencias=presentes+tardanzas; porcentaje=clases>0 ? Math.round(cantidad/clases*10000)/100 : 0. Conteos safeintegers no negativos. Cero clases produce conteos/porcentajes0, nunca NaN. Son reglas de demostración, no política de asistencia/aprobación SUM.

## Fixtures y arquitectura

Módulo feature AsistenciasModule con controller/pipe/service/repository y tipos concretos (sin Envelope<unknown>). Repositorio clona respuesta y comparte alumno por DI; servicio forma envelope. Tres semillas sintéticas, sección1, cursos DEMO-001 Matemática I, DEMO-002 Introducción a la Informática, DEMO-003 Lenguaje y Comunicación:

| Curso | Clases | Presentes | Tardanzas | Faltas | Total asistencias | % presentes/tardanzas/faltas/asistencia |
| --- | --- | --- | --- | --- | --- | --- |
| DEMO-001 |16|14|1|1|15|87.5 / 6.25 / 6.25 / 93.75|
| DEMO-002 |8|6|1|1|7|75 / 12.5 / 12.5 / 87.5|
| DEMO-003 |0|0|0|0|0|0 / 0 / 0 / 0|

ASISTENCIAS_FIXTURE ausente/populated o empty ([]), otros valores impiden arranque. Independiente de REPORTES_FIXTURE y MI_INFORMACION_FIXTURE. Memoria readonly, copias profundas, reinicio/repetición/concurrencia deterministas, sin auth/DB/nuevos paquetes/telemetría.

## Cliente

Añadir únicamente `asistencias` a localHttpKeys en modo local; llamadas reales same-origin `/api`, credentials omit, AbortSignal/retry existentes. Mock/api legacy mantienen comportamiento. Validar runtime campos/tipos/enteros/invariantes/porcentajes (tolerancia <=0.000001), y rechazar respuestas malformadas con error accesible, sin fallback mock ni vacío falso. Mantener tabla agrupada12columnas, identidad/resumen existentes; adaptador usa filas reales. Sin nuevo diseño ni filtros/calendario inventado. Botones calendario deshabilitados con explicación breve accesible de disponibilidad no verificada. CSV local existente11columnas sin acción, `asistencias.csv` en local (mock -demo), encabezados+3filas, o encabezados en empty. CSV es comportamiento propio, no descarga SUM verificada.

## Criterios de aceptación

A-HTTP: POST200, tres filas/campos/porcentajes e identidad; tercera0clases válida.
A-INVALID: acción ausente/errónea/duplicada/queryextra/cuerpoJSON/array/textplain400; `{}`aceptado; configuración inválida falla inicio.
A-READONLY: repetición/concurrencia/reinicio iguales; no efectos escritos.
A-UI: carga por ruta y menú al backend real, tabla/valores/resumen y recarga; observar POST local.
A-EMPTY: servidor real empty devuelve[] y UI mensaje 'No hay registros de asistencia.', CSVheaders.
A-RECOVERY: backend parado → error, restaurar → reintento recupera tabla; loading con respuesta real demorada.
A-CONTRACT: respuesta sintética malformada (inconsistencias/porcentaje/string) se rechaza en cliente; no usar fallo inyectado para acreditar éxito integrado.
A-CSV: descargar tres filas11columnas correctas, headers en empty; calendario permanece deshabilitado.
A-GUARD: reportes/miinformacion conservan endpoints, otra clave de cliente mantiene modo anterior. Build/lint ambos proyectos. REA/CDP local registra navegación y solicitudes correlacionadas; no inspección de producción ni paridad visual exacta.
