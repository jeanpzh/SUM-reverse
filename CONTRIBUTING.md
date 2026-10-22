# Cómo contribuir

Gracias por ayudar. Este repo es una réplica independiente del SUM con datos
sintéticos; no está afiliado a la UNMSM.

## Flujo

1. Haz **fork** del repo y clónalo.
2. Crea una rama desde `master`: `git switch -c feat/descripcion-corta`.
3. Haz commits pequeños con asunto imperativo, por ejemplo `Add student profile screen`.
4. Mantén tu rama al día: `git fetch upstream && git rebase upstream/master`.
5. Abre un PR hacia `jeanpzh/SUM-reverse:master` y completa la plantilla.
6. Espera la revisión y el CI. Nadie empuja directo a `master`.

## Arrancar el proyecto

Sin Node, solo Docker:

```sh
docker compose -f compose.local.yaml up --build   # http://localhost:5180
```

Con Node 24 y pnpm:

```sh
pnpm --dir client install --frozen-lockfile
pnpm --dir backend install --frozen-lockfile
pnpm --dir backend start:dev
pnpm --dir client dev:local
```

## Checks antes de abrir el PR

```sh
pnpm --dir client build && pnpm --dir client lint && pnpm --dir client test:data
pnpm --dir backend build && pnpm --dir backend lint && pnpm --dir backend test
```

## Reglas obligatorias

- **Nunca** subas `datos-reales/`, exportaciones del SUM, `.env`, cookies,
  tokens, HAR ni capturas sin sanitizar.
- Usa solo datos sintéticos. Reemplaza códigos, nombres y documentos por
  marcadores como `STUDENT_ID` o `STUDENT_NAME`.
- No llames ni hagas proxy al SUM real desde la app.
- Conserva la fidelidad visual de las pantallas ya replicadas; no las rediseñes.
- Antes de crear un componente, contrato o DTO nuevo, revisa `shared/`,
  `client/src/components/`, `client/src/data/` y el módulo del backend.

Detalle completo: [AGENTS.md](AGENTS.md), [client/AGENTS.md](client/AGENTS.md) y
[backend/AGENTS.md](backend/AGENTS.md).

## Licencia

Al contribuir aceptas que tu aporte se publique bajo la licencia [MIT](LICENSE).
