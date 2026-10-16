# Modelo local: matrícula regular sintética

**Revisión:** `MR-MODEL-2`, 2026-10-11. Diseño, no implementación.
**Autoridad HTTP:** [MR-CONTRACT-2](../../docs/reverse-engineering/contracts/local-api/matricula-regular.md).
Entidades/mecanismos `local-only`; L-01–L-06 y testimonios no describen arquitectura SUM.

## Entidades y relaciones

| Entidad | Identidad / campos persistidos en memoria | Relaciones / invariantes |
| --- | --- | --- |
| Run | `runId` UUID; catálogo, perfiles, actors, sessions, requests, enrollments, reports | Un proceso/una instancia singleton; nuevo run tras arranque/reset; no inputs/datos privados |
| Perfil | `profileRevision`; scope de contrato, fuentes, calendario publicado y ventanas efectivas, reglas/estado de conocimiento | Una revisión inmutable por actor/run; lookup exacto, no fallback facultad/periodo/plan |
| Actor sintético | `actorId`; scope/profileRevision, nombre de demostración, PP acumulado number>=0 o null, historial y condiciones abajo | Catálogo exhaustivo; no cuenta/auth SUM. Snapshot wire/flags legacy no alimentan permisos |
| CourseDocument | `courseId,planId,name,credits` | Pendiente de plan/prematrícula; no equivale a oferta ni matrícula |
| Oferta | Course con prerequisites/sections; cada section tiene capacity/occupied/schedule | SectionId global único dentro run; pertenencia course exacta; occupied<=capacity; sin reservas |
| Sesión demo | `sessionId,actorId,runId,startedAt,expiresAt` | 15min, reloj servidor; renovación solo explícita de recarga vigente. No tokens/cookies/security nueva |
| Elección | Choice[] del cliente, canónica en solicitud | No ocupa plazas ni es borrador persistido académico; ninguna descarga habilita matrícula |
| Solicitud | clave `(runId,actorId,requestId)`, payload canónico, Outcome | Inmutable tras publicación; accepted/rejected/pending; replay no reevalúa ni consume |
| Matrícula | enrollmentId, requestId, actor/scope/revisión, acceptedAt y Choice[] | Solo accepted; exactamente una por actor/scope/run en esta rebanada; selección completa |
| Reporte | EnrollmentReport del contrato | Uno por matrícula; cursos/créditos/horarios copiados al commit; no seed, previos no eliminados por rechazo |

Todas las colecciones del catálogo son copias independientes sintéticas. Ninguna factory
lee `datos-reales/`, snapshots, archivos externos/caches o red. Profile revision tiene
prefijo `MR-`; IDs course/section/plan/actor/ventana `SYN-`, sin códigos oficiales supuestos.

## Elegibilidad y rechazo local L-05/L-06

Seleccionables = course de prematrícula COMPLETA ∩ oferta aplicable del plan vigente.
`preEnrollmentComplete=false` o `offerKnown=false` → PLAN_OR_OFFER_UNKNOWN, sin opción
habilitada ni commit. Completa vacía es distinta: ninguna opción, documento vacío conocido.
Oferta puede conservar course del mismo plan no incluido en prematrícula completa: UI no
seleccionable; envío forzado de course/section conocidos evalúa y rechaza
COURSE_NOT_IN_PRE_ENROLLMENT. Otro plan causa PLAN_MISMATCH, sin duplicar pertenencia para
ese course. Catálogo inexistente es protocolo404, no causa académica. Prerrequisitos/cruces
no cambian opciones por validación inmediata. Nuevos campos completos de Context constan
solo en MR-CONTRACT-2; modelo interno reutiliza flags anteriores.

Todo rejected académico definitivo lleva UI a registro con elección vacía. Repetir el mismo
intento rejected conserva resultado; nueva elección necesita nueva identidad. Protocolo y
pending no ejecutan esa transición, unknown conserva identidad recuperable. Retorno SUM sigue
no observado para otras causas; esta política es propia. Cerrar un modal no revierte commit.

## Evaluador de acceso al contexto previo a US1

Foundation T007 crea UN evaluador en `backend/src/matricula-regular/windows.ts`, usando
perfil/factories T004, reloj T005 y tipos T006; T012 prueba su resultado real. Context.eligibility
significa acceso a entrada: perfil/scope aplicable, PP/ventana definidos, habilitación y
completitud de prematrícula/oferta y condiciones institucionales/contextuales aplicables
known. False/unmet conocido produce causa contextual; dato requerido unknown produce gap;
met/not-applicable conocidos no equivalen a comprobar una elección aún inexistente.
No evaluar créditos, cruces, prerrequisitos o cupos de selección desde Context vacío.
Outcome evalúa selección real/estado actual y conserva todas causas/gaps según contrato.
US1 T015 consume evaluador terminado; US2 T020 integra/reutiliza esa misma función, no
la crea tarde ni mantiene otra implementación/hardcode que fuerce eligible.
Perfil documental11–12 sin ventana efectiva sigue pending. Solo perfil synthetic
explícitamente seleccionado usa sus ventanas de prueba; unknownDates oficiales no se
sobrescriben ni se usan como permiso/fallback al perfil documental.

## Perfil de reglas y conocimiento

DTOs de entrada no reciben PP, cupos, permisos, historial, reloj ni fuentes desde cliente;
los consume servicio desde fixture de proceso. Entradas internas exactas del actor:

| Campo | Tipo / interpretación local |
| --- | --- |
| `preEnrollmentEnabled` | boolean o null: true/false conocido, null gap |
| `preEnrollment` | CourseDocument[]; `preEnrollmentComplete:boolean`; false gap, [] completo es vacío conocido |
| `planKnown`, `offerKnown`, `equivalencesKnown` | boolean; false requiere gap, jamás datos seed fallback |
| `approvedCourseIds` | IDs únicos; solo con historial conocido; no cálculo de notas inventado |
| `historyKnown` | boolean; false bloquea determinación de prerrequisitos/prioridad |
| `failedCourses` | `{courseId:ID,failures:entero0..4}` únicos; 4 representa rama normativa de separación, no cuarta matrícula |
| `creditException` | `{kind:'none'/'remaining-for-completion'/'return-after-suspension'/'plan-change-no-offer',applicability:'applicable'/'not-applicable'/'unknown',sourceIds:string[]}`; unknown gap. No procedimiento de autorización inferido |
| `institutional` | `{debt:'met'/'unmet'/'unknown',health:'met'/'unmet'/'unknown',eligibility:'met'/'unmet'/'unknown'}`; facts synthetic, sin datos monetarios/médicos ni consultas externas |
| `tutorship` | por course `{courseId,condition:'met'/'unmet'/'unknown'}`; estado de requisito sintético, no tramitación/alta administrativa |
| `fourthAttemptAuthorization` | por course `{courseId,condition:'met'/'unmet'/'unknown'}`; para rama 3 desaprobaciones sin oferta, conocida permite máximo12; unknown gap |
| `ponderado` | number finito>=0 o null; sin redondeo local; comparación exacta contra mínimo. Null pendiente, no0 |

Reglas de perfil `{ruleId,sourceIds,knowledge:'known'/'unknown'/'not-applicable'}`;
unknown produce Gap, not-applicable solo si contexto lo documenta explícitamente.
Cada regla enlaza F1/F2/F6/testimony/decisión synthetic correspondiente. Fuentes common
normativas separadas de override escuela/periodo. Datos reales de planes/equivalencias,
deuda/salud/autorizaciones faltantes conservan gap por caso, no aprueban ni inventan rechazo.

Lógica conocida: créditos sumados una vez por course; carga ordinaria12–26; excepciones
documentadas no rechazan solo por <12. Prerrequisito debe constar en aprobados o equivalencia
sintética conocida; desaprobado ofertado tiene prioridad y selección obligatoria en caso
aplicable. Dos desaprobaciones exige tutoría; tres con course ofertado solo esa asignatura
y tutoría, tres sin oferta máximo12 con autorización conocida. En estas ramas de cuarta
matrícula el perfil aplica la carga especial en lugar del mínimo ordinario12: curso único
ofertado o máximo12 autorizado, sin un CREDIT_LOAD_INVALID contradictorio solo por<12.
Cuatro desaprobaciones requiere condición institucional/resoluciones aplicables conocidas;
unknown queda pendiente, no se genera separación/resolución automática. Separación/suspensión
conocidas no elegibles. Casos con varias ramas especiales no resueltas institucionalmente
quedan pending, no composición universal inventada. Oferta/descripciones totalmente synthetic.

Cruce local: reuniones del mismo día con max(inicios)<min(finales), intervalos [inicio,fin);
se compara todo par de asignaturas elegidas, sin deshabilitar opción al clic. Horario null
gap; [] conocido no equivale a null. La UI no reserva ni recalcula disponibilidad por polling.

## Calendario y fixture de tiempo

Perfil documental `MR-FISI-2026-II-DOC-1`: preserva nueve filas F6, labels6/7 repetidos y
PPmax19 documental. Horas 11–12 ausentes, unknownDates explícitas; no ventana virtual13–14.
Derivación funcional local del lunes indicada en contrato: PP acumulado, >=min, acceso
posterior, PP>19; límites de reloj/fin exclusivo son diseño local, no F6 reescrito.

Perfil de pruebas `MR-SYN-SIS-1` o `MR-SYN-SOFT-1`: mismos scope escolares identificados
con plan `SYN-SIS-PLAN` / `SYN-SOFT-PLAN`, fuentes/offer creadas independientemente;
ventanas `SYN-WINDOW-1` de `2026-08-11T14:00:00.000Z` a `2026-08-11T16:00:00.000Z` y
`SYN-WINDOW-2` de `2026-08-12T14:00:00.000Z` a `2026-08-12T16:00:00.000Z`, ambas minPP0,
origin synthetic. Reloj test `2026-08-11T15:00:00.000Z` o `2026-08-12T15:00:00.000Z` según día;
cada instancia reinicia estado sin matrícula del día previo. AC-26 se prueba con PP0/16/17/20
por cada día y escuela, no con PP>19 del primer turno del lunes. No representa horario
oficial 11–12 ni sustituye perfil documental. Tests usan reloj controlado inyectado;
modo demo usa hora actual del servidor y puede estar fuera, sin habilitación silenciosa.

Seed de éxito/carrera: dos actores A/B de la misma escuela, PP17/18, prematrícula habilitada,
condiciones known met, plan/historial completo, sin failedCourses/excepción. Tres cursos
independientes `SYN-{SIS|SOFT}-C1..C3`, cada4 créditos, secciones `SYN-{SIS|SOFT}-S1..S3`,
sin prerrequisito; reuniones lunes08–09, martes08–09, miércoles08–09. Capacity C1=1, C2/C3=2;
occupied0. Ocupación total es base occupied del fixture más matrículas accepted del run;
no puede disminuir ni exceder capacity. Ambos seleccionan las mismas tres para última vacante: exactamente una aceptación,
y otro rechazado sin ocupar C2/C3. Este seed permite pruebas12 créditos sin depender de
catálogo real. Variante error cruza C1/C2 lunes08–09 y llena S1 con ocupación sintética
de control coherente (no matrícula del actor); causas conocidas exactamente conflict/full.

Variantes finitas obligatorias en [acceptance-catalog.md](acceptance-catalog.md), incluyendo
MAT01–10 y excepciones. Construidas por factory de tests: vacío, prematrícula false/null, carga11/26/27,
excepciones, prerrequisitos/plan, branches2/3/4 y gaps; no selector de escenario HTTP/producto.
Default del módulo: perfil documental, no ventana synthetic activada. Tests seleccionan
factory explícitamente al crear aplicación aislada; todo proceso verificado usa solo
esas factories/fixtures, incluidos shell/lecturas auxiliares.

## Estados, atomicidad y lifetime

Nueva solicitud válida entra a cola serial. Repetición existente devuelve mismo Outcome;
payload distinto rechaza protocolariamente. Nueva petición con sesión/profile vigentes
evalúa contexto actual completo: gaps→configuration-pending; sin gaps+causas→rejected;
sin ambos→accepted. DTO/session inválidos no crean Outcome. HTTP/timeouts no son estados
académicos. Resultado `unknown` es lectura sin resultado publicado, incluso si sigue en cola.

En accepted se publica una copia conjunta requests/enrollments/reports/occupied. Ante
fallo previo a publicación, estado intacto. Rejected/pending solo añade request Outcome.
GET siempre lee snapshot completo clonado. No I/O/await dentro del tramo check→publish;
invariantes capacidad/replay válidos en un proceso, no en un cluster.

Outcome/canonical payload/reporte duran todo el run aunque expire sesión; no TTL de
dedup. Rejected/pending no mutan posteriormente: revisión/configuración nueva requiere
requestId nuevo. Reinicio/reset elimina estado y cambia runId; consultas/replays viejos
RUN_CHANGED, sin aceptación/rechazo inferidos ni reenvío automático. La sesión demo dura15min,
no limita lifetime del resultado. sessionStorage conserva solo intento synthetic pendiente,
sin suplir persistencia backend ni recuperar registros de un run destruido.
