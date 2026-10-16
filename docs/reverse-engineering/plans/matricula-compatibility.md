# Plan incremental: Matrícula y snapshots wire

- ID: **matricula-compatibility-2026-10-08**, revisión1. Contrato fijado **MC-CONTRACT-1** en [matricula-compatibility.md](../contracts/local-api/matricula-compatibility.md).
- Planner real: `sum-planner`, GPT-6.1 Sol High; sin delegación, browser ni producción. Propiedad exclusiva de este plan y su contrato. Root mantiene adquisición REA y registros; workers futuros Luna High no delegan ni revierten cambios ajenos.
- Objetivo: completar brechas de cinco lecturas de Matrícula y compatibilidad de JSON sanitizados offline, usando backend NestJS existente. Reimplementar únicamente adaptadores/fronteras que fallan el contrato; conservar pantallas/componentes y lecturas que ya funcionan.
- Complejidad media/alta (cinco DTOs, dos transportes y contexto); incertidumbre alta (no hay JSON real suministrado, nueva fuente JS distingue gates del artículo); impacto medio/alto (pérdida de datos, falso éxito y atribución de reglas). Sol debe separar compatibilidad wire, lógica pública observada y contrato local; Luna ejecuta unidades delimitadas después de fijar revisión.
- Estado actualizado por root al cierre: **MC-S1, MC-B1..B4, MC-C1..C4 y MC-V1..V2 implementados y aceptados con snapshots sintéticos**. [Verificación y comandos](../../../evidence/local/matricula-compatibility/fullstack-verification.md). MC-V3 requiere los JSON reales del operador. Gate formulario/registro/labs/PDF continúa sin contrato suficiente. Las tablas de auditoría e instrucciones de handoff de abajo describen el estado previo y criterios originales, no pendientes actuales.

## Reutilización y alcance implementado

Reutilizar [matricula.md](matricula.md), [matricula-informacion.md](matricula-informacion.md), [remaining-implementation.md](remaining-implementation.md), sus especificaciones y contratos asociados. No rehacer sus tareas cumplidas ni reiniciar contadores de reparación. La suite histórica global tiene fallos de espera registrados; este trabajo usa verificación enfocada que espera loaders correctamente.

| Parte | Implementación local auditada | Evidencia / límite |
| --- | --- | --- |
| Información de Matrícula | Loader HTTP, artículo `{codSemestre,articulo}`, cinco secciones, loading/vacío/error/reintento | MI-CONTRACT-1 y resultados previos; no implementa estado académico raw ni gates observados ahora |
| Programación | POST propio, ocho cursos/horarios sintéticos, tabla, modal por fila, CSV local | RI-PROG; su validator impone reglas del seed a toda respuesta |
| Prematrícula y Matrícula | POST propio, tres filas/metadata y CSV local | reportes-api-v1; parse mínimo permite objetos incompletos |
| Reporte Horarios | POST propio, seis eventos y rejilla | reportes-api-v1; representación horario estricta sin validación completa de candidato |
| Inscripción/confirmación/registro | **Ausente** en backend y UI transaccional local | No agregar estado, cupos, reglas ni persistencia de escritura para resolver lectura |
| Importación DevTools offline | **Ausente** | Ningún snapshot real sanitizado entregado todavía |

La existencia de cinco consultas integradas no acredita matrícula transaccional de extremo a extremo. La conservación de JSON no acredita que la UI use todos sus datos con la semántica SUM correcta.

## Auditoría concreta y decisión Sol

| Brecha | Archivo actual / fallo | Decisión acotada |
| --- | --- | --- |
| MC-G1: información raw ≠ artículo | `client/src/data/transport.ts` local llama validator artículo; backend Information sirve solo artículo; `adapters.ts:toEnrollmentArticle` raw cae a constante | Unión validada sin borrar candidato original; snapshots sirven envelope raw completo; artículo propio MI intacto |
| MC-G2: sobrevalidación programación | `data/programacion.ts` exact keys, seis días, docente no vacío, horarios positivos, igualdad facultad/docente/minutos y tipo/nombre | Validator wire estructural completo + extras; conservar seed y comprobar sus invariantes separadamente |
| MC-G3: literals/Date | `contracts.ts` JsonValue resuelve Date→string; candidato Hora excluye `08:30` y otros literals son ejemplos | Mantener Date→string; alias wire local amplía literals a string, sin editar raw-types |
| MC-G4: falsa forma completa | `transport.ts` reportes valida solo columnas; acepta matrícula sin datosMatricula y prematrícula sin totales_creditos | Validar todos los campos candidatos según MC-CONTRACT-1; faltante/tipo incorrecto error con key/path |
| MC-G5: no fuente offline | Repositorios actuales solo seed y services recomponen envelopes | Helper mínimo en backend + almacenamiento readonly en ReportesRepository existente; archivos fijos, arranque atómico |
| MC-G6: método por modo | `endpoints.ts` una propiedad method POST usada por `api` y `local` | Separar método legacy observado GET de POST propio; mock sin red |
| MC-G7: contexto | StudentSummary siempre usa formulario shell; programación ignora su propio alumno para resumen | Prop opcional al componente, programación pasa alumno de su respuesta. No trasplantar identidad a otros módulos |
| MC-G8: artículo incompleto como reconstrucción | Información solo cinco secciones; nueva fuente frontend incluye fechas/mensajes/perfil condicional y controles ocultos | Renderizar datos según bindings observados; gate formulario/control registro queda sin implementar hasta contrato suficiente |
| MC-G9: presentación programación parcial | Tabla local7columnas, curso/docente sin códigos ni grupo ciclo | Ocho columnas, agrupación en orden y strings exactos según JS público, sin inventar dato s |

Incertidumbre que requiere Sol: los candidatos tienen nulls/literals de muestras y el artículo propio se había elegido sin traza de flags. Hay que evitar tanto estrechar un snapshot válido por reglas locales como interpretar datos opacos como permisos. MC-CONTRACT-1 generaliza únicamente wire de muestras, conserva datos, mantiene límites de representación y rechaza malformed. No hace falta rehacer NestJS, router ni almacenamiento.

## Nueva evidencia comunicada por root

Fuente C adquirida exclusivamente por root con autorización específica de lectura; planner solo leyó los artefactos offline que root proporcionó. Fuentes persistentes: [behavior](../../../evidence/sum/matricula-compatibility/behavior.md), [metadata REA](../../../evidence/sum/matricula-compatibility/rea-network.json), [DOM](../../../evidence/sum/matricula-compatibility/dom-states.json), [informacion.js](../../../evidence/sum/matricula-compatibility/public-js/informacion.js), [programacion.js](../../../evidence/sum/matricula-compatibility/public-js/programacion.js) y [provenance/hashes](../../../evidence/sum/matricula-compatibility/public-js/provenance.json). No cuerpos reales o identificadores personales suministrados.

- REA `ev_b003cddbc31acecbcb9742ac7c1d1a413d0c0f4af687abedf3535d6519cd218f`: DOM de información contiene cinco títulos y botón `Ingresar al Formulario`; listener observado jquery, todavía sin prueba runtime de efecto.
- REA `ev_9b572cad189e1e901a11e8d3f3c13f97cae4e505f4ed2f73a836c859d1de129e`: GET200 observado para formularioDatos/obtenerFormularioDatosMatricula y matricula/informacion/obtenerInformacion. Solicitud programación GET observada; resultado de esa captura aún pendiente. Contradice la generalización POST del README/candidato, sin cambiar nuestro backend readonly POST.
- JS público `/tmp/sum-matricula-public-js/{informacion,programacion}.js` leído offline por planner; root conserva fuente sanitizada mínima: GET de esas dos acciones; `#btnIrFormulario` navega a `v2/informacion/formularioDatos`; gate `formulario==null || formulario.idPuebloOpc==null || llenar===true` muestra modal y deshabilita inicio. Información asigna fechas/mensajeMatricula siempre, `mensaje` con !indMatHabilitada y perfil/cronograma con !indMatHabilitada && valProgramacion!=null. indMatHabilitada crea Iniciar Matrícula; click validarMatricula/data==='ok' redirige registro. Es traza de fuente, no prueba de la transacción.
- REA `ev_29de9faf2926f7eb1a43b0f0d401934cc6ca8500944bee41ffc9bb496f81f13d`:15/15pasos Info→Programación→modal horarios→PreMat→Mat→Horarios completados; seis acciones incl formulario GET200 confirmadas. Completeness global de eventos incompleta; no afirmar captura completa de toda red o cuerpos. Modal visible sin segunda petición y metadata específica de esas respuestas disponible.
- DOM seguro `evidence/sum/matricula-compatibility/dom-states.json`: #btnIrFormulario/#modalIrFormulario existen pero ocultos; #iniciarMatricula/#iniciarMatriculaLabo ausentes; fechas/mensaje visibles, cronograma no visible. REA trace `ev_98678f10dc87ffff00e78031ef1d63b9c681f28fcf053929bb736c2700c74a0a` parcial1nodo/0relaciones jQuery no prueba causalidad app; análisis manual de fuente+runtime acotado sostienen los criterios de lectura.
- Programación pública: headers8, campo extra s, curso/docente con códigos, agrupación por cambio de ciclo (99→0), modal usa data.horarios. Acciones exportar/exportarLab abren PDF; CSV replica es local. Branch labs fac19/16 e información labs fac19/16/18 no se activaron; carecen de contrato de esta revisión.

La lectura de fuente pública observa lógica frontend; no acredita datos runtime de todos los estados, respuestas negativas de validarMatricula ni efectos/persistencia del registro. No se ejecutó inscripción/confirmación ni se conocen reglas servidor. El campo idPuebloOpc/forma de formulario requerido por gate no está explicado por los cinco snapshots de esta revisión.

**Gate MC-EVIDENCE lectura:** satisfecho para fechas/mensajes/perfil condicional, ocho columnas/agrupación y modal; usar archivos persistentes enlazados, no depender de /tmp. **Gate de formulario/registro/labs/PDF:** no satisfecho; no bloquea lectura. No añadir Link universal porque el control está oculto en el estado observado. Antes de funcionalidad registro se necesita contrato propio separado; no lo crea este plan.

## Invariantes de impacto

| ID | Invariante | Comprobación |
| --- | --- | --- |
| MC-I1 | Solo consultas; ningún request externo, matrícula escrita, cuenta, capacidad o validación contra SUM | Diff y red local MC-E2E |
| MC-I2 | Raw-types originales intactos; fechas siguen string exacto, null/opaque/extras conservados | Huellas y MC-PRESERVE |
| MC-I3 | Campo ausente o tipo malformado nunca se convierte en vacío ni seed; import falla antes de servir | MC-ERROR/OFFLINE |
| MC-I4 | Valores académicos no crean permisos/reglas; invariantes del seed no validan raw externo | MC-WIRE, diff handler |
| MC-I5 | Forma artículo MI conserva su null/error/5secciones; forma raw no confundida por key adicional articulo | MC-MI y MI-MALFORMED pertinente |
| MC-I6 | GET legado observado y POST local son independientes; ninguna revisión abre acceso de producción desde app | MC-METHODS/MODES |
| MC-I7 | Snapshots clonado/readonly; import de cinco archivos completo o aborta, reinicio reproduce mismo contenido | MC-REPEAT/OFFLINE |
| MC-I8 | Resumen Programación usa su propio alumno; otros módulos no reciben identidad transplantada ni datos inventados | MC-CONTEXT/REGRESSION |
| MC-I9 | JSON válido pero no representable en calendario produce error explicable, no evento omitido/normalizado | MC-HORARIO |
| MC-I10 | Resultado local ≠ referencia; cinco lecturas ≠ inscripción/confirmación | Registro final por criterio |

## Handoff fijo, ownership y dependencias

No despachar mientras root y este planner editen la revisión. Una vez fijada MC-CONTRACT-1, backend y client pueden implementarse en paralelo por archivos disjuntos. Máximo dos workers; ambos **Luna High**, no delegan. No están solos en workspace: conservar cambios existentes, no reset/revert y no editar contratos/config raíz/raw-types.

**B**, `sum-executor` Luna High: asignación explícita y exclusiva de `shared/matricula-wire.mjs` y `shared/matricula-wire.d.mts` **primero**, además de `backend/src/common/matricula-snapshots.ts` nuevo; `backend/src/reportes/{reportes.repository.ts,reportes.service.ts,reportes.types.ts}`; `backend/src/programacion/{programacion.repository.ts,programacion.service.ts,programacion.types.ts}`; `backend/src/matricula-informacion/{matricula-informacion.repository.ts,matricula-informacion.service.ts,matricula-informacion.types.ts}`; tests nuevos `backend/test/matricula-wire.spec.ts` y `matricula-snapshots.spec.ts`; sección de uso `backend/README.md`. No wrapper/reexport vacío common/matricula-wire, controller/pipe/module/bootstrap, env de otros módulos, imports de client/ ni dependencias nuevas. Aliases backend propios en types existentes.

**C**, `sum-executor` Luna High: `client/src/data/{matriculaWire.ts,contracts.ts,transport.ts,api.ts,endpoints.ts,programacion.ts,matriculaInformacion.ts,adapters.ts}`; `client/src/screens/{EnrollmentInfo.tsx,TableScreens.tsx}`; `client/src/components/Common.tsx` (solo prop opcional de StudentSummary); tests `client/src/data/{matriculaWire.test.ts,matriculaInformacion.test.ts,api.test.ts,adapters.test.ts}` si afectados. Mantener rutas/loaders existentes. No shared/, CSS, raw-types, scripts generales, backend, mocks históricos ni otras pantallas. No Link/button universal; controles desconocidos no se recrean.

**Interfaz MC-S1 fija:** B entrega primero el validator compartido puro con los exports definidos en contrato: `matriculaWireKeys`, tipos `MatriculaWireKey`/`WireJson`/`WireJsonObject`, y `validateMatriculaWire(key,value): asserts value is WireJsonObject`. No imports raw-types en d.mts, DOM/Node/fs ni HTTP. Import por ruta relativa desde client/src/data y backend/src/common hacia shared; rutas conservan profundidad equivalente src/common→dist/common. MJS evita cambiar rootDir backend y Vite lo integra por import existente; comprobar import desde dist al build. Frontend/backend tienen una frontera tipada luego del validator, sin repetir schemas. B y C pueden arrancar en paralelo con interfaz fijada; C implementa consumidores/proyecciones y espera entrega MC-S1 antes de build/tests. B anuncia S1 disponible. Root coordina entregas; C nunca edita shared para resolver una espera.

**Root**: cinco snapshots sintéticos sanitizados temporales para aceptación, metadatos/fuentes sanitizadas, registro `docs/reverse-engineering/workflows/matricula-compatibility.md`, `evidence/local/matricula-compatibility/**`, actualización de estado y revisión de docs. Referencias SUM bajo evidencia root, no propiedad de workers. Si desea snapshots sintéticos persistentes, asignar ruta root explícita; no incluir archivos personales suministrados automáticamente en git.

Skills: B lee `backend/AGENTS.md`, `backend/.agents/skills/sum-nestjs-implement/SKILL.md`, `nestjs-best-practices` (módulos/DI/repositorio/validation), `sum-nestjs-verify`, `oxlint`; Vitest para pruebas autorizadas. C lee `client/AGENTS.md`, `client/.agents/skills/sum-react-implement/SKILL.md`, `sum-react-verify`. Root aplica sum-fullstack-verify y es único dueño del browser. Reutilizar APIs existentes; si necesitan sintaxis de librería nueva para esa tarea consultar Context7, sin usarlo para deducir comportamiento SUM.

| ID / resultado | Dependencias | Archivos exclusivos | Aceptación / checks | Estado |
| --- | --- | --- | --- | --- |
| MC-P1 contrato fijo, decisiones e invariantes | Auditoría y planes anteriores | Dos docs de este handoff | Lectura coherente sin transacción, forms separados, ownership disjunto | Completada Sol; enlaces/consistencia validados sin pruebas de app |
| MC-S1 validator único puro + declaración | MC-P1 | shared/matricula-wire.mjs + .d.mts propiedad B | Cinco schemas requeridos completos, generalización descrita, diagnóstico key/path, sin deps; node --check/import smoke | Lista, B primero |
| MC-B1 aliases backend wire | MC-S1 | tipos3features | Import validator único; aliases propios; extras/nulls/fechas conservados, sin wrapper vacío | Lista; MC-WIRE/PRESERVE |
| MC-B2 loader snapshots puro | MC-B1 | common/matricula-snapshots.ts + tests | Cinco archivos o aborta, env estricta, no fallback/recomposición, sin red | Lista; MC-OFFLINE/ERROR |
| MC-B3 conectar repositorios y servicios | MC-B2 | repository/service3features | ReportesRepository singleton carga una vez; read envelope clone; env ausencia conserva fixtures | Lista; MC-REPEAT/REGRESSION |
| MC-B4 documentar uso offline | MC-B3 | backend/README.md | Comando con ruta absoluta y cinco nombres, provenance, no identidad transplantada | Lista; build/lint backend |
| MC-C1 tipos y wrappers por forma | MC-P1 interfaz fija; MC-S1 para checks | matriculaWire.ts,contracts.ts,programacion.ts,matriculaInformacion.ts,transport.ts | Validator compartido; local admite raw/article y reportes completos; claves extra permitidas en wire, artículo previo estricto | Lista; MC-WIRE/MALFORMED |
| MC-C2 transporte por modo | MC-C1 + metadata root | api.ts,endpoints.ts + api.test.ts | GET seis keys legacy observadas; localPOST/proxy/credentials intactos; mock sin red | Lista; MC-METHODS |
| MC-C3 proyecciones/contexto/programación | MC-C1 | adapters.ts,TableScreens.tsx,Common.tsx,adapters.test.ts | Ocho columnas, grupo por cambio ciclo99→0, códigos/docente, s solo si recibido; Buscar filtra en memoria código/nombre/docente/sección/ciclo y limpiar restaura orden/grupos; modal sin nueva request, CSV local8cols con todas las filas DTO; resumen propio | Lista; MC-CONTEXT/PROG |
| MC-C4 Información raw condicionada | MC-C1 + MC-EVIDENCE satisfecho | EnrollmentInfo.tsx,adapters.ts y test MI | Orientación local5temas, tres fechas/mensaje siempre, mensaje/perfil condicionados exactamente fuente; sin botones/form gate/registro/labs | Lista; MC-INFO |
| MC-V1 checks de capas | MC-B3/C1/C2/C3; C4 si lista | Tests propiedad B/C, resultados root | Build/lint ambos; tests de invariantes significativos | Pendiente |
| MC-V2 integración lecturas | MC-V1 | root evidencia/registro | Cliente→Nest→snapshots reales locales y seed; no mocks como prueba de integración | Pendiente |
| MC-V3 snapshot futuro del operador | JSON real sanitizado + MC-V2 | root evidencia/registro | Diagnóstico por archivo/estado, reabrir solo incompatibilidad concreta | Bloqueada por entrada ausente; no bloquea MC-V2 sintético |

No usar genericidad compleja para ahorrar nombres de cinco schemas; validadores pequeños son suficientes. No reconstruir todo el frontend/backend para solucionar estas brechas.

## Escenarios significativos

Verificación solicitada por encargo root; este planner no ejecuta app/tests. Root preparó cinco archivos sintéticos en `/tmp/sum-matricula-compatibility/snapshots`, con nombres fijos del contrato, y variantes `/tmp/sum-matricula-compatibility/variant-snapshots.json`, sin guardar datos personales al repo. Dataset construido a partir de seeds existentes: actor DEMO-001 y alias sanitizados; nada de cookies/HAR/URL de foto externa. Variante con alumno sintético diferente prueba contexto; no requiere producción.

| ID | Precondición / acción / espera | Resultado obligatorio / efecto posterior |
| --- | --- | --- |
| MC-WIRE | Cinco JSON completos; InfoSemestre strings; programación hora08:30, docente strings vacíos, horario0, domingo/tipo distinto como texto, código facultad de slot distinto, minutos distintos | Aceptación estructura, conservación exacta; no gates/cupos ni coerción. Estos valores ejercen generalización local, no observación SUM |
| MC-PRESERVE | Añadir extras en envelope,data,perfil,alumno,course,slot y reporte; campos candidate-null con JSON opaco; fechas con string/offset exactos | Después archivo→Nest→parse cliente DTO JSON profundamente igual; no conversión Date/timezone, trims solo vistas; raw-types huellas intactas |
| MC-MI | Local seed artículo, artículo=null, raw completo y raw con extra articulo | Primeros dos comportamiento MI previo; raw se valida como raw y retiene flags/messages; no ejecución inscripción ni fallback después de error |
| MC-MALFORMED | Quitar fecha InfoSemestre, datosMatricula, totales_creditos o color; number-string/null en string requerido/boolean-string; crédito NaN en test object; calendario segundos99 | Error key/path sin value; UI error, cero contenido ficticio. Artículo local extra keys continúa rechazado según MI |
| MC-OFFLINE | Arrancar sin env y con ruta absoluta +5archivos; luego missing file/JSONroto/schema mal/config conflicto | Ausencia conserva seeds anteriores; válida sirve envelopes enteros; errores abortan antes de escuchar. Nunca completar archivo faltante con seed |
| MC-REPEAT | 3 lecturas y5 paralelas, mutar respuesta recibida, editar archivo mientras proceso corre, reiniciar | Snapshot no muta; edición no altera proceso vivo; reinicio refleja archivo validado; archivo inválido nuevo aborta |
| MC-METHODS | Fetch sintético api para seis keys observadas y local real cinco lecturas; mock fetch throw | ApiGET en6claves; localPOST acción/mismosDTO/credentialsomit/AbortSignal; mock cero requests; métodos legacy no observados conservados |
| MC-CONTEXT | Programación snapshot con alumno sanitizado distinto de shell y periodo distinto | Resumen de Programación refleja response.alumno; Formulario/Perfil/Historial no cambian de identidad. Reportes contexto shell documentado sin afirmar snapshot equivalente |
| MC-HORARIO | HH:mm y HH:mm:ss válidos, numDia1..7; intervalo08:30:15→08:30:30; inválidos HH:99 o seconds99/end<=start/day8 | Comparación completa con segundos, intervalo subminuto válido, posiciones minutos fraccionarios; etiquetas strings exactas y orden; inválido error explícito antes de render, cero filas omitidas |
| MC-E2E | Backend real snapshot+Vite local; abrir cinco rutas desde menú y directo, esperar loaders, recargar; modal y CSV filas HTTP | Requests llegan al Nest local; tablas/modal/CSV coinciden con envelopes; codError/red/HTTPmalformed produce error, retry200 recupera; cero origen SUM |
| MC-INFO | Snapshot raw habilitadafalse/valProgramacionnull y false/valProgramacionobjeto con enlace opaco; true/objeto; localarticle/null | Siempre fechas/mensajeMatricula; mensaje solo false, perfil solo false && valProgramacion!=null; ningún enlace SUM/control registro/gate formulario; raw conserva opaco. Artículo orientación aviso local; MI null vacío intacto |
| MC-PROG | Tres cursos orden ciclo1,99,1, con s ausente/string y docente codDocente-- o código+nombre; abrir horarios segunda fila; CSV local | Cabeceras CICLO1/CICLO0/CICLO1 en orden,8columnas, nombres exactos; s ausente vacío; modal solo fila elegida/cero request extra; CSV8cols curso sin filas de ciclo inventadas |
| MC-PROG-SEARCH (MC-C3) | Input Buscar respaldado por DOM root `#tablaProgramacion_filter input[type=search]`; filtrar por código/nombre/docente/sección/ciclo, query sin coincidencias y limpiar | Comparación local trim/sin mayúsculas sobre presentación; orden recibido y grupos de filas visibles; vacío sin mutar DTO o backend y sin request adicional; limpiar restaura filas/grupos originales; modal corresponde a fila filtrada; CSV sigue exportando todas las filas DTO. Sin CSS/URL/paginación/endpoints ni cambios B/shared |
| MC-REGRESSION | Sin env; consultas previas cinco y artículo, programación/table/modal/CSV, mock/api tests afectados | Seeds/MI previos intactos, reportes completos continúan aceptados; no repetir toda suite histórica sin causa |

Tests nuevos deben cubrir rechazo sin fallback, preservación de extras/fechas/campos opacos, métodos y cambio de contexto; no añadir tests espejo de getters. B puede usar Vitest existente con tmpdir limpiado; C usa test:data existente. Root ejecuta escenarios HTTP/Playwright enfocados, con browser secuencial. UI screenshots locales no sustituyen referencias SUM.

Corroboración de búsqueda por root: REA `ev_c859c1e1e15464a8f856fa2b675b9460158f25669ed7945a5019668e922ec56c`,6/6pasos: input visible, query sin coincidencias→td.dataTables_empty, limpiar→fila2 Horarios restaurada; solo GET200 inicial, sin nuevas API. MC-C3 está lista, sin esperar evidencia adicional; comparación exacta y CSV propio mantienen decisión local.

Comandos por capa modificada: `pnpm --dir backend build`, `pnpm --dir backend lint`, `pnpm --dir client build`, `pnpm --dir client lint`. Pruebas enfocadas: `pnpm --dir backend exec vitest run test/matricula-wire.spec.ts test/matricula-snapshots.spec.ts`, `pnpm --dir client test:data`. Verificar desde backend compilado que el import compartido resuelve; no instalar paquetes ni cambiar tsconfig por defecto. Root registra comando exacto y resultado real, luego `git diff --check`. No declarar checks aquí como aprobados.

Máximo una reparación automática por tarea/corrida; registrar contador0→1 en entrega y pregunta concreta ante persistencia. Sol solo vuelve ante nueva incompatibilidad semántica, evidencia contradictoria o replanteamiento de contexto/registro. No escalar rutina lint/build a reviewer caro.

## Huellas de entradas auditadas

SHA256 al 2026-10-08:

| Archivo | SHA256 |
| --- | --- |
| raw-types/matricula-info.ts | d57fd7622fc6c1fe0a06b1b0b6277c0e0a821a484be509c2d4a37cd8ab192afa |
| raw-types/programacion-asignaturas.ts | bc5eacd78446050b6e4d0a7e4eced6088941325bf36e5932b0fba2cf10455203 |
| raw-types/reporte-pre-matricula.ts | 5635cd6ac7395945be0d437651aa7babe718ff6d1df8ac65ec5b1fd696d8d811 |
| raw-types/reporte-matricula.ts | 5100cb15980c25259c6d8e6bbc005a33f793483736b629653ca69f9fb30c4282 |
| raw-types/reporte-horario.ts | ccdd3d75fd41791d600e1f274398c21bf6e0a4d5080d20fd8357cc922f8b93e4 |
| client/src/data/transport.ts | dba7b9994b8c221be23d80b62ab7f47f8fe2f9f39d89664e1127e2c29359f59f |
| client/src/data/programacion.ts | 692aa0904651169fc4d4d5d304186d7f8198bbe14b91d5a1606bc145ffd15118 |
| client/src/data/matriculaInformacion.ts | 425c347f19bd0abcedbcf6f010951bd02327c34c657ddd8cce06840c85211cdc |
| client/src/data/contracts.ts | 483e6f10e154ad8b93559fc809726663bd12956df0a251ed164c15f6e04156e4 |

## Cierre preciso

Entregar archivos cambiados, criterios resueltos, checks reales, skill aplicada y límites. Separar integración de lecturas, compatibilidad sintética, compatibilidad de snapshot real, fidelidad de referencia y transacción. Hasta snapshot real, MC-V3 sigue pendiente. Hasta contrato y escenarios de registro, matrícula transaccional sigue ausente. No llamar 100% compatible a este resultado.
