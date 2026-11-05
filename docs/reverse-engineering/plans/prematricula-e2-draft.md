# E2 mínimo: borrador personal sintético

Principal2026-11-04, schedule-pt1. Requisito explícito/local-only. Complejidad alta
por identidad/aislamiento; plan/contrato principal antes de workers. Preservar SUM
visual/interacciones: solo ampliar /alumnoWebSum/v2/reportes/prematricula con sección
compacta, conservar reporte/guardas/rutas y matrícula intactos. No portal nuevo.
Sin privados/PDF, dependencias, migraciones, E3, Registrar intención o estadísticas.

## Contrato fijo E2-LOCAL-1

shared/prematricula-api.mjs/.d.mts son autoridad wire. Prefijo /local/prematricula/v1
(frontend /api). Cuatro POST JSON exacto (HTTP200); headers/origin/query guard reuse
assertWriteScope exportado de demo.controller.ts y DemoAccessService+DemoHttpErrorFilter.
- contexto {identity} → E2Context: ámbito/revisiónacadémica, lista E1, draft|null,
  draftValidation|null recalculada sin escribir. identity existente runId/actorId/sessionId.
- publicacion {identity,publicationId} → {actorId,academicRevision,publication:PA-PUBLICATION-1,eligibility:
  [{courseId,issues}]} para TODAS las asignaturas publicadas.
- validar {identity,publicationId,publicationVersion,selection:[{courseId,sectionId}]}
  → E2Validation: identidad, refs, academicRevision, selección canónica, créditos,
  courseCount,status valid/unmet/insufficient/incomplete, issues estructurados.
- guardar añade id:null|UUID,expectedVersion:null|int,expectedAcademicRevision:SHA256
  → {draft:E2Draft,validation:E2Validation}. Sin authority/status/credit client.

400 malformed/duplicatecourse;401 sesiónvencida/ausente;403 owner/actor/scenario/mode;
409 CAS/publicationversion/source changed/corrupt;404 publication noexiste;
503 almacenamiento. Mismo error simple {error:{code,message}}. Convertir errores
MatriculaRegularError existentes a ese envelope sin tocar contrato E3.

Precisión del contrato final: un actor distinto de los dos admitidos incumple el
esquema de entrada (400); sesión asociada a otro actor o propiedad ajena se rechaza
en el servidor (403). Respuestas publicacion incluyen actorId y academicRevision.

## Identidad y modo

Solo local con SUM_LOCAL_SCENARIOS=1 y SUM_ACADEMIC_SCHEDULING=1, nunca
SIMULATOR_DEPLOYMENT=public. Reutilizar snapshot MatriculaRegularRepository,
LocalProfileSessionService.requireActive(now ContextService), LocalScenariosService
catalog currentScenarioId==='regular'. Actor SIS-A/SIS-B, escuelaSISTEMAS/planSYN-SIS-PLAN.
No renovar/inventar sesiones. Validar identidad antes de leer archivos o E1.
Escenarioalterno rechaza y no altera su repositorio. Source estable regular-SISTEMAS-v1;
propietario durable actorId+source+escuela/plan/periodo2027-I, NO runId/sessionId.
Hash académico canónico incluye datos relevantes/mapping/knowledge y cut-off2026-1,
excluye run/session/time: sobrevive reinicio y detecta contexto cambiado. Perfil sigue
2026-II en E3; proyección E2 apunta2027-I sin modificar actor ni aplicar sus turnos.

## Lógica reutilizada

SavedDraftService (exportado AcademicSchedulingModule) publications/getPublication
como fuente única. Validar ámbito/vigencia de ID+publicationVersion; versionanterior
publicada siguepermitida. No reemplazar por latest al cargar; avisar nueva vigente.
Sin publicación no hay fallback a la oferta de matrícula. projectActor usa la correspondencia
actor.scenarioData.courseCodes para producir códigos académicos; classify recibe esos
códigos originales publicados, sin convertirlos de nuevo a identificadores SYN.
projectActor exportado de demand-fixtures y classify exportado de demand-estimator
reutilizan habilitación/approved/prerequisite/equivalence/unknown sin modificar reglas.
Conocimiento de equivalencias regular es conocido/vacío explícitamente; fuente120
no cuentas. Exportaciones son único cambio de lógica E1, comportamiento igual.
classify devuelve category non-eligible/insufficient o eligible, corte2026-1, conjunción
de prerrequisitos. Mapear mensajes claros por code. Nuevos issues kind unmet/insufficient.
Usar intervalsOverlap para cruces de TODOS componentes de secciones seleccionadas;
componentes consecutivos no cruzan. Sin límites12/26, cupos, deuda, turnos u órdenes
de repitencia institucionales. Cantidadcréditos una porcourseId. Emptyselection issue
incomplete EMPTY_SELECTION. IDs fuera depublication o course/section discrepante400;
badacademicchoices sí guardables con unmet/insufficient y avisos, no matrícula válida.
Validar no toma locks de ocupaciones ni llama MatriculaRegularService.submit.

## Persistencia

MISMO volumen existente, subdirectorio e2-prematricula dentro de SUM_ACADEMIC_DRAFT_DIR.
NO JSON E2 al directorio principal E1. Reutilizar SavedDraftStore como genérico<T=PersistedDraft>
con checksum/atomic/queue/path-safe unchanged, no otra implementación filesystem.
E2 payload propio {schemaVersion:1,document:E2Draft}, sin retained/catalogFingerprint falsos.
Un borrador activo por actor para este ámbito. Crearuuidalguardarinicial, contexto
lo recupera porowner. Petición idnull si ya existe409; updateID ajeno403; versionvieja409.
Store validation estricto, duplicates/corrupt no overwrite. Selecciónverificarconpublicado
en todosreads/saves. Lectura recalcula validación actual; academicRevision guardada
puede ser anterior, advertir ACADEMIC_CONTEXT_CHANGED insufficient sin autoescritura.
CASrevisiónacadémicaenSave requierecontextactual. Update mismoID puede cambiarpub
solo por selección explícita UI; limpia/confirmaselección al cambiar. Anteriorrecord
queda igual hastaSave explícito. Borradoresparciales y conerrores se guardan. No stats.
Reinicio reautentica sesión local y recupera mismoowner/borrador/version. Cuota pequeña
de hasta50 documentos namespace; directorio vacío/inexistente permitido. Un writerbackend.

## UI y reutilización

Montar componente E2 solo getLocalProfileActivation synthetic-actors, VITE_DEVTOOLS1,
VITE_SUM_ACADEMIC_SCHEDULING1, localdata y NO VITE_SUM_SIMULATOR1; soloSIS-A/B. Otros
modos conservan pantallaexacta. Backend compruebamodo+regular siempre; E2component
sekeyea porrunId+actorId+sessionId, no mostrar resultados tardíos deotraidentidad.
Mantener reporte actual y debajo details «Mi propuesta de prematrícula»; no formularios
extensos. Lista publicación (escuela/periodo/número), acciones Consultar/Recuperar/Guardar,
tabla cursos con créditos y estado, elegir/reemplazar/quitar, calendario WeeklySchedule.
Aviso permanente: borrador no reserva vacantes ni matrícula confirmada, sin límites
institucionales verificados. No inferir occupied0 o mostrarvacantes deE1.

Extraer en SectionPickerDialog.tsx una vista de presentación genérica reutilizable
(strings/rows) conservando wrapper y props E3 intactos; nuevo E2 usa mismo diálogo
con columna «Capacidad planificada». Similar presentación opcional de SumEnrollmentTable
si útil: no copiar tablas enteras ni mensajes EJECUTAR/Matriculados aE2. Generalizar
chooseSection/removeChoice/credithelpers a camposstring si necesario, SIN modificar
shared/matricula-regular ni comportamiento/reglas E3; tests existentes pasan.
No casts SYN falsos paraIDs E1, preservar IDsoriginales enstate/request. Reutilizar
formatters/agrupadorE1 paraeventos de calendario vía WeeklySchedule.displayEvents.
Revalidar al editar con tokens/abort y expectedselection; resultado viejo noautoriza
selección nueva. Cambiarpublicaciónconfirmar y limpiar selección; noautosave/migración.
GuardarCAS id/version yacademicRevision; si respuesta llega tras edición conservar
ediciónlocal+dirty, avanzar metadata solo al mismodocumento. Recuperarexplicito confirma
discarddirty, no pisar otraidentidad. Backend valida los créditos/causas al guardar.

## Propiedad disjunta

Principal shared/plan/contrato/app.module.ts+demo-module/controllerexport y E1exports,
Docker/browser/evidencia. Backend LunaHigh: nuevo backend/src/prematricula/*,
test/prematricula*.spec.ts, modificación genérica saved-draft-store.ts. No otrosarchivos.
Frontend LunaHigh: nueva screens/StudentPreEnrollment.tsx/.css, data/prematricula.ts/
.test.ts, ruta reportes.prematricula, componentes SectionPickerDialog y SumEnrollmentTable
si necesario, helper sumEnrollmentTable.ts/selectionPanel.ts, script verify-e2-prematricula.mjs.
No matrícula wire ni screens E3/WeeklySchedule/source E1. No subdelegar. Leer AGENTS+
skills carpeta, root sumworkflow; CodeGraph noinit sinexclusionessegurasstore/symlinks;
TOML ausente fallbackreal gpt-6-luna/high. Preservar cambiosprevios; no commit/push.

## Aceptación

Backend fixturespublicadas reales confiables víaE1review/approval/publication en tmp
seguro; sin alterar seed paraaprobar. Casos A/Bisolation+wrongsession/id, nonregular,
public/disabledmode, courseapproved/unmetprereq/unknown/equiv known recognized,
duplicatesec/differentcourse mismatch, creditsbelow12/above26 sinreglainventada,
crosses/adjacency/components, partialempty save, CASversion/source, newpublication
oldrefintact, newservice/restart recovery, corrupt/fileIO preserve, E1directoryintact,
matriculasnapshot/occupied/reports identical. Front build/lint/data+legacymatrícula.
Principal browser real ownCompose5280: prepararpublicationconcursoselegiblesparaA/B
(no defaultINE002yaaprobado), loginregularA → reporteconservado→select/calendar/save,
BsinA → saveB; closebrowser/restartbackend/reloginA yrecover; newerpublication
noautomove, elegirnuevaexplícito; assert E1pubs y ocupaciones intactos. No crear
estadísticas/intención/ejecutar matrícula. RegresiónERPmanual y enrollment idempotent.

## Cierre de implementación, 2026-11-04

Alcance mínimo implementado y aceptación local completada. La generación, sus
validadores y sus diez archivos base conservan SHA256. No se modificaron contratos
ni reglas E3. Matriz de criterios, comandos, resultados y límites en
[informe integrado](../../../evidence/local/prematricula-e2-draft/fullstack-verification.md).
364 casos focales backend y204 frontend pasan. Existe un fallo previo de Windows
en una prueba adicional de perfiles, documentado sin modificar esa prueba.
No se inician intención registrada, estadísticas ni otra etapa.
