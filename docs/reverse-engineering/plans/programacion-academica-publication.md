# E1: aprobación/publicación simuladas

Principal,2026-11-04; schedule-pt1. Requisitos usuario local-only. Complejidad/impacto
altos por integridad; incertidumbre delimitada. Conservar diseño/interacción SUM,
solo pantalla administrativa existente autorizada, reutilizar sin rediseño. No E2/E3,
datos privados/PDF, matrícula, dependencias, Docker, migraciones, commits/push.

## Decisión: un registro atómico, no otro mecanismo

Mantener SavedDraftStore JSON/checksum/cola/CAS/volumen/schema1. Campos opcionales
approval/publication/origin, sin migrar archivos anteriores. El mismo archivo pasa
de ready-for-approval a approved y published. Aprobado congela contenido y revisión;
publicar solo añade metadata en UNA escritura atómica. No índice mutable, snapshots
paralelos o segundo store. Vigente es mayor publicationVersion entre publicados del
único ámbito demo Sistemas/2027-I. Lista/historial derivado bajo la misma cola.
Si un archivo corrupto impide determinar vigente, rechazar lectura/publicación409;
no caer silenciosamente a una versión anterior. Límite previo50 archivos/2MiB.

Approval {sourceVersion,approvedVersion,approvedAt,fingerprint SHA256}. sourceVersion
es archivo listo para aprobación, approvedVersion=source+1. fingerprint canónico de
{title,configuration,demandBase,proposal,review} (sin version/estado/metadata): snapshot
exacto congelado. State approved exige draft.version=approvedVersion; published exige
draft.version=approvedVersion+1 y publication {publicationVersion,publishedAt}.
Servidor revalida payload/retained/cobertura, roster/huellas y todas conformidades
actuales SIN confiar en state recibido. Para reviewMatchesSnapshot en estados locked,
validar metadata y presentar copia normalizada state ready-for-approval a helper.
No tocar generador ni helper de revisión si basta normalizar en isValidPayload.

Save/submit/decide rechazados409 DRAFT_LOCKED en approved/published. Resume devuelve
snapshot congelado sin crear RAM nueva ni regenerar; cliente modo lectura bloquea
configuración/editor/guardar/respuestas. RAM antigua podría editarse como simulación
independiente pero no guardar sobre congelado: captura durable es clon confiable.
Sin revocación/reapertura; para cambios crear borrador independiente desde approved
o published (evita callejón sin salida antes de publicar). Nuevo UUID/version1,
state draft, configuración y base copiadas, horarios recuperados a RAM con autoridad
existente; review/approval/publication vacíos. origin {draftId,version,publicationVersion
o null}. Guardados siguientes preservan origin, nunca aceptarlo del cliente.

## Contrato fijado (shared tipos/runtime ya definidos)

Mismo prefijo /local/programacion-academica/v1; frontend /api.
- GET borradores/:id/vista-previa → AcademicReleasePreview {id,version,title,state,schedule}.
  Solo snapshot completo no vacío; incompleto422 con mensaje claro.
- POST borradores/:id/aprobar {expectedVersion} → {draft:AcademicSavedDraft}.
- POST borradores/:id/publicar {expectedVersion,expectedCurrentId:null|UUID} → {draft}.
  expectedCurrentId debe igualar vigente actual, aún si versión origen correcta;
  así publicación concurrente no sustituye vigente inesperadamente. Asignar número
  max+1 bajo cola, escribir un solo archivo. Repetición/stale409, no doble publicación.
- POST borradores/:id/nuevo-borrador {expectedVersion} → {draft} con sesión nueva.
  Solo approved/published, respetar cuota/UUIDcolisión/IO; no escribir origen.
- GET publicaciones → AcademicPublicationList {currentId,items:[summary]}.
- GET publicaciones/vigente → AcademicPublication;404 si no existe.
- GET publicaciones/:id → AcademicPublication inmutable,404 si no publicada.

AcademicScheduleSnapshot {schoolId,academicPeriod,courses:[{courseId,name,cycle,credits}],
sections:AcademicProposal.sections,assignments:AcademicProposal.assignments}.
Solo cursos con secciones efectivas, ciclo1–10 y créditos del catálogo autorizado.
Tipo/duración componentes vienen de asignaciones, no créditos. Reusar validadores
del horario, no crear otra lógica. Datos consultables no incluyen recursos privados,
observaciones, demanda estudiantil, leases, estudiantes o autoridad interna.
AcademicPublication {revision:'PA-PUBLICATION-1',id,publicationVersion,title,
sourceProposalVersion,approvedVersion,approvedAt,publishedAt,schedule}. Summary omite
revision/schedule. GET :id permanece igual aun tras otra publicación; currentId solo
vive en lista/vigente, no modificar publicaciones anteriores para marcarlas históricas.
Preparado para futuro E2 mediante (id,publicationVersion), sin implementar consumidor.

JSON exacto + controles locales/origin/featureflag existentes; HTTP200 éxitos,
400 inválido,404 ausente,409 versiones/locked/corrupción/vigente cambió,
422 no completo/no conforme/no aprobado,429 cuota,503 IO. Errores conservan archivo.
Lista conservadora no oculta corrupción; duplicados de número son corrupción409.

## UI mínima

Panel details compacto Aprobación y publicación simuladas. Preview bajo demanda
mediante endpoint confiable, una tabla agrupada reutiliza aggregateAcademicBlocks
adaptando snapshot a view solo presentación o helpercompatible; no reimplementar
algoritmo. Mostrar escuela/periodo/versión/estado y aviso sin autenticación/oficialidad.
Preview se exige antes de aprobar/publicar, se invalida al editar/cambiar versión;
botones separados y confirmación explícita. Acciones solo trabajo guardado limpio;
respuesta actualiza metadata/version/state, no sustituye RAM por lease viejo.
Configuración y edición bloqueadas en approved/published; consulta/revisión lectura
conservada. Acción Nuevo borrador carga copia con nueva sesión y limpia revisiones.

Lista compacta publicaciones con Vigente/Anterior, fecha/versión; seleccionar una
muestra MISMA previewtabla en solo lectura, sin duplicar resultados/calendar. Siempre
visibles código/nombre/ciclo/sección/docente/ambiente/día/horario/componentes/capacidad.
Selector de acceso rol simulado ya existente, no otro portal ni auth ficticia.
Manejar race de lista/preview/acción con id/version/token; una respuesta antigua no
puede pisar trabajo más nuevo. Bloquearedición mientrasacción o preservar ediciones
si se permite; bloqueo temporal de fieldset compatible suele más sencillo.

## Asignación y pruebas

Principal plan/shared/tests/contrato/aceptación Docker-browser. Backend worker LunaHigh:
saved-draft.service.ts, nuevo academic-release.ts helper si útil, demo.controller.ts,
nuevo backend/test/programacion-academica-publication.spec.ts. NO store salvo justificar
necesidad ni generator/client/shared. Frontend worker LunaHigh: AcademicScheduling.tsx/
.css, nuevo AcademicPublicationPanel.tsx/.css, data/academicScheduling.ts/.test.ts,
nuevo scripts/verify-academic-publication.mjs. Contrato fijo y archivos disjuntos;
sin subdelegar. Leer AGENTS/skills propios. CodeGraph no init sin exclusiones de
.pnpm-store/symlinks privados/externos; TOML ausente fallback real gpt-6-luna/high.

Backend: rechazo incomplete/observaciones/outdated, approval válida+huella+versión,
publicación solo aprobada, CASfile y CAScurrent, bloqueo save/review, fork sinmutar,
segunda publicación conserva primera y cambia vigente, reinicio servicio, legacy,
corrupción y fallo IO atómico. Frontendbuild/lint/data. Browser secuencial principal
propio5280 (nooperador5180): generar→guardar→review conform→preview→approve→preview→publish,
consultarpublicado→nuevo borrador→editar guardar y probar que publicado igual; crear
segunda publicación y comprobar vigente/antigua; cierre/reinicio/recover ambas. Scripts
dosfases save/resume, checkpointsynthetic only; no producción/private. Regresión ERP
manual y matrículaidempotente. No afirmar integración por mocks/build solamente.

## Cierre y recuperación tras interrupción —2026-11-04

Backend y frontend implementados por los workers asignados; continuación principal
conservó el trabajo, confirmó rama/diff e hizo solo aceptación y documentación.
Backend346/346, cliente201/201, shared21/21, Nodecore203/203 (mismos casos de Vitest),
Composeconfig2/2, builds/tipos/lints pasaron;4 avisos previos backend. Una corrida
backend durante compilaciones Docker paralelas dio345/346 por timeout5s; repetición
completa sin esa concurrencia346/346, sin cambiar prueba/código/límites.

Docker/browser real5280: guardar/conformar/preview/aprobar/preview/publicar; crear
otro borrador/guardar/revisar/publicar y comprobar anterior inmutable. Cerrar browser,
restart backend y recuperar ambas versiones/crear borrador: pasó. También ERP180 y
matrícula idempotente, oferta intacta. SHA25610 archivos de núcleo sin cambios.

Informe con archivo→criterio→resultado:
evidence/local/programacion-academica-publication/fullstack-verification.md.
Límites: solo simulación, una instancia,50 registros compartidos; una sesión RAM de
fork cuyo write falla puede persistir hasta15min, sin clon durable. Sin nuevas deps,
Docker/migraciones, E2/E3, commits/push o inspección privada. Lectura futura E2 lista,
no consumidor E2 implementado ni integración con matrícula.
