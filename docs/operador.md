# Guía del operador: datos propios del SUM

Esta guía es solo para el operador que exporta sus propios datos con su sesión del SUM. Para usar o contribuir a la réplica no la necesitas: el modo local funciona con datos sintéticos. Los JSON exportados son privados; nunca se suben al repositorio.

`compose.prod.yaml` despliega la réplica con los JSON del operador en el puerto **5181**, sin consola de simulación.

## Flujo: sesión SUM → exportar → generar fixtures → Docker

### 1. Preparar el equipo

Requisitos: Node.js 24, pnpm, Docker con Compose y un escritorio gráfico.
Los scripts usan rutas relativas al repositorio. Puedes usar Chromium de
Playwright o [Chrome/Brave de Windows por CDP](#chromebrave-de-windows-desde-windows-o-wsl).

Desde la raíz, una sola vez:

```sh
pnpm --dir client install --frozen-lockfile
pnpm --dir client exec playwright install chromium
```

En Linux, si faltan bibliotecas del navegador, usa
`pnpm --dir client exec playwright install --with-deps chromium`.
La instalación descarga herramientas; todavía no procesa datos privados.

### 2. Iniciar sesión y exportar las nueve consultas

Ejecuta personalmente:

```sh
node client/scripts/export-sum.mjs --replace
```

1. El script abre Chromium. Inicia sesión manualmente con una cuenta cuyo acceso
   y consultas de solo lectura estés autorizado a realizar.
2. Regresa a la terminal y escribe **EXPORTAR**.
3. El script abre las nueve vistas para identificar el método y cuerpo de su
   consulta nativa. Después realiza las llamadas API usando `fetch` dentro del
   mismo navegador, con la sesión autenticada. No adivina GET/POST ni hace
   reintentos con métodos alternativos.
4. Recibe y valida las nueve respuestas antes de escribir los archivos.
   `--replace` conserva una copia anterior en `datos-reales/backup-<fecha>/`.
   Sin esa opción, se detiene si ya existen archivos de destino.

No envíes formularios ni cambies la sesión durante la exportación. Solo se
permiten las consultas declaradas en `scripts/sum-snapshot-contract.mjs`.
No se automatiza la contraseña, se guardan cookies o tokens, ni se generan HAR,
videos, screenshots o archivos `storageState`. Los logs contienen únicamente
contadores, nombres fijos y códigos de error. Al finalizar se cierra Chromium;
con `--cdp` se cierra solo la pestaña del exportador y se desconecta Playwright.

Los nueve JSON quedan en **`datos-reales/`**, fuera de Git y de las imágenes
Docker. Nunca compartas esa carpeta con agentes. Si una consulta no se detecta,
devuelve HTML, falla la sesión o no cumple el esquema, el exportador se detiene
sin sustituir el conjunto existente. Los métodos y estados efectivos de SUM
quedan pendientes de la ejecución del operador; no se ejecutó contra producción.

### 3. Generar fixtures derivados localmente, sin LLM

```sh
node scripts/generate-synthetic.mjs --seed 42
```

Lee únicamente los nueve archivos previstos y escribe **`datos-sinteticos/`**.
No tiene llamadas de red, servicios externos ni dependencias de generación.
Con los mismos archivos y semilla, produce el mismo conjunto.

Conserva las filas, nulls, tipos, estados booleanos, créditos, ciclos y relaciones
entre cursos. Sustituye nombres, documentos, correos, teléfonos, códigos, texto
libre y claves opacas; elimina fotografías y URLs. Cambia periodos, fechas,
días y horas de manera consistente, conservando duraciones. Cambia calificaciones
y recalcula los promedios por periodo como una decisión de los fixtures locales;
no supone un umbral de aprobación ni el significado de métricas desconocidas.
Valida nuevamente el conjunto con los contratos existentes.

Estos son **fixtures derivados para desarrollo**, no una garantía de anonimato:
la cantidad de filas, duraciones y patrones estructurales pueden seguir siendo
reconocibles. Ambas carpetas se excluyen de Git. Revisa la salida localmente antes
de compartirla; no se publican automáticamente fixtures ni tablas de equivalencias.

### 4. Consultar los JSON generados con el despliegue de la réplica

```sh
SUM_SNAPSHOT_SOURCE_DIR=./datos-sinteticos docker compose -f compose.prod.yaml up --build
```

Abre **http://localhost:5181**. Solo monta `datos-sinteticos/` en modo lectura;
la aplicación no recibe `datos-reales/` ni la sesión SUM. Para repetir el flujo,
exporta, genera y reinicia el backend; los snapshots se cargan al arrancar.
Si los contenedores ya estaban ejecutándose, aplica el nuevo conjunto con:

```sh
SUM_SNAPSHOT_SOURCE_DIR=./datos-sinteticos docker compose -f compose.prod.yaml restart backend
```

Para detener este modo:

```sh
SUM_SNAPSHOT_SOURCE_DIR=./datos-sinteticos docker compose -f compose.prod.yaml down
```

Asistencias, Evaluaciones y Deudas conservan los fixtures de la aplicación:
no pertenecen a estas nueve exportaciones. La validación de entrega de los
scripts es estática; ningún agente ejecutó la lectura de datos privados.

## Chrome/Brave de Windows desde Windows o WSL

El lanzador detecta la instalación de Chrome o Brave en Windows, abre una
instancia con perfil temporal separado y habilita CDP en `127.0.0.1:9222`.
No usa el perfil habitual ni necesita instalar Chromium de Playwright.
Chrome moderno requiere un directorio de datos diferente para depuración.
[Documentación de Chrome](https://developer.chrome.com/blog/remote-debugging-port).

### Abrir el navegador

Desde la raíz en **PowerShell de Windows**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-sum-browser.ps1 -Browser brave
```

Desde la raíz en **WSL**, usando el navegador instalado en Windows:

```sh
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$PWD/scripts/start-sum-browser.ps1")" -Browser brave
```

Usa `-Browser chrome` para Chrome, o elimina `-Browser` para detección automática
(Chrome primero). Para una instalación distinta, indica `-Executable` con su
ruta Windows. El puerto puede cambiar con `-Port`; ajusta también el MCP y
`--cdp`. Si está ocupado, el lanzador se detiene.

Deja esa terminal abierta. Al pulsar Enter cierra únicamente esa instancia y
elimina el perfil temporal. Cierra la sesión del exportador antes de hacerlo;
el login dura mientras permanezca abierta esta instancia.

### Conexión desde WSL

Para conectar desde WSL a este puerto local de Windows necesitas **Windows 11
22H2 o posterior y WSL con red mirrored**. En `%UserProfile%\.wslconfig`, añade
o actualiza estas claves sin sustituir las otras opciones:

```ini
[wsl2]
networkingMode=mirrored
```

Aplica el cambio con `wsl --shutdown` en PowerShell y vuelve a abrir WSL.
Ese comando detiene las sesiones WSL actuales. En el modo NAT predeterminado,
el `127.0.0.1` de WSL no apunta al navegador de Windows. Si mirrored no está
disponible, ejecuta Node y Codex en Windows con un checkout local del repositorio.
[Documentación de redes WSL](https://learn.microsoft.com/en-us/windows/wsl/networking).

### Usar el navegador con el exportador

Instala las dependencias con `pnpm --dir client install --frozen-lockfile`.
Desde **otra terminal**, tanto en Windows como en WSL con mirrored:

```sh
node client/scripts/export-sum.mjs --cdp http://127.0.0.1:9222 --replace
```

Abre su propia pestaña en esa instancia, reutiliza su sesión y pide **EXPORTAR**
tras el login manual. Solo acepta endpoints HTTP locales. Al finalizar cierra
su pestaña, retira sus reglas de red y deja abierto el navegador Windows.
Luego continúa con la generación local y Docker de los pasos 3 y 4.

### Configuración del MCP en Codex

Integra la plantilla `.codex/playwright-cdp.toml` (local, no versionada)
en `.codex/config.toml`; la plantilla sola no se carga automáticamente.
En WSL usa:

```toml
[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest", "--cdp-endpoint=http://127.0.0.1:9222"]
startup_timeout_sec = 60

[mcp_servers.playwright.tools.browser_tabs]
approval_mode = "approve"
```

En Windows nativo, si Codex no puede ejecutar `npx.cmd`, sustituye **dentro de
`[mcp_servers.playwright]`** `command` y `args` por:

```toml
command = "cmd"
args = ["/c", "npx", "-y", "@playwright/mcp@latest", "--cdp-endpoint=http://127.0.0.1:9222"]
```

Abre primero el navegador y reinicia la sesión de Codex para cargar el MCP.
Necesitas Node/npm en el sistema donde corre Codex. Esta opción conecta con la
instancia existente; el MCP no arranca Chrome/Brave por sí mismo.
[Playwright MCP](https://github.com/microsoft/playwright-mcp),
[referencia de configuración de Codex](https://developers.openai.com/codex/config-reference).

Usa el MCP del agente con páginas locales y datos sintéticos. El exportador
privado lo ejecuta el operador sin llamadas del agente al navegador; no uses
el MCP simultáneamente durante el login o la exportación de SUM. La configuración
de aprobación de una herramienta no aísla los datos de la sesión del navegador.

Validación realizada: sintaxis JavaScript y TOML; no se abrió una instancia
Windows ni se conectó a CDP o a una sesión SUM durante esta implementación.

## Usar los JSON locales del operador

El archivo `compose.prod.yaml` despliega la réplica con los JSON del operador. Si ya los tienes en `datos-reales/`, ejecuta desde la raíz:

```sh
docker compose -f compose.prod.yaml up --build
```

Abre **http://localhost:5181**. Esta configuración monta `./datos-reales` en
`/snapshots` solo para lectura y activa los cargadores de Matrícula, Mi Información
y Plan de Estudios. No activa escenarios ni las variables de fixtures incompatibles.
Los JSON permanecen fuera de las imágenes y de Git; la carpeta debe existir
en el equipo donde corre Docker. El archivo es independiente y no usa etiquetas `!reset`.

Para usar otra carpeta, indica su ruta absoluta (también admite espacios):

```sh
SUM_SNAPSHOT_SOURCE_DIR='/ruta/a/mis datos SUM' \
  docker compose -f compose.prod.yaml up --build
```

También puedes guardar `SUM_SNAPSHOT_SOURCE_DIR=/ruta/a/mis datos SUM` en el
archivo `.env` local de la raíz. Mantén esa carpeta privada fuera del repositorio.
Sin la variable, se sigue usando `./datos-reales`.

Los nombres y esquemas deben corresponder a los cargadores existentes:

```text
mi-perfil.json
formulario-datos-matricula.json
historial-academico.json
matricula-info.json
programacion-asignaturas.json
reporte-pre-matricula.json
reporte-matricula.json
reporte-horario.json
plan-estudios.json
```

Se reutilizan las pantallas y navegación actuales. Los archivos se consultan en
modo lectura. La simulación y los comandos MODE están desactivados en este despliegue.

El backend valida los esquemas al arrancar y debe reiniciarse si cambian los JSON.
Los módulos sin soporte de snapshots (Asistencias, Evaluaciones y Deudas)
conservan sus datos sintéticos. Los agentes no ejecutan este modo ni inspeccionan
sus datos; solo el operador lo inicia y consulta localmente.

Para detener este modo:

```sh
docker compose -f compose.prod.yaml down
```

