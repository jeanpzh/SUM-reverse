# Evidencia del diagnóstico P1-06 (agregados sanitizados)

**Estado:** `local-only`. Mediciones del simulador propio con datos sintéticos, en una VM de 2 vCPU donde k6 y el servidor comparten host. No acreditan capacidad ni comportamiento del SUM institucional. Informe: [`docs/performance/diagnosis.md`](../../../../docs/performance/diagnosis.md).

Commit medido: `6dd3c95`. Fecha de ejecución: 2026-10-22.

## Contenido

| Ruta | Qué es |
| --- | --- |
| `data/runs.json` | Un registro por ejecución: latencias de k6, descomposición de la media, fases del store, esperas del pool, wait events, estado inicial (campañas y filas) y cobertura. Sin identificadores de pruebas |
| `data/variants.json` | Mediana y rango [mín, máx] por variante. Excluye las ejecuciones que el guard del generador marcó inválidas (campos `excluded` y `nTotal`) |
| `data/e3b-*.json`, `data/e9-*.json` | Salida del bench en la base PostgreSQL desechable (E3b: disco frente a tmpfs; E9: pocas frente a muchas campañas) |
| `pg/` | Volcados de `pg_stat_statements` y `EXPLAIN` sanitizados por `load/pg-diagnostics.sh`, y `pg_test_fsync` de la sesión (E3) |
| `scripts/` | Los scripts con los que se ejecutó y agregó la campaña |

## Saneamiento

- Los identificadores de campaña se sustituyen por `CAMPAIGN_ID`; los `testid` de k6 no se incluyen.
- Sin credenciales, cookies ni datos de personas. Los datos de partida son los fixtures sintéticos del simulador.
- Las rutas absolutas de la sesión se sustituyeron por variables (`RESULTS_DIR`, `REPO`).

## Cómo se ejecutó (resumen)

- `scripts/mkplan.mjs` genera `scripts/plan-full.txt` (135 ejecuciones); `scripts/driver.sh <plan>` las ejecuta en serie, con un único propietario de Docker, y guarda por ejecución el resultado de k6, el estado inicial, la configuración efectiva de los contenedores y la captura del servidor (`scripts/capture.mjs`).
- `scripts/docker-wrapper.sh`: `sudo` descarta las variables de entorno, por lo que `PERF_CPUSET_*`, `SIMULATOR_DB_POOL_MAX` y `COMPOSE_FILE` se pasan con `sudo env`. El driver usa este envoltorio como `docker`.
- E14 usa `scripts/compose.e14.yaml`, que monta un `nginx.conf` sin la línea del servidor `api-b` (archivo `nginx-1api.conf`, no incluido: es el `infra/simulator/nginx.conf` de ese commit sin esa línea).
- `scripts/disposable.sh e3b|e9` ejecuta E3b y E9 en un PostgreSQL desechable con la misma imagen (por digest) y los mismos parámetros de diagnóstico, nunca sobre el volumen del stack.
- `scripts/aggregate.mjs <runs> <salida>` produce `data/`; `scripts/attrib.mjs` calcula la atribución de una ejecución.
- Las ejecuciones de la campaña no se publican crudas: los resultados completos (resúmenes de k6, capturas) quedaron fuera del repositorio.

## Omitido a propósito

E14 stress y la tercera repetición de mixed con pool 40 no se ejecutaron (decisión del operador). Véase la sección de huecos del informe.
