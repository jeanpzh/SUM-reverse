# E2: intención y demanda agregada — plan fijo

Principal, 2026-11-04, schedule-pt1. Fuente: requisito explícito del usuario,
local-only, sin evidencia institucional nueva. Complejidad/impacto altos por
historial, concurrencia y deduplicación; incertidumbre resuelta con política de demo.
Preservar fidelidad visual e interacciones SUM. Solo ampliar panel E2 y añadir un
resumen compacto en Escuela; no rediseñar pantallas ni modificar matrícula.
Reutilizar plan/contrato E2 previo, PA-PUBLICATION-1, publicación/fork E1 y store.
No privados, PDF, dependencias, Docker, migraciones, commits/push o nuevos alumnos.

## Estados y política local

El borrador es independiente de la intención. Guardarlo nunca registra intención.
Una intención registra una versión guardada exacta, desde fuente regular-SISTEMAS-v1,
actor SIS-A/B, escuela Sistemas, plan sintético y periodo2027-I. Historial de hasta100
revisiones por propietario; solo la última es activa. No existe reserva, garantía de
sección ni matrícula confirmada. La UI explica roles simulados y alcance conocido.

Política DEMO explícita: solo selección no vacía con validation.status=valid puede
registrarse. unmet son incumplimientos bloqueantes; insufficient son verificaciones
pendientes y también bloquean; incomplete requiere completar selección. Advertencias
de alcance (solo reglas conocidas, no verificación institucional completa) no autorizan
a ignorar pendientes. No se inventan mínimos/máximos de créditos ni reglas universitarias.
Servidor recalcula, valida sesión/propiedad/hash/pub exacta recuperable, y CAS de
draftVersion e intentionVersion bajo la misma cola del store. Repetir el mismo
draftVersion da422 INTENTION_UNCHANGED; guardar otra versión permite registrar actualización.

## Contrato fijo

shared/prematricula-intention.mjs/.d.mts es autoridad nueva, reutiliza tipos/validadores
E2 existentes; no altera respuestas de los cuatro endpoints previos ni contratos E3.
Prefijo existente /api/local/prematricula/v1. Tres POST JSON200, mismas guardas local,
loopback/proxy/origin/query y filtro E2:

- /intencion/contexto {identity} → E2IntentionContext. Lectura individual, historial
  completo propio y validación recalculada de la última intención. Sin intención,
  intention/validation nulos. El draftId/version se obtiene del documento guardado.
- /intencion/registrar E2RegisterIntentionRequest (identity,draftId,
  expectedDraftVersion,expectedIntentionVersion:null|int,expectedAcademicRevision)
  → E2IntentionContext. No acepta selección, estado ni historial del cliente.
- /demanda E2DemandRequest {publicationId,publicationVersion} → E2Demand. Escuela
  simulada local, sin identidad estudiantil. Exige flags locales+escenario regular,
  nunca público; no se afirma autenticación administrativa real.

Errores existentes400/401/403/404/409/503;422 INTENTION_INCOMPLETE,
INTENTION_REQUIREMENTS_UNMET,INTENTION_VERIFICATIONS_PENDING,INTENTION_UNCHANGED;
409 INTENTION_HISTORY_LIMIT, INTENTION_VERSION_MISMATCH o VERSION_MISMATCH;
404 DRAFT_NOT_FOUND si no guardado. No confiar en estado cliente.

## Persistencia y agregación

Extender E2Payload schemaVersion1 con campo opcional intention:E2Intention. Documentos
anteriores siguen válidos, ninguna migración. Guardado conserva intention; registro
conserva document. Un archivo, checksum+atomicidad+cola/CAS existentes, namespace E2
separado de E1. Validar historial e identidad/scope/draftId de ambos; corrupción
falla explícitamente sin sobrescribir. No otra store ni servicio paralelo.

Por propietario estable+fuente+escuela+plan+periodo existe un solo documento. Última
intención por propietario cuenta una vez por courseId y sectionId. Al registrar nueva
publicación deja de contar en la anterior; consultar/editar no lo hace. No contar
borradores ni versiones antiguas ni escenarios alternativos ni población120. Consulta
selecciona publicación exacta, revalida últimas intenciones contra actores actuales
del escenario regular. Hash cambiado, incumplimiento, información pendiente o datos
no disponibles excluyen del conteo válido; registered=counted+excluded. Datos corruptos
impiden presentar un agregado confiable. Publicación inválida/no recuperable rechaza.
Respuesta solo totales (máximo2 participantes), cursos y secciones, nunca actores,
historiales ni identidades. Ceros explícitos en cursos/secciones publicados sin intención.

## UI

Estudiante: misma pantalla, Guardar borrador separado de Registrar/Actualizar intención;
registro solo documento guardado y pantalla sin cambios pendientes, con bloqueo
explicado. Panel compacto con estado, versión, publicación, fecha e historial propio
plegable. Conservar selección/configuración ante error o CAS; recuperación fresca.
Tokens/abort para respuestas de sesión anterior; no autosave ni registro implícito.

Escuela: details «Intenciones de prematrícula», publicación/periodo/versión, consultar,
totales y tabla curso/estudiantes/secciones. Mostrar separado potencial estimado del
workspace E1, intención registrada y demanda final editable en controles existentes;
aclarar fuente/población distinta, no sumarlas. Datos de E1 abiertos no son cifras
oficiales. Acción explícita para crear nuevo borrador desde publicación usa forkDraft
existente con approvedVersion+1; no aplica conteos a demandas automáticamente. Publicación
conservada, cambios locales sin guardar requieren confirmación habitual. Sin nueva ruta.

## Propiedad y verificación

Principal: shared, este plan, contrato/registro, Docker/browser/evidencia secuencial.
Backend Luna High: backend/src/prematricula/* y backend/test/prematricula-intention.spec.ts.
Frontend Luna High: StudentPreEnrollment.tsx/.css, nuevos StudentIntentionPanel y
AcademicIntentionDemandPanel, AcademicScheduling.tsx (solo montaje/callback fork),
data/prematricula-intention.ts/.test.ts, verify-e2-prematricula.mjs (solo etiqueta Guardar).
No workers planificadores ni subdelegación. TOML no disponible: fallback real gpt-6-luna/high.
Leer root/folder AGENTS y skills de carpeta. CodeGraph CLI/índice ausentes y config
sin exclusiones .pnpm-store/symlinks suficientes: no inicializar ni indexar privados.

Criterios: guardado sin registro; registro válido; bloqueo unmet/insufficient/empty;
recuperabilidad/versiones pub; historial/actualización; A/B aislamientos; un solo conteo
por propietario con cambio pub; CAS concurrente; lectura tras reinstanciar y reiniciar;
agregado exacto/sin IDs/ceros/excluidos; E1 y snapshot E3 sin mutaciones. Reutilizar
18 tests E2,346 E1/regresión,204 frontend y contratos existentes. Build/tipos de
fuente/lint. Docker propio5280 con --env-file NUL y fixtures built-in, nunca servicio
operador5180. Navegador A registra, guardar no cambia conteo, A actualiza sección,
B registra, cambia pub, reinicio, escuela consulta/crea fork sin tocar publicación.
Registrar matriz y resultados en evidence/local/prematricula-e2-intention/fullstack-verification.md.
Un ciclo de reparación automático; fallos adicionales se diagnostican por principal.
