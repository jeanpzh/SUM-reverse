# Snapshots locales de Plan de Estudios

- Revisión **PE-SNAPSHOT-1**, 2026-10-09. Estado **listo para implementación de decisiones locales delimitadas**, no implementado/verificado por esta planificación Sol High.
- Amplía solo RI-PLAN de [RI-CONTRACT-1](remaining-implementation.md); reutiliza la ruta/módulo/fixtures existentes y mecanismos readonly de [Matrícula](matricula-compatibility.md) y [Mi Información](mi-informacion-compatibility.md), sin cambiar sus catálogos.
- Plan ejecutable: [plan-estudios-snapshots](../../plans/plan-estudios-snapshots.md). Sin APIs SUM, endpoints nuevos, auth, ORM, escrituras ni dependencias nuevas.

## Fuentes, reglas observadas y límites

| Fuente | Respalda | No establece |
| --- | --- | --- |
| `raw-types/plan-studios.ts`, tipo local sanitizado | Envelope/array, catorce campos de cada fila y aliases literales | Respuestas completas actuales, origen de identidad, reglas de avance/elegibilidad o semántica de prerrequisitos |
| `evidence/sum/plan-estudios/structure.md` | Ruta/título, tabla siete columnas Esp./Asignatura/Créd./Tipo/Grupo/Pre-Requisito/Grupo y control Descargar | Valores de filas o funcionamiento de descarga |
| `interactions.md` en esa carpeta | Navegación observada, filas/descarga no accionadas | Efectos o formatos de descarga SUM |
| `measurements.md` en esa carpeta | Medidas históricas de shell/tabla en viewport 1536×735 | Comparación visual integral; no hay captura sanitizada ni filas retenidas |
| RI-PLAN y código actual explorado con CodeGraph | Fixture propio8filas/empty, controller/pipe/repo, transport y validator UI estrictos | Que unicidad, signos, contexto común y consistencia de prerrequisito sean reglas SUM |
| Plan de exportación existente | Nombre canonical `plan-estudios.json` | Que exista o sea válido un archivo privado concreto |

**Reglas observadas en fuentes locales:** el tipo exige `codPlan:'2018  '`, `tipoAsignatura:'E'|'O'`, `codGrupo/codGrupoPre:'GEG'|'--'`. El validator actual añade signos, unicidad, consistencia de campos de prerrequisito e igualdad con alumno del shell; esos son requisitos del seed propio, no wire candidato.

**Hipótesis:** una futura exportación puede describir otro plan/código y requerir revisar el tipo. Esta revisión no generaliza esos literales: evidencia nueva sanitizada debe respaldar una ampliación explícita.

**Decisión local de Sol:** separar candidate-v1 conservado de local-v1 del fixture, señalarlos fuera del JSON y aplicar solo los tipos del esquema fuente al candidato. Presentar siete columnas con correspondencias directas; no fabricar semántica académica ni comprobar la identidad contra el shell. Esta planificación no verifica producción.

## HTTP y representaciones

Mantener ruta de vista `/alumnoWebSum/v2/planEstudios`, clave cliente `plan`, endpoint propio `POST /alumnoWebSum/v2/planEstudios?accion=obtenerPlanEstudios`. DTO y pipe actuales: una acción literal, body ausente o `{}`, sin parámetros para archivo, alumno, filtro o periodo. Conservar errores400/404/parser de RI-CONTRACT-1.

HTTP200 JSON incluye `X-SUM-PLAN-Representation: candidate-v1 | local-v1`:

- Directorio snapshot configurado y archivo válido → candidate-v1, envelope original clonado completo.
- Directorio snapshot ausente → local-v1, fixture existente/envelope propio anterior.

No usar opaque ni override local para este snapshot. La cabecera es configuración del proceso, no dato del request; no requiere Vary, CORS nuevo ni clave en envelope. Cliente local exige una de las dos opciones y valida su forma antes de renderizar. No determinar representación por forma coincidente ni ausencia de campos.

Candidate-v1: objeto envelope con `message:string|null`, `codError:null`, `data:PlanEstudiosWireRow[]`; todos los campos son requeridos. message string permitido por política local de conservación de envelopes, no demuestra otra respuesta SUM. Extras JSON en envelope/fila se conservan recursivamente. No transformar message ni reconstruir envelope. Conservación semántica JSON, no bytes/whitespace/orden textual/claves duplicadas.

Local-v1 mantiene RI-PLAN: `{message:null,codError:null,data:PlanEstudiosRow[]}`, fixture8filas o `[]`, restricciones de seed vigentes. Validarlas solo en esta representación; no reutilizarlas para rechazar un candidato válido.

## Esquema candidate-v1 y validación runtime

Fuente exhaustiva: `raw-types/plan-studios.ts` con política local JSON explícita:

| Tipo requerido | Campos |
| --- | --- |
| string, vacío permitido y preservado | codAsignatura, desAsignatura, codAsignaturaPre, desAsignaturaPre |
| literal exacto `'2018  '` | codPlan; conservar sus dos espacios, no trim/coerción |
| number finito | codFacultad, codEscuela, codEspecialidad, ciclo, creditos, creditosPre |
| literal `'E'` o `'O'` | tipoAsignatura |
| literal `'GEG'` o `'--'` | codGrupo, codGrupoPre |

Array vacío válido. Clave faltante, null en campo tipado, número string, alias desconocido o tipo incorrecto es error; no default/coerción. Valores negativos/fraccionarios finitos no se rechazan por reglas no tipadas. No exigir códigos iguales a otros módulos/alumno, filas únicas, ciclos positivos, strings de curso no vacíos ni que ambos campos de prerrequisito estén simultáneamente llenos. Preservar listas en orden recibido, duplicados y todos los campos sin normalizar.

Nuevo módulo puro compartido `shared/plan-estudios-wire.mjs` y `shared/plan-estudios-wire.d.mts`, sin fs/HTTP/DOM/dependencias ni imports runtime raw-types. Declaración importa WireJson/WireJsonObject de `shared/matricula-wire.mjs`. Exports fijados:

- `PlanEstudiosRepresentation = 'candidate-v1'|'local-v1'`.
- `PlanEstudiosWireRow = WireJsonObject &` todos los campos de la tabla con sus tipos exactos.
- `PlanEstudiosWireEnvelope = WireJsonObject & {message:string|null;codError:null;data:PlanEstudiosWireRow[]}`.
- `validatePlanEstudiosWire(value:unknown): asserts value is PlanEstudiosWireEnvelope`; valida envelope/candidato y extras, sin transformar value.
- `PlanEstudiosWireValidationError extends Error`; solo sus mensajes de rutas conocidas son diagnósticos seguros reutilizables por importador.

Excluir undefined, Date runtime, NaN/Infinity, funciones, prototipos no JSON y ciclos. Error seguro: `plan.data[2].creditos: se esperaba number finito` o `plan.data[2].codPlan: literal no admitido`. Distinguir campo ausente. Extras desconocidos usan `[extra]`, sin copiar nombres/valores que podrían contener identificadores. No incluir el valor recibido ni directorio absoluto/cause/errores nativos.

## Configuración, archivo y ausencia

Variable nueva **`PLAN_ESTUDIOS_SNAPSHOT_DIR`**, opt-in de proceso: ausente conserva fixture y `PLAN_ESTUDIOS_FIXTURE` anteriores. Definida exige ruta absoluta no vacía y directorio existente/accesible; leer exclusivamente **`plan-estudios.json`**, sin listar directorios/glob/autodetectar ZIP ni leer manifest.

No heredar automáticamente `MATRICULA_SNAPSHOT_DIR` ni `MI_INFORMACION_SNAPSHOT_DIR`: el operador puede definir las tres variables con el mismo directorio para activar cada catálogo explícitamente. Puede también usar directorios distintos. Cada módulo conserva su configuración; no deducir correspondencia de identidad entre archivos. No modificar el loader Matrícula ni requerir sus cinco archivos para Plan standalone.

Con directorio Plan definido, cualquier definición de `PLAN_ESTUDIOS_FIXTURE` es conflicto, incluso populated; abortar con diagnóstico de nombres de variables. `REPORTES_FIXTURE` sigue configurando sus propios módulos y no es conflicto con Plan snapshot; este repositorio no lee Reportes para completar snapshots ni generar identidad. Mantener política de conflictos Matrícula/MI intacta.

Directorio inválido/inaccesible aborta arranque. En directorio válido, archivo ENOENT deja catálogo en estado missing; consultar Plan devuelve HTTP503 `{message:'plan.plan-estudios.json: snapshot no disponible',codError:'SNAPSHOT_MISSING',data:null}`. No reemplazarlo por fixture ni tratarlo como `[]`. Archivo presente ilegible, JSON inválido, respuesta de error codError no null o esquema inválido aborta arranque antes de servirlo. No modificar/detectar otros datasets para resolver un archivo faltante.

Carga una vez al constructor, memoria readonly por proceso, clones profundos por lectura y reinicio para recargar. Repetición/concurrencia/recarga no alteran catálogo; sin escrituras/reservas/transacciones. El operador inicia backend privado fuera del acceso de agentes; agentes no ejecutan lectura privada ni acceden indirectamente por browser/API/logs/procesos. El loader no promete sanitización.

## Datos que permanecen locales y proyección UI

El snapshot es solo un array de filas, sin alumno/periodo/nombres de institución. El shell continúa con su propia fuente Formulario root (candidata o fixture según su configuración), sin trasplantar datos ni afirmar correspondencia con el array Plan. Para Plan candidate-v1 omitir el StudentSummary académico de esa pantalla: no mostrar su alumno/plan como si viniera de este archivo. Header/navegación globales permanecen contexto de la aplicación. Local-v1 conserva su resumen/seed propios; no declarar integración contextual del conjunto.

Reutilizar las siete columnas/orden del layout observado. Adaptador candidato propio `toPlanCandidateRows(data:PlanEstudiosWireRow[]):string[][]`:

| Columna | Proyección directa |
| --- | --- |
| Esp. | String(codEspecialidad) |
| Asignatura | codAsignatura + `' - '` + desAsignatura |
| Créd. | String(creditos), sin redondeo/sumas |
| Tipo | tipoAsignatura literal E/O, sin convertirlo a etiquetas inferidas |
| Grupo | codGrupo literal |
| Pre-Requisito | Si ambos strings no vacíos, código + `' - '` + descripción; si solo uno está presente, ese string; si ambos vacíos, celda vacía |
| Grupo final | codGrupoPre literal |

No mostrar `Ninguno` por campos vacíos: ausencia de texto no demuestra inexistencia de regla. `creditosPre`, `ciclo`, `codFacultad`, `codEscuela`, `codPlan` y extras permanecen en el DTO completo sin inventar columnas/reglas; no agrupar o eliminar filas. No resolver prerrequisito contra otras filas ni deducir elegibilidad, equivalencia, curso aprobado, disponibilidad o progreso. Todas las cadenas como texto React, sin HTML.

Vacío `data:[]` renderiza siete headers y `No hay registros`. Error/503 reutilizan RouteError/reintento con mensaje seguro `Información aún no disponible.` para SNAPSHOT_MISSING. Cabecera/esquema inválidos producen error claro; nunca fallback a mock/seed.

CSV existente es una descarga **propia local**, no formato/efecto SUM observado. Para candidato, rótulo `Descargar CSV local`, siete columnas y todas las filas de la proyección en orden; `[]` exporta solo headers. No afirmar que CSV preserva los catorce campos/extras del JSON. Fixture/mock mantienen la presentación local previa Obligatorio/Electivo/Ninguno. Descarga SUM y fidelidad visual completa siguen unverified.

## Frontera cliente

ApiResponseMap.plan acepta envelope propio o PlanEstudiosWireEnvelope con alias exactos y extras. El parser local de Plan intercepta la respuesta **antes** de exigir message null/envelope exacto de otras consultas. En candidate-v1 usa validator shared; en local-v1 usa validator RI-PLAN existente. Extender `parseResponse(key,value,local=false,miRepresentation?,planRepresentation?)` con quinto argumento opcional y exigirlo solo para Plan HTTP local; preservar el argumento MI anterior. `readHttpResponse` valida/extráe cabecera Plan y lo pasa; no modificar transporte/query/método/credentials/AbortSignal.

En `client/src/data/planEstudios.ts`, metadata fuera del JSON mediante WeakMap: `rememberPlanEstudiosRepresentation(response:object,representation:PlanEstudiosRepresentation):void`, `getPlanEstudiosRepresentation(response:object):PlanEstudiosRepresentation|undefined`. Local sin metadata falla, no deduce forma. Mock/api conservan modo y comportamiento previos sin nueva cabecera remota ni consultas. En pantalla candidate no invocar el validator que compara alumno o impone seed; local-v1 conserva su flujo. Mantener JSON original validado como retorno del transporte, sin propiedades nuevas de metadata.

503 local para clave plan valida el envelope exacto/error seguro anterior y genera el mensaje de producto propio. No copiar message/cuerpos arbitrarios de red. Ningún endpoint selecciona datasets o expone diagnostics/raw para agentes.

## Escenarios y aceptación delimitada

| ID | Precondición / acción | Resultado esperado y efecto |
| --- | --- | --- |
| PE-CANDIDATE | Operador configura directorio con envelope válido; cliente local carga ruta | candidate-v1, JSON conservado y siete columnas mapeadas; sin resumen/validación cruzada synthetic ni escritura |
| PE-SEED | Sin env nueva; mock o fixture local previos | Mismos datos/controles/checks del seed; no adquirir snapshot automáticamente desde MATRÍCULA |
| PE-EMPTY | Snapshot válido con data[]; cargar/recargar | Empty siete headers; conserva message/extras; CSV headers; no fallback |
| PE-MISSING | Directorio válido sin archivo; consultar ruta | 503 SNAPSHOT_MISSING, UI disponibilidad y reintento; no seed |
| PE-INVALID | Configuración/directorio/archivo presente inválidos | Arranque falla seguro; alias/campo faltante/tipo incorrecto distinguidos; sin valores/cause |
| PE-EXTRAS | Candidate con extras, duplicados, números finitos no propios del seed y campos de prerequisito disparejos | Conservación completa; no rechazar reglas no tipadas ni rellenar campos |
| PE-REPEAT | Repetición/concurrencia/recarga; archivo modificado y luego reinicio por operador | Catálogo immutable/copies; cambia solo tras reinicio, sin persistencia de escritura |

Escenarios definidos para futuras verificaciones sintéticas autorizadas; no ejecutados en planificación. En implementación de esta sesión solo build/lint y revisión estática, sin añadir/ejecutar tests, servidores o browser/HTTP. Integración, JSON real, descarga SUM, filas completas y semántica académica no verificados. El alcance listo corresponde a este contrato propio basado en el tipo local; otro plan/literal exige revisar evidencia/tipo, no relajar silenciosamente validator.
