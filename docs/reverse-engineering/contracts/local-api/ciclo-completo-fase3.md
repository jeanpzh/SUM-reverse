# FISI-PLANNING-1 y contrato de ejecución E3-PUBLICATION-1

Autor principal, 2026-11-05. Autorización de implementación: «realiza lo q te
encomende», posterior al plan ciclo-completo-fase3. Decisiones `local-only` con
datos sintéticos; no se atribuyen a producción SUM. Preservar fidelidad visual e
interacción de todas las pantallas SUM y reutilizar interfaces existentes. Cambios
autorizados: controles del área local de programación, panel de prematrícula y
contexto/matrícula local existentes; sin rediseño del dashboard.

## Extensión compatible PA-DEMO-1, fija para P1/P2

Se extienden los artefactos existentes `shared/programacion-academica-api.*`.
`AcademicRequest.planningPolicy?` es `{revision:'FISI-PLANNING-1',period,
allowAfternoon:boolean,allowSaturday:boolean}`. Periodo canónico 20xx-I/II.
Workspace/publicación admiten ese periodo; si hay política, coincide con workspace.
Ausencia de política conserva exactamente el camino histórico. Demanda potencial
E2/estimador siguen 2027-I; no interpretar una publicación de otro periodo como E2.

En el cliente, nuevos formularios usan planningDefaults: 180 para ciclo coincidente
con semestre, 90 para opuesto, capacidad45. Selector de periodo y acción explícita
de aplicar valores conservan ajustes/borradores al recuperar; no modificar el
catálogo backend ni su fingerprint, para mantener publicaciones antiguas legibles.
Pool sintético inicial: todos los referenceTeachers/referenceRooms del catálogo,
copiados, sin cambiar catálogo/fingerprint; disponibilidad local conocida L–V08–22.
Metadata opcional docente `facultyId`, `category` principal/asociado/auxiliar,
`qualificationSource:'synthetic'`. syntheticTeachingMetadata(index) crea supuestos
visibles de demo, nunca categorías institucionales inferidas del nombre.

Política aplicada solo si planningPolicy existe:
- Tesis IDs20118081/20118091/20118101 exige facultyIdFISI y procedencia synthetic,
  con habilitación explícita courseIds. Asociados no se excluyen. Sin metadata no
  se considera candidato. Mantener objetivo45 salvo override explícito.
- Ciclos7–10: candidatos L–V18–22 primero; si allowAfternoon permite L–V14–22;
  si allowSaturday permite sábado08–13 después. Opciones son consentimiento local
  explícito para proponer excepciones; defaultfalse. Nunca domingo. Otras cohortes
  conservan L–V08–22, con sábado08–13 solo al habilitarlo. Disponibilidad efectiva
  es intersección con recursos; habilitar sábado no inventa disponibilidad docente.
- Reportar excepciones mediante diagnósticos existentes; no afirmar optimalidad.
  search-limit conserva su significado y no prueba necesidad de excepción.
- SesionesL usan laboratorio, tipos restantes no fuerzan clasificación distinta.
  Validación de ajustes aplica las mismas restricciones. Grupos por ciclo y ordinal
  de sección impiden cruces de cursos distintos del mismo itinerario; no confundir
  secciones alternativas de un curso con asignaturas obligatorias simultáneas.
- Límites coherentes: 96cursos,128docentes,128ambientes,1024sesiones/secciones;
  conservar límites de tiempo/trabajo. Cobertura completa solo si pasa validador.

UI: filtrar docentes por nombre/código sin tildes/mayúsculas; ocultar resultados no
quita recursos; edición y borradores retenidos. Aplicar presets y cargar inventario
son decisiones explícitas, no reseteos silenciosos. Estimador de potencial solo se
habilita para su ámbito2027-I hasta extensión separada respaldada.

Aceptación P: default4/2secciones, paridad inversa, overrides conservados, búsqueda,
49ambientes activos permitidos, tesis habilitada/nohabilitada, noche/excepciones,
laboratorio/ciclo y edición validados; regresión sin política y lectura de documentos
anteriores conservadas. Build/lint y suites dirigidas autorizados.

## Activación E3-PUBLICATION-1, contrato A/B/C congelado

Reutiliza MR-CONTRACT-3 y sus tipos ActorProfile/EnrollmentProfile/OfferedCourse,
RunState, Outcome y reportes; no crea otro motor. Artefacto shared/enrollment-offer.*
valida únicamente activación/catálogo, comportamiento nuevo que antes no tenía API.

- GET `/local/matricula-regular/v1/ofertas`, sin query/body:
  `{activeRunId:null|uuid,items:OperationalOffer[]}` (máximo50).
- POST `/local/matricula-regular/v1/ofertas/activar`, JSON exacto
  `{publicationId:uuid,publicationVersion:positive,expectedActiveRunId:null|uuid}`
  →200 `{offer:OperationalOffer,reused:boolean}`.
- OperationalOffer es exactamente `{runId,publicationId,publicationVersion,
  offerVersion,academicPeriod:'2027-I',schoolId:'SISTEMAS',planId:'SYN-SIS-PLAN',
  activatedAt,clockBase,courseCount,sectionCount}`; fechas UTC, enteros positivos,
  runId UUID estable persistido y offerVersion monotónica local.
- Mismo origen publicationId/version devuelve mismo recurso, reusedtrue y no mueve
  activeRunId. Nueva publicación requiere CASexpectedActiveRunId y consentimiento
  de Escuela; crea OTRO contexto sin alterar anteriores ni sus matrículas. No
  sobrescritura de oferta existente. Lista activa es la de mayor offerVersion.
- La unicidad de matrícula por estudiante/periodo/escuela/plan abarca todas las
  versiones operativas. Bajo la misma cola global, una matrícula previa en otra
  oferta añade la causa existente ALREADY_ENROLLED; no cambia sus ocupaciones ni
  el reporte anterior. La recuperación rechaza duplicados entre archivos. La
  repetición de una solicitud ya registrada conserva su resultado original.
-400 campos inválidos;404 publicación ausente;409 PUBLICATION_VERSION_MISMATCH,
  ACTIVE_OFFER_CHANGED, corrupción o incompatibilidad de versión;422
  ACTIVATION_NOT_SUPPORTED/COURSE_UNMAPPED/ACADEMIC_CONTEXT_UNAVAILABLE cuando no
  hay correspondencia/ámbito/metadata;429 cuota;503 STORAGE_UNAVAILABLE. Envelope
  de activación `{error:{code,message}}`, sin detalles internos de archivos.
- Mismas barreras locales Origin/JSON/DemoAccess de E1, flags
  SUM_ACADEMIC_SCHEDULING=1 y SUM_LOCAL_SCENARIOS=1; prohibido public/snapshots.
  AppModule añade módulo de activación condicional importando los módulos E1 y MR.

### Construcción y persistencia por contexto

SavedDraftService.getPublication valida publicación aprobada/inmutable y su checksum;
solo Sistemas2027-I. Usar como fuente de antecedentes el bundle Regular incorporado
independiente, sin leer/alterar estado del operador. Dos actores SIS A/B, clonados
con scope2027-I y nueva profileRevision. Historial, requisitos y excepciones se
conservan; no aprobar cursos ni habilitar requisitos desconocidos para hacer pasar
la demo. Perfil academicPolicyfisi-regular reutiliza evaluador/constantes existentes.

Mapear código de publicación a `scenarioData.courseCodes` explícito y único y a
catálogo académico validado; datos de créditos/prerrequisitos deben concordar.
Conservar courseIdSYN existente cuando corresponda, aislado por runId. SectionIdSYN
determinista desde la tupla de origen (hash acotado), sin inferir por nombre/horario;
sectionOrigins conserva publicación/version/curso/sección exacta. Publicación aporta
capacidad, reuniones, docente y aula; occupied0. PreEnrollment incluye solo cursos
conocidos admisibles según antecedentes; los desconocidos no se habilitan por defecto.

Calendario sintético declarado: día2027-03-01, mismas bandas/umbrales existentes
mediante regularTurnWindowsForDate. Reloj por contexto createAdvancingSyntheticClock
desde2027-03-02T03:30:00.000Z (22:30Lima), independiente del reloj 2026-II. Al
reiniciar se restablece este reloj de demostración y se invalidan sesiones del
contexto operativo; se conservan runId, oferta, ocupaciones, solicitudes y reportes.
El estudiante reingresa explícitamente; recuperar resultado con mismo runId/requestId
funciona sin recrear matrícula. Esta política no afirma fechas oficiales de2027.

Reutilizar SavedDraftStore<T> en subcarpeta `e3-ofertas` de SUM_ACADEMIC_DRAFT_DIR,
una unidad atómica por runId con metadata + RunSnapshot validado en carga; nunca
escribir E1/E2. Registro antes de visibilidad en RAM, misma cola por repositorio
para sesiones/confirmación y activaciónCAS. Fallos de escritura no mutan estado.
La copia candidata se valida antes de persistir; rechazar archivos corruptos y
no caer silenciosamente a cero ocupaciones. Un escritor; máximo2MiB por contexto,
sin prometer garantías multiproceso o pérdida eléctrica no comprobadas.

### Enrutamiento compatible de servicios existentes

MatriculaRegularRepository conserva ejecución legacy por defecto y almacena las
operativas por runId. readSnapshot(runId?) y enqueue(operation,runId?) seleccionan
contexto sin cambiar globalmente la ejecución. enqueue opera sobre una copia del
contexto operativo, la valida/persiste y después la expone; publishCandidate conserva
el camino legacy. Sesiones y confirmaciones usan la misma unidad atómica. Un runId
desconocido conserva semántica RUN_CHANGED. reset/configurar escenarios no elimina
contextos operativos. Constructor y configure no sobrescriben documentos al iniciar.
El módulo base MR conserva su grafo sin archivos, variables de entorno ni snapshots.
OperationalOfferModule configura explícitamente un OperationalRunStore al construir
su servicio. El adaptador de archivos pertenece exclusivamente a ese módulo y exige
SUM_ACADEMIC_DRAFT_DIR explícito, los flags locales y ausencia de snapshots/public.
Esto preserva las pruebas de procedencia existentes sin relajar sus aserciones.

ContextService.now(runId?) usa reloj del contexto; read(actorId,runId?) selecciona
snapshot. Sesiones, submit, lookup, report y dashboardread usan request/identityrunId;
validan identidad/sesión contra ese snapshot. Sin runId explícito, comportamiento
legacy inalterado. GETcontextos/:actorId y GETperfiles admiten UN query opcional
runId UUID (sin body/duplicados/otros campos). Catálogo operativo tiene exactamente
SYN-SIS-A/B en orden y scope2027-I; catálogo legacy conserva cuatro perfiles.

PrematriculaService resuelve cada lectura/revalidación por identity.runId, también
tras await y dentro de colas. Para operacional se omite solo el gate de escenario
legacy activo; flags/identidad/plan/sesión/academia siguen obligatorios. La intención
2027-I conservada se lee sin mutación y con sus enlaces exactos. Su hash académico
no cambia por el mero scopeperiod/revisión si historial es idéntico. Un E1 de otro
periodo no se presenta en E2 como compatible ni produce un fallback ficticio.

### Cliente A/B/C

Área existente de aprobación/publicación: activar versión publicada, mostrar origen,
CAS y enlace «Abrir matrícula2027-I». Confirmar creación si hay oferta activa;
anteriores quedan accesibles. Login local admite queryrunId validado: carga catálogo
específico y entra sin reset de escenarios. Sin query conserva chooser histórico.
LocalProfileSessionStore.enter acepta contextRunId junto a expectedRunId, solicita
ese catálogo y sesión; guardar identidad actual permite renovar/reingresar tras
reinicio sin cambiar a2026. APIcatalog envía runId solo cuando se solicita contexto.

Reutilizar RegularEnrollment, diálogo, recovery y reporte completos. Contexto activo
del dashboard ya devuelve2027 al entrar; no crear pantalla/motor alternativos.
Mantener selector manual, carga de intención y guardas ante consulta tardía/solicitud
incierta. Mostrar periodo/reloj sintético de forma clara usando datos existentes.
El estudiante puede salir y volver al selector2026 sin alterar ninguna matrícula.

### Aceptación A/B/C

Probar HTTP verdadero: activación válida/duplicada/CAS/inválida/otroperiodo, cero
ocupación, integridad, aislamiento2026 y dos sesiones. B importa intención registrada
por A/B sobre publicación exacta; cambiar sección conserva E2. C usa crédito12–26
o excepción legítima, revalida todos los requisitos; exactamente un ganador de última
plaza, idempotencia con misma clave y conflicto con payload distinto. Fallo de
persistencia revierte todo y respuesta perdida recupera mismo resultado tras reinicio.
Reporte y ocupación sobreviven. Docker y navegador real, sin mocks como integración.
Se autorizan estas pruebas sintéticas y regresiones; principal conserva navegador.
