# mi-informacion-api-v1

Fecha: 2026-10-08. Estado: listo para backend propio. Todo contrato, valores, reglas y escenarios de este documento son `local-only`, no contratos SUM verificados. Fuente reutilizada: `evidence/sum/mi-informacion/observations-2026-10-08.md`, cuatro specs perfil/historial/formulario-datos/ficha-socioeconomica, `raw-types/mi-perfil.ts` candidato y rótulos del cliente StudentForms. Solo implementación backend; sin modificaciones cliente ni claim de integración UI.

## HTTP y alcance

POST bajo `/alumnoWebSum/v2/informacion/`:

| Ruta | accion literal | data |
| --- | --- | --- |
| perfil | obtenerInformacionAlumno | Los 28 campos de Data en raw-types/mi-perfil.ts, como JSON sintético propio. Fecha ISO YYYY-MM-DD, promedio/promUltMat números. |
| historial | obtenerHistorialAcademico | {alumno, resumen, periodos, asignaturas} |
| formularioDatos | obtenerFormularioDatosMatricula | Mismos campos y valores actuales de Reportes para data; agregar `secciones` (8) sin cambiar formulario={} ni flags. Único handler; trasladar desde Reportes al módulo MiInformacion. |
| fichaSocioeconomica | obtenerFichaSocioeconomica | {alumno, secciones (13), familiares} |

Los nuevos nombres de acciones historial/ficha son decisiones propias, sin evidencia de endpoint SUM. Métodos POST readonly, 200 `{message:null,codError:null,data}`. Sin identidad/periodo/filtrado/env por request, sin autenticación, contraseña, guardar/modificar, descargas, pagos ni cliente HTTP externo. HTTP 404 para rutas/métodos no implementados. Query exactamente una accion literal; body ausente o objeto JSON vacío. 400 envelope `{message:string,codError:'INVALID_ACTION'|'INVALID_QUERY'|'INVALID_BODY',data:null}`; prioridad acción, query extra, body. Rechazar accion duplicada, arrays, query extra, cuerpo no vacío incluido text/plain no parseado. Malformed JSON puede recibir 400 del parser Nest/Express; no afirmar envelope propio en ese caso.

## Datos locales

Alumno: misma forma y valores que `backend/src/reportes/reportes.fixtures.ts` formulario.alumno (DEMO-001, 2026-2). Reutilizar repositorio Reportes exportado desde su módulo para leer resumen; no duplicar identidad ni import runtime frontend.

Perfil: documento DEMO-DOC-001, nombres/dirección/teléfonos synthetic; correos example.test, ingreso 2026, añoEstudio 1, promedio15, estado Regular, última matrícula2026-2/promedio15. Campos restantes según candidato explícitamente local; no copiar valores reales.

Historial:
- resumen `{asignaturasAprobadas:number,creditosAprobados:number,promedioPonderado:number|null}`.
- periodos `{periodoAcademico:string,creditos:number,promedio:number}[]`.
- asignaturas `{ciclo:number,codPlan:string,tipoAsignatura:string,codAsignatura:string,desAsignatura:string,calificacion:number,creditos:number,seccion:number,acta:string,periodoAcademico:string}[]`.
- populated: tres asignaturas DEMO-001..003 de Reportes, cada una4 créditos y nota15, ciclo1/tipoO/seccion1/actaDEMO-ACTA-001..003/periodo2026-2; resumen3/12/15, un periodo2026-2/12/15. No inferir umbral de aprobación SUM; fixtures explícitamente aprobados.

Secciones: `{id:string,titulo:string,campos:{id:string,etiqueta:string,valor:string|null}[]}[]` con IDs únicos estables, rótulos sin sufijos de control *,?,@,#,~,^ de StudentForms. Reutilizar sus dos catálogos completos y orden (8 formulario,13 ficha), incluyendo etiquetas repetidas con IDs distintos. No generar opciones inventadas de selects ni afirmar controles SUM. populated valores sintéticos o null si sin registro; código/nombre/correo del alumno coherentes. Familiares `{id:string,nombre:string,edad:number,parentesco:string,grado:string,ocupacion:string,condicionLaboral:string,aporteEconomico:string,enfermedad:string|null,tipoDiscapacidad:string|null}[]`; populated un familiar DEMO sin datos reales, aporte decimal-string '100.00'. Acción de tabla es UI, no dato/endpoint.

`MI_INFORMACION_FIXTURE` ausente/populated o empty; otros valores fallan arranque. Empty conserva alumno, perfil, estructura/IDs/etiquetas y campos identificadores de alumno, cambia otros valores secciones a null, familiares/asignaturas/periodos a [], resumen0/0/null. No cambia flags heredados de formulario ni REPORTES_FIXTURE. Persistencia: memoria readonly/copias profundas por consulta, sin escrituras; repetición, concurrencia y reinicio mismo fixture son deterministas.

## Aceptación backend

MI-HTTP cuatro consultas reales: tipos/campos/counts/secciones/identidad/envelope. MI-INVALID acción ausente/incorrecta/duplicada/query extra/JSON no vacío/arrays/text/plain. MI-READONLY repetición y concurrencia sin modificación; reinicio mismos datos. MI-EMPTY consulta cuatro vistas con env empty y verificación de estructura y nulls. MI-CONFIG valor inválido falla arranque. MI-REPORTES seis contratos previos aún consultables con mismos valores (solo adición secciones formulario); no handler duplicado. Build y lint backend. Escenarios HTTP locales autorizados por workflow, no nuevas suites de tests.

Frontend no cambia; por tanto aceptación solo backend HTTP, sin acreditar interfaz conectada ni fidelidad SUM.
