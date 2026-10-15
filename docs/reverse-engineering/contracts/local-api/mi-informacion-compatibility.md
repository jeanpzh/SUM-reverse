# Compatibilidad offline de Mi Información

- Revisión vigente **MIC-CONTRACT-2**, 2026-10-09. Amplía MIC-CONTRACT-1 exclusivamente con Historial candidato. Infraestructura anterior implementada según el plan; esta ampliación está **lista para implementación**, sin implementación ni comprobación funcional por el planner.
- Amplía [mi-informacion-api-v1](mi-informacion.md) y reutiliza [MC-CONTRACT-1](matricula-compatibility.md). El contrato propio, sus cabeceras y su almacenamiento son `local-only`.
- Plan: [mi-informacion-compatibility](../../plans/mi-informacion-compatibility.md). Mantener el backend NestJS existente y las cuatro consultas de lectura; no agregar endpoints de importación, escritura ni llamadas a SUM.

## Fuentes y certeza

| Fuente | Lo que respalda | Límite |
| --- | --- | --- |
| `raw-types/README.md`, `raw-types/mi-perfil.ts` | Evidencia previamente proporcionada por operador desde Network/fetch/XHR: ruta/acción y forma de Perfil con 28 campos | Esquema candidato de muestras; no demuestra todas las respuestas posibles ni formato ISO de nacimiento |
| `raw-types/matricula-formulario-datos.ts` | Forma de Formulario: alumno, flags, mapa formulario y política | No hay asociación entre claves de formulario y los controles visibles |
| `raw-types/historial.ts`, leído localmente el 2026-10-09 | Tipo sanitizado aportado: Data, HistorialElement y Promedio; fuente exhaustiva de campos de Historial candidato | Esquema fuente local, no respuesta ejecutada ni verificación de producción; sin semántica de creditaje, aprobación o criterioCalificacion |
| `evidence/sum/mi-informacion/observations-2026-10-08.md` y cuatro especificaciones de pantalla | Rótulos, secciones, navegación y estructura visibles sanitizados | No cuerpos completos de Historial/Ficha ni significado de claves de formulario |
| `evidence/sum/matricula-compatibility/public-js/informacion.js` | Fuente frontend ya proporcionada contempla `formulario==null` | No demuestra estados reales adicionales ni autoriza ejecutar matrícula |
| Contrato previo, implementación y fixtures propios | Formas locales explícitas de Historial/Ficha y secciones de Formulario | No convertir estas formas en normalizadores de JSON SUM |
| Plan de exportación existente | Nombres `mi-perfil.json` y `formulario-datos-matricula.json` | No exporta Historial/Ficha sin contrato SUM suficiente |

**Observado por inspección estática local:** los servicios recomponen envelopes; `miInformacion.ts` exige claves exactas, fecha ISO y secciones locales; StudentForms completa valores no asociados con demostraciones. Esas restricciones impiden aceptar los candidatos originales.

**Hipótesis:** otras muestras podrían incluir extras, nulls adicionales o formas distintas. No se las acepta automáticamente como si hubieran sido observadas.

**Decisión Sol:** separar conservación JSON, validación del candidato y representación local explícita. Perfil/Formulario/Historial tienen formas candidatas; Ficha mantiene únicamente forma propia u opaca. Historial candidato tiene `historial/promedios/creditaje`, distintos de `alumno/resumen/periodos/asignaturas` del DTO propio: se proyecta directamente, sin completar el resumen local. El operador comunicó que Perfil puede redirigir a Inicio; su archivo no es prerrequisito de Formulario.

## HTTP y selección de representación

POST readonly bajo `/alumnoWebSum/v2/informacion/`, `accion` única, body ausente o `{}`. Pipes, prioridad de errores 400 y métodos no registrados 404 siguen el contrato previo. No se seleccionan archivos, actor o periodo mediante query/body.

| Clave backend / cliente | Ruta / acción | Archivo fijo | Obligatorio | Representación snapshot |
| --- | --- | --- | --- | --- |
| perfil / perfil | perfil / obtenerInformacionAlumno | `mi-perfil.json` | No | `candidate-v1` |
| historial / historial | historial / obtenerHistorialAcademico | `historial-academico.json` | No | `candidate-v1`; `local-v1` solo por declaración explícita |
| formularioDatos / formulario | formularioDatos / obtenerFormularioDatosMatricula | `formulario-datos-matricula.json` | Sí | `candidate-v1` |
| fichaSocioeconomica / fichaSocioeconomica | fichaSocioeconomica / obtenerFichaSocioeconomica | `ficha-socioeconomica.json` | No | `opaque`; `local-v1` solo por declaración explícita |

Los nombres Historial/Ficha son una convención nueva del importador **propio**; no afirman que el exportador los genere ni que estas acciones sean SUM.

MIC-CONTRACT-2 conserva nombre, opcionalidad, ruta/acción propia y error 503 de Historial. Sin override local explícito, archivo Historial presente exige el candidato nuevo: no intentar opaque/local-v1 tras fallar su validación. Un archivo opaco admitido anteriormente debe ajustarse al nuevo esquema o aportar evidencia para una revisión; no publicar un falso éxito de compatibilidad.

Cada éxito HTTP200 incluye `X-SUM-MI-Representation: candidate-v1 | local-v1 | opaque`. Fixtures existentes: `local-v1` para las cuatro consultas. Esta cabecera no se introduce dentro del envelope. No depende de un header del request y no requiere `Vary`; tráfico local mediante proxy same-origin existente, sin nueva configuración CORS.

Éxito snapshot: envelope objeto con `message:string|null`, `codError:null`, `data` presente y esquema según representación. Permitir/preservar extras JSON recursivos en envelope y datos. Devolver copia profunda del envelope completo; no recomponer message ni agregar secciones. Conservación **semántica JSON**, no whitespace, orden textual, claves duplicadas ni bytes originales.

Archivo opcional ausente (`ENOENT`): su consulta devuelve HTTP503 `{message:'<clave>.<archivo>: snapshot no disponible',codError:'SNAPSHOT_MISSING',data:null}`. Construir texto exclusivamente con los nombres fijos de esta tabla. No devolver fixture ni `data:null` como éxito. Archivos presentes pero ilegibles, JSON inválido, éxito con esquema inválido o `codError` no nulo abortan arranque, incluso si el archivo es opcional. No publicar un catálogo parcialmente válido.

## Validadores y tipos de transporte

Un módulo puro nuevo, explícitamente compartido por ambas capas, `shared/mi-informacion-wire.mjs` con `shared/mi-informacion-wire.d.mts`. Sin fs/DOM/HTTP/dependencias. No editar raw-types ni el validator de Matrícula. Declaraciones reutilizan los tipos JSON de `shared/matricula-wire.mjs`, sin importar raw-types en backend.

Exports fijados:

- `miInformacionWireKeys`: tuple readonly `['perfil','historial','formularioDatos','fichaSocioeconomica']`.
- `MiInformacionWireKey`: unión anterior; `MiInformacionRepresentation = 'candidate-v1'|'local-v1'|'opaque'`.
- `MiInformacionWireEnvelope = WireJsonObject & {message:string|null;codError:null;data:WireJson}`.
- `validateMiInformacionWire(key:MiInformacionWireKey,value:unknown,representation:MiInformacionRepresentation): asserts value is MiInformacionWireEnvelope`.
- `MiInformacionWireValidationError extends Error`: identifica únicamente los diagnósticos seguros producidos por el validator. El importador reemplaza cualquier otro error por un motivo constante, sin copiar mensajes nativos.

La función valida y no transforma. Una combinación no permitida por la tabla HTTP falla. Tipos de vista propios siguen separados de `WireJson`; no afirmar que opaco es HistorialLocalData mediante un cast.

Reglas comunes candidatas, consistentes con MC-CONTRACT-1: string permite vacío sin parsear fechas; number finito sin coerción/signo/entero implícitos; boolean exacto; objetos/arrays con todos los campos requeridos; extras cualquier JSON recursivo. Los campos cuyo candidato es exclusivamente null se conservan como JSON opaco por decisión local. No extender nulabilidad a otros campos sin revisión. Excluir undefined, Date runtime, NaN, Infinity, funciones y ciclos en las entradas del validator.

### candidate-v1: Perfil

Los 28 campos requeridos y tipos provienen exhaustivamente de `raw-types/mi-perfil.ts`: 25 strings y `anioEstudio`, `promedio`, `promUltMat` numbers finitos. `fechaNacimiento` sigue siendo string literal: no imponer ISO, usar Date ni cambiar zona/formato. No introducir reglas de notas o año académico. Extras se conservan. La UI puede presentar sus paneles personal/académico ya respaldados, incluido Domicilio; ambas ramas usan los datos recibidos, independientemente del modo de transporte.

### candidate-v1: Formulario

Campos requeridos: `alumno`, `formulario`, `politicaPrivacidad`, `llenar`, y los nueve flags `datosPersonalesCompletado`, `colegioCompletado`, `actividadProfesionalCompletado`, `dependenciaEconomicaCompletado`, `recursosEstudioCompletado`, `transporteCompletado`, `saludCompletado`, `interesAcademicoCompletado`, `contactoCompletado`.

Validar **todos** los campos de Alumno, InfoMatricula e InfoSemestre del archivo candidato con las reglas comunes. Los Date de InfoSemestre son strings wire, sin normalización. `politicaPrivacidad` es JSON opaco; no renderizarlo como HTML. `formulario` permite null o un objeto JSON opaco: el candidato documenta mapa number|null; la ampliación local de valores a JSON conserva datos desconocidos sin atribuirles significado. Null está respaldado como rama de fuente frontend histórica. Arrays/primitivos en formulario siguen incompatibles en esta revisión.

`secciones` no es requerido en candidate-v1. Si aparece como extra, preservarlo e ignorarlo para la proyección candidata; su existencia no cambia la representación a local-v1. No buscar aliases, convertir el mapa a catálogo ni rellenar controles con perfil/seed. La ausencia de correspondencia semántica no es un registro vacío.

### candidate-v1: Historial

Fuente exclusiva del esquema: `raw-types/historial.ts`, tipo local sanitizado. No verifica producción ni establece método/acción de un endpoint SUM. Validar todos los campos requeridos:

| Objeto | Campos / tipo wire |
| --- | --- |
| data | `historial:HistorialElement[]`, `promedios:Promedio[]`, `creditaje:Record<string,number>`, `criterioCalificacion:boolean`, `anioIngreso:number`, `facultad:number`, `escuela:number` |
| Cada historial[i] | strings `codSemestre`, `codPlan`, `codTipoAsignatura`, `codAsignatura`, `desAsignatura`, `codTipoActa`, `numActa`; numbers `codFacultad`, `codEscuela`, `codEspecialidad`, `codSeccion`, `ciclo`, `creditos`, `calificacion`; JSON opaco `codAlumno`, `numResConv` |
| Cada promedios[i] | `semestre:string`, `promedio:number` |
| creditaje | Objeto con claves libres y **todos** sus valores number finitos; mapa vacío permitido |

Todos los números finitos, sin coerción ni requisitos de signo/entero, escala de notas o relaciones entre códigos. Arrays vacíos válidos; ningún array/objeto/campo requerido faltante equivale a vacío. Extras permitidos y conservados recursivamente. Las muestras de alias `CodTipoAsignatura='E'|'O'` y `CodTipoActa='P'` se amplían deliberadamente a string en el wire propio, según la política candidata de muestras, sin atribuir significados a otros códigos. Los campos tipados null en la muestra se conservan como JSON opaco por la regla común; no usarlos para identidad ni resolver resoluciones de convalidación.

Errores compartidos identifican rutas seguras como `historial.data.historial[0].calificacion` o `historial.data.promedios[0].semestre`, distinguiendo faltante de tipo incorrecto. Para valores del mapa creditaje usar `historial.data.creditaje[*]`, sin copiar su clave/valor. No convertir el candidato al DTO local con defaults.

Declarar/exportar `HistorialCandidateRow`, `HistorialCandidatePromedio` y `HistorialCandidateData` en `shared/mi-informacion-wire.d.mts`, con los campos/tipos de esta tabla e intersección WireJsonObject para conservar extras. Backend/client consumen esas declaraciones; no importar raw-types al runtime backend. Los exports anteriores y la firma `validateMiInformacionWire` permanecen iguales.

Proyección de pantalla candidate-v1, decisión de presentación local basada exclusivamente en campos del tipo:

| Elemento UI | Campo / representación |
| --- | --- |
| Resumen de datos de Historial | `anioIngreso` → Año de Ingreso; `facultad` → Código de Facultad; `escuela` → Código de Escuela; mostrar números recibidos como texto, sin resolver nombres ni validar identidad |
| Ciclo / Plan / Tipo | `ciclo` / `codPlan` literal sin trim / `codTipoAsignatura` literal |
| Asignatura | `codAsignatura + ' - ' + desAsignatura`, sin lookup |
| Calificación / Créditos / Sección / Acta | `calificacion` / `creditos` / `codSeccion` / `numActa`; números mediante String sin redondeo, coerción ni clasificación de aprobación |
| Periodo Académico | `codSemestre`, novena columna al final de la tabla candidata para conservar la asociación de cada fila; forma local-v1 conserva sus ocho columnas |
| Promedios por periodo | Tabla independiente de dos columnas Periodo Académico / Promedio: `semestre` / `promedio`, orden recibido y String(number), sin columna de créditos inventada |
| creditaje | Conservar completo en wire; no mostrar ni sumar claves sin semántica documentada |
| criterioCalificacion, codTipoActa y campos opacos | Conservar; no interpretar escala, acta, identidad o resolución, ni agregar controles académicos |

El resumen de aprobación del DTO local no se presenta en candidate-v1: no inferir asignaturas/créditos aprobados, promedio global/ponderado, matrícula vigente, ranking ni reglas académicas. El título de la tabla candidata de promedios es `Promedios por periodo`; el nombre `promedio` no prueba ponderación. Datos del shell proceden del Formulario requerido como contexto propio, claramente separado del resumen de Historial; no afirmar que codAlumno opaco identifica al alumno del Formulario. No requerir Perfil.

Mantener orden y duplicados de ambas listas; no agrupar, deduplicar o sumar por semestre. Búsqueda local existente por código/nombre de asignatura puede operar exclusivamente sobre `data.historial`, sin red, URL ni filtrado de promedios; su algoritmo es una decisión local. Historial vacío muestra `No hay registros académicos.`; promedios vacío muestra `No hay promedios registrados.`; no derivar el estado de un array del otro. Mantener controles/CSV candidatos ausentes si no tienen contrato; no exportar una proyección como el original completo.

Interfaces de proyección adicionales en `client/src/data/adapters.ts`: `toHistorialCandidateRows(data:HistorialCandidateData):string[][]` retorna las nueve columnas anteriores en ese orden; `toHistorialCandidatePromedios(data:HistorialCandidateData):string[][]` retorna semestre/promedio. No alteran el DTO ni incorporan datos de otros endpoints.

### opaque: Ficha

Validar envelope de éxito y JSON recursivo completo de data (null, escalar, array u objeto). No asumir alumno, periodos, asignaturas, familiares, secciones ni formatos de fecha. Conservar y servir ese JSON; la UI muestra `Información aún no disponible para mostrar.` sin tablas/familiares/descarga ficticios. Esta condición no se confunde con HTTP503, contrato inválido ni una lista local vacía. No mostrar JSON raw, nombres de sus claves desconocidas ni valores en el diagnóstico.

### local-v1: formas propias

Reutilizar los DTOs de `mi-informacion-api-v1` y las validaciones locales existentes: Perfil con fecha real YYYY-MM-DD/añoEstudio entero no negativo; Historial con alumno/resumen/periodos/asignaturas; Formulario con ocho secciones propias; Ficha con trece secciones/familiares. Mantener IDs/orden/counts y restricciones locales allí fijadas. La aceptación de extras JSON no elimina campos requeridos ni relaja los invariantes del DTO propio. Centralizar esas reglas en el módulo compartido; wrappers del cliente hacen narrowing después de validación, sin duplicar reglas.

Un snapshot Historial/Ficha solo adopta esta forma si su clave figura en `MI_INFORMACION_SNAPSHOT_LOCAL_KEYS`, CSV estricto con allowlist `historial,fichaSocioeconomica`. Ausente = Historial candidate-v1 y Ficha opaque; definido vacío, tokens desconocidos, whitespace o duplicados = configuración inválida. No se usa para Perfil/Formulario. Coincidencia estructural por sí sola no declara local-v1; el override historial exige el DTO local completo aunque el archivo tenga campos candidatos.

## Importación, privacidad y persistencia

`MI_INFORMACION_SNAPSHOT_DIR` opcional: ausente conserva fixtures y env existentes; definido exige ruta absoluta no vacía. Cargar el archivo obligatorio y solo los tres nombres opcionales fijos una vez en el constructor del repositorio. No glob/listado de directorio, autodetección de ZIP, watchers ni acceso a otros archivos. `MI_INFORMACION_SNAPSHOT_LOCAL_KEYS` definida sin directorio = error.

Con directorio MI definido, cualquier definición de `MI_INFORMACION_FIXTURE` o `REPORTES_FIXTURE` es conflicto, incluso populated. Se permite coexistencia con `MATRICULA_SNAPSHOT_DIR`; no comparar ni trasplantar identidades entre catálogos sin evidencia de contexto. No afirmar que módulos todavía sintéticos representan el mismo alumno. El modo MI snapshot nunca lee `ReportesRepository.readFormulario()` para completar datos ni identidad.

Persistencia readonly en memoria por proceso; copias profundas por lectura; reinicio necesario para recargar archivos. Repetición/concurrencia no mutan catálogo. No DB, ORM ni transacciones de escritura. Los agentes solo pueden usar fixtures sintéticos expresamente identificados; el operador inicia el proceso con snapshots privados fuera del acceso de agentes. Esta función no sanitiza ni garantiza ausencia de datos personales.

Diagnósticos: variable, clave fija, basename fijo, ruta de campo conocida y motivo constante; nunca valores, directorio absoluto, cuerpo, error nativo o `cause`. Para campos desconocidos usar segmentos `[extra]` y para mapas opacos `[*]`, evitando copiar claves que podrían ser identificadores. Distinguir campo requerido ausente de tipo incorrecto. El helper MI no hereda el `cause` del helper de Matrícula actual ni exige modificarlo.

## Frontera cliente y contexto

El parser intercepta las cuatro claves MI antes de la comprobación local de envelope exacto; recibe la representación desde la cabecera en HTTP local y valida con el módulo compartido. Cabecera local ausente/desconocida/incompatible = error explícito de contrato, sin deducir representación por shape. Mantener response JSON original como retorno. Guardar representación fuera del JSON, en WeakMap interno del módulo `miInformacion.ts`.

Interfaces cliente: `rememberMiRepresentation(response:object,representation:MiInformacionRepresentation):void`, `getMiRepresentation(response:object):MiInformacionRepresentation|undefined`; parser `parseResponse(key,value,local=false,miRepresentation?)` conserva sus tres argumentos anteriores y exige el cuarto para MI HTTP local. El lector HTTP proporciona la cabecera. En mock/api, conservar el comportamiento anterior explícito; no exigir cabecera de un servicio remoto ni nuevas consultas SUM. Vistas locales nunca usan ausencia de metadata como permiso para demo.

Tipos candidate-v1 del cliente amplían los candidatos exclusivamente según las reglas anteriores; Historial acepta envelopes con HistorialCandidateData o HistorialLocalData, Ficha conserva su unión local/opaca. Nueva proyección `toHistorialCandidateData(response):HistorialCandidateData|null` devuelve data tras validar candidate-v1, null exclusivamente ante local-v1; representación incompatible o metadata ausente en respuesta local falla. `toHistorialLocalData(response)` ahora devuelve null ante candidate-v1 y hace narrowing del DTO solo ante local-v1. `toFichaLocalData` mantiene su contrato anterior. La vista discrimina primero metadata y usa la proyección correspondiente; null de una proyección no significa respuesta vacía ni permiso para demo. Adaptadores de tablas locales consumen HistorialLocalData; los candidatos consumen HistorialCandidateData, sin indexar un union sin narrowing.

`readHttpResponse` distingue 503 SNAPSHOT_MISSING para estas cuatro claves: valida únicamente envelope seguro de error y genera mensaje de producto desde clave conocida, `Información aún no disponible.`. Otros errores HTTP conservan manejo existente. No propagar mensajes/cuerpos no validados de red. RouteError y reintento existentes muestran el mensaje seguro; no nuevos controles técnicos en producto.

El root loader sigue consultando **Formulario**, única fuente requerida para el alumno del shell; `useStudentFormData`/`useShellStudent` siguen operativos con la forma candidata completa. Perfil usa ese contexto y su propio snapshot, sin datos DEMO de respaldo. Formulario no carga Perfil en modo local. Ficha usa su alumno solo cuando es local-v1; no depende de Perfil. Historial local-v1 usa su propio alumno/resumen; candidate-v1 usa exclusivamente su resumen/tables definidos arriba. Opaque no muestra un resumen académico inventado.

StudentForms en candidate-v1 usa únicamente `alumno` y flags validados: encabezado/resumen del alumno, código y nombre en Datos Personales, correo institucional del alumno donde se presenta ese dato. Mantener ocho títulos/anclas respaldados y controles readonly; para campos sin mapping documentado mostrar `Información no disponible`, sin `Dato de demostración` ni `No registrado` que sugiera un registro ausente. Fechas no mapeadas no se pasan a input date con texto: value vacío más texto de estado. Mostrar estado Completado/Pendiente desde los flags ya mapeados por el cliente; conservar actividadProfesional sin inventar una sección. Aviso breve `Hay datos del formulario que aún no se pueden mostrar.`. Sin CSV candidato de campos no mapeados; descarga deshabilitada con mensaje de disponibilidad. Local-v1 conserva presentación/CSV propios. Mock conserva demostración explícita consistente anterior.

## Aceptación y límites

MIC-* del plan fijan conservación, opcionales, validación, cabeceras, fuente de identidad y representación. MIC-H-* añade los criterios de esta revisión. Solo build/lint y revisión estática están autorizados para implementación en este encargo; no añadir/ejecutar tests, servidores o verificación browser/HTTP. No declarar integración, equivalencia visual ni compatibilidad 100% sin escenarios autorizados y evidencia equivalente. El tipo local Historial permite esta proyección acotada y no verifica producción. Ficha, significado de creditaje/criterioCalificacion y mapping de formulario siguen pendientes; no inspeccionar snapshots privados ni solicitar valores reales.
