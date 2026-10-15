# API propia: matrícula regular sintética

**Revisión canónica:** `MR-CONTRACT-2`, 2026-10-11. Contrato de diseño fijado, no implementado.

**Clase:** todas las rutas, DTOs, estados, mecanismos y textos de esta API son `local-only`.
Base funcional: [spec vigente](../../../../specs/001-matricula-regular-fisi/spec.md),
L-01–L-06, FR-021–FR-029 y testimonios preservados. No acredita internos o N3 del SUM.
Este documento es la única definición HTTP; [plan](../../../../specs/001-matricula-regular-fisi/plan.md)
y [modelo](../../../../specs/001-matricula-regular-fisi/data-model.md) describen su ejecución.

## Alcance, contexto y aislamiento

Backend existente NestJS, prefijo nuevo `/local/matricula-regular/v1`; React usa
`/api/local/matricula-regular/v1` mediante el proxy local existente. Solo modo `local`,
`Accept: application/json`, POST JSON, `credentials: omit`; sin cookies, autenticación
nueva o llamadas SUM. No se habilita esta operación en `api` legacy. `mock` puede mostrar
demostración identificada sin writes; no suplanta un fallo de `local`.

Se conservan MC/MI/RI/reportes: las cinco lecturas existentes, sus POST/accion/body vacío,
DTOs y datos readonly siguen intactos. Esta API requiere elección y contexto de varios
actores sintéticos, incompatibles con esos DTOs. Sus reportes se consultan aquí, nunca en
el seed/snapshot de `ReportesService`. No se consultan snapshots del operador.

Cada ejecución crea `runId` UUIDv4 nuevo, un catálogo íntegramente construido desde fixtures
sintéticos y cero solicitudes/matrículas/reportes/sesiones. Actores admitidos únicamente
los declarados en ese catálogo: IDs `SYN-SIS-A`, `SYN-SIS-B`, `SYN-SOFT-A`, `SYN-SOFT-B`.
No selección de identidad real, cuenta o credenciales. `actorId` es selector de demostración,
no autenticación ni seguridad para despliegue público. La réplica queda local/loopback.

La memoria dura hasta reinicio del proceso o reset interno de test. Un run nuevo invalida
todo identificador anterior; no se promete recuperación tras reinicio/crash ni durabilidad.
No disco, ORM, almacenamiento de matrícula en navegador ni reset/seed HTTP. Tests crean
repositorio nuevo; reiniciar backend restaura seed y genera run nuevo. Ninguna factory lee
inputs privados. No múltiples procesos/réplicas: garantía de capacidad e idempotencia es
de un único proceso; escalar requiere revisar contrato/repositorio.

## Tipos comunes y validación en ejecución

Todos los objetos de DTO tienen **solo** las claves enumeradas y todas son obligatorias;
`null` se admite únicamente donde se indica. Sin coacción/defaults ni strings recortados.
Números finitos, contadores enteros seguros no negativos; IDs de catálogo regex
`^SYN-[A-Z0-9-]{1,48}$`; UUIDs v4 canónicos minúsculos; fechas UTC ISO `YYYY-MM-DDTHH:mm:ss.sssZ`.
Reglas de fechas verifican instante real. Validación de respuesta correlaciona runId
con contexto/solicitud consultada, actorId/requestId y enrollmentId con la identidad
esperada; una respuesta de otra identidad es malformada, no se muestra como éxito. Límites técnicos propios: 1–32 selecciones,
sin cursos repetidos, sin entradas duplicadas. Orden de selección no es prioridad académica.

| Tipo | Campos exactos |
| --- | --- |
| `Choice` | `courseId: ID`, `sectionId: ID` |
| `Scope` | `facultyId: string no vacío`, `schoolId: string no vacío`, `period: string YYYY-I o YYYY-II`, `planId: ID`, `modality: 'regular-virtual'` |
| `Source` | `id: string no vacío`, `origin: 'evidence'/'local-decision'`, `class: 'normative'/'observed'/'testimony'/'inferred' o null`, `reference: string no vacío`, `date: YYYY-MM-DD real`, `status: 'documented'/'reported'/'unverified'/'local-only'` |
| `Gap` | `code: GapCode`, `courseIds: ID[] únicos ordenados`, `sourceIds: string[] únicos ordenados` |
| `Cause` | `code: CauseCode`, `courseIds: ID[] únicos ordenados`, `sectionIds: ID[] únicos ordenados`, `sourceIds: string[] únicos ordenados` |
| `Session` | `runId: UUID`, `actorId: ID`, `sessionId: UUID`, `startedAt: ISO`, `expiresAt: ISO` |

En Source, origin=evidence exige una de las cuatro clases; origin=local-decision exige
class:null y status:local-only. La autorización es decisión local con referencia a L-01–L-04,
no una nueva clase de evidencia ni observación SUM.

Solo perfiles FISI/2026-II/SISTEMAS o SOFTWARE pueden habilitar writes de esta
funcionalidad. Scope es más amplio para expresar fixtures ajenos con PROFILE_MISSING,
sin aplicar FISI ni permitir inscripción en otro periodo/facultad.

Los enums aparecen con `/` solo como notación documental de alternativas. El wire lleva
una cadena. Causes/gaps son conjuntos: sin duplicados por `(code,courseIds,sectionIds)` /
`(code,courseIds)`. Se serializan por código y IDs lexicales para repetición estable; ese
orden técnico no representa precedencia SUM ni condición de aceptación AC-27.

## Operaciones HTTP

Ninguna query excepto las indicadas. Un GET no admite body. POST admite únicamente JSON
con claves exactas de su DTO. Todas las respuestas 200 contienen exactamente
`{runId: UUID, data: T}`. No usar envelope MC/codError para estas operaciones.

| ID | Método / ruta bajo prefijo | Entrada exacta | Respuesta 200 / efectos |
| --- | --- | --- | --- |
| MR-CTX | GET `/contextos/:actorId` | Sin query/body | `Context`; lectura del perfil, prematrícula/oferta y calendario propios, sin reserva ni sesión nueva |
| MR-SESSION | POST `/sesiones` | `{runId: UUID, actorId: ID}` | `Session`; crea sesión demo únicamente, ningún registro/cupo/reporte |
| MR-RENEW | POST `/sesiones/:sessionId/renovar` | `{runId: UUID, actorId: ID}` | Mismo Session con `expiresAt=now+15min`; solo sesión vigente del actor/run. Expirada requiere sesión nueva |
| MR-SUBMIT | POST `/solicitudes` | `Submission` abajo | `Outcome`; validación, rechazo/pending o commit completo; replay estable |
| MR-RESULT | GET `/solicitudes/:requestId` | Exactamente `runId=UUID&actorId=ID` | `Lookup`; lectura sin efectos, incluso sesión demo expirada |
| MR-REPORT | GET `/reportes/:enrollmentId` | Exactamente `runId=UUID&actorId=ID` | `EnrollmentReport`; solo matrícula aceptada de ese actor/run, nunca seed fallback |

Segmentos inválidos/query repetida o extra/body desconocido → 400. GET con run anterior
→ 409 `RUN_CHANGED`, nunca «no registrado». Context devuelve el run actual; el cliente
compara el run del intento conservado antes de consultar/enviar.

`Submission` exacto: `{runId,actorId,sessionId,requestId,profileRevision,selection}`.
Cuatro IDs son los tipos de arriba; `profileRevision` string regex `^MR-[A-Z0-9-]{1,48}$`;
`selection: Choice[1..32]`. Course/section deben existir y relacionarse en catálogo;
ID bien formado inexistente produce 404 `CHOICE_NOT_FOUND`, sin guardar un intento.
La admisión protocolaria solo comprueba catálogo completo de oferta y relación course/section;
no es elegibilidad. Con prematrícula y oferta completas, opciones seleccionables = intersección
de courses de prematrícula del plan vigente y oferta aplicable de ese mismo plan. Catálogo
puede contener courses ofertados del mismo plan ausentes de prematrícula para probar admisión
forzada: course/section válidos admiten evaluación y rechazan COURSE_NOT_IN_PRE_ENROLLMENT,
no404. Otro plan ofertado produce PLAN_MISMATCH; no cause de pertenencia duplicada para ese
course. ID desconocido sigue404. Incompletitud conocida produce gap, nunca exclusión por lista
parcial ni aceptación. Prerrequisitos/cruces siguen evaluados al enviar, no disabled al clic.

`Context` exacto: `{actorId,scope,profileRevision,serverNow,preEnrollmentEnabled,preEnrollmentComplete,preEnrollment,
offerKnown,offer,calendar,eligibility,sources}`:

- `preEnrollmentEnabled: boolean o null`; null exige gap, nunca se deduce de descarga.
- `preEnrollmentComplete: boolean`, `offerKnown: boolean`; false produce PLAN_OR_OFFER_UNKNOWN
  y no permite selección/commit. Datos parciales pueden consultarse como incompletos.
- `preEnrollment: CourseDocument[]`, documentos de asignaturas pendientes, incluso no ofertadas;
  `CourseDocument={courseId:ID,planId:ID,name:string no vacío,credits:number >0}`.
- `offer: OfferedCourse[]`; `OfferedCourse={courseId,planId,name,credits,prerequisiteIds:ID[],
  sections:Section[]}`. Ninguna asignatura se inventa a partir de documento incompleto.
- `Section={sectionId:ID,capacity:entero>=0,occupied:entero>=0,schedule:Meeting[] o null}`;
  `occupied<=capacity`; `Meeting={day:entero1..7,startMinute:entero0..1439,endMinute:entero1..1440}`,
  inicio<fin. Fuente synthetic o norma explícita; null no equivale a horario vacío conocido.
- `calendar={publishedRows:PublishedRow[],effectiveWindows:Window[],unknownDates:string[]}`.
  `PublishedRow={row:entero1..9,groupLabel:string,day:'2026-08-10',startLocal:string HH:mm,
  endLocal:string HH:mm,ppMin:number,ppMax:number,sourceId:'F6'}`; transcripción F6 sin corrección.
  `Window={id:ID,startsAt:ISO,endsAt:ISO,minPp:number>=0,origin:'published-derived'/'synthetic',
  sourceIds:string[]}`. Fin exclusivo, inicio inclusivo y UTC/Lima explícitos como diseño local.
- `eligibility={state:'eligible'/'ineligible'/'configuration-pending',windowId:ID o null,
  windowOrigin:'published-derived'/'synthetic' o null,causes:Cause[],gaps:Gap[]}` calculado con reloj
  servidor inyectable, no con hora/PP enviada por cliente. Context siempre disponible aunque no
  haya habilitación; ningún requisito académico se considera aprobado por omisión.
- `sources: Source[]` registra F1/F2/F6, testimony y decisiones/fixtures. No identificadores
  personales ni materiales originales. Campo `period` propio `2026-II` no modifica `2026-2` legacy.

Semántica de Context.eligibility (aclaración documental, sin cambio wire): `eligible`
es entrada habilitada por perfil/scope, PP/ventana, prematrícula habilitada/completa,
oferta conocida y condiciones institucionales/contextuales aplicables conocidas; no
significa que una selección aún inexistente cumpla créditos, prerrequisitos, cruces o
cupos. Dato contextual requerido unknown produce gap; unmet conocido causa contextual.
Outcome evalúa la elección real al procesar y conserva todas sus causas/gaps. Foundation
T007 implementa ese evaluador único y T012 lo verifica antes de US1; US2 solo lo reutiliza.
Las ventanas synthetic11/12 son de perfil de prueba seleccionado explícitamente, nunca
fallback ni sustitución de unknownDates/horas oficiales del perfil documental.

## Resultado y recuperación

`Outcome` exacto: `{requestId,actorId,profileRevision,state,evaluatedAt,windowOrigin,
selection,causes,gaps,enrollmentId,reportPath}`:

- `state: 'accepted'/'rejected'/'configuration-pending'`.
- `selection` es Choice[] canónico ordenado `(courseId,sectionId)`; `evaluatedAt:ISO`.
- `windowOrigin` enum como Context o null. `causes:Cause[]`, `gaps:Gap[]`.
- Accepted: causes/gaps vacíos; `enrollmentId:UUID`; `reportPath` exactamente
  `/local/matricula-regular/v1/reportes/{enrollmentId}`. La query del actor/run se añade en cliente.
- Rejected: causes no vacío, gaps vacío; `enrollmentId:null,reportPath:null`, cero writes de cursos/cupos/reporte.
- Configuration-pending: gaps no vacío; causes incluye todas las fallas conocidas evaluables,
  IDs de matrícula/reporte null; cero writes académicos. No es rechazo académico ni «validado».
  Este resultado del intento se conserva; nueva configuración/revisión exige nueva solicitud.

`Lookup` exacto: `{state:'known'/'unknown',outcome:Outcome o null}`. `known` requiere outcome;
`unknown` requiere null. Unknown: no hay resultado publicado aún para esa identidad/run;
puede ser petición nunca recibida o en cola. No prueba ausencia definitiva de efectos futuros.
Consultar no crea solicitud ni renueva sesión. Una sesión expirada no oculta el resultado.

Identidad estable: `(runId,actorId,requestId)`. Payload semántico canónico: actorId +
profileRevision + selection ordenada; excluye sessionId y orden original. Se compara el
objeto canónico completo, no solo un hash. Repetir misma identidad/payload devuelve exactamente
el Outcome original, timestamps/enrollment/report incluidos, sin reevaluar cupos, ventana
o sesión. Tiene prioridad sobre perfil stale/sesión expirada, tras validación estructural,
run/actor; el replay ocurre antes de validar catálogo/perfil/sesión de una petición nueva. Nunca autoriza un nuevo commit con sesión vencida.

Misma identidad con payload distinto → 409 `REQUEST_CONFLICT`; no cambia original. Otra
elección genera otro requestId. Un actor ya matriculado en ese scope/run recibe rechazo
`ALREADY_ENROLLED` para nuevo intento; no se amplía matrícula en esta rebanada. Replay de
rechazo no se vuelve aceptación al aparecer plazas. Identidad/resultado duran todo el run,
sin TTL de deduplicación. Sesión nueva permite consultar/repetir misma identidad.

Cliente crea UUID antes del primer envío y conserva **solo** identidad, revisión y elección
sintéticas pendientes en sessionStorage por run/actor (una solicitud incierta por actor).
No almacenar registros/reportes allí. Doble clic comparte identidad/payload; botón bloqueado
durante envío. Tras fallo de transporte/abort/JSON no interpretable muestra «resultado no
confirmado», sin éxito, rechazo ni selección nueva; ofrece consultar y, si unknown, repetir
**manualmente** la misma identidad/payload. No reenvío/polling automático. Cambiar actor
conserva su intento separado. Run cambiado limpia el intento tras aviso explícito de reset,
sin reenviarlo en el run nuevo. Nunca tratar reinicio como rechazo o persistencia recuperada.

## Evaluación de reglas y ventanas

L-01: evaluar todas las causas conocidas del contexto completo dentro del commit serial;
no detenerse en primera falla. Si faltan datos necesarios, acumular gaps y no registrar.
Solicitud DTO malformada es HTTP error, no conjunto de causas académicas.

| Código CauseCode | Condición conocida propia / base |
| --- | --- |
| `PRE_ENROLLMENT_NOT_ENABLED` | Habilitación false; FR-021 |
| `OUTSIDE_WINDOW` | Ventana aplicable conocida pero now fuera; apertura por PP acumulado testimoniada y bordes locales |
| `CREDIT_LOAD_INVALID` | 12–26 ordinario, excepción aplicable revisada en fixture; ramas especiales de cuarta matrícula sustituyen mínimo ordinario, según modelo/F1 |
| `COURSE_NOT_IN_PRE_ENROLLMENT` | Course del mismo plan ofertado pero ausente de prematrícula COMPLETA; decisión local L-05, sin write |
| `PLAN_MISMATCH`, `PREREQUISITE_UNMET`, `RETAKE_PRIORITY` | Plan único, prerrequisitos aprobados/equivalencias conocidas, desaprobados ofertados obligatorios faltantes; F1 arts13.a/16/18 |
| `SCHEDULE_CONFLICT` | Cruces de reuniones conocidas de selección; intervalos [inicio,fin), misma day; evento final es diseño local, rechazo regular testimoniado |
| `SECTION_FULL` | occupied==capacity al evaluar y commit; no reserva durante selección |
| `DEBT_REQUIREMENT_UNMET`, `HEALTH_REQUIREMENT_UNMET`, `ACADEMIC_INELIGIBILITY` | Condición known unmet en contexto synthetic; F1 art24/10. No consulta bancaria/médica/admin |
| `TUTORSHIP_REQUIREMENT_UNMET`, `FOURTH_ENROLLMENT_RULE_UNMET` | Ramas normativas conocidas de 2/3 desaprobaciones, curso ofertado o máximo12 si no ofertado; autorización conocida synthetic. No alta/permiso administrativo real |
| `ALREADY_ENROLLED` | Un registro por actor/scope/run, política local de esta rebanada |

`GapCode`: `PROFILE_MISSING`, `WINDOW_UNSPECIFIED`, `PRE_ENROLLMENT_UNKNOWN`, `PLAN_OR_OFFER_UNKNOWN`,
`PREREQUISITE_OR_EQUIVALENCE_UNKNOWN`, `SCHEDULE_UNKNOWN`, `EXCEPTION_UNKNOWN`,
`INSTITUTIONAL_REQUIREMENT_UNKNOWN`, `REPETITION_OR_AUTHORIZATION_UNKNOWN`.
Datos del perfil decididos en [modelo](../../../../specs/001-matricula-regular-fisi/data-model.md).
Curso documental conocido sin oferta se muestra como no ofertado/no seleccionable en
preparación (AC-09), sin sección inventada ni CauseCode inalcanzable. Un ID de elección
inexistente es CHOICE_NOT_FOUND protocolario. Gap no añade un error académico ficticio. Evaluar reglas independientes conocidas aun con gaps;
no deducir fallas de datos ausentes. Una regla no aplicable conocida no es gap.

Perfil documental FISI conserva unknownDates 2026-08-11/12, sin effectiveWindow para esos días:
contexto/intento allí `WINDOW_UNSPECIFIED`, sin registro. Ventanas synthetic de tests son perfil
distinto/revisión `MR-SYN-*`, marcadas synthetic en Context/Outcome/UI. No fallback automático
del perfil documental al synthetic. Derivación local del lunes: umbrales 17/16/15/14/13/12/11/10/0,
PP sin redondeo, sin tope19 funcional, acceso desde apertura al fin de día a las 00:00 del 11
exclusivo; diferencia de borde frente a «23:59» y `>19` son decisiones/testimonio, no F6 corregida.
13–14 presencial no crea ventana virtual. PP desconocido/perfil ajeno → pendiente, no PP=0.

Simulación de sesión local: entrada inicia 15min de reloj servidor; solo renovación explícita
al recargar una página activa renueva otros15min. Ninguna actividad ordinaria renueva. now>=expiresAt
caduca; antes de nuevo commit requiere nueva entrada y elección reiniciada. La pérdida de respuesta
de un envío en curso mantiene su identidad para consulta, incluso al expirar; no la trata como
rechazo. Inicio/renovación es diseño local, el testimonio no acredita esos mecanismos SUM.

## Commit, concurrencia y errores HTTP

Un repositorio singleton de este módulo mantiene catálogo/ocupación, sesiones, requests,
enrollments y reports del mismo run. Una cola serial por run procesa nuevas solicitudes/replays;
evalúa sobre último estado, construye copia candidata y publica reemplazo completo una sola vez.
Sin I/O ni await entre comprobar capacidades y publicar estado; fallo de construcción no
publica parcialmente. GET ve estado anterior o posterior completo. No locks de plazas en UI.
Cada matrícula aceptada incrementa exactamente1 por sección elegida y crea único reporte
e identidad de resultado en el mismo cambio. Rechazo/pending solo guarda Outcome; ninguna plaza
ni reporte nuevo. Dos actores válidos por última plaza → una aceptación/otra FULL; no ganador
predeterminado. Duplicados concurrentes se resuelven contra resultado ya publicado.

| Error antes de Outcome | HTTP / `error.code` | Efectos |
| --- | --- | --- |
| DTO/segmento/query/body inválidos, extras/tipos/duplicados | 400 `INVALID_REQUEST` | Ninguna solicitud/matrícula/cupo; `error.fields` paths únicos sin valores privados |
| actor/section/course/session inexistente | 404 `ACTOR_NOT_FOUND` / `CHOICE_NOT_FOUND` / `SESSION_NOT_FOUND` | Ninguno; no enumeración fuera catálogo synthetic |
| run anterior | 409 `RUN_CHANGED` | Ninguno; devuelve run actual, recuperación anterior fuera de lifetime |
| misma identidad payload distinto | 409 `REQUEST_CONFLICT` | Original intacto |
| revisión distinta de actor actual, para solicitud nueva | 409 `PROFILE_CHANGED` | Ninguno; refrescar contexto y nueva identidad |
| sesión de otro actor/run | 409 `SESSION_CONTEXT_MISMATCH` | Ninguno |
| sesión vencida en nuevo intento/renew | 409 `SESSION_EXPIRED` | Ninguno; nueva entrada, nunca reset del resultado previo |
| reportId ausente/otro actor | 404 `REPORT_NOT_FOUND` | Nunca seed/reporte previo fallback |
| fallo interno antes de publicar | 500 `LOCAL_FAILURE` | Ningún cambio parcial; cliente consulta identidad, nunca presume ausencia de commit solo por500 |

Error de módulo exacto `{runId:UUID,error:{code:string,fields:string[]}}`; sin `data`, payload,
identificadores personales o stack. Prioridad protocolaria: estructura → run → actor →
identidad/conflicto → elección catálogo → perfil/sesión nueva. No es precedencia académica.
JSON inválido rechazado por parser conserva HTTP400/envelope framework, que UI trata como
fallo protocolario, no Outcome; no modificar errores de otras rutas. GET/método no registrados404.

Context expone capacity/occupied para checks synthetic y evaluación propia, sin adoptar
panel de vacantes actualizadas ni polling. La aceptación usa ocupación al procesar, no
lo mostrado por una lectura anterior. Todo Outcome rejected académico definitivo (incluidos
cruce sin cupo lleno, prerrequisito, crédito, pertenencia y cupo) muestra causas, luego retorna
a `/local/matricula-regular` con elección vacía, sin reenviar; cerrar/Escape ejecuta ese retorno.
L-06 es política local, no generalización SUM. Configuration-pending conserva su contexto/gaps;
HTTP protocolario no vacía elección por esta política. Transporte incierto conserva identidad
recuperable; no lo trata como rejected. Diferente elección tras rechazo requiere nueva UUID.

## Reporte y aceptación

`EnrollmentReport` exacto: `{enrollmentId:UUID,requestId:UUID,actorId:ID,scope:Scope,
profileRevision:string,acceptedAt:ISO,windowOrigin:enum,rows:ReportRow[],totalCredits:number}`;
`ReportRow={courseId:ID,sectionId:ID,planId:ID,name:string,credits:number,schedule:Meeting[]}`.
Rows exactamente cursos aceptados ordenados por courseId; total suma de créditos, sin repetir
por horario. Reporte inmutable durante run, creado al commit, no visado activador. Prematrícula
es documento distinto, CSV local de rows no afirma PDF oficial.

AC-27 causas como conjunto + efectos cero; AC-28 pendiente horario sin write; AC-29 origin
synthetic observable; AC-30 exactamente1/1 y ocupación+1; AC-31 GET recupera mismo accepted/report
sin write; AC-32 replay accepted/rejected/concurrente sin efectos extra y conflicto distinto
payload; AC-33 unknown antes de procesamiento sin reporte ni registro. Además AC-20 precondición,
AC-21 todo-o-nada, AC-24 reinicio tras cupo, AC-17–19 correspondencia y aislamiento SC-004.
Ver [quickstart](../../../../specs/001-matricula-regular-fisi/quickstart.md) para escenarios futuros.
Ningún criterio ejecutado, contrato implementado o paridad SUM acreditada por este diseño.


## MR-CONTRACT-3 (2026-10-14): campos de presentación opcionales

Fuente: V-02, V-04, V-05 y V-08 ([structure.md](../../../../evidence/sum/matricula-regular/structure.md)).
Revisión aditiva: todos los campos son **opcionales**. Si no están, el productor no los aporta y la UI
muestra `--`, el `sectionId` o `-- --, --`. Los validadores rechazan valores malformados y siguen
rechazando claves no declaradas.

| Objeto | Campo | Tipo | Regla |
| --- | --- | --- | --- |
| Section | `label` | string no vacío | Número de sección mostrado («1»). |
| Section | `teacher` | string no vacío \| null | `APELLIDOS, NOMBRES`; null = sin docente asignado. |
| Section | `room` | string no vacío \| null | null se muestra «-». |
| OfferedCourse | `cycle` | entero 1–14 \| null | Ciclo del plan. |
| OfferedCourse | `courseType` | `'mandatory'` \| `'elective'` \| null | «O - Obligatorio» / «E - Electivo» (la segunda etiqueta es inferida). |
| Context | `retakeCourseIds` | IDs SYN ordenados y únicos, presentes en `offer` | Asignaturas ofertadas con una o más desaprobaciones (fila «(*)»). |
| Context | `creditCap` | entero 1–60 \| null | «Tope de créditos»; FISI 2026-II = 26 (F1 art. 13.p, RN-01). |
| ReportRow | `cycle`, `label`, `teacher` | como arriba | Copiados de la oferta al aceptar. |

El backend los rellena con datos sintéticos (L-13). Un `historyKnown` falso produce `retakeCourseIds: []`.
