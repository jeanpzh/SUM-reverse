# E2-LOCAL-1 — borrador de prematrícula

Contrato/decisión local sintética2026-11-04. Shared prematricula-api.mjs y .d.mts
definen campos/runtime exactos. Plan ../../plans/prematricula-e2-draft.md. Prefijo
/api/local/prematricula/v1. Solo dos estudiantes Sistemas, escenario regular local.

POST contexto {identity} → E2Context. POST publicacion {identity,publicationId} →
{actorId,academicRevision,publication:PA-PUBLICATION-1,eligibility}. POST validar
{identity,publicationId,publicationVersion,selection} → E2Validation. POST guardar
añade {id,expectedVersion,expectedAcademicRevision} → {draft,validation}.
Éxitos200;400 estructura/IDsselección,401 sesión,403 ownership/escenario/modo,
404 publicación,409 versiones/corrupción/revisión académica,503 almacenamiento.

Un borrador por propietario estable/ámbito; rawpublication/sectionIDs se conservan.
No runId/sessionId persistidos como identidad. Selección vacía y errores académicos
se guardan con diagnóstico; no es intención registrada o matrícula. No vacantes,
ocupaciones, turnos, mínimo12/máximo26 ni validaciones administrativas inventadas.
No se acepta historial, créditos calculados o autoridad de validación del cliente.

Publicaciones válidas anteriores siguen consultables, no migración automática al
cambiar vigente. Namespace E2 en e2-prematricula del volumen existente; no mezclar
archivos con registro E1. Reutiliza atomic/checksum/CAS y servicios fuente, no endpoints
de ejecución de matrícula. MatriculaRegular wire y reglas permanecen intactos.
