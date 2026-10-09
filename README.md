# SUM local

Réplica independiente con React y NestJS. La aplicación Docker no conecta con
SUM. El exportador separado lo ejecuta el operador en su equipo con su sesión.

## Flujo: sesión SUM → exportar → generar fixtures → Docker

### 1. Preparar el equipo

Requisitos: Node.js 24, pnpm, Docker con Compose y un escritorio gráfico.
Los scripts usan rutas relativas al repositorio y Chromium de Playwright;
no necesitan Brave, rutas personales ni un puerto de depuración.

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
contadores, nombres fijos y códigos de error. Al finalizar se cierra Chromium.

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

### 4. Levantar los fixtures generados con Docker

```sh
docker compose -f compose.yaml -f compose.synthetic.yaml up --build
```

Abre **http://localhost:5180**. Solo monta `datos-sinteticos/` en modo lectura;
la aplicación no recibe `datos-reales/` ni la sesión SUM. Para repetir el flujo,
exporta, genera y reinicia el backend; los snapshots se cargan al arrancar.
Si los contenedores ya estaban ejecutándose, aplica el nuevo conjunto con:

```sh
docker compose -f compose.yaml -f compose.synthetic.yaml restart backend
```

Para detener este modo:

```sh
docker compose -f compose.yaml -f compose.synthetic.yaml down
```

Asistencias, Evaluaciones y Deudas conservan los fixtures de la aplicación:
no pertenecen a estas nueve exportaciones. La validación de entrega de los
scripts es estática; ningún agente ejecutó la lectura de datos privados.

## Alternativa: fixtures básicos, sin sesión ni exportación

Instala Docker con Docker Compose y, desde la raíz, ejecuta:

```sh
docker compose up --build
```

Abre **http://localhost:5180**. El comando instala las dependencias dentro de las
imágenes, compila ambas aplicaciones y espera a que la API esté disponible antes
de iniciar el frontend. No necesitas instalar Node ni pnpm en el equipo.

Para dejarlo en segundo plano:

```sh
docker compose up --build -d
```

Para detenerlo y eliminar los contenedores:

```sh
docker compose down
```

Los logs se consultan con `docker compose logs -f`. Si el puerto está ocupado,
cambia `SUM_PORT` en un archivo `.env` local (por ejemplo, `SUM_PORT=5181`).

El frontend compilado se sirve con Nginx; `/api` redirige a NestJS por la red
interna. Solo el frontend publica un puerto, limitado al equipo local.
Para aplicar cambios de código, vuelve a ejecutar `docker compose up --build`.

## Usar los JSON locales del operador

El operador puede ejecutar este comando desde la raíz:

```sh
docker compose -f compose.yaml -f compose.snapshots.yaml up --build
```

Abre **http://localhost:5180**. Esta configuración monta `./datos-reales` en
`/snapshots` solo para lectura y activa los cargadores de Matrícula, Mi Información
y Plan de Estudios. También elimina las variables de fixtures incompatibles.
Los JSON permanecen fuera de las imágenes y de Git; la carpeta debe existir
en el equipo donde corre Docker. Este modo requiere Compose compatible con `!reset`.

El backend valida los esquemas al arrancar y debe reiniciarse si cambian los JSON.
Los módulos sin soporte de snapshots (Asistencias, Evaluaciones y Deudas)
conservan sus datos sintéticos. Los agentes no ejecutan este modo ni inspeccionan
sus datos; solo el operador lo inicia y consulta localmente.

Para detener este modo:

```sh
docker compose -f compose.yaml -f compose.snapshots.yaml down
```

## Desarrollo con recarga automática

Con Node y pnpm instalados, ejecuta `pnpm --dir backend start:dev` y
`pnpm --dir client dev:local` en dos terminales, después de instalar las
dependencias de cada carpeta con `pnpm --dir <carpeta> install --frozen-lockfile`.

Consulta [la documentación del backend](backend/README.md) y
[el sistema de diseño](client/DESIGN_SYSTEM.md).
