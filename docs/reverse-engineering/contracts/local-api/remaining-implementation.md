# Contrato incremental: trabajo local pendiente

- Revisión fija: **RI-CONTRACT-1**, 2026-10-08; lista para Luna High.
- Alcance: consumo de Mi Información existente y tres consultas nuevas de Programación, Tutoría y Plan de Estudios. Manuales permanece estático. Todo DTO, acción, fixture y regla de esta extensión es `local-only`.
- Reutilización obligatoria: [mi-informacion-api-v1](mi-informacion.md), [reportes](reportes.md), [asistencia-api-v1](asistencia.md) y [MI-CONTRACT-1](matricula-informacion.md). No se sustituyen ni reabren sus decisiones. Formulario **ya** usa HTTP local y su handler pertenece a MiInformacion; su brecha es renderizar `data.secciones`.
- Fuentes B: notas sanitizadas `evidence/sum/{programacion-asignaturas,plan-estudios,tutoria,manuales}/`, `evidence/sum/mi-informacion/observations-2026-10-08.md` y especificaciones vigentes. Tipos `raw-types/` son candidatos; código/mocks actuales son fuentes A de la réplica, nunca prueba SUM.

## Frontera HTTP común

Mantener proxy same-origin `/api` a `http://127.0.0.1:3000` y backend loopback/PORT existentes. No cambiar configuración compartida. POST readonly con `Accept: application/json`, `credentials: 'omit'`, AbortSignal y body ausente. Aceptar también objeto JSON vacío. Query exactamente `accion` literal única; sin identidad, periodo, filtros o fixture por request.

| Operación / clave cliente | Ruta backend bajo `/alumnoWebSum/v2/` | accion | DTO de consulta |
| --- | --- | --- | --- |
| RI-PROG / programacion | matricula/programacion | obtenerProgramacionAsignaturas | `{accion:'obtenerProgramacionAsignaturas'}` |
| RI-TUTOR / tutoria | tutoria | obtenerListaAsignaturaTutoria | `{accion:'obtenerListaAsignaturaTutoria'}` |
| RI-PLAN / plan | planEstudios | obtenerPlanEstudios | `{accion:'obtenerPlanEstudios'}` |

Acciones/rutas adoptan nombres existentes del cliente por compatibilidad local; no se declaran tráfico SUM verificado. Éxito HTTP200 JSON envelope exactamente `{message:null,codError:null,data:T}`. Reutilizar `ConsultaReadOnlyRequest`/`validateReadonlyQuery` existentes sin editar common: prioridad acción → query extra → body. HTTP400 `{message:'Acción de consulta inválida.',codError:'INVALID_ACTION',data:null}`, o `Parámetro de consulta no admitido.`/`INVALID_QUERY`, o `La consulta no admite cuerpo de datos.`/`INVALID_BODY`. Arrays, null/primitivos y text/plain con bytes no constituyen cuerpo vacío. Malformed JSON rechazado antes del pipe conserva error400 del parser. Métodos/rutas no registrados404; no endpoint de descarga/reset/escritura.

Servicios forman envelopes concretos, repositorios singleton inyectados entregan copias profundas. Cada módulo importa ReportesModule para su ReportesRepository exportado; nunca registra segunda copia del provider. No imports runtime de client/, red externa, autenticación, ORM o dependencias nuevas.

## RI-PROG: forma exacta compatible

`data` exactamente `{alumno:AlumnoFixture,programacion:ProgramacionRow[]}`. AlumnoFixture es **la forma JSON completa vigente** de `backend/src/reportes/reportes.types.ts`/`ReportesRepository.readFormulario().alumno`, definida por reportes.md, incluyendo infoSemestre/infoMatricula; no construir alumno parcial ni utilizar flags como permisos. Conservar `ApiResponseMap.programacion`/raw candidate actual, sin unión nueva ni cambios raw-types.

ProgramacionRow, todos los campos requeridos:

| Tipo | Campos |
| --- | --- |
| string | codAsignatura, desAsignatura, codDocente, nomDocente, apePatDocente, apeMatDocente |
| number | ciclo, creditos, codSeccion, horario, topeAlumnos, matriculados |
| HorarioProgramacion[] | horarios |

HorarioProgramacion, todos requeridos:

| Tipo | Campos |
| --- | --- |
| exactamente null | codSemestre, codPlan, desAsignatura, nomDocente |
| string | codAsignatura, codDocente, dia, horaInicio, horaFin, codAula, codTipoHoraAsignatura, desTipoHoraAsignatura |
| number | codFacultad, codEscuela, codEspecialidad, codSeccion, horario, horaInicioMin, horaFinMin, topeAlumnosLab, matriculadosLab |

Validación cliente local: objetos con claves exactas; strings de curso/docente no vacíos salvo nombres/apellidos que pueden ser `''` con nombre docente combinado no vacío; codAula puede `''`. Números finitos; códigos/contadores/horario safeinteger no negativos, ciclo/sección/horario positivos; créditos no negativos. No imponer relación matriculados≤tope como regla de negocio ni calcular capacidad/disponibilidad. Identidad de horario curso/sección/docente coincide con fila; códigos facultad/escuela/especialidad coinciden con alumno. Clave de fila `(codAsignatura,codSeccion,horario)` única; horario anidado `(horario,dia,horaInicio,horaFin)` único dentro de curso. `dia`: LUNES/MARTES/MIERCOLES/JUEVES/VIERNES/SABADO (compatibilidad con candidato); horas HH:mm válidas, inicio<fin; horaInicioMin/horaFinMin coinciden con conversión a minutos. Tipos T/P/L corresponden a Teoría/Práctica/Laboratorio. Estas relaciones son diseño sintético explícito.

Seed populated **ocho cursos** del snapshot actual `client/src/data/mocks/courses.ts` (no importarlo runtime): DEMO-001 Matemática I, DEMO-002 Introducción a la Informática, DEMO-003 Lenguaje y Comunicación, DEMO-004 Metodología del Estudio, DEMO-005 Estadística, DEMO-006 Programación I, DEMO-007 Matemática II, DEMO-008 Física General. Todos4 créditos; primeros4 ciclo1, restantes ciclo2; sección1, horario1, docente `DOC-${index+1}`/DOCENTE/DE/DEMOSTRACIÓN, tope40/matriculados20. Dos horarios por curso: día del array LUNES..SABADO en índice modulo6; Teoría08:00–10:00 horario1 aula `A-${index+1}` minutos480/600; Práctica10:00–11:00 horario2 aula`--` minutos600/660. Ambos topeAlumnosLab40/matriculadosLab20; nulls explícitos y códigos académicos del alumno común. Alumno leído por DI, mismoDEMO-001/2026-2; catálogo no depende del modo REPORTES_FIXTURE.

`PROGRAMACION_FIXTURE` ausente/populated = esa semilla; empty = `{alumno,programacion:[]}`; cualquier otro valor incluida cadena vacía aborta arranque. Memoria readonly; ningún reloj o persistencia externa. Modo/reinicio/repetición equivalentes; copia impide mutación.

UI: reutilizar tabla7columnas, modal5columnas y CSV del cliente. Modal lee exclusivamente horarios de la fila HTTP elegida; no segunda consulta ni handler SUM supuesto. Conservar cierre por botón/Escape/backdrop, foco y desbloqueo scroll ya implementados. Vacío `No hay registros` y modal vacío `No hay horarios registrados.`. CSV7columnas y filas visibles; headers solamente en empty. Columna indicadora histórica sigue unverified, sin inventarla.

## RI-PLAN: forma exacta compatible

`data:PlanRow[]`, todos los campos requeridos y sin extras:

| Tipo | Campos |
| --- | --- |
| string | codPlan, codAsignatura, desAsignatura, codAsignaturaPre, desAsignaturaPre |
| number | codFacultad, codEscuela, codEspecialidad, ciclo, creditos, creditosPre |
| 'O' o 'E' | tipoAsignatura |
| 'GEG' o '--' | codGrupo, codGrupoPre |

Mantener ApiResponseMap.plan/candidato vigente. `codPlan` literal`'2018  '` del contexto sintético existente, con espacios en el DTO; adaptación visual actual puede trim. Códigos académicos safeinteger no negativos y coinciden con alumno común; ciclo entero positivo; créditos finitos no negativos. Código/descripcion curso no vacíos; fila `(codPlan,codEspecialidad,codAsignatura)` única. Prerrequisito vacío requiere ambos strings vacíos; si existe ambos no vacíos. No interpretar campo como permiso, bloqueo, equivalencia ni algoritmo de avance; `creditosPre` no suma automáticamente créditos de otro curso.

Seed populated ocho cursos, créditos/ciclo exactamente RI-PROG; códigos comunes de alumno; tipoO/grupoGEG; primeras4 sin prerrequisito, últimas4 referencian código/nombre del curso índice−4; codGrupoPre`--`, creditosPre0 en todas las filas. Son relaciones de ejemplo existentes en mock, no reglas académicas SUM. `PLAN_ESTUDIOS_FIXTURE` ausente/populated =8filas, empty=[]; otro valor incluida cadena vacía aborta arranque. Obtener código de plan del alumno por DI; el fixture solo soporta contexto actual2018, no selector de planes.

UI reutiliza siete columnas Esp./Asignatura/Créd./Tipo/Grupo/Pre-Requisito/Grupo, tipos Obligatorio/Electivo y Ninguno para prerrequisito vacío. Empty `No hay registros`; CSV7columnas,8filas o solo headers. Sin filtros/consulta de elegibilidad/descarga backend.

## RI-TUTOR: estado vacío preciso

Respuesta siempre `{message:null,codError:null,data:[]}`; backend tipo `TutoriaData=[]`, sin `unknown[]` ni filas inventadas. No variable de fixture necesaria: única semilla vacía, retornada como copia. Array no vacío es **error de contrato en local**, aunque el candidato legacy unknown[] siga permitido en api heredado y la vista conserve su aviso histórico para filas opacas. No campos docentes/resolución ni endpoint de acción. UI seis encabezados actuales y `No hay tutorías registradas`. No descarga. Esta limitación refleja la única observación disponible; no bloquea aceptación local del estado vacío.

## RI-MI: integrar contrato Mi Información vigente

Backend no requiere cambios. Mantener cuatro acciones/DTOs/error/seed en mi-informacion.md. Perfil tiene28campos exactos según backend/src/mi-informacion/mi-informacion.types.ts y raw-types/mi-perfil.ts: strings tipoDocumento,numDocumento,estadoCivil,codSexo,desSexo,fechaNacimiento,departamentoNac,provinciaNac,distritoNac,telefono,celular,correoInstitucional,correoPersonal,departamentoDir,provinciaDir,distritoDir,direccion,anioIngreso,codTipoIngreso,desTipoIngreso,codColegioProc,desColegioProc,situAcademica,permanencia,codSemUltMat; numbers anioEstudio,promedio,promUltMat. Validar local todos, números finitos, añoEstudio entero no negativo; fecha realYYYY-MM-DD; campos opcionales de contenido siguen strings vacíos, sin inventar nulabilidad nueva. Periodo/año con formatos actuales. No imponer escala de notas.

Nuevo cliente `data/miInformacion.ts`: tipos propios HistorialLocalData/FichaSocioeconomicaLocalData/SeccionInformacion/CampoInformacion/FamiliarSocioeconomico y FormularioLocalData = formulario legacy data + secciones requerida. Copiar formas **exactamente** del contrato y types backend mediante declaración independiente, sin import runtime backend. ApiResponseMap.historial y .fichaSocioeconomica envelopes concretos nuevos; formulario unión legacy/local discriminada por `secciones`; perfil mantiene tipo actual.

Nuevas claves endpoints historial (`informacion/historial`, obtenerHistorialAcademico) y fichaSocioeconomica (`informacion/fichaSocioeconomica`, obtenerFichaSocioeconomica). Agregar perfil/historial/fichaSocioeconomica a claves HTTP local; formulario ya está. Para compatibilidad de mocks, añadir solo respuestas sintéticas de las **dos claves nuevas**, coherentes con contrato MI; no alterar respuestas mock existentes. En modo api esas dos claves nuevas son locales únicamente: resolver desde esas respuestas sintéticas, sin hacer peticiones candidatas nuevas. Helper `loadLocalMiInformacion(key,options)` en data/client.ts devuelve `null` en mock/api y envelope validado en local; las rutas de historial/ficha usan ese helper. `null` es discriminante interno de representación legacy, nunca una respuesta backend ni vacío permitido en local. En local siempre hacer HTTP y rechazar data:null.

Runtime local valida objetos/claves obligatorias, secciones8/13, IDs de sección/campo únicos y orden estable `formulario-01..08` o `ficha-01..13`/campos`<section>-001...`; rótulos/títulos se toman del payload y no se regeneran por etiqueta. Reutilizar orden/catálogos de backend mi-informacion.catalogs.ts para asociar el control existente por índice/ID, porque rótulos repetidos existen. Valor string|null: null presenta `No registrado` en texto/select y vacío en input date; no sustituirlo por Dato de demostración. Fecha de campo válida se muestra como YYYY-MM-DD sin zona horaria; checkbox legacy sin modelo booleano permanece disabled/unchecked (no convertir texto a booleano ni inventar opciones). Validar identidad alumno consumida y todos valores usados; familiaredad entero no negativo, aporte decimal-string no negativo2decimales, nulables explícitos. Historial tipos/enteros no negativos, calificaciones/promedios finitos sin escala; promedioPonderado number|null y arrays vacíos válidos. No recalcular resumen de aprobados con umbrales.

Presentación local:

- Perfil Domicilio = departamentoDir/provinciaDir/distritoDir unidos o No registrado. Panel académico nueve etiquetas existentes usa respectivamente anioIngreso,desTipoIngreso,desColegioProc,anioEstudio,promedio,situAcademica,permanencia,codSemUltMat,promUltMat; promedios2decimales. No completar Cambio de Contraseña ni inventar columna ciclo separada. Legacy panel académico conserva representación actual.
- Historial alumno/resumen/periodos/asignaturas desde HTTP; ocho columnas existentes ciclo/codPlan/tipoAsignatura/código−descripción/calificacion2decimales/creditos/seccion/acta. Resumen0/0/null usa No registrado para promedio; periodos vacío `No hay promedios registrados.` y asignaturas vacío `No hay registros académicos.`. Búsqueda existente filtra solo la tabla por código o descripción sin distinguir mayúsculas; no endpoint, paginación u ordenamiento. Mensaje filtrado vacío `No hay registros académicos.`. Es búsqueda local explícita, no SUM probada.
- Formulario local consume secciones del loader raíz ya HTTP y flags existentes; conserva ocho grupos/navegación/tipos y estado readonly. No depender de perfil para valores locales; rama legacy conserva lookup actual. Ficha recibe su propia consulta/secciones13/familiares; sustituye fila vacía fija por familiares reales9campos, última Acción disabled sin endpoint. Familias vacías `No hay familiares registrados.`. Navegación por secciones conserva anclas existentes.
- CSVs locales existentes perfil/formulario/ficha se derivan de los mismos valores visibles de HTTP, sin otro backend ni datos inventados; conservar alcance actual de exportación (ficha exporta campos de secciones, no añadir exportación familiar). Modificar y acciones familiares siguen deshabilitadas; sin escrituras/persistencia de edición.

Error/carga/reintento usan RoutePending/RouteError existentes, declarados en rutas nuevas/afectadas; no fallback mocks tras fallo local ni éxito por respuesta interceptada. Formularios conservan root loader del resumen sin hacer otra petición formulario redundante.

## Manuales y límites

Nueve recursos de `data/tutorialResources.ts` ya describen el contenido estático; reutilizar sin backend, nuevos DTOs, hrefs, archivos o videos supuestos. Un título observado no establece URL destino. Toda tarjeta permanece artículo, no control que simula navegación. Solo corregir detalle comprobado, como fecha visible a partir de publicationDate, si se diagnostica en verificación. Referencias sanitizadas respaldan composición visible; scroll/región enmascarada no permiten paridad integral. Inicio usa resumen común ya local y su diseño/destinos vigentes; no agregar endpoint Inicio.

## Aceptación y límites de verificación

Escenarios RI-* del [plan](../../plans/remaining-implementation.md) obligatorios para integración propia; no declarar fidelidad SUM por fixtures. Build/lint por capa y HTTP real por backend; UI real cliente→proxy→NestJS para cada ruta afectada. RI-CONTRACT de frontera puede usar JSON sintético inválido y fetch local, pero no acredita éxito integrado. Sin probes o inspección producción; reglas SUM de matrícula, edición, calendarios, destinos Manuales, filas Tutoría y paridad visual sin referencia permanecen unverified.
