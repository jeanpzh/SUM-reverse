# JSON privados y exportación DevTools

## Carpeta excluida

Guardar los datos reales en `datos-reales/` de la raíz del proyecto. Esa carpeta está excluida de Git, CodeGraph y acceso de todos los agentes mediante AGENTS.md. No se restringen los JSON de configuración ni archivos con los mismos nombres fuera de esta carpeta.

`.codex/config.toml` configura `sum-data-private`, extendiendo `:workspace` con deny para la carpeta relativa y su ubicación absoluta actual; así la ubicación original también está cubierta si la sesión comienza en client/backend. Al mover el repositorio, actualizar la ruta absoluta. El perfil se resolvió localmente con `codex sandbox -P sum-data-private -C <raíz> /usr/bin/true` (exit0), sin acceder a datos reales.

La sesión actual continúa sin sandbox. Editar configuración no modifica su aislamiento en caliente: iniciar una sesión que active este perfil y no lo sustituya por sandbox_mode/--sandbox/danger-full-access del launcher. MCP, navegador y APIs tienen controles propios; AGENTS prohíbe acceder indirectamente a las respuestas privadas. [Permisos oficiales](https://learn.chatgpt.com/docs/permissions).

El operador inicia el backend fuera del sandbox de los agentes, que no puede leer la carpeta protegida:

```sh
PLAN_ESTUDIOS_SNAPSHOT_DIR=/ruta/absoluta/al/proyecto/datos-reales \
pnpm --dir backend start:dev
```

## Preparación de Mi Información

La ampliación sigue [MIC-CONTRACT-1](contracts/local-api/mi-informacion-compatibility.md). Guardar las respuestas completas (incluyendo envelope) con estos nombres:

| Pantalla | Archivo |
| --- | --- |
| Mi Perfil | `mi-perfil.json` |
| Historial Académico | `historial-academico.json` |
| Formulario de Datos | `formulario-datos-matricula.json` |
| Ficha Socioeconómica | `ficha-socioeconomica.json` |
| Plan de Estudios | `plan-estudios.json` |

El Formulario será la fuente del alumno para el shell. Las demás respuestas podrán faltar sin reemplazarse por datos sintéticos. No renombrar ni agregar campos al JSON exportado para hacerlo coincidir con los fixtures locales.

Los tipos proporcionados cubren Perfil, el envelope/estado/alumno del Formulario y la forma candidata de Historial en `raw-types/historial.ts`. No definen el significado de las claves dinámicas de `formulario`, de `creditaje` ni de `criterioCalificacion`. Historial se valida como candidate-v1 y se mapea sin derivar aprobaciones o promedios globales; esta estructura sanitizada no verifica el JSON privado ni el comportamiento de producción. Ficha todavía requiere sus tipos anónimos para mostrar sus campos.

La importación está implementada y comprobada estáticamente; la integración con datasets reales no fue ejecutada por agentes. El operador puede iniciar el backend privado desde la raíz con:

```sh
MI_INFORMACION_SNAPSHOT_DIR="$PWD/datos-reales" pnpm --dir backend start:dev
```

Y en otra terminal:

```sh
pnpm --dir client dev:local
```

`formulario-datos-matricula.json` es obligatorio. Las otras tres respuestas son opcionales: su ausencia devuelve `503 SNAPSHOT_MISSING` y se muestra como información no disponible. Un archivo presente ilegible, inválido o con respuesta de error impide el arranque; no se reemplaza con fixtures. El catálogo se carga una vez; reiniciar el backend tras cambiar archivos.

Plan de Estudios usa la configuración independiente `PLAN_ESTUDIOS_SNAPSHOT_DIR`; `plan-estudios.json` es opcional y su ausencia produce `503 SNAPSHOT_MISSING`. Puede apuntar a la misma carpeta sin activar otros catálogos. Si defines la variable, quita `PLAN_ESTUDIOS_FIXTURE`; no son compatibles. Un envelope inválido impide el arranque. Sin la variable, permanece el fixture Plan anterior.

No definir `MI_INFORMACION_FIXTURE` ni `REPORTES_FIXTURE` al usar snapshots de Mi Información. Se permite definir también `MATRICULA_SNAPSHOT_DIR` para cargar el catálogo de Matrícula por separado; eso no convierte los demás módulos sintéticos en información real del mismo alumno.

Historial usa candidate-v1 por defecto con `historial-academico.json`; `local-v1` se permite únicamente mediante allowlist explícita para DTOs locales. Ficha se conserva opaca hasta contar con un tipo candidato. No declares una respuesta SUM como DTO local para forzar su representación; no hay conversión automática al DTO propio.

## Script principal: todos los módulos por CDP

El operador decidió continuar con exportación manual después de que Mi Perfil regresara a Inicio incluso desde el menú. El colector siguiente permanece disponible, pero su ejecución completa no está validada y actualmente se detiene ante esa redirección. No es necesario ejecutarlo para preparar los archivos privados.

[export-sum-all.cdp.mjs](../../scripts/export-sum-all.cdp.mjs) es JavaScript para ejecutar **personalmente desde la terminal**, con Node22 o posterior. Usa el navegador SUM que ya tiene sesión iniciada y CDP accesible en `http://127.0.0.1:9222`; no requiere paquetes adicionales. Los agentes no ejecutan el colector ni abren sus resultados.

REA encontró en el script público de Inicio un `debugger` cada1000ms y una recarga cuando la pausa supera100ms. Esto puede destruir un exportador pegado en Console; el proceso externo conserva su estado al navegar o recargar. [Hallazgo sanitizado y referencias REA](../../../evidence/sum/export-data/rea-findings.json), [fragmento público](../../../evidence/sum/export-data/detector.js) y [plan Sol High ME-EXPORT-2](plans/matricula-export-script.md).

1. Mantener abierta la sesión estudiantil SUM en el navegador con CDP. El puerto9222 ya fue accesible en la comprobación de metadatos de esta preparación; el script informa si deja de estarlo.
2. Dejar esa pestaña libre durante la recopilación: no navegar, cambiar selectores ni enviar formularios simultáneamente.
3. Ejecutar desde la raíz del repositorio:

```sh
node scripts/export-sum-all.cdp.mjs
```

4. El script recorre16vistas y guarda un ZIP en `datos-reales/`. No necesita un permiso de descarga del navegador. Extraer el ZIP **en la raíz del proyecto**, ya que sus entradas tienen el prefijo `datos-reales/`.

Opciones previstas por el contrato:

```sh
node scripts/export-sum-all.cdp.mjs --help
node scripts/export-sum-all.cdp.mjs --delay-ms 3000
node scripts/export-sum-all.cdp.mjs --cdp http://127.0.0.1:9222 --target TARGET_ID
```

`--target` sólo se necesita cuando existen varias pestañas estudiantiles válidas. No acepta cuentas ni credenciales. `--output nombre.zip` cambia únicamente el nombre del ZIP dentro de la carpeta privada; no permite rutas arbitrarias ni sobrescribe archivos. La pausa mínima entre vistas es2s; espera también la carga y el tráfico pertinente, con límites de tiempo. Su finalidad es reducir carga, no ocultar solicitudes.

La sesión CDP aplica temporalmente `Debugger.setSkipAllPauses` y reanuda las pausas durante la recopilación. Al salir desactiva esa configuración de su sesión y se desconecta. No modifica el código SUM ni afirma restaurar una preferencia previa de debugger que no se conoce. [Protocolo oficial Debugger](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/js_protocol.json).

### Qué recopila

El [manifest de código](../../scripts/export-sum-all.manifest.mjs) contiene16rutas de vistas previamente observadas y12pares ruta/acción candidatos. El script navega a esas vistas y escucha las respuestas de sus llamadas normales; **no inventa métodos, parámetros, acciones de Historial/Ficha ni nuevas llamadas API**. No pulsa Registrar, Confirmar, Modificar, Guardar, contraseña ni descargas. No recorre otros periodos, laboratorios o controles que requieran interacciones adicionales.

- **Respuestas originales:** texto JSON recibido, sin transformar valores, fechas, nulls o campos extra; cinco nombres de Matrícula conservados. También guarda las ocurrencias válidas en `responses/`. Si la última respuesta de una consulta falla, no presenta una anterior como canonical vigente.
- **Vistas:** `views/<slug>.json` captura datos DOM visibles de cada vista, con formato `sum-visible-dom-v1`. Es una representación de la página, no una respuesta API ni un contrato SUM confirmado. Excluye scripts, controles ocultos/contraseñas y material de autenticación; no lee storage.
- **Cobertura:** `manifest.json` contiene sólo slugs, estados, nombres técnicos y faltantes. JSON desconocidos no se recuperan: sólo se cuenta su presencia para señalar una brecha de contrato. Una captura DOM no reemplaza una respuesta wire ausente.

Los doce nombres de respuesta esperados:

| Módulo | JSON canonical |
| --- | --- |
| Perfil | `mi-perfil.json` |
| Formulario previo | `formulario-datos-matricula.json` |
| Información de Matrícula | `matricula-info.json` |
| Programación de Asignaturas | `programacion-asignaturas.json` |
| Pre-Matrícula | `reporte-pre-matricula.json` |
| Reporte Matrícula | `reporte-matricula.json` |
| Horarios | `reporte-horario.json` |
| Evaluaciones | `reporte-evaluaciones.json` |
| Deudas | `reporte-deudas.json` |
| Asistencias | `mis-asistencias.json` |
| Tutorías | `tutoria.json` |
| Plan de Estudios | `plan-estudios.json` |

Inicio, Historial, Ficha Socioeconómica y Manuales tienen captura DOM; no se fabrican endpoints para convertirlos en respuestas wire. Los candidatos pueden no ser solicitados por una vista o pueden fallar: el ZIP y su manifest lo indican sin crear archivos vacíos.

**`MATRICULA_SNAPSHOT_DIR` importa solamente los cinco JSON de Matrícula** (`matricula-info`, `programacion-asignaturas`, `reporte-pre-matricula`, `reporte-matricula`, `reporte-horario`). Plan de Estudios tiene un cargador independiente activado por `PLAN_ESTUDIOS_SNAPSHOT_DIR` y espera `plan-estudios.json`; el exportador CDP no garantiza crear ese archivo. Las demás respuestas siguen como material suplementario sin importador. Ningún flujo acredita compatibilidad100% con datos reales.

### Estados y privacidad

Código de salida0: las entradas previstas de la carga inicial están presentes;2: ZIP guardado con faltantes;1: fallo fatal;130: cancelación. Ninguno acredita cobertura de todos los estados o periodos. `Ctrl+C` cancela y limpia recursos. El navegador queda en la última vista visitada. El lock `.sum-export.lock` dentro de la carpeta privada impide corridas simultáneas; si queda huérfano tras una interrupción abrupta, el operador lo retira manualmente.

Si una captura DOM alcanza su límite de tamaño o cantidad, se identifica como truncada y no satisface cobertura completa. Las tablas paginadas se capturan en el estado visible inicial; no se afirma haber recopilado sus páginas restantes.

Diagnósticos que se pueden compartir sin datos personales:

| Código | Acción del operador |
| --- | --- |
| `CDP_DISCOVERY` | Comprobar que el navegador sigue abierto con CDP en el puerto indicado. |
| `TARGET_NOT_FOUND` | Abrir una de las vistas estudiantiles conocidas dentro de la sesión SUM. |
| `TARGET_AMBIGUOUS` | Elegir la pestaña deseada con `--target`; no compartir títulos ni URLs personales. |
| `EXPORT_LOCK` | Comprobar que no haya otra recopilación activa; retirar manualmente un lock huérfano. |
| `SESSION_OR_SCOPE` | Revisar la sesión/pantalla en el navegador; el script se detiene sin recopilar autenticación. |
| `SCOPE_DETAIL` | Compartir sólo esta línea técnica y `SESSION_OR_SCOPE`: distingue navegación, destino conocido y HTTP401/403 sin revelar URLs ni datos. |
| `MISSING` | Consultar el manifest privado y compartir sólo el slug/key/código si hace falta. |

El ZIP contiene datos personales originales. Mantenerlo, su extracción y el lock dentro de `datos-reales/`; no compartirlos con agentes. No se copian cookies, cabeceras de autorización ni cuerpos de solicitudes al ZIP o a logs. Compartir sólo un diagnóstico sanitizado de estado/archivo/key/field path si hace falta corregir la herramienta.

La primera ejecución comunicada por el operador se detuvo al visitar Perfil con `SESSION_OR_SCOPE`; no acredita una exportación completa. Se añadió `SCOPE_DETAIL` para precisar la causa en una nueva ejecución del operador, conservando la detención ante redirecciones y fallos de autorización.

Planificación por Sol High e implementación por Luna High según ME-EXPORT-2. Comprobaciones de entrega limitadas a sintaxis y revisión estática/diff; **no se ejecutó el colector en producción ni se abrieron datos privados**. Consultar el [registro del workflow](workflows/export-data.md) para comandos efectivamente ejecutados.

## Alternativa: Network → HAR → ZIP (cinco JSON de Matrícula)

Si la exportación desde Console no termina, usar la exportación nativa de Network. No depende de ejecutar el exportador dentro de la página; necesita que las respuestas ya estén capturadas. El fallo concreto de descarga no está diagnosticado: F8 por sí solo no demuestra que el script terminó ni que el navegador aceptó la descarga.

1. Abrir **Network**, activar **Preserve log** y mantener la grabación activa. Si ya aparecen las cinco respuestas completas, conservarlas; si se inicia una captura nueva, limpiar el registro antes de navegar.
2. Abrir normalmente **Información de Matrícula**, **Programación de Asignaturas**, **Reporte Pre-Matrícula**, **Reporte Matrícula** y **Reporte Horario de Asignaturas**, una vista a la vez, esperando que termine de cargar.
3. Filtrar por `accion=` y verificar las cinco acciones de la tabla. No pulsar Registrar ni Confirmar matrícula.
4. Clic derecho en una solicitud → **Copy → Save all listed as HAR (sanitized)**. Guardar o mover el archivo a `datos-reales/sum.har` del proyecto. También existe **Export HAR (sanitized)** en la barra de Network. [Referencia oficial de Network](https://developer.chrome.com/docs/devtools/network/reference).
5. Ejecutar personalmente desde la raíz del repositorio, con Python 3.8 o posterior:

```sh
python3 scripts/extract-sum-har.py datos-reales/sum.har
```

En Windows, si se utiliza el lanzador de Python, sustituir `python3` por `py -3`.

| Acción capturada | Archivo dentro del ZIP |
| --- | --- |
| `obtenerInformacion` | `matricula-info.json` |
| `obtenerProgramacionAsignaturas` | `programacion-asignaturas.json` |
| `obtenerAlumnoPrematricula` | `reporte-pre-matricula.json` |
| `obtenerAlumnoMatricula` | `reporte-matricula.json` |
| `obtenerHorariosAsignatura` | `reporte-horario.json` |

[extract-sum-har.py](../../scripts/extract-sum-har.py) genera `datos-reales/sum-matricula-json.zip`. Extraer el ZIP **en la raíz del proyecto**: sus entradas ya tienen el prefijo `datos-reales/`. No requiere paquetes adicionales ni realiza peticiones de red. Sólo acepta un HAR ubicado directamente en la carpeta privada y exporta cuerpos de cinco GET de origen, rutas y acciones conocidas, sin cabeceras. Conserva el texto JSON recibido; decodifica los cuerpos base64 cuando corresponde. Comprueba HTTP200 y el envelope básico; NestJS mantiene la validación completa de contratos.

Si hay capturas repetidas, usa la última entrada de cada consulta y rechaza errores, cuerpos ausentes o JSON inválido. Si falta alguna de las cinco respuestas, no crea un ZIP parcial. Tampoco sobrescribe un ZIP anterior: renombrarlo antes de repetir.

**HAR sanitized elimina cabeceras sensibles, pero no anonimiza los datos personales de las respuestas.** Mantener tanto HAR como ZIP dentro de `datos-reales/`; no enviarlos al agente. La alternativa manual es **Copy → Copy response** para cada solicitud y guardar su JSON con el nombre de la tabla. [Exportación y copia de respuestas](https://developer.chrome.com/docs/devtools/network/reference#export-requests-data).

Sólo se comprobó la sintaxis del conversor; no se ejecutó con un HAR real ni se accedió a datos privados.

## Exportar las cinco consultas desde Console

Script: [export-sum-matricula.devtools.js](../../scripts/export-sum-matricula.devtools.js). Copiar su contenido completo en Console de DevTools de la pestaña SUM autorizada. No ejecutarlo mediante el agente. Versión concisa sin panel, selector de carpeta ni modal: comienza al pegarlo y solicita un único ZIP tras las cinco respuestas. Hace cinco GET conocidos, secuenciales, con pausa fija de dos segundos, timeout30s por llamada y sin reintentos. Sólo imprime contadores/diagnósticos técnicos, nunca cuerpos. La pausa reduce carga y no oculta las solicitudes. Ejecutar una sola vez; para sustituir una versión anterior, recargar la pestaña primero.

La captura proporcionada por el operador mostraba **Paused in debugger**. Mientras JavaScript esté pausado no progresan las consultas ni la descarga; reanudar desde DevTools. Esto no es un modal de exportación. No se modifican funciones de SUM, debugger, alert/confirm ni permisos del navegador. [Pausas y breakpoints](https://developer.chrome.com/docs/devtools/javascript/breakpoints).

Extraer `datos-reales/` de `sum-matricula-json.zip` en el proyecto. El ZIP se genera en memoria con STORE y CRC32 sin librerías externas; conserva texto JSON original. [Formato ZIP](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT). La herramienta solicita automáticamente la descarga; el operador confirma su finalización en el navegador. Si el navegador exige permitir descargas o confirmar guardado, esa confirmación es manual.

Contenido:

```text
datos-reales/
  matricula-info.json
  programacion-asignaturas.json
  reporte-pre-matricula.json
  reporte-matricula.json
  reporte-horario.json
```

Si alguna consulta falla, devuelve HTML o codError no nulo, se detiene sin preparar un ZIP parcial. Comprueba el envelope básico, no todos los schemas; NestJS hace su validación completa al arrancar. Para detener consultas pendientes, recargar la pestaña. No imprimir ni compartir cuerpos de respuesta, cookies ni cabeceras.

El script no registra ni confirma una matrícula y no exporta contratos de escritura desconocidos. Sintaxis comprobada con `node --check`; no se ejecutó contra producción ni se abrieron datos del operador. El fallback ZIP evita depender de showDirectoryPicker, pero el operador reportó que la descarga no termina incluso después de F8. Usar la alternativa Network/HAR anterior; no se acredita una exportación real correcta desde Console.
