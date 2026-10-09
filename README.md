# SUM local

Réplica independiente con React y NestJS. Docker utiliza fixtures sintéticos
por defecto y no conecta con SUM.

## Arrancar todo con un comando

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
