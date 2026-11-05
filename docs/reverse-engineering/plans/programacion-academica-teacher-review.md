# E1: revisión docente sintética

Principal,2026-11-04. Fuente: requisitos explícitos del usuario, local-only. Rama
schedule-pt1. Complejidad alta/impacto integridad alto/incertidumbre acotada.
Preservar fidelidad visual/interacción de SUM: solo autorizada pantalla administrativa
existente /local/programacion-academica, sin rediseñar ni tocar estudiante/matrícula.
Reutilizar persistencia JSON schema1, CAS, checksum, validación, catálogo autorizado,
editor de bloques y generador SIN cambios. No datos privados/PDF/dependencias.

## Contrato fijado

Extensión compatible opcional `AcademicSavedDraft.review`; archivos anteriores sin
review siguen válidos, no migración. Estados anteriores draft/ready-for-review siguen
admitidos para compatibilidad; nuevos in-review/ready-for-approval derivados SOLO
servidor, nunca seleccionados libremente en SaveRequest. Guardar desde nuevo estado
envía draft; backend conserva/calcula estado por revisión. UI muestra los tres estados
solicitados y etiqueta anterior como «Lista para revisión» solo en trabajos antiguos.

Tipos/runtime exactos en shared/programacion-academica-api.mjs y .d.mts:
Review round/submittedVersion/submittedAt/teachers/history; docentes con huella SHA256,
status pending/conformity/changes-requested/outdated, observation,decisionVersion y fecha.
Historia eventos submitted/decision/invalidated con versión, ronda, docente, huella,
observación, decisión y fecha. Máximo200 eventos, rechazo429 sin truncar/perder historia.

POST /local/programacion-academica/v1/borradores/:id/revision/enviar
body {expectedVersion}; POST .../:id/revision/responder body
{expectedVersion,round,teacherId,decision:'conformity'|'changes-requested',observation}.
HTTP200 {draft:AcademicSavedDraft}; NO nueva sesión RAM al responder/enviar. Ambos
usan barreras locales/JSON/origin existentes y cola/store del SavedDraftService.
400 malformed,404 missing,409 stale version/round/corrupt,422 incomplete/not submitted/
teacher not assigned/outdated needs resubmit,429 history bound,503 storage failure.
Respuestas incrementan versión de archivo; conflicto conserva edición. Misma revisión
está en cada snapshot JSON, checksum+semántica al guardar/recuperar. Cliente no envía
review ni asignaciones. No auth; selector explícito Escuela/Docente simulado no permiso.

## Huellas y estados

Fingerprint por docente con payload canónico ordenado de TODAS sus asignaciones
(curso/sección/tipo/día/inicio/fin/ambiente), secciones/capacidad y recursos relevantes
(docente/carga/habilitación/disponibilidad/preferencia y ambientes usados), escuela y
periodo. Excluir IDs/fechas/versiones RAM; recuperar no invalida. Cambiar otro docente
no invalida a este. Cambiar demanda/capacidad/patrón/recursos primero retira resultado
en UI; al guardar sin resultado estado draft y teachers vacío, eventos conservados.
Guardar horario modificado sincroniza roster: afectados outdated, nuevos pending,
retirados desaparecen del roster pero conservan historia. Agregar invalidated también
para retirados. Conformidades de no afectados permanecen con versión original.

Enviar exige horario completo no vacío VALIDADO desde snapshot guardado; incrementa
ronda y crea evento, convierte pendientes/observaciones/outdated en pending; conserva
conformity solo si huella igual. Responder solo docente actual pendiente/observado/
conforme de ronda vigente (no outdated); observación obligatoria al pedir cambios,
opcional al conformar, máximo1000 caracteres. Un docente responde por TODO su horario.
Decisiones pueden actualizarse y quedan históricas. Estado listo para aprobación solo
si completo/no vacío y TODOS docentes actuales conformity con huellas vigentes.
La escuela no «resuelve» una observación marcándola: ajusta editor, guarda y reenvía;
el docente vuelve a responder. Reenvío sin ajuste permitido, historial lo hace visible.
No representa aprobación ni publicación institucional.

## UI mínima y concurrencia

Una sección desplegable compacta junto a guardado/resultados. Rol simulado selector,
un docente selector, resumen pendientes/observados/desactualizados/conformes, tabla
agrupada con aggregateAcademicBlocks, un textarea y dos botones en modo docente;
Escuela: Enviar a revisión, selector consulta observaciones y referencia Editar horario
en tabla existente. Historial details limitado por backend200. Sin portal nuevo.
Acciones revisión bloqueadas con cambios sin guardar; siempre guardar primero.
Después de enviar/responder actualizar SOLO metadata id/version/state/review,
no sustituir runtime proposal (podría tener lease antiguo). No perder ediciones
escritas mientras espera; token/version/workspaceMutation y busy adecuados.
Al cambiar horario/configuración local mostrar revisión guardada como desactualizada
hasta guardar; no mostrar lista para aprobación del trabajo local sucio.

## Asignación disjunta y aceptación

Principal shared+tests, plan/contrato, Docker/browser/evidencia. Worker backend LunaHigh:
saved-draft.service.ts, nuevo teacher-review.ts si útil, demo.controller.ts, nuevo
test/programacion-academica-teacher-review.spec.ts; NO core/client/shared. Worker
frontend LunaHigh: AcademicScheduling.tsx/.css, AcademicTeacherReview.tsx/.css si útil,
data/academicScheduling.ts/.test.ts, nuevo verify-academic-teacher-review.mjs. No tocar
otros archivos ni subdelegar. Leer AGENTS/skills carpeta, no CodeGraph init hasta
exclusiones seguras (actual config no .pnpm-store/ni symlinks fuera); no indexar privado.
TOML perfil ausente: fallback real gpt-6-luna/high con fork none.

Backend pruebas: conformidad total→ready; observación obligatoria→in-review; ajuste
afecta solo docentes cambiados; reenvío nueva ronda; stale version/round; rechazo
ready falsificado; corrupción semántica; recuperación con servicio nuevo; compatibilidad
guardados antiguos; IO preservaarchivo. Build/lint/tipos. Cliente build/lint/data y
browser principal real: guardar/enviar, docente observa, escuela ajusta editor/guarda,
reenvía, conforma, cerrar navegador/reiniciar backend propio5280/recuperar historia y
estado. Regresión ERP manual y matrícula oferta intacta. No tocar servicio operador5180.

## Cierre2026-11-04

Implementado y aceptado localmente. Backend336/336, cliente200/200, shared17/17,
Node core203/203 (reutilizados en Vitest), Composeconfig2/2; build/lint/tipos pasaron.
Se conservan4 avisos previos de lint backend. Dos fases browser reales con cierre
y reinicio de backend: observación→ajuste→nueva ronda→conformidad→recuperación,
pasaron. ERP180 y matrícula idempotente también. Núcleo10 hashes sin cambios.

Se hizo corrección aislada diagnosticada por principal para retorno A→B→A en misma
ronda; huella actual puede coincidir con una previa invalidada y aun requerir nueva
revisión. Evento conserva hash anterior y decisión más reciente; regresión6/6.
Frontend tuvo fixture de test incompleto corregido antes de200/200. Principal añadió
aserción de observación escolar y captura recuperación al script; sin cambio de UI.
No tests finales fallidos ni bloqueo de integración. Evidencia:
`evidence/local/programacion-academica-teacher-review/fullstack-verification.md`.
Sin autenticación, aprobación/publicación, E2/E3, nuevas dependencias o cambios Docker.
