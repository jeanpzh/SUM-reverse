# Contrato agregado: todos los snapshots enumerados

- Revisión **SS-CONTRACT-1**, 2026-10-09. **Lista para implementar decisiones locales de ingestión/presentación delimitadas**; no certifica archivos privados, producción ni integración.
- Encargo: hacer utilizables los catorce nombres documentados desde una carpeta, incluyendo módulos pendientes y carpetas parciales, sin llamadas SUM.
- Plan: [all-snapshots](../../plans/all-snapshots.md). Reutiliza MC-CONTRACT-1, MIC-CONTRACT-2, PE-SNAPSHOT-1, asistencia-api-v1, reportes-api-v1 y RI-CONTRACT-1. Sus schemas/mappings vigentes no se rediseñan; esta revisión cambia únicamente selección agregada, ausencia, nuevas lecturas/presentación y contexto opcional.
- Fuentes: inventario documental comunicado por root desde `docs/reverse-engineering/private-snapshots.md`; tipos locales sanitizados `raw-types/`; inspección estática CodeGraph de código actual. No se leyó/listó la carpeta privada ni se verificó ningún archivo allí existente.

## Cobertura exacta y certeza

| Clave cliente / basename fijo | Estado reutilizado o brecha | Representación snapshot de esta revisión |
| --- | --- | --- |
| perfil / mi-perfil.json | MIC-CONTRACT-2 implementado previamente | candidate-v1, mapping acotado vigente |
| historial / historial-academico.json | Tipo sanitizado Historial/mapping vigente | candidate-v1, sin aprobaciones derivadas |
| formulario / formulario-datos-matricula.json | Alumno/flags tipados; mapa formulario sin mapping completo | candidate-v1 vigente; controles sin correspondencia siguen pendientes |
| fichaSocioeconomica / ficha-socioeconomica.json | Conservación opaque existente; sin tipo candidato | **opaque y vista JSON propia local**, sin trece secciones inventadas |
| plan / plan-estudios.json | PE-SNAPSHOT-1 vigente | candidate-v1 con literales exactos del tipo fuente |
| matriculaInfo / matricula-info.json | MC-CONTRACT-1 vigente | Wire validado/mapping vigente; transacciones no implementadas |
| programacion / programacion-asignaturas.json | MC-CONTRACT-1 vigente | Wire validado/mapping vigente |
| prematricula / reporte-pre-matricula.json | MC-CONTRACT-1 vigente | Wire validado/mapping vigente |
| matricula / reporte-matricula.json | MC-CONTRACT-1 vigente | Wire validado/mapping vigente |
| horarios / reporte-horario.json | MC-CONTRACT-1 vigente | Wire validado; límites de rejilla vigentes, sin ajuste silencioso |
| asistencias / mis-asistencias.json | Tipo completo; falta ingestión candidata | **candidate-v1 tipado** según sección siguiente |
| evaluaciones / reporte-evaluaciones.json | `raw-types/reporte-evaluaciones.ts` solo unknown[] | **opaque-array**, vista JSON propia; no DTO EvaluacionLocalRow inferido |
| deudas / reporte-deudas.json | `raw-types/reporte-deudas.ts` vacío | **opaque-json**, vista JSON propia; no montos/conceptos/totales inferidos |
| tutoria / tutoria.json | `raw-types/tutoria.ts` solo unknown[] | **opaque-array**, vista JSON propia; no docentes/resoluciones inferidos |

Esto es un inventario de nombres permitidos, no constatación de archivos presentes ni cobertura de todos los exports posibles. No glob, descubrimiento de otros basenames, manifest/HAR/ZIP ni endpoints desconocidos. Inicio/Manuales no tienen snapshot JSON documentado y continúan como UI local; no inventarles fuente SUM.

**Observado:** tipos Asistencias completos; Evaluaciones/Tutoría unknown[]; Deudas sin tipo; Ficha sin esquema candidato. Los actuales validators/reportes/seed no constituyen evidencia de formas reales para estos cuatro opacos.

**Hipótesis:** el operador puede suministrar archivos faltantes o tipos anonimizados que habiliten mappings futuros. No se supone que ya existan ni se deduce su estructura desde datos privados.

**Decisiones Sol:** agregado opt-in con overrides compatibles, archivo ausente distinto de fixture, vista JSON propia cuando falta semántica, y Formulario contextual opcional en modo agregado. Esta última decisión evita que la ausencia de un archivo bloquee todos los demás y exige adaptar hooks, sin fabricar identidad.

## Configuración de una carpeta y prioridad

Variable nueva `SUM_SNAPSHOT_DIR`: ausente conserva comportamiento previo. Definida exige ruta absoluta no vacía a directorio existente/accesible; el operador configura/inicia el proceso. No iniciar ni inspeccionar ese proceso mediante agentes.

| Scope | Selección efectiva |
| --- | --- |
| Matrícula (cinco claves) | `MATRICULA_SNAPSHOT_DIR` explícito; si ausente, `SUM_SNAPSHOT_DIR`; si ambos ausentes, fixtures previos |
| Mi Información (cuatro) | `MI_INFORMACION_SNAPSHOT_DIR` explícito; si ausente, SUM; si ambos ausentes, fixtures |
| Plan (una) | `PLAN_ESTUDIOS_SNAPSHOT_DIR` explícito; si ausente, SUM; si ambos ausentes, fixture |
| Nuevas Asistencias/Evaluaciones/Deudas/Tutoría | SUM si definido; si ausente, comportamiento synthetic anterior |

Overrides son **por scope completo**, no por archivo: si un archivo falta en el override no buscarlo en SUM ni otro directorio. Una variable explícita vacía/relativa no equivale a ausencia. Pueden coincidir los directorios; no imprimirlos ni comparar identidades entre catálogos.

Solo scopes seleccionados **desde SUM** permiten faltar cualquiera de sus archivos, incluido Formulario y los cinco de Matrícula. Scope seleccionado desde env legacy explícita conserva sus requisitos originales (cinco Matrícula obligatorios, Formulario MI obligatorio, Plan missing503). Esta es una extensión opt-in y no cambia silenciosamente el arranque legacy. Guía principal de carpeta parcial: definir únicamente SUM, retirar variables legacy que no se quieran como overrides.

Con SUM definido, cualquier fixture env `REPORTES_FIXTURE`, `PROGRAMACION_FIXTURE`, `MATRICULA_INFORMACION_FIXTURE`, `MI_INFORMACION_FIXTURE`, `PLAN_ESTUDIOS_FIXTURE`, `ASISTENCIAS_FIXTURE` definida es conflicto incluso populated; fallar por nombres de variables, sin valores. Sin SUM, conflictos legacy existentes permanecen. `MI_INFORMACION_SNAPSHOT_LOCAL_KEYS` sigue con su allowlist original y puede acompañar MI resuelto desde SUM; no extenderla a las nuevas claves para forzar mappings locales.

Directory inválido/inaccesible/config inconsistente abortan arranque. Los helpers leen solo nombres fijos una vez. Archivo presente ilegible/JSON inválido/codError no null/esquema tipado inválido aborta arranque con diagnóstico seguro; un esquema fallido **no cambia a opaque**. Archivo ausente ENOENT, cuando está permitido, registra missing y no publica fixture.

## API, ausencia y metadatos

Todos los endpoints/rutas/acciones POST readonly ya existentes se mantienen. Nuevas fuentes no agregan rutas ni queries de dataset/identidad/periodo. Conservar pipes400/404, body ausente o `{}`, proxy local `/api`, credenciales omit y AbortSignal. Módulos legacy siguen sirviendo los envelopes actuales cuando no hay fuente snapshot activa.

| Nueva fuente | Ruta propia bajo /alumnoWebSum/v2/ | Acción |
| --- | --- | --- |
| asistencias | asistencia | obtenerResumenAsistencia |
| evaluaciones | reportes/evaluaciones | recuperarEvaluacionesCalificaciones |
| deudas | reportes/deudas | obtenerAlumnoDeuda |
| tutoria | tutoria | obtenerListaAsignaturaTutoria |

Las acciones de esta tabla conservan los literales vigentes de endpoint/pipe; no se renombran. No deducir métodos de SUM desde la API propia.

Fuente snapshot activa/missing → HTTP503 `{message:'<clave>.<basename>: snapshot no disponible',codError:'SNAPSHOT_MISSING',data:null}`. Claves/basename son los fijos de la tabla, salvo Formulario cuyo error MI vigente usa clave backend `formularioDatos`. Sin fallback, éxito null ni `[]` falso. Todas las consultas Matrícula distinguen fuente disabled de active/missing; actuales getters null no pueden representar ambos indistintamente.

Success snapshots nuevos: objeto envelope `message:string|null`, `codError:null`, `data` presente; extras JSON recursivos permitidos y conservados. Datos tipados/arrays/opacos según tabla. Solo éxito se importa: respuesta de error no se presenta como viewer exitoso. Semántica JSON/clones, no bytes/whitespace/textual ordering. Leer once; reiniciar para cambios; readonly/copies impiden mutation por consultas concurrentes.

Cabecera nueva **`X-SUM-Additional-Representation`** para Asistencias/Evaluaciones/Deudas/Tutoría: `candidate-v1 | opaque-array | opaque-json | local-v1`. Fixtures anteriores local-v1; snapshot Asistencias candidate; Evaluaciones/Tutoría opaque-array; Deudas opaque-json. Mi/Plan conservan headers existentes; Ficha usa MI opaque. Matrícula conserva sus fronteras existentes y no exige un nuevo header general. Representación externa al envelope; no heurísticas de shape ni marker añadido a JSON.

## Asistencias candidatas: validación y mapping

Fuente exhaustiva: `raw-types/mis-asistencias.ts`, esquema local sanitizado. Validar Datum con todos sus22campos:

- Strings `codAlumno`, `codSemestre`, `desEspecialidad`, `codPlan`, `codAsignatura`, `desAsignatura`, vacío permitido y conservado.
- Números finitos `codFacultad`, `codEscuela`, `codEspecialidad`, `codSeccion`, `numClases`, `cantPresentes`, `cantFaltas`, `cantTardanzas`, `cantAsistencias`, `porcentajePresentes`, `porcentajeFaltas`, `porcentajeTardanzas`, `porcentajeAsistencias`.
- Campos muestra null `apellidoMaterno`, `apellidoPaterno`, `nombreAlumno`: JSON opaco conservado por la política candidata común; no usarlos como identidad tipada ni reconstruir nombres.

Sin enteros/no negatividad/%0..100/fórmulas/tolerancia/sumas/equivalencia de alumno/periodo/sección positiva del seed. No recalcular porcentajes o interpretar asistencia como derecho de aprobación. Strings vacíos, duplicados, números finitos no propios del seed se preservan. Missing/null en campos string/number es error; no coacción.

Reutilizar tabla actual de conteos/porcentajes con valores recibidos y String(number), sin redondeo ni cálculo. En candidate-v1 añadir columnas iniciales `Código de estudiante`/`Periodo Académico` desde codAlumno/codSemestre por fila, permitiendo filas de contextos distintos sin agrupar/deducir igualdad. Mantener once columnas de datos actuales y acción calendario deshabilitada: catorce columnas visuales total. No StudentSummary del shell presentado como identidad de todas las filas. DesEspecialidad/otros códigos/extras se conservan en DTO sin nuevas reglas. CSV propio `Descargar CSV local`: trece columnas de datos, sin acción; empty headers, mensaje vacío vigente. Fixture local-v1 conserva tabla/CSV previos y validaciones del seed.

## Opacos: vista JSON local propia

Evaluaciones/Tutoría requieren array data con elementos JSON desconocidos según sus tipos unknown[]; validar recursivamente JSON, no DTOs de filas locales ni array vacío único. Deudas requiere solo envelope/data JSON por decisión de importación propia: puede ser null/escalar/array/objeto, sin esquema suministrado. Ficha mantiene su validator opaque ya existente. Arrays vacíos opacos se muestran como `[]`, sin afirmar una semántica de ausencia académica.

Componente local nuevo `ImportedJsonView({envelope})`: heading `Datos importados`, aviso `Estos datos aún no tienen un formato de pantalla definido.`, `<pre>` con JSON.stringify(envelope,null,2) escapado por React. Mostrar envelope completo y extras, sin borrar/truncar valores ni ejecutar HTML/enlaces, expandir URL/fotos o cargar recursos. No logs, telemetría, persistencia browser ni screenshot por agentes; no copiar raw a evidencia. Es una pantalla para el operador en su aplicación local, **no un endpoint diagnóstico accesible a agentes**.

Reutilizar rutas de Evaluaciones/Deudas/Tutoría/Ficha, sus títulos/navigation, seleccionar viewer exclusivamente por header validado. No tablas de calificaciones/deudas/tutores/familiares inferidas, botones de pago/acción/download fingidos ni CSV de DTO synthetic. Local-v1 sin SUM conserva pantallas previas. Para futuras pantallas tipadas pedir al operador solo tipos sanitizados/mapa de campos sin valores personales; no bloquear ingestión/viewer viable.

## Formulario ausente y contexto raíz

Root loader actual requiere Formulario; eso bloquea incluso rutas cuyo snapshot existe. Cambiar la salida raíz a `StudentContextState = {status:'ready';formulario:ApiResponseMap['formulario']} | {status:'unavailable'}`. Root consulta Formulario igual y captura **solo** el error tipado de HTTP503 SNAPSHOT_MISSING validado para esa clave en modo local. Otros errores red/parser/esquema/config siguen siendo errores, no un contexto ficticio.

Cliente define `SnapshotMissingError extends Error` con `code:'SNAPSHOT_MISSING'` y `key:EndpointKey`; mensaje de producto constante. `readHttpResponse` valida el envelope exacto seguro de cualquier clave del inventario antes de lanzarlo. No capturar por texto/por status HTTP genérico ni ignorar respuestas inválidas.

`useStudentFormData()` retorna formulario validado o null; `useStudent()` resumen real de esa fuente o null; `useShellStudent()` estado unavailable, sin DEMO/blancos fabricados. Common StudentSummary muestra override propio cuando existe o se omite si contexto unavailable. Shell conserva navegación y muestra `Información del estudiante no disponible`; Home conserva accesos, omite identidad/periodo inventados. Perfil puede mostrar su payload personal/académico con sidebar sin identidad si falta Formulario. Programación usa su propio alumno. Historial/Plan usan proyecciones propias sin contexto requerido. Reportes sin alumno no inventan semestre/resumen desde fila/seed.

StudentForms/Formulario en contexto null debe consultar su endpoint desde su ruta para mostrar el missing error específico, sin circularidad/root blocking; no fabricar formulario. Ficha opaque viewer es independiente del Formulario. Ficha local-v1 utiliza alumno propio de su DTO donde esté disponible y no depende de Perfil. Consumer que actualmente accede a student/formulario sin guard debe narrow null; todas las llamadas identificadas se cubren por tarea cliente. Mock/legacy disponen de contexto válido previo y conservan comportamiento.

## Interfaces compartidas e internas

Mantener validators MC/MIC/PE sin volver a especificarlos. Agregar módulos puros `shared/additional-snapshots-wire.mjs` y `.d.mts` con exports:

- `AdditionalSnapshotKey = 'asistencias'|'evaluaciones'|'deudas'|'tutoria'`.
- `AdditionalSnapshotRepresentation = 'candidate-v1'|'opaque-array'|'opaque-json'|'local-v1'`.
- `AdditionalSnapshotEnvelope = WireJsonObject & {message:string|null;codError:null;data:WireJson}`.
- `AsistenciasWireRow`, `AsistenciasWireEnvelope` según el esquema anterior.
- `validateAdditionalSnapshotWire(key:AdditionalSnapshotKey,value:unknown): asserts value is AdditionalSnapshotEnvelope`; candidate/opaque especificados por key, no autoriza local-v1.
- `AdditionalSnapshotValidationError extends Error` seguro.

Backend `SnapshotEnvironment = Readonly<Record<string,string|undefined>>`; `resolveSnapshotSource(scope:'matricula'|'miInformacion'|'plan',env:SnapshotEnvironment): {kind:'disabled'} | {kind:'configured';directory:string;mode:'legacy'|'aggregate'}` en `backend/src/common/sum-snapshot-config.ts`; validación global SUM/config, prioridades/fixture conflicts exactos. Nuevas cuatro fuentes utilizan solo SUM. Helpers actuales aceptan option `allowMissing` exclusivamente cuando source.mode aggregate; defaults legacy mantienen comportamiento previo.

ReportesRepository ya singleton compartido: carga cuatro nuevos archivos desde SUM mediante helper `additional-snapshots.ts`; `readAdditionalSnapshot(key)` retorna `{kind:'disabled'}|{kind:'missing'}|{kind:'snapshot';envelope;representation}` con clones. Asistencias/Tutoría consumen ese repo por DI existente o ReportesModule añadido a Tutoría, sin provider duplicado ni módulo global nuevo. ReportesService utiliza adicional para Evaluaciones/Deudas. Cada service/controller emite header y conserva envelope; missing lanza503. El repo aggregate activo no consulta readFormulario para construir snapshots. No agregar seed de unknown[] ni columna nueva de deuda.

Cliente metadata additional en WeakMap fuera del JSON, `rememberAdditionalRepresentation(response,representation)` / `getAdditionalRepresentation(response)`; ampliar ApiResponseMap de las cuatro keys con union propia/wire. Parser intercepta header additional local antes de validators exactos/invariantes synthetic. Conservar firmas MI/Plan; si agrega sexto argumento optional additional, documentarlo y no romper los cinco anteriores. Ficha viewer usa metadata MI existente. Opaque narrow nunca se casteará a DTO local.

## Foto del estudiante: componente/hook propios

Petición adicional expresa del usuario: componente reusable y hook para convertir `alumno.foto` base64 en imagen. Fuente local sanitizada `raw-types/matricula-formulario-datos.ts` declara **foto:string**; no se leyó un payload ni se constató su MIME/formato. Los formatos siguientes son decisiones locales para el componente, no variantes SUM observadas.

`useStudentPhoto(photo:string|null|undefined):StudentPhotoState`, unión `{status:'ready';src:string} | {status:'empty'|'invalid'}`. Input ausente/empty → empty. Aceptar data URI solo `data:image/png;base64,...`, `image/jpeg`, `image/gif` o `image/webp`; sin otros parámetros, URLs externas o SVG. Para base64 desnuda aceptar alfabeto estándar RFC4648, padding trailing válido opcional, sin whitespace/URL-safe; normalizar padding solo para decodificación local, no modificar el campo original. Longitud módulo4=1, caracteres inválidos o padding/bits no canónicos → invalid. No extraer base64 arbitrariamente desde un string desconocido.

Tras decodificar, detectar MIME por firma binaria PNG8bytes, JPEG FF D8 FF, GIF87a/GIF89a o RIFF con WEBP bytes8..11. Data URI declarada debe coincidir con firma; base64 desnuda obtiene MIME solo de firma conocida. Firma desconocida/truncada → invalid, sin inventar tipo. Tope local explícito **5 MiB decodificados**, comprobado también en longitud codificada antes de decodificar para evitar asignaciones ilimitadas. No recalcular ni copiar foto al backend/persistencia/logs/evidencia.

Crear Blob de MIME detectado y una URL propia `URL.createObjectURL` desde Effect; cleanup revoca exactamente esa URL al reemplazar input y desmontar, incluido ciclo extra de StrictMode. No crear URL en render ni revocar URLs ajenas. Al cambiar input no retornar el src anterior como si perteneciera al nuevo alumno; invalid/empty nunca reutilizan una foto previa. Source retenida solo lo necesario en memoria del componente.

`StudentPhoto({photo,alt,className?})`, alt requerido, img ready con onError que muestra fallback local de icono cuando decoder de imagen rechaza bytes. Empty/invalid también fallback accesible; no imprimir el input/error nativo. No enlace a `urlFoto`, request remoto, cache/storage, logging, canvas/export/download/copy de foto. Añadir CSS propio mínimo para object-fit, sin redesign global.

Integración planificada **solo avatar de Profile** como decisión de UI propia autorizada por la petición: usar `formulario?.data.alumno.foto` de contexto validado, alt `Foto de <nombre del contexto>` si existe o `Foto del estudiante`. Perfil no tiene foto en su propio payload; no atribuirla a ese endpoint. Contexto unavailable/empty/invalid → icono previo. Shell no recibe foto en esta revisión porque no hay evidencia de avatar allí ni requisito expreso de esa ubicación. Componente/hook quedan reusable sin integración adicional inferida.

Documentación React consultada por Context7 `/reactjs/react.dev`: Effect cleanup antes de deps nuevas/desmontaje y ciclo extra de StrictMode; respalda el ciclo de recurso propio, no formato de foto SUM. Comprobaciones de implementación build/lint únicamente; no pruebas, payload privado, browser/screenshots ni servidores.

## Escenarios y aceptación

| ID | Precondiciones / acción | Resultado requerido |
| --- | --- | --- |
| SS-ALL | SUM con catorce archivos sintéticos válidos; entrar a cada ruta | Cada endpoint usa su archivo/representación; typed mappings o viewer, sin fixture substitution |
| SS-PARTIAL | SUM válido solo con Deudas o Plan, Formulario ausente; navegar | App/navegación operativa, dato disponible mostrado; otras rutas503, identidad unavailable |
| SS-OVERRIDE | SUM y env legacy de scope definidos con directorios sintéticos distintos | Scope completo usa override sin fallback por archivo; requisitos legacy conservados |
| SS-INVALID | Presente ilegible/JSON/tipo/literal/codError inválido | Diagnóstico seguro y arranque abortado; no downgrade opaque ni falso éxito |
| SS-OPAQUE | Arrays con distintos JSON y Deudas/Ficha de forma no tipada | Envelope completo visible sin semántica/table/acciones inventadas ni HTML ejecutado |
| SS-ATTEND | Asistencias estructural válida con porcentajes no calculados como seed/filas distintas/duplicadas | Valores originales/identidades por fila; no validar fórmulas académicas |
| SS-CONTEXT | Formulario válido/ausente/contrato inválido | Ready/unavailable/error distintos; no mock por falla ni bloqueo global por missing tipado |
| SS-REPEAT | Consultas/reload/concurrencia, reinicio con mismo contenido | Readonly/copias/carga única; resultados equivalentes, sin nuevas escrituras |
| SS-LEGACY | SUM ausente | Env legacy/fixtures/modos anteriores vigentes, sin importación inesperada |

Escenarios para verificación sintética futura autorizada; no ejecutados aquí. Implementación exige build/lint ambas capas y revisión estática; no añadir/ejecutar tests, servidores ni browser/HTTP en este encargo. Una carpeta privada no se usa para comprobaciones. Compatibilidad total con todos los posibles JSON, producción y mapping académico completo siguen unverified; tipos futuros habilitan ampliación concreta.
