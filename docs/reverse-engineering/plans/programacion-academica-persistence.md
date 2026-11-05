# E1 · propuestas locales durables

2026-11-04. Principal: diseño/contrato/aceptación. Fuente: requerimiento explícito
local-only. Complejidad/impacto medios (integridad/concurrencia), no reglas nuevas
de matrícula. Preservar fidelidad visual/interacción SUM: solo ampliar pantalla
administrativa compactamente. Reutilizar contratos/estado/validadores existentes.
No E2/E3/aprobación/publicación, dependencias, DB o datos privados.

## Arquitectura elegida

Un archivo por borrador UUID, JSON versionado con SHA256 de integridad, en directorio
configurado por SUM_ACADEMIC_DRAFT_DIR. Volumen Docker nombrado academic-drafts,
montado solo en backend en /app/backend/var/academic-drafts, creado con propietario
node. Cambios mínimos al Dockerfile/backend y compose local; público sin volumen ni
variable. Ausente variable: operaciones de persistencia503, resto E1 funciona.
Tests usan exclusivamente mkdtemp sintético, nunca directorios del operador.

MVP una instancia backend/escritor: cola de escrituras, lectura de versión dentro
de operación serial, temporal exclusivo mismo directorio, sync/cierre y rename
atómico. No prometer coordinación entre réplicas ni protección ante manipulación
del disco por administrador. Checksum detecta corrupción accidental; permisos y
validación del modelo evitan confiar ciegamente en archivos. UUID estricto, rutas
derivadas solo del servidor, rechazar symlinks/archivos no regulares y tamaño>2MiB,
máximo50propuestas. Temporales ignorados; no sobreescribir archivos corruptos.
Listado devuelve válidos y unavailableCount de archivos de propuesta inválidos,
visible en UI, sin borrar ni silenciar errores. Sin borrado/backup/exportación MVP.
Volumen sobrevive restart/recreate/down-up sin -v; no a eliminación del volumen.

Al guardar: solo acepta configuration y referencia a propuesta confiable del
servidor, jamás assignments/input/authority del cliente. Estimación base se obtiene
de nuevo de demandBaseRequest validada, no una cifra aportada por el cliente.
Conservar request original completo (incluye recursos no seleccionados/qualification
map), recursos autorizados filtrados para generador, input, requirements derivables,
automaticView y view ajustada. Capturar clones; reconstruir CoverageAuthority al
leer, validar modelo actual, catálogo/fingerprint y equivalencia de configuración
con snapshot (input Y nombres/kind de recursos). Fuentes/datos solo sintéticos.
No volver a ejecutar búsqueda al recuperar. Rechazar horarios incoherentes con
configuración y no declarar lista una propuesta parcial/vacía/inválida.

Identificador estable es borrador.id; cada sesión temporal de generación tiene
proposalId interno. Al continuar, nuevo proposalId/lease15min en RAM evita pisar
ediciones no guardadas de otra pestaña; conserva horarios/ajustes y borrador.id.
Guardar exige proposalEditVersion vigente; si resultado RAM expiró, no aceptar una
copia del cliente como autoridad:404 explicativo. Guardar periódicamente antes de
la caducidad temporal y recuperar renueva lease. Los archivos guardados no caducan.
Mismo límite RAM20 de propuesta existente, sin alterar generador.

## Contrato aditivo fijo

Tipos compartidos nuevos (mantener PA-DEMO-1):
AcademicWorkspace `{schoolId:'SISTEMAS',academicPeriod:'2027-I',request:AcademicRequest,demandSourceId:AcademicDemandSourceId,demandBaseRequest:AcademicDemandRequest|null}`.
request.resources obligatorio para guardar toda la configuración. Campos demanda/
capacidad numéricos válidos; no persistir formularios inválidos. courses vacíos
permitidos para guardar recursos; patrones/modos se normalizan con catálogo vigente.
Si demandBaseRequest no nulo, fuente/periodo/cursos/capacidades deben coincidir con
workspace actual. No sustituir demanda final por base.

AcademicDraftSaveRequest exacto
`{id:string|null,expectedVersion:number|null,title:string,state:'draft'|'ready-for-review',configuration:AcademicWorkspace,proposalId:string|null,proposalEditVersion:number|null}`.
Nuevo: id/version null; actualización: UUID y versión>=1; proposalId/editVersion
ambos nulos o ambos presentes(entero>=0). title1–100 sin extremos en blanco.
AcademicSavedDraft exacto
`{id,version,title,state,createdAt,updatedAt,configuration,demandBase:AcademicDemandEstimate|null,proposal:AcademicProposal|null}`.
AcademicDraftList `{items:[{id,version,title,state,schoolId,academicPeriod,createdAt,updatedAt,hasSchedule:boolean}],unavailableCount:number}`.
AcademicDraftResume `{draft:AcademicSavedDraft}`. Shared valida forma y relaciones
metadata/scope/cursos/base, API/servicio valida relaciones semánticas completas.

GET `/borradores`: sin query/body, devuelve lista compacta, orden updatedAt desc/id,
no autoridad ni recursos completos. POST `/borradores/guardar`: save request,
devuelve SavedDraft; create201? Mantener HTTP200 para ambos. POST
`/borradores/:id/continuar` JSONexacto `{expectedVersion}` >=1: devuelve Resume.
Misma barrera local/acceso/origen/JSON que E1; idUUID y query estrictos.400 forma;
404 ausente/lease expirado;409 versión/catálogo incompatibles o archivo corrupto;
422 configuración no corresponde a horarios o ready sin cobertura válida;
503 persistencia no configurada/error de IO sin filtrar paths/trazas;429 límite50.
Error envelope existente. Mis propuestas es local compartido, sin autenticar usuario.

Snapshot durable interno `{schemaVersion:1,catalogFingerprint,document,retained:null|{request,input,resources,automaticView,view}}`, dentro envelope con checksum. Nunca exponer
retained al cliente. Revalidar catálogo, shape de input mediante prepareGeneratorInput,
secciones y recursos originales, asignaciones con validador/cobertura/política;
para parcial solo tolerar MISSING_SESSION. requirements se regeneran de input.
ready exige complete+coverageComplete y alguna asignación. Base se verifica contra
fuente sintética vigente al leer; incompatibilidad no causa migración automática.

## UX / alcance

Barra compacta nombre, estado, Guardar propuesta, Mis propuestas. Lista expandible
con nombre/escuela/periodo/estado/fecha y Continuar edición. Confirmar antes de
descartar cambios locales al abrir otra; no confirmaciones por archivo. Versiones
obsoletas muestran conflicto y mantienen edición, sin reintento que pise cambios.
Restaurar selectedCourses/demandas/capacidades/patrones/modos/resources/policy/source/
base y resultado ajustado. Invalidar respuestas antiguas de generación/estimación/
save/load con tokens; no adoptar resultado de guardado viejo sobre edición nueva.
Cambio demanda/recursos conserva borrador.id/version pero vacía resultado y baja
estado ready a draft; no mostrar horario viejo válido. Guardar después de invalidar
persiste configuración con proposal:null. Ajuste manual válido conserva cobertura;
marcar trabajo sucio hasta guardar. Sin autosave ni almacenamiento de alumnos.

## Asignación y pruebas

Principal: shared contrato/validadores/tests, Dockerfile/compose/testconfig,
documentos y aceptación Docker/browser. Backend worker LunaHigh: solamente
backend/src/programacion-academica/saved-*.ts, demo-proposal.service.ts,
demo.controller.ts, backend/test/programacion-academica-persistence*.spec.ts;
puede extender servicio con export/import de snapshots confiables, no tocar core.
Frontend worker LunaHigh: AcademicScheduling.tsx/.css, nuevo AcademicSavedProposals
si útil, academicScheduling.ts/.test.ts, nuevo verify-academic-persistence.mjs.
No tocar shared/backend ni scripts previos. Browser secuencial principal.
Leer AGENTS/skills propios, sin subdelegar; CodeGraph no inicializar sin salvaguardas.
Fallback real gpt-6-luna/high si falta TOML.

Checks backend: create/list/resume/update con tmpdir, nuevo servicio/repository como
reinicio sin memoria, mismoid/version incremental, conflicto concurrente y leases,
corrupt/checksum/schema/fingerprint/symlink/path/size/50límites, fallo de IO sin
sobrescritura, autoridad/noPII, ready/parcial/staleconfig, mantener ajustes4/6h y
revalidar tras restore; bases/finales distintas. Frontendbuild/lint/data; browser
guardarconfig y horario ajustado, nueva sesión navegador recupera todo, cambio
demanda invalida horario, rechazo escritura vieja, listarevisión, regeneración.
Principal reinicia/recrea SOLO backend propio sum-academic-acceptance5280 y verifica
recuperación desde volumen sin RAM y regresión matrícula. No tocar5180 operador.

## Cierre de implementación —2026-11-04

Implementado el alcance mínimo, sin cambiar generador ni matrícula. Store JSON
versionado en volumen local, revalidación semántica y autoridad del servidor,
barra compacta para guardar/listar/continuar, conflicto409 y retiro del resultado
al cambiar entradas. Se conservaron los cambios previos sin commit.

Aceptación: backend330/330 (incluye11 persistencia y51 regresión matrícula),
cliente199/199, shared14/14, configuración Compose2/2; builds/tipos/lints sin errores.
Lint backend conserva4 advertencias anteriores ajenas al módulo. Browser real:
guardar horario ajustado, cerrar navegador, reiniciar backend Docker y recuperar
en nuevo navegador; luego invalidar por cambio de demanda y actualizar mismoID.
Pasaron además revisión manual ERP180 y matrícula idempotente.

Detalle reproducible y limitaciones:
`evidence/local/programacion-academica-persistence/fullstack-verification.md`.
No se probó fallo físico de disco ni se implementaron respaldo, múltiples escritores,
autenticación, aprobación, publicación o E2/E3. Sin commits/push ni instalaciones.
