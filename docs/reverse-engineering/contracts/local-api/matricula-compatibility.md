# Compatibilidad incremental de Matrícula

- Revisión: **MC-CONTRACT-1**, 2026-10-08. **Lista** para wire, reproducción offline y presentación de lecturas respaldadas. El transporte/almacenamiento propio es `local-only`; métodos y bindings de UI llevan evidencia frontend explícita, sin constituir recuperación de backend SUM.
- Alcance: cinco lecturas ya existentes y reproducción offline de sus envelopes JSON sanitizados. No inscripción, confirmación, reserva, cupos, pagos, autenticación ni transacciones.
- Reutiliza [MI-CONTRACT-1](matricula-informacion.md), [RI-CONTRACT-1](remaining-implementation.md) y [reportes-api-v1](reportes.md). Conserva rutas, acciones, DTOs de consulta, códigos HTTP, proxy, fixtures predeterminados y transporte. Esta revisión modifica únicamente la aceptación de respuestas wire de Matrícula; las reglas estrictas del seed RI-PROG siguen documentando el seed, no los posibles snapshots externos.
- Plan de ejecución: [matricula-compatibility](../../plans/matricula-compatibility.md).

## Fuentes y alcance de certeza

`raw-types/matricula-info.ts`, `programacion-asignaturas.ts`, `reporte-pre-matricula.ts`, `reporte-matricula.ts` y `reporte-horario.ts` son candidatos obtenidos anteriormente, no esquemas normativos de todos los estados SUM. La implementación actual prueba formas propias. No se ha entregado un JSON real sanitizado para comprobar esta revisión. La captura de un valor null o un literal no demuestra que el campo siempre tenga ese valor. Nueva evidencia persistente: [comportamientos](../../../../evidence/sum/matricula-compatibility/behavior.md), [informacion.js](../../../../evidence/sum/matricula-compatibility/public-js/informacion.js), [programacion.js](../../../../evidence/sum/matricula-compatibility/public-js/programacion.js) y [provenance](../../../../evidence/sum/matricula-compatibility/public-js/provenance.json), obtenida por root y leída offline por planner.

**Observado localmente por inspección estática:** `JsonValue` ya convierte Date a string; `parseResponse` conserva el objeto de entrada; el DTO de artículo es distinto del DTO académico; programación impone claves exactas y relaciones del seed; los reportes validan solamente campos usados por UI. Los servicios actuales forman envelopes nuevos desde repositorios sintéticos.

**Hipótesis:** futuros snapshots pueden contener más claves, horarios distintos de los literales enumerados y valores en campos cuyo único ejemplo es null. No se afirma que estas variantes hayan aparecido en producción.

**Decisión local:** reconocer el esquema candidato completo sin destruir información adicional, conservar tipos JSON y separar proyección visual de datos wire. Una nueva forma incompatible se diagnostica; no se rellena con datos sintéticos.

## HTTP sin cambios

Prefijo `/alumnoWebSum/v2/`; POST con `accion` única, body ausente o `{}`, HTTP200 JSON. Reutilizar pipes existentes para 400 `INVALID_ACTION`/`INVALID_QUERY`/`INVALID_BODY` y parser JSON; otros métodos no registrados404. No query/body para elegir snapshot o actor.

| Clave | Ruta | accion | Respuesta en modo snapshot |
| --- | --- | --- | --- |
| matriculaInfo | matricula/informacion | obtenerInformacion | Envelope de `matricula-info.json`, forma académica raw |
| programacion | matricula/programacion | obtenerProgramacionAsignaturas | Envelope de `programacion-asignaturas.json` |
| prematricula | reportes/prematricula | obtenerAlumnoPrematricula | Envelope de `reporte-pre-matricula.json` |
| matricula | reportes/matricula | obtenerAlumnoMatricula | Envelope de `reporte-matricula.json` |
| horarios | reportes/horarios | obtenerHorariosAsignatura | Envelope de `reporte-horario.json` |

Fuera del modo snapshot los envelopes propios siguen siendo exactamente los anteriores. En snapshots, éxito exige `message: string | null`, `codError:null`, `data` válida; claves adicionales en envelope permitidas y conservadas. No recomponer el envelope ni eliminar `message` no nulo. `codError` no nulo en HTTP recibido es error explícito del cliente, nunca vacío. Los archivos de esta primera revisión solo admiten snapshots de éxito; un archivo que contiene un error aborta arranque con diagnóstico, sin publicar ese dataset parcialmente.

## Wire y validación completa

Mantener los cinco archivos `raw-types/` intactos. Definir aliases de transporte propios en cada capa; no importar runtime de client/ en backend ni modificar rootDir para incluir raw-types. El backend usa tipos propios homólogos. `ApiResponseMap` de estas cinco claves representa las formas realmente aceptadas, no una assertion hacia el candidato original más estrecho. Un único validator puro compartido `shared/matricula-wire.mjs` con declaración `shared/matricula-wire.d.mts` contiene los cinco esquemas y validación JSON; sin DOM, Node/fs, dependencias ni llamadas HTTP. Ambas capas importan el mismo módulo, sin duplicar reglas. Declaración solo expone key de cinco lecturas, JSON y firma validator; no importa raw-types fuera del rootDir backend. Tipos de proyección propios son independientes de esa declaración. Esta ubicación/ownership compartida está explícitamente asignada en el plan, sin tocar configuración de build.

Exports exactos (propiedad B; C consume): `matriculaWireKeys` es tuple readonly en este orden `['matriculaInfo','programacion','prematricula','matricula','horarios']`; `MatriculaWireKey` es su unión; `WireJson` = null|string|number|boolean|WireJson[]|WireJsonObject, `WireJsonObject` = `{[key:string]:WireJson}`; `validateMatriculaWire(key:MatriculaWireKey,value:unknown): asserts value is WireJsonObject` valida envelope y esquema raw completo de esa key, lanza Error key/path y no transforma value. No export parse/coerción, ni validator del artículo MI propio. El envelope raw permanece el mismo objeto tras validación; repositorio devuelve su clone. Tipos declarativos no incluyen imports de raw-types y no emiten código. Alias/wrappers de capa solo hacen narrowing en su frontera después de esa única validación.

Los candidatos nombrados arriba son el inventario exhaustivo de **campos requeridos** y estructura anidada de MC-CONTRACT-1. Regla por campo:

| Tipo candidato | Tipo wire aceptado / validación |
| --- | --- |
| string, incluidos Hora/Dia/CodTipoHoraAsignatura/DESTipoHoraAsignatura | string, también `''`; ampliar literals generados a string, sin enumeración de ejemplos |
| Date | string; no crear Date, convertir timezone, recortar ni normalizar |
| number | number finito; no coacción string→number ni reglas de signo, entero, capacidad o identidad |
| boolean | boolean, no coacción de `0`, `1`, `S`, `N` |
| null de un campo de data | valor JSON opaco (null/string/number finito/boolean/array/objeto); preservar sin interpretar |
| T[], objeto, mapa creditaje | arrays/objetos con todos sus campos requeridos; `creditaje` conserva keys libres con valores number finitos |
| Claves adicionales en cualquier objeto | cualquier valor JSON, conservado recursivamente |

La generalización de campos cuyo candidato solo contiene null es deliberadamente local: no declara que el candidato original incluya otros tipos. No extender nulabilidad a campos string/number/boolean con datos faltantes: null allí sigue siendo incompatible hasta evidencia y revisión explícitas. No permitir undefined, bigint, Date real, funciones, NaN o Infinity en fixtures de prueba del límite; los JSON reales ya excluyen esos valores. Validación recursiva conserva el objeto validado; no reconstruye solo sus campos conocidos. No usar coerciones ni defaults.

Validar todos los campos de `Data`, `Perfil`, `Alumno`, `InfoMatricula`, `InfoSemestre`, `Programacion`, `Horario`, `Datum`, `DatosMatricula` y `Matricula` según su archivo candidato y esta tabla. Por ejemplo, programación exige **todas** las fechas string de infoSemestre, todos los flags del alumno y todos los campos del horario aunque no aparezcan en la tabla. Prematrícula exige `totales_creditos` y `lisSeccion`; matrícula exige `datosMatricula`, `indMatHabilitadaLabPra` y `codFacultad`; horarios exige `color`, códigos y campos opacos. Arrays vacíos válidos no eliminan el resto de estructura del envelope/data.

Eliminar de la aceptación wire de programación: claves exactas, docente combinado no vacío, horario/ciclo/sección positivos, unicidad asumida, correspondencia de códigos con alumno/curso, minutos iguales a HH:mm, correspondencia T/P/L con nombre de tipo y día limitado a seis ejemplos. El seed no cambia. Sus reglas pueden comprobarse sobre el seed, pero no rechazar otros JSON estructuralmente válidos.

**Representabilidad visual:** la tabla/modal de programación muestra strings de horario/día/tipo tal como llegan, sin interpretar permisos o capacidad. La rejilla de Reporte Horarios sí requiere `numDia` entero1..7 y horas `HH:mm` o `HH:mm:ss` válidas con inicio<fin, porque necesita ordenar/ubicar eventos. Comparar segundos completos: `08:30:15`→`08:30:30` es válido, no colapsar ambos a minuto510; posiciones pueden usar minutos fraccionarios (`hora*60+minuto+segundo/60`). Este es un límite local de representación; un intervalo fuera de esa forma produce error explícito con ubicación del campo, no fila omitida ni ajuste de valor. Los segundos deben ser 00..59, corrigiendo la regex actual que acepta dos dígitos arbitrarios. La validación ocurre antes del render, y los strings originales siguen conservados en el DTO/etiqueta visible.

Errores del límite identifican clave y ruta del campo, por ejemplo `programacion.data.alumno.infoSemestre.fecInicioEncuestaDocente: se esperaba string`; no incluir valores del snapshot, identificadores, cuerpos ni secretos. Falta de campo y tipo incorrecto son distintos diagnósticos. La UI reutiliza RouteError y reintento existentes; nunca transforma un rechazo en éxito con mocks.

## Información de Matrícula: dos formas explícitas

La API local acepta una unión validada: artículo propio vigente `{codSemestre,articulo}` o estado académico wire completo de `raw-types/matricula-info.ts`. El artículo propio conserva estrictamente MI-CONTRACT-1, incluido null/vacío, cinco secciones/IDs y texto HTTP. No relajar su validator para justificar los snapshots raw. Para distinguir la forma raw usar su campo requerido `indMatHabilitada` tras validar; si ese campo existe, validar raw completo, incluso si hay una clave adicional `articulo`. No elegir artículo por la sola presencia de una clave extra en un objeto raw.

Para la forma raw, conservar `codSemestre`, `fechaDB`, `fecIniMatInternet`, `fecFinMatInternet`, `mensajeMatricula`, `mensaje`, `indMatHabilitada`, `matriculado`, `indMatCtrlHorario`, perfil, creditaje y todos los demás campos. Esta conservación no autoriza paneles nuevos de flags/fechas ni interpretación de permisos. Una proyección visible diferente exige observación frontend/semántica y criterio especificado por root. El tipo candidato por sí solo no prueba qué se muestra.

Conservar la adaptación histórica del artículo en raw para los cinco temas ya documentados con aviso `Orientación local de demostración`; los textos locales son paráfrasis y no campos de ese JSON. Una respuesta artículo null mantiene el vacío MI previo, sin orientación de respaldo. Strings se renderizan como texto React, sin HTML interpretado.

Fuente frontend pública `/tmp/sum-matricula-public-js/informacion.js`, observada offline por planner y root: fechas `fechaDB`, `fecIniMatInternet`, `fecFinMatInternet` se asignan siempre, y `mensajeMatricula` siempre como texto. Renderizar esos cuatro campos en la rama raw. `mensaje` se muestra solo cuando `indMatHabilitada===false`; en esa misma rama y `valProgramacion!==null` se muestran perfil.permanencia/anioIngreso/anioEstudio/promedio/situAcademica. Conservar números sin inventar escala/redondeo académico. No panel de bools inventado. El cronograma fuente usa `valProgramacion.enlace_cronograma`, pero su estructura es opaca en el candidato: solo texto de aviso en esa rama; no enlace a SUM ni href derivado no validado. Validación de un enlace local propio requiere una revisión separada si se pide.

DOM actual root en `evidence/sum/matricula-compatibility/dom-states.json`: fechas/mensaje visibles, cronograma oculto, #modalIrFormulario/#btnIrFormulario existen **ocultos**, botones iniciar ausentes. No poner `Ingresar al Formulario` universalmente visible. El gate frontend raw (`formulario==null || formulario.idPuebloOpc==null || llenar===true`) y destino de ese botón son lógica de fuente, sin estado runtime suministrado para probarlos en el contrato local extendido. Este plan no modifica Formulario ni recrea modal de gate desde `{}` sintético. Tampoco crea Iniciar Matrícula activo, validarMatricula/registro o labs. Documentar esas brechas por estado, sin afirmar que el artículo reconstruye todo el flujo.

## Programación: presentación respaldada

Fuente pública `/tmp/sum-matricula-public-js/programacion.js` leída offline y REA root `ev_29de9faf2926f7eb1a43b0f0d401934cc6ca8500944bee41ffc9bb496f81f13d` con15/15pasos completados: ocho encabezados, primero vacío; filas por ciclo en orden recibido, nueva cabecera `CICLO n` cuando cambia el ciclo (99 se muestra0), sin reordenar ni deduplicar. Cabecera ocupa8columnas y no es una fila raw inventada. Columna asignatura `${codAsignatura} - ${desAsignatura}`; docente `'--'` si codDocente==='--', de lo contrario `${codDocente} - ${apePatDocente} ${apeMatDocente}, ${nomDocente}`. Primera columna usa extra `s` si es string/number/boolean; falta/null/objeto/array se muestra vacía y permanece en DTO sin inventar significado. No generar indicador desde facultad/cupo/otros flags.

Modal cinco columnas usa exclusivamente fila.horarios, sin nueva petición; aula conserva string recibido (no sustituir `''` por '--'). Reutilizar dialog accesible/cierre/foco local. La fuente SUM descarga mediante acciones exportar/exportarLab y PDF/window.open: CSV previo se conserva como descarga propia con rótulo `Descargar CSV local`, ocho columnas de curso (no cabeceras de ciclo sintéticas en export); nunca presentarlo como PDF SUM. Labs y exportadores SUM no son endpoints de este contrato.

Búsqueda de Programación: root observó `#tablaProgramacion_filter input[type=search]` en DOM SUM y ausencia de paginación. La fuente DataTables no activa serverSide ni deshabilita searching; el filtrado en memoria es una reconstrucción respaldada, sin nueva petición ni regla académica. Añadir input de búsqueda con etiqueta accesible `Buscar` en Programación, propiedad exclusiva C en TableScreens. Decisión local precisa: query trim y comparación sin distinción de mayúsculas contra código/nombre de asignatura, docente presentado, sección y ciclo presentado (incluido CICLO0 para ciclo99). Mantener el orden recibido y reconstruir cabeceras de grupo sobre las filas visibles. Sin coincidencias: estado vacío de tabla, sin alterar DTO, repositorio ni backend; limpiar devuelve todas las filas y grupos originales. Modal recibe siempre el objeto de la fila visible seleccionada. CSV conserva **todas las filas de curso del DTO**, independientemente del filtro, como la descarga local previa; no exportar cabeceras de ciclo. No estado de búsqueda en URL, paginación, CSS o endpoints nuevos. El detalle exacto de comparación es `local-only`; root comprobará interacción readonly de entrada/limpieza para corroboración adicional.

Corroboración runtime root: REA `ev_c859c1e1e15464a8f856fa2b675b9460158f25669ed7945a5019668e922ec56c`,6/6pasos completados: input visible, búsqueda `ZZZ_REA_NO_MATCH` muestra `td.dataTables_empty`, limpiar restaura fila2 con Horarios; solo GET200 inicial de Programación, sin nuevas API durante búsqueda. Esto acredita búsqueda/vacío/limpieza readonly, no todos los algoritmos de comparación ni la semántica de exportación SUM.

## Métodos por transporte

REA root confirmó GET HTTP200 de seis acciones: formulario, matriculaInfo, programacion, prematricula, matricula y horarios. Modificar el metadata/adaptador legacy solo en esas seis keys para GET; `local` conserva POST y las mismas acciones, `mock` sin red. Todas las demás keys conservan su método vigente hasta evidencia. No cambiar rutas/pipes backend ni redefinir el contrato propio como GET. Credenciales/AbortSignal/baseURL guard existentes intactos.

## Snapshots offline: configuración y persistencia mínima

`MATRICULA_SNAPSHOT_DIR` opcional, configuración de proceso. Ausente: comportamiento y env de fixtures anteriores intactos. Definida: ruta absoluta no vacía a un directorio local con los **cinco archivos fijos** de la tabla HTTP; todos sanitizados previamente por operador/root. No buscar archivos arbitrarios, usar URLs, leer HAR ni extraer cookies. No endpoint upload/reset, watchers, DB, ORM, auth o servicio nuevo de almacenamiento.

El singleton ya compartido `ReportesRepository` carga los cinco envelopes mediante un helper puro de lectura/validación al arranque. Directorio inexistente, archivo faltante, JSON inválido, esquema inválido o configuración simultánea `REPORTES_FIXTURE`, `PROGRAMACION_FIXTURE` o `MATRICULA_INFORMACION_FIXTURE` definida: abortar arranque con clave/ruta de campo y motivo, sin imprimir contenido. Incluso `populated` explícito cuenta como conflicto; evita modos mezclados. Los nombres son fijos; resolverlos dentro del directorio dado.

Memoria readonly por proceso. Leer archivo una vez; respuestas como copia profunda del envelope completo. Cambiar un archivo requiere reiniciar backend. Reiniciar con igual contenido produce mismo JSON semántico; repetir, paralelizar o recargar UI no cambia snapshots. Importar solo fuente sanitizada; la herramienta no promete detectar automáticamente datos personales.

API interna mínima: `ReportesRepository.readMatriculaSnapshot(key)` devuelve envelope tipado/clonado o null cuando la env está ausente; sin fallback tras error de archivo. ProgramacionRepository/Service y MatriculaInformacionRepository/Service reutilizan su ReportesRepository ya inyectado; ReportesService hace lo mismo para tres reportes. Mantener controller/pipe/modules sin nuevos endpoints/provider duplicado. Los servicios devuelven el envelope completo cuando existe snapshot y forman el envelope previo solo en modo fixture. Si el worker prefiere una función interna equivalente, debe conservar esta semántica y no introducir un módulo global.

Contexto del resumen: no trasplantar alumno del snapshot a Formulario/Perfil/Historial/Ficha sintéticos. Programación muestra resumen de su propio `data.alumno`, mediante prop opcional de StudentSummary, conservando el default del componente en otras rutas. Reportes sin alumno/periodo explícito conservan el resumen del shell como contexto local vigente; no deducir fechaMatricula o periodo de nulls. Con un snapshot futuro cuyo contexto difiera, la compatibilidad de sus filas puede verificarse, pero el resumen/periodo de esos reportes no se acredita hasta contar con contexto sanitizado equivalente y una revisión mínima. No presentar resultados de cinco snapshots como compatibilidad integral del contexto global.

Integración conserva `local`, `/api`, credentials omit, AbortSignal, sin red SUM; `mock` sigue predeterminado. `api` heredado no obtiene autorización de producción por esta revisión; su aceptación wire de las cinco claves puede usar los mismos validators compatibles, sin alterar URL/método/credentials. No agregar un cuarto modo de datos.

## Aceptación y límites

MC-WIRE, MC-PRESERVE, MC-MI, MC-OFFLINE, MC-CONTEXT, MC-ERROR, MC-REPEAT, MC-REGRESSION y MC-E2E del [plan](../../plans/matricula-compatibility.md) son obligatorios para afirmar compatibilidad local. Todas las pruebas usan snapshots sintéticos que ejerciten invariantes y, cuando se entregue, una copia sanitizada del snapshot real. El éxito con sintéticos acredita esta política, no compatibilidad del 100% de respuestas reales ni fidelidad visual SUM.

Estado de esta revisión: fijada para handoff; no implementada ni verificada. Nueva evidencia incompatible debe producir una revisión concreta antes de ampliar esquema o UI. Inscripción/confirmación, control de deudas, capacidad, horarios y reglas académicas siguen fuera del contrato y sin verificar.
