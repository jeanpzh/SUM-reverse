# E2-INTENT-1 / E2-DEMAND-1

Decisión local sintética del 2026-11-04. Autoridad de campos y validación runtime:
`shared/prematricula-intention.mjs` y `.d.mts`, extensión compatible con E2-LOCAL-1.
Plan: ../../plans/prematricula-e2-intention.md. No reglas institucionales nuevas.

Tres POST JSON bajo /api/local/prematricula/v1, HTTP200:

| Ruta | Entrada | Salida |
| --- | --- | --- |
| /intencion/contexto | {identity} | E2IntentionContext, historial y validación propios |
| /intencion/registrar | {identity,draftId,expectedDraftVersion,expectedIntentionVersion,expectedAcademicRevision} | E2IntentionContext |
| /demanda | {publicationId,publicationVersion} | E2Demand, exclusivamente agregado |

Guardar borrador no registra intención. Registrar toma la selección guardada del
servidor y revalida; bloquea incumplimientos, información insuficiente y selección
vacía (422). CAS/hash/versiones erróneas409; propiedad/modo/escenario403; sesión401;
forma inválida400, documento/publicación ausente404, almacenamiento503. Error simple
{error:{code,message}}. En la demo no hay excepciones a verificaciones pendientes.

Último evento por propietario estable+fuente+escuela+plan+periodo; revisiones previas
se conservan pero no suman. Agregado por publicación exacta con estudiantes únicos;
solo últimas intenciones actualmente válidas cuentan. registered=counted+excluded.
Un cambio de publicación requiere registro explícito; no migración al cambiar vigente.
No IDs de alumno, nombres o historial en respuesta escolar. Población máxima2 de
escenario regular, jamás perfiles120 del estimador.

Persistencia opcional intention dentro del mismo payload E2, sin migración, mismo
namespace/cola/atomicidad/checksum. Historial máximo100; borradores previos compatibles.
Solo modo local autorizado, guardas existentes y roles simulados; no autenticación
institucional, E3, reservas ni modificaciones a E1. Nuevo borrador E1 por fork existente
es explícito y no copia conteos automáticamente a la demanda final.
