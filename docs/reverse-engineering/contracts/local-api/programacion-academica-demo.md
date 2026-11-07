# PA-DEMO-1: API e interfaz local de programación académica

> Extensiones fijadas el 2026-11-07, pendientes de implementación: rondas docentes, núcleo de regeneración parcial y capacidad por sección en [planning-rounds.md](planning-rounds.md); reajuste posprematrícula en [planning-readjustment.md](planning-readjustment.md). Este contrato sigue vigente para todo lo que ellas no modifican.

## Extensión2026-11-04: aprobación y publicación simuladas

Plan preciso y criterios: ../../plans/programacion-academica-publication.md.
Se conserva schema1 y store/cola/CAS existente; metadata opcional approval/publication/
origin. Estados approved/published bloquean save y respuestas/reenvíos. Ninguno
puede enviarse mediante SaveRequest. Aprobar requiere revalidar horario y todas las
conformidades vigentes del snapshot guardado; publicar requiere aprobación intacta.

- GET borradores/:id/vista-previa → AcademicReleasePreview.
- POST borradores/:id/aprobar `{expectedVersion}` → `{draft}`.
- POST borradores/:id/publicar `{expectedVersion,expectedCurrentId}` → `{draft}`.
- POST borradores/:id/nuevo-borrador `{expectedVersion}` → `{draft}` nuevoID/version1,
  sin revisión/aprobación/publicación; origen conserva referencia. Solo fuentes locked.
- GET publicaciones → AcademicPublicationList; currentId indica mayor versión.
- GET publicaciones/vigente → AcademicPublication;404 si no hay.
- GET publicaciones/:id → misma AcademicPublication inmutable aun si ya no vigente.

Éxitos200. Errores400 estructura,404 ausente,409 versión/estado locked/vigente cambió/
corrupción,422 condiciones académicas,429 cuota,503 IO. Mismas barreras locales JSON/
origin y simulador deshabilitado. Se verifica CAScurrent además de versión de archivo;
un solo writeatómico guarda publicación y estado. No índice o transacción multarchivo.

Contrato futuro de lectura PA-PUBLICATION-1 incluye ID/versionpublicación, versión
de origen/aprobada, fechas y schedule (escuela/periodo, catálogo mínimo con ciclo/
créditos, sections/assignments existentes). No configuración interna, observaciones,
estudiantes ni autoridad. E2 deberá referenciar ID+publicationVersion explícitos;
no se implementa ni conecta E2, matrícula u oferta vigente. Roles simulados sin
validez institucional. Máximo50 propuestas incluidas las publicaciones; si corrupción
impide determinar vigente se falla explícitamente, sin fallback engañoso.

## Extensión2026-11-04: revisión docente local

Contrato fijado y criterios detallados en
`../../plans/programacion-academica-teacher-review.md` (desde esta carpeta).
`AcademicSavedDraft.review` es opcional para leer archivos schema1 anteriores.
Estados in-review/ready-for-approval derivados en servidor; SaveRequest mantiene
solo draft/ready-for-review, sin permitir enviar review ni reemplazar autoridad.

- POST `borradores/:id/revision/enviar`: `{expectedVersion}`.
- POST `borradores/:id/revision/responder`:
  `{expectedVersion,round,teacherId,decision,observation}`.
- Ambos200 `{draft:AcademicSavedDraft}`, mismo ID persistente, versión incremental;
  no crean/reemplazan sesión RAM ni regeneran. JSON exacto y barreras locales
  existentes.400 malformed,404 ausente,409 versión/ronda/corrupción,422 estado/
  docente inválido,429 historia llena,503 almacenamiento. Consultar shared runtime.

Docente responde por todas sus asignaciones guardadas en una ronda. Pedir cambios
requiere observación1–1000 caracteres; conformidad permite vacía. Huella individual
incluye horarios/componentes/capacidad y recursos relevantes, excluye lease/version
RAM. Guardar ajuste invalida solo afectados; docentes no cambiados conservan su
conformidad de versión anterior explícita. Reenviar crea ronda, conserva únicamente
conformidades idénticas y solicita nuevas respuestas al resto. Historial200 eventos,
sin borrado silencioso. Sin horario completo no se puede enviar ni estar listo.

La pantalla muestra Escuela/Docente como simulación sin autenticación. No es control
de acceso ni aprobación institucional. No correo, portal, E2/E3 ni publicación.

Fecha: 2026-10-29. Principal: contrato y aceptación. Requisitos del usuario y
decisiones local-only; ninguna regla nueva se atribuye al SUM oficial.

## Alcance y aislamiento

Ruta React `/local/programacion-academica`, habilitada exclusivamente con
VITE_SUM_ACADEMIC_SCHEDULING=1 y VITE_SUM_SIMULATOR distinto de 1. Se conserva
fidelidad visual/interacción de pantallas estudiantiles: cero cambios autorizados
en ellas. Solo se permite una excepción exacta de ruta en raíz, sin desactivar
controles globales ni reutilizar una identidad estudiantil como administrativa.
Reutilizar Common/DataTable/PageTitle y WeeklySchedule, con datos del módulo.

Nest: `/local/programacion-academica/v1`. Módulo opt-in SUM_ACADEMIC_SCHEDULING=1,
no registrado en SIMULATOR_DEPLOYMENT=public. Peticiones desde loopback o,
solo con SUM_ACADEMIC_PROXY_HOST=frontend y habilitación explícita, desde una
dirección exacta resuelta actualmente por DNS para el proxy frontend de Docker;
nunca se confía en encabezados reenviados ni en toda una subred privada.
POST rechaza Origin no loopback y peticiones cross-site. No autenticación real.
Arranque dedicado solo con AcademicSchedulingModule en 127.0.0.1:3210 para no
cargar repositorios/snapshots del operador. No inspeccionar servidores existentes.

## Operaciones

### Extensión E1: preferencias y máximos por docente/asignatura

Docentes admiten preferences?:intervalos semanales (máximo32), blandas, y
sectionLimits?:[{courseId,maxSections}], límites únicos enteros0..128. Sin límite
explícito no se agrega un máximo distinto de carga/disponibilidad. Cuenta secciones
distintas, no componentes: dos componentes de una sección consumen un cupo, cuatro
secciones consumen cuatro. Un docente puede asumir varias o todas si cumple reglas.

allocationPolicy opcional en POST, defaultpreferences: bloques preferidos primero,
docentes sin preferencias después, alternativas fuera como respaldo. balanced usa
la misma prioridad y desempata por menos secciones, luego minutos eID; no impone
equidad. first-feasible usa orden determinista sin priorizar preferencias. Heurística
de primera solución factible, no optimización global demostrada. Preferencias no
anulan disponibilidad/carga/límites ni convierten un fallback válido en imposible.

preferenceReport aditivo informa policy, evaluatedSections, withinPreferenceSections,
outsidePreferenceSections, withoutPreferenceSections y optimality:not-proven. Evalúa
solo secciones completamente cubiertas; suma consistente. PREFERENCES_NOT_MET
informa asignaciones actuales fuera de preferencias, no prueba inexistencia de una
alternativa mejor. Fuente original y nombres permanecen retenidos en servidor.

Contadores y diagnóstico deben concordar: SEARCH_LIMIT solo con statussearch-limit;
componentes asignados iguales a assignments.length, pendientes no duplicados,
secciones/docentes/continuidad coherentes. La UI separa razón de terminación de
cobertura completa/parcial/sin asignaciones. Tabla y calendario usan un mismo
agrupador de tramos contiguos por sección/docente/día; no fusionan huecos/días ni
inventan duración de componentes pendientes. No se emite un statuspartial adicional.

### Extensión E1: sección continua y responsable único

Regla funcional proporcionada por el usuario para el prototipo FISI, sin atribuirla
a norma verificada ni a SUM producción. demands.deliveryMode opcional:
continuous (predeterminado) o split (excepción explícita). Cada sección mantiene
un docente responsable habilitado, con carga sumada y sin cruces. continuous agrupa
componentes en su orden original el mismo día, contiguos y sin huecos. split permite
distintos días, conservando responsable único. Un ambiente puede cambiar entre
componentes; no se inventan tiempo de traslado o requisitos de equipamiento.

weeklySessions.type conserva T/P/L u otro código de la referencia. sections devuelve
deliveryMode, assignments devuelve sessionType cuando existe. Duraciones nunca se
deducen de créditos. La autoridad de cobertura verifica continuidad/orden/docente
contra la entrada original retenida en servidor, además de todos los requisitos y
reglas del validador base. Requisitos internos conservan order explícito.

referenceRooms contiene los49ambientes suministrados por el usuario:28AP y21NP,
33aulas y16laboratorios, capacidad de referencia45, sin disponibilidad confirmada.
Puede incorporarse cualquier referencia a los ambientes activos (máximo32 por
propuesta); cuatro activos iniciales, incluyendo aula/laboratorio. La capacidad
objetivo por sección sigue siendo un parámetro separado. Disponibilidad inicial
sintética lunes-viernes08:00-22:00 y editable por recurso; no se copia del historial.

Búsqueda por bloques, combinaciones de ambientes perezosas y acotadas por trabajo,
tiempo cooperativo y exploraciones. Sin solución se refiere al dominio finito y la
cuadrícula declarada. Diagnósticos específicos distinguen condiciones necesarias
comprobadas de restricciones observadas al buscar. search-limit siempre informa
que no demuestra imposibilidad, aunque la programación no se haya completado.

### Extensión E1: configuración administrativa de recursos

Fuente de nombres: exclusivamente scenario-reference.seed.ts, declarado sintético,
con reutilización expresamente autorizada por el usuario. `referenceTeachers` separa
identidad/nombre y cursos de referencia; history.sessions puede incluir teacherName.
La asignación histórica nunca confirma disponibilidad, habilitación o participación
futura. Sin lectura del PDF ni fuentes privadas.

POST admite `resources?: {teachers, rooms}`. Cada docente contiene id, name,
courseIds, maxWeeklyMinutes y availability. Cada aula contiene id, name, capacity,
availability y kind opcional (classroom/laboratory). Máximo32 recursos por lista,
32 intervalos por recurso, IDs únicos de hasta80 caracteres sin espacios extremos,
nombres no vacíos, carga entera0..10080, capacidad positiva y habilitación sin cursos
duplicados/ajenos al catálogo. Las disponibilidades son intervalos semanales válidos,
intersectados por el generador con las ventanas generales visibles del catálogo.
La clasificación laboratorio es descriptiva; no impone equipamiento o tipo de sesión.

resources ausente conserva los defaults del servidor; resources explícitamente
vacío se respeta y puede producir impossible. Nunca completar silenciosamente
recursos editados insuficientes. Filtrar habilitaciones a la selección al construir
GeneratorInput; misma identidad docente participa en varias asignaturas y comparte
carga y restricciones de cruce. Los nombres de asignaciones provienen de la copia
de recursos validada para esa propuesta. GET sigue sin aceptar recursos/requisitos.

Configuración solo en memoria; no escribe matrícula, oferta, fixtures ni archivos
del operador. Cambios de recursos invalidan el resultado vigente en React. Filtro
de ciclo1..10 es visual y no descarta selección oculta ni altera el catálogo.

### Extensión E1: catálogo reutilizado (2026-10-29)

La demo administrativa reutiliza scenario-reference.seed.ts, declarado
explícitamente sintético. No consume respuestas de alumnos, snapshots privados
ni el PDF pendiente de sanitización. Agrupa por código conservando ciclo, créditos,
secciones y todas las sesiones como `history`; no atribuye un semestre oficial al
seed. `source` diferencia referencia de periodo nuevo y enumera supuestos sintéticos.
IDs docentes locales; los nombres de referencia del seed explícitamente sintético
están autorizados por el usuario para esta extensión. No se usa el PDF privado.

Catálogo hasta 256 cursos; solicitud hasta 32 cursos seleccionados, únicos y
conocidos. `demands` puede estar vacío. Cada fila admite `targetCapacity` entero
positivo y `patternId`, validado contra los patrones autorizados del servidor.
Ausentes mantienen valores por defecto para compatibilidad PA-DEMO-1. Los patrones
conservan cantidades y duraciones completas (no créditos) y la UI muestra qué patrón
se elige; no fija los días históricos. El cliente no puede reemplazar requisitos
ni autoridad de propuestas retenidas. La configuración de recursos de una propuesta
nueva sí puede enviarse con la extensión descrita abajo, validada por el servidor.
La autoridad de cobertura se sigue construyendo y
reteniendo en el servidor a partir de la entrada resultante.

Demanda inicial cero y capacidad objetivo 30 son parámetros sintéticos independientes
de los matriculados/topes históricos. Docentes, aulas, habilitación, carga y franjas
son recursos sintéticos explícitos del periodo de planificación. No se escriben
ofertas ni se publican propuestas en matrícula. Los campos nuevos son aditivos;
los dos cursos de la primera demo dejan de ser el catálogo del servidor.

Las operaciones descritas debajo conservan rutas/retención, con esta extensión
sustituyendo el requisito antiguo de enviar exactamente todos los cursos.

- GET `/catalogo`: sin query/body. AcademicCatalog del contrato compartido,
  revision PA-DEMO-1, asignaturas agrupadas del catálogo sintético existente,
  demanda inicial cero y parámetros explícitos del nuevo periodo de demo.
- POST `/propuestas`: JSON `{ revision, demands:[{courseId, estimatedDemand}] }`.
  Hasta 32 cursos seleccionados del catálogo, únicos, enteros seguros >= 0;
  capacidad objetivo y patrón semanal opcionales según la extensión E1.
  No aceptar requisitos, ofertas, asignaciones ni fuente del cliente; recursos
  opcionales únicamente bajo el contrato validado de esta extensión.
  Revisión diferente → 409. Forma/demanda inválida → 400. Entrada que supera los
  límites del generador → resultado invalid-input, HTTP 200.
- GET `/propuestas/:proposalId`: sin query/body; devuelve copia del resultado
  retenido, recomprobando cobertura contra autoridad privada del servidor.
  Nunca acepta entrada/requisitos para cambiar la autoridad. Ausente/expirado →404.

POST devuelve HTTP 200 con ProposalView: ID/fecha/expiración, status, secciones,
asignaciones, sesiones pendientes, diagnósticos, cobertura, conteos y estadísticas.
Fechas ISO UTC, días 1–7 y minutos, sin strings HTML. Exponer solo la vista local;
no importar el generador backend en React. Validación runtime en ambas fronteras
mediante shared/programacion-academica-api.mjs y declaración .d.mts.

Conservar entrada original clonada, resultado y CoverageAuthority únicamente en
memoria durante 15 minutos, máximo 20 propuestas; limpiar expiradas al acceder y
rechazar saturación con 429. Reiniciar elimina todo. No es aprobación/persistencia.
Errores HTTP: `{error:{code,message}}`, sin datos privados, trazas o configuración.

## Aceptación y asignación

### Persistencia local de trabajo (2026-11-04)

Extensión exacta y criterios: `docs/reverse-engineering/plans/programacion-academica-persistence.md`.
GET `/borradores`, POST `/borradores/guardar`, POST `/borradores/:id/continuar`.
Tipos AcademicWorkspace/DraftSaveRequest/SavedDraft/List/Resume y validadores shared.
Configuración explícita y referencia/versionado del resultado autorizado; no acepta
asignaciones ni autoridad del cliente. Base potencial se verifica en servidor,
demanda final se conserva independiente. Estado draft o ready-for-review; listo
requiere cobertura completa no vacía y no significa aprobación/publicación.
ID guardado estable y versión optimista; continuar crea lease temporal independiente.
JSON/checksum/schema/catálogo validados, persistencia en volumen local por propuesta,
escritura atómica y una instancia escritora. Sin PostgreSQL/Redis/migraciones.
Volumen exclusivamente compose local, Mis propuestas es compartido en el entorno
sin identidad administrativa real. No efectos sobre oferta/vacantes/matrícula.

### Estimación potencial sintética E1 (2026-11-02)

Contrato aditivo exacto y criterios en
`docs/reverse-engineering/plans/programacion-academica-demand-demo.md`.
POST `/demanda/estimar`, AcademicDemandRequest/AcademicDemandEstimate y validadores
runtime compartidos. Solo agregados de fuente sintética integrada o independiente,
Sistemas SYN-SIS-PLAN, objetivo2027-I/corte2026-1. No recibe estudiantes ni autoridad
del cliente. Misma barrera de acceso/origen/JSON.400 inválido,409 revisión obsoleta.
Fuente regular usa una única versión de los actores, nunca suma nueve escenarios.
Repitentes incluidos en elegibles. Estado insuficiente separado. Demanda base no
sobrescribe demanda final manual; acción explícita de adopción cuando no hay gaps.
Generación sigue usando estimatedDemand como valor final; este endpoint no reserva
vacantes, no cambia oferta/matrícula, no estima intención y no persiste información.

### Extensión local de revisión manual (2026-11-02)

Plan y criterios: `docs/reverse-engineering/plans/programacion-academica-manual-review.md`.
POST `/propuestas/:proposalId/ajustes`, JSON exacto
`{expectedVersion,sectionId,sessionIds,teacherId,day,startMinute,roomIds}`.
Devuelve la propuesta completa actualizada (HTTP200), con `editVersion` y
`manuallyAdjustedSectionIds`. La generación inicial entrega versión0/lista vacía.
Se aplican los mismos controles de acceso/origen/JSON de generación. 400: forma
inválida;404:ausente/expirada;409:versión obsoleta;422:restricción incumplida.
El error conserva el envelope existente con mensaje específico de código/recurso.

`sessionIds` identifica, en orden, un bloque contiguo existente completo; `roomIds`
corresponde a sus componentes. Se conserva cada duración. En continuo se exige toda
la sección; en split se mueve únicamente ese bloque, conservando los demás. El
responsable único se cambia para toda la sección, nunca para otra sección. No se
completan sesiones pendientes mediante esta operación. Se retienen entrada,
recursos y autoridad originales en servidor y una copia automática independiente.
No acepta recursos/requisitos sustitutos. Verificación atómica sin regenerar.

Compatibilidad de ambientes, decisión local conservadora: preservar para cada
componente el tipo de ambiente usado en la propuesta automática, si se declaró
`kind`. No constituye una regla oficial que una letra de componente implique
equipamiento determinado. También se valida capacidad, disponibilidad y cruces.
Cambios fuera de preferencias pueden ser válidos con aviso; no son restricciones
obligatorias. Preferencias se recalculan sin prometer óptimo. Se preservan estado,
pendientes y diagnóstico de terminación de la búsqueda original. La marca manual
registra que la sección fue ajustada, no aprobación. Retención en memoria sin cambios.

Principal: shared, contrato, app.module.ts, raíz React y aceptación integrada.
Backend worker: archivos nuevos backend/src/programacion-academica/demo-* y
local-main.ts, pruebas propias disjuntas. Frontend worker: nuevos route/screen/css,
data adapter y pruebas propias; routeTree.gen.ts generado. Ningún worker modifica
el generador ni matrícula. Debe preservar fidelidad e interfaces existentes.

API: catálogo sintético; POST genera; GET recupera sin aceptar autoridad cliente;
mutaciones/revisiones/demanda/expiración/saturación inválidas; aislamiento de oferta;
registro público ausente. UI: carga, consulta, edición, generar, tabla/calendario,
cuatro estados, pendientes/diagnósticos, cambio demanda sin mostrar resultado viejo
como vigente, error/reintento. Flujo real navegador → React → API Nest → generador.
193 regresiones, builds/tipos fuente/lint y pruebas focalizadas. Registrar fallos
preexistentes aparte. Sin nuevas dependencias, Docker, migraciones ni commits.
