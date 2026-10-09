# SUM local

Réplica independiente con React y NestJS. Docker utiliza únicamente fixtures
sintéticos; no conecta con SUM ni monta snapshots privados.

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

## Desarrollo con recarga automática

Con Node y pnpm instalados, ejecuta `pnpm --dir backend start:dev` y
`pnpm --dir client dev:local` en dos terminales, después de instalar las
dependencias de cada carpeta con `pnpm --dir <carpeta> install --frozen-lockfile`.

Consulta [la documentación del backend](backend/README.md) y
[el sistema de diseño](client/DESIGN_SYSTEM.md).
