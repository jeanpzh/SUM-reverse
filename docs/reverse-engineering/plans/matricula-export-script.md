# Plan: exportación privada de todos los módulos de la réplica

**ID:** ME-2026-10-08, revisión fija **ME-EXPORT-2**, 2026-10-08 America/Lima.

**Objetivo:** preparar un script externo que el operador ejecute personalmente para recopilar las lecturas iniciales de las 16 vistas conocidas, conservar respuestas JSON de 12 consultas candidatas y guardar un ZIP privado sin depender de Console ni descargas del navegador.

**Arquitectura:** Node conecta por CDP al target estudiantil existente, navega secuencialmente las rutas observadas y recoge únicamente respuestas permitidas que la página ya solicita. Captura además datos DOM visibles en archivos de formato separado. No fabrica métodos/payloads, no hace fetch directo de API SUM y no incorpora nuevas entradas al backend.

**Stack:** Node22 o posterior con fetch/WebSocket disponibles, módulos nativos y ZIP STORE/CRC32 reutilizado. Sin paquetes externos.

**Entradas reutilizadas:** [inventario de 16 rutas](../../frontend/routes.md), [12 consultas candidatas](../contracts/observed-api.md), [MC-CONTRACT-1](../contracts/local-api/matricula-compatibility.md), [plan ya aceptado](matricula-compatibility.md), [behavior.md](../../../evidence/sum/matricula-compatibility/behavior.md), [informacion.js público](../../../evidence/sum/matricula-compatibility/public-js/informacion.js) y [guía de privacidad/exportación](../private-snapshots.md). ME-EXPORT-1 de seis GET queda reutilizado como subconjunto, no como cobertura global.

Nuevos artefactos sanitizados mantenidos por root: [findings REA](../../../evidence/sum/export-data/rea-findings.json) y [detector.js público](../../../evidence/sum/export-data/detector.js). No contienen datos privados del operador.

**Planner:** perfil asignado `sum-planner`, GPT-6.1 Sol High, según `.codex/agents/sum-planner.toml`. Propiedad exclusiva de este documento; sin delegación, inspección de producción o implementación. Root reúne evidencia/guía y registra resultados; un implementador futuro Luna High recibe los archivos de script definidos abajo. Todos preservan cambios ajenos.

## Fuentes, hipótesis y decisiones Sol

| Clase | Regla/finding | Límite |
| --- | --- | --- |
| Observado en evidencia persistente | Seis acciones de Matrícula/Programación/reportes GET200; 16 rutas de vistas visibles | No acredita todos los métodos, parámetros o cuerpos |
| Comunicado por root, análisis offline REA | `ev_c68e507714dcd40902d9e5fad94150b4d929dc5ad41532532de17e0ef9623016`; traza `ev_6fd32924d4c81e73f56dc5c5d1a9f0d0a370d30c8adc3ada17a3b31b3eff493b` completa dentro de sus fuentes | JavaScript público, no prueba del exportador |
| Comunicado por root, fuente pública | `ev_80a0962f9c510c68cfcd8ef986027719c338c76ce4b936c83f006276934f74ea`:14scripts sin errores de parseo; jQuery dinámico no recuperó contratos nuevos | No inferir API de lo que no recuperó la herramienta |
| Comunicado por root, fuente pública Inicio | `ev_2d66240cfca79bb46f773da4b3659606719e02adb50eb201c7b566517ccb1e90`: inline498bytes ejecuta debugger cada1000ms y location.reload si pausa supera100ms | Lógica estática observada; no ejecución del exportador por agentes |
| Reportado por operador | Console pendiente, Paused in debugger y sin ZIP aun con F8 | Síntoma, no diagnóstico universal |
| Inferencia | La recarga después de debugger puede destruir estado del Snippet; una navegación completa también lo destruye | No afirmar que explica todos los fallos |
| Decisión local | CDP externo; gestión temporal de pausa, captura allowlist de carga normal y ZIP en disco | Evita depender del estado del Snippet y permiso de descarga |
| Hipótesis no implementada | Consultas de otros periodos o estados requieren parámetros/controles no especificados | No recorrer periodos, pulsar buscar ni fabricar payloads; quedan faltantes explícitos |

Complejidad alta (correlación de eventos, navegación y privacidad); incertidumbre alta (solo seis métodos observados y varios módulos sin wire); impacto alto (datos privados/falso éxito). Sol fija la frontera: recopilar la carga inicial de todos los módulos, separar wire de DOM y reportar cobertura incompleta. **Todos los módulos no significa todos los periodos, ramas ocultas, laboratorios, inscripción o recuperación del backend privado.**

El planner no amplía autorización de inspección de producción: la lectura histórica Matrícula/Programación/reportes corresponde a root. Esta entrega es código para ejecución privada por el operador; ningún agente conecta al target para recopilar datos. El script no promete aislar una sesión unrestricted ni anonimizar los datos del ZIP.

## Contrato CLI

Comando principal desde raíz, ejecutado solo por operador:

```sh
node scripts/export-sum-all.cdp.mjs
```

Flags: `--cdp http://127.0.0.1:9222` predeterminado; `--target <id>` solo si hay más de un target estudiantil válido; `--delay-ms 2000` admite enteros >=2000; `--output <nombre.zip>` opcional, basename solamente. `--help` imprime instrucciones sin conectar/crear archivos. Flags desconocidos fallan. Sin flags para cuentas, cookies, API arbitraria, rutas adicionales o desactivar límites.

Leer `/json/list` solo del origen HTTP loopback (`127.0.0.1`, `localhost`, `::1`, sin usuario/password/query). Elegir único target `type=page` cuya URL sea origen exacto `https://sum.unmsm.edu.pe` y path `/alumnoWebSum/v2/…`; portal/login no califican. `--target` debe cumplir el mismo filtro. Nunca imprimir títulos, URLs/query originales o websocketDebuggerUrl. Si falta CDP/sesión, informar código técnico y pedir abrir la sesión que el operador usa; no lanzar Chrome, copiar perfiles o recuperar credenciales. Node solo hace HTTP local para CDP, nunca llamadas HTTP SUM.

Salida fija dentro de `datos-reales/` del proyecto: `sum-all-json-<UTCtimestamp>.zip` por defecto. Crear directorio/ZIP con permisos0700/0600 donde el SO los soporte; rechazar symlink de directorio de salida que escape la carpeta del proyecto y basename inválido. No listar/cargar snapshots anteriores. Crear archivo con exclusión `wx`, no sobrescribir; guardar ZIP tras construirlo completo en memoria. Si falla escritura, retirar solamente el archivo creado por esta ejecución. Lock exclusivo `datos-reales/.sum-export.lock` evita dos corridas; cleanup elimina solo su lock. Un lock huérfano exige retirada manual del operador, sin asumir PID reutilizado.

Logs permiten slugs, pasos/16, HTTPstatus, filenames y códigos constantes. Prohibido cuerpos, nombres reales, tokens, cabeceras, query/body/requestPostData, errores CDP nativos o stacks. Archivo/ZIP/DOM son privados aunque el manifest sea técnico. Salida0: recorrido y todas las entradas esperadas presentes; salida2: ZIP de recopilación guardado con faltantes explícitos; salida1: error fatal/sesión expirada/escritura; salida130: cancelado. No confundir salida0 con cobertura de todos los estados o integración backend.

## Manifest fijo de vistas y consultas

Prefijo vistas y API: `/alumnoWebSum/v2/`. Navegar exactamente las filas de abajo, en orden; grupos `#` no son rutas. La columna consulta define el único par path/accion cuyo body puede recuperarse. Método proviene del request natural de la página, nunca de una llamada fabricada. Para `accion` aceptar una única ocurrencia desde URL o form-urlencoded/JSON plano ya emitido por requestWillBeSent; leer exclusivamente ese campo, no retener/loguear resto del payload. Sin acción inequívoca no capturar body.

| Paso / slug DOM | Vista GET | Consulta permitida `accion` | Archivo canonical JSON |
| --- | --- | --- | --- |
| 1 inicio | inicio | Sin contrato | — |
| 2 perfil | informacion/perfil | obtenerInformacionAlumno | mi-perfil.json |
| 3 historial | informacion/historial | Sin contrato SUM | — |
| 4 formulario-datos | informacion/formularioDatos | obtenerFormularioDatosMatricula | formulario-datos-matricula.json |
| 5 ficha-socioeconomica | informacion/fichaSocioeconomica | Sin contrato SUM | — |
| 6 matricula-info | matricula/informacion | obtenerInformacion | matricula-info.json |
| 7 programacion-asignaturas | matricula/programacion | obtenerProgramacionAsignaturas | programacion-asignaturas.json |
| 8 reporte-pre-matricula | reportes/prematricula | obtenerAlumnoPrematricula | reporte-pre-matricula.json |
| 9 reporte-matricula | reportes/matricula | obtenerAlumnoMatricula | reporte-matricula.json |
| 10 reporte-horario | reportes/horarios | obtenerHorariosAsignatura | reporte-horario.json |
| 11 reporte-evaluaciones | reportes/evaluaciones | recuperarEvaluacionesCalificaciones | reporte-evaluaciones.json |
| 12 reporte-deudas | reportes/deudas | obtenerAlumnoDeuda | reporte-deudas.json |
| 13 asistencias | asistencia | obtenerResumenAsistencia | mis-asistencias.json |
| 14 tutoria | tutoria | obtenerListaAsignaturaTutoria | tutoria.json |
| 15 plan-estudios | planEstudios | obtenerPlanEstudios | plan-estudios.json |
| 16 manuales | manuales | Sin contrato | — |

La vista Matrícula también consulta formularioDatos: la allowlist de12 pares es global dentro de la ventana de cada vista, no limitada a la fila actual. Historial/Ficha tienen acciones de API propia local, **no** contratos SUM; no incluirlas. Consultas desconocidas, incluso `obtener…`, no se recuperan: incrementar únicamente contador seguro `unknownJsonRequests`; sin action/path/payload ajenos en manifest. Excluir auth/login/logout/session/account y cualquier path fuera del listado. No `validarMatricula`, validarMatriculaLabo, labPra, exportar/exportarLab, inscripción, confirmación, archivos/fotos o descarga PDF.

Cinco nombres consumidos por NestJS se mantienen exactos. Los otros siete canonical y los16 DOM son suplementarios y **no importados automáticamente** por el backend actual. No crear JSON vacíos para candidatos ausentes. Datos de periodo por defecto no se convierten en todos los periodos.

## Sesión CDP, eventos y captura

Un WebSocket directo al target validado; IDs monotónicos, mapa de comandos pendientes, timeout10000ms por comando/conexión/discovery y errores sanitizados. Rechazar pendientes al cerrar socket. Enviar Page.enable, Runtime.enable, Network.enable con `maxTotalBufferSize: 52428800`, `maxResourceBufferSize: 10485760`, `maxPostDataSize: 65536`; no activar Fetch/intercepción/replay/cookies ni ExtraInfo handlers. Recibir eventos puede incluir headers en memoria transitoria del protocolo: nunca copiar esos campos a estructuras, disco o logs.

Debugger.enable → Debugger.setSkipAllPauses `{skip:true}` → Debugger.resume si pausado. Handler paused reanuda durante la corrida sin persistir callFrames/reasons privados. Si resume devuelve estado no pausado, manejar ese caso específico con código fijo; otros errores no se ignoran. Al finalizar/cancelar, `setSkipAllPauses {skip:false}` y Debugger.disable, luego Network.disable/Page.disable/Runtime.disable y socket.close. Cada comando de cleanup tiene timeout2000ms independiente; quitar handlers, rechazar todos los pendientes y cerrar socket incluso si un disable falla. Esto limpia la configuración aplicada por la sesión, **no promete restaurar una preferencia previa desconocida del usuario**; no toca breakpoints persistidos ni código fuente. Cleanup es idempotente y no oculta fallos. Resume puede disparar la recarga del detector inicialmente; el proceso externo conserva el control y debe esperar estabilización antes del recorrido.

Por vista: registrar listeners/epoch antes de Page.navigate `{url: fixedOrigin+fixedPath}`. Esperar navegación del main frame/load y estabilización: quiet2000ms desde último request XHR/Fetch pertinente, mínimo2000ms después de load; límite total30000ms por vista. Descargas/load de images/websockets no bloquean quiet. Mantener requestId→epoch/clave/status mínimos; en responseReceived aceptar solo main-frame XHR/Fetch de método GET/POST realmente emitido con origen/path/accion allowlist, HTTP200 y MIME JSON; en loadingFinished invocar Network.getResponseBody inmediatamente y aguardar todas esas lecturas antes de próxima navegación. loadingFailed/status/error/missingbody marcan entrada faltante con código; no retries ni cache/cookie modificaciones. Métodos pendientes de observación solo se conocen pasivamente aquí, sin generalizarlos a peticiones nuevas.

Capturas completas no dependen de buffers durables experimentales: recuperar bodies antes de avanzar; si CDP no dispone del body marcar BODY_UNAVAILABLE, no replay. Guardar texto body sin reserialización; si base64Encoded, decodificar bytes y validar UTF8/JSON. Envelope objeto con propias message/codError/data, message string/null, codError===null; extras/nulls/fechas conservados. No validar contra literals del seed. Fallo de envelope no expone valores ni se convierte en fixture.

Redirección fuera de ruta/origen de vista, formulario/login o HTTP401/403: parar por SESSION_OR_SCOPE; no exportar DOM de autenticación. No restaurar automáticamente la ruta inicial, pues cargarla otra vez agrega requests no necesarios; el navegador queda en última vista visitada. El operador usa exclusivamente ese target durante la corrida. Ctrl+C/SIGTERM cancela navegación/captura, libera recursos y no escribe ZIP por defecto. Cancelación no borra ZIP anterior.

## Formatos privados y cobertura

ZIP STORE/CRC32 con nombres UTF8 fijos, sin path traversal, límites ZIP32/entrycount antes de escribir. Entradas prefijadas `datos-reales/`; extraer en raíz del proyecto. Canonical existe solo si **el último intento** de esa clave fue válido; preservar además cada ocurrencia válida como `responses/<key>/<viewSlug>-<ordinal>.json`, sin usar parámetros reales en filenames. Si llega un intento posterior fallido, eliminar la entrada canonical de la colección antes de empaquetar, `canonicalFile:null`, `lastAttemptStatus:'failed'`, status failed/missing y salida parcial. Las respuestas válidas anteriores permanecen en responses/; no se usan como fallback de éxito. JSON parseable de un par permitido con envelope de error puede conservarse únicamente como `failed-responses/<key>/<viewSlug>-<ordinal>.json`, nunca canonical; HTML/noJSON/login no se archivan. No loguear conteos de filas/datos. Límite de memoria256MiB en cuerpos/DOM agregados y10MiB por body; al superar, marcar SIZE_LIMIT sin trucar JSON y detener recorrido restante con cobertura parcial técnica, distinto de Ctrl+C.

Por las16 vistas, capturar `views/<slug>.json` mediante lectura DOM pura después de estabilizar, en isolated world del main frame (`Page.getFrameTree`, `Page.createIsolatedWorld` sin grantUniveralAccess; Runtime.evaluate returnByValue). Sin fetch, clicks, callbacks de aplicación o lecturas de storage/window state. DOM formato `sum-visible-dom-v1`, separado de envelope wire: `{format,routeSlug,rootKind,headings,tables,fields,links,text}`. Preferir main/.page-content/.content-wrapper; estos selectors son **heurística local**, no selectores SUM verificados. Fallback body solo recorriendo nodos visibles y excluyendo header/nav/aside/script/style/noscript/hidden/password, cualquier atributo/nombre de token/secret/cookie/authorization/session/csrf y nodos input hidden. No serializar HTML, atributos arbitrarios, imágenes, eventos ni URLs completas; links solo texto+pathname de rutas propias/recursos visibles, sin query/hash; fields solo label/type/value visible y opciones seleccionadas. Valores reales permitidos únicamente en archivo privado del operador, nunca logs/manifest. Si no hay contenido seguro, vista DOM_UNAVAILABLE; no inventar estructura.

`manifest.json` técnico: `{format:'sum-export-manifest-v1',planRevision:'ME-EXPORT-2',coverage:'initial-view-load',views:[{slug,status,domFile,rootKind,selectorEvidence:'local-only',code}],queries:[{key,status,canonicalFile,captureCount,lastAttemptStatus,lastValidOrdinal,code}],unknownJsonRequests,missing}`. Status `captured`, `missing`, `failed`, `dom-only`; code enum fijo. No URLs/query, datos, identidad, timestamps de sesión o headers. Una vista DOM capturada no satisface un wire ausente. Informe final enumera módulos/archivos faltantes y diferencia12candidatos,16DOM y5entradas backend; no afirma100%.

## Interfaces y tareas para Luna High

Dos archivos de script, implementación secuencial por un único worker (no subdelegación): `scripts/export-sum-all.manifest.mjs` exporta objetos congelados `origin`, `viewJobs`, `readJobs`, `planRevision`; campos `slug/path`, `key/path/action/filename/evidenceLevel`. `scripts/export-sum-all.cdp.mjs` importa ese manifest y módulos Node. No editar client/backend/shared/raw-types/configuración ni contratos existentes. Root posee guía/evidencia/registros; planner solo este plan. No revertir cambios ajenos.

| ID / resultado | Dependencias | Archivos exclusivos | Aceptación / check | Estado / reparaciones |
| --- | --- | --- | --- | --- |
| ME-P1 decisión/contrato global Sol | Rutas, candidatos, hallazgo debugger | Este plan | Manifest exacto, inferencias separadas, privacidad/cobertura | Listo;0 |
| ME-S1 manifest y CLI Luna High | ME-P1 | scripts/export-sum-all.manifest.mjs + export-sum-all.cdp.mjs |16rutas/12pares, flags y output/lock/target confinados | Lista;0 |
| ME-S2 cliente CDP/captura Luna High | ME-S1 | export-sum-all.cdp.mjs, mismo worker |Correlación/timeout/skip/resume/cleanup, allowlist sin llamadas API | Lista;0 |
| ME-S3 DOM/ZIP/cobertura Luna High | ME-S2 | export-sum-all.cdp.mjs, mismo worker |Textos/nombres conservados, DOM separado, manifest faltantes, escritura exclusiva | Lista;0 |
| ME-D1 guía principal root | ME-S3 | docs/reverse-engineering/private-snapshots.md |Comando Node principal, privacidad,12/16/5 separados, resultados honestos | Lista;0 |
| ME-V1 checks limitados root/worker | ME-S3/D1 | Registro root |Sintaxis/diff; sin ejecución collector/tests/producción | Pendiente;0 |

Interfaces internas concretas: `parseOptions(argv): Options`; `selectTarget(options): Promise<Target>`; `connectCdp(target): Promise<{send(method,params,timeoutMs):Promise<object>,on(method,listener):unsubscribe,close():Promise<void>}>`; `visitView(cdp,job,collector,signal): Promise<ViewResult>`; `captureDom(cdp,job): Promise<DomSnapshot>`; `collector.finish(): {files,manifest}`; `buildZip(files): Buffer`; `saveArchive(buffer,options):Promise<string>`; `cleanup():Promise<void>`. Files usan `{filename,bytes:Buffer}`; Result/manifest no contienen cuerpos; collector los conserva en scope privado. Opciones estructuradas de CLI nunca habilitan rutas arbitrarias.

- [ ] ME-S1: materializar tabla exacta; validar flags/Node/API disponibilidad/output y target único antes de navegar; ayuda sin side effects.
- [ ] ME-S2: implementar transporte CDP con pendientes y cleanup; evento→allowlist→loadingFinished→body sin logs de eventos; visitas seriales con epoch/quiet/límite; sin replay/API requests.
- [ ] ME-S3: lectura DOM filtrada en isolated world, formatos y estado de cobertura; canonical+ocurrencias originales; ZIP32/CRC32 y escritura exclusiva dentro de carpeta privada.
- [ ] ME-D1: documentar CDP existente, comando, Ctrl+C, tab exclusiva, efecto temporal de skip, límites de periodos/módulos y cinco entradas compatibles backend. Console6 permanece alternativa anterior, no gate de exportación global; no duplicar su arquitectura en esta revisión.

## Invariantes de alto impacto y aceptación

| ID | Invariante | Revisión determinista |
| --- | --- | --- |
| ME-I1 | Solo16 GET vistas observadas; APIs originadas por página y12pares allowlist | Diff manifest y Page.navigate; no fetch SUM/replay/clicks |
| ME-I2 | Agentes no ejecutan collector ni acceden a carpeta/datos privados, también indirectamente | Comandos y registro; solo sintaxis/diff |
| ME-I3 | Cinco nombres backend exactos; otros módulos suplementarios, sin import automático | Diff filenames y documentación |
| ME-I4 | JSON conserva texto/extras/nulls; errores nunca fixtures/empty falso | Lectura de validación/Buffer/ZIP |
| ME-I5 | Logs/manifest solo metadatos seguros; no auth/headers/body/error nativo | Todos los sinks y campos copiados |
| ME-I6 | Una corrida/target; cancel/cleanup y skip reversible a false, sin cambios persistidos | Lock/listeners/finally/signal |
| ME-I7 | DOM≠wire; falta de acción/periodos no se presenta como captura completa | Manifest/códigos/mensajes |
| ME-I8 | Sin CDP remoto, copia perfiles, secretos, carga externa o fichero fuera de privado | CLI/origins/output/ imports |

No añadir/ejecutar tests ni collector. Comprobaciones de entrega:

```sh
node --check scripts/export-sum-all.manifest.mjs
node --check scripts/export-sum-all.cdp.mjs
git diff --check -- scripts/export-sum-all.manifest.mjs scripts/export-sum-all.cdp.mjs docs/reverse-engineering/private-snapshots.md docs/reverse-engineering/plans/matricula-export-script.md
git diff -- scripts/export-sum-all.manifest.mjs scripts/export-sum-all.cdp.mjs docs/reverse-engineering/private-snapshots.md
```

Aceptar preparación si sintaxis/whitespace pasan y diff cumple ME-I1..I8. **No acredita ejecución CDP, interoperabilidad ZIP, captura DOM o descarga real.** Cotejo con datos reales solo lo hace operador; comparte exclusivamente estado y diagnóstico sanitizado de archivo/key/field path. Máximo un ciclo de reparación automático, luego diagnosticar; Sol vuelve únicamente ante cambio de arquitectura, alcance o invariantes.

Referencias primarias para protocolo: [Network fuente oficial](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json) define body/base64 y navegación; [Debugger/Runtime fuente oficial](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/js_protocol.json) define skip/resume/evaluate; [Node globals](https://nodejs.org/api/globals.html#class-websocket) acredita WebSocket nativo disponible desde22. No consultar ni inferir internos SUM a partir de estas fuentes.

**Estado actualizado por el principal:** ME-S1..ME-S3 y ME-D1 preparados; ME-V1 con sintaxis/whitespace y revisión estática realizada. Un ciclo automático de reparación Luna, seguido de correcciones aisladas diagnosticadas por el principal. El operador informó un corte `SESSION_OR_SCOPE` al visitar Perfil; root añadió diagnóstico mínimo `SCOPE_DETAIL`, sin cambiar la navegación ni el gate. Ejecución completa, interoperabilidad ZIP y cobertura real pendientes. Véase el registro [export-data.md](../workflows/export-data.md). Planner hizo lectura offline y consulta de documentación pública; no producción ni tests. Los agentes no ejecutaron el colector ni accedieron a datos privados. Conserva evidencia previa y no rehace compatibilidad React/NestJS aceptada.

Validación documental del planner: 16 filas de vistas, todos los enlaces locales existentes y ausencia de whitespace final comprobados mediante lectura de este documento; `git diff --check` exit0. El plan es archivo nuevo no tracked, por lo que diff Git solo no valida su contenido; la lectura documental adicional cubre esa limitación. No se ejecutaron scripts de exportación, pruebas o aplicación.
