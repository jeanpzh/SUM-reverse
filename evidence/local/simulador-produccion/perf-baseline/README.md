# Agregados de la línea base P0-06

**Estado:** `local-only`. Simulador propio con datos construidos de forma independiente. No acredita capacidad ni comportamiento del SUM institucional. El informe es [docs/performance/baseline-400.md](../../../../docs/performance/baseline-400.md).

## Procedencia

| Aspecto | Valor |
| --- | --- |
| Commit medido | `c29b9d5`. Ejecuciones complementarias (stress, repeticiones 4–5, y jornada): `d4b4a7f` (#20; solo cambia el arnés de carga) |
| Entorno | ENV-H: VM de 2 vCPU y 8 GB, sin cpusets, `generatorSharesServerHost: true`. Grafana detenido y Prometheus activo |
| Fechas (UTC) | 2026-10-22, de 02:47 a 04:52 y de 11:25 a 11:49; complementarias de 12:09 a 12:55 |
| Imágenes | Fijadas por digest en `compose.simulator.yaml` |
| Fuente de los datos | `infra/simulator/runtime/results/` (privado, fuera de Git): summary-export de k6, auditorías, CSV de recursos, `run-meta` y resultados de `submit-bench` |
| No registrado (estrategia §8.1) | Latencia de fsync (`pg_test_fsync`) y huella de fuentes (`source-fingerprint.json`) |

## Ficheros

- `aggregate.json`: filas por ejecución y mediana/rango por escenario y por tamaño del bench. Lo genera `aggregate.mjs`, que filtra por `gitSha` y modo, y sustituye los testids por `<testid>`.
- `aggregate.mjs`: el script de agregación. Uso: `node aggregate.mjs <results-dir> c29b9d5 normal aggregate.json`.
- `aggregate-p0b.json`: las ejecuciones complementarias de `d4b4a7f`, sin el bench. Uso: `node aggregate.mjs <results-dir> d4b4a7f normal aggregate-p0b.json variants-p0b.json --no-bench`.
- `variants-p0b.json`: separa las dos jornadas por su hora de inicio. `run-meta` no registra `WAVE_FRONTLOAD`, así que la correspondencia sale del log del script de ejecución (inicio y fin de cada bloque), no de los metadatos.
- `http-errors.json` y `http-errors-p0b.json`: respuestas ≥ 400 por ventana, tomadas de `simulator_http_metrics`, más el recuento de deadlocks y cancelaciones del log de PostgreSQL.
- `guard-reeval.json` y `guard-reeval.mjs`: las 30 ejecuciones de una iteración por VU de `c29b9d5`, re-evaluadas sin conexión con el guard de #20 (`--connection-model per-vu`). Uso: `node guard-reeval.mjs <results-dir> c29b9d5 <ruta a load/check-generator-guard.mjs> > guard-reeval.json`.

## Ejecuciones excluidas

| Ejecución | Motivo |
| --- | --- |
| stress, repetición 4 | Cortada a las 04:52. Últimos ficheros a esa hora; `uptime -s` = 11:19. Sin resultado |
| jornada 1422, `WAVE_FRONTLOAD=1` | k6 terminado por OOM global durante la inicialización de VUs (≈605/1422, 5,6 GB de RSS). Sin summary-export |
| jornada 1422, `WAVE_FRONTLOAD=0` | Detenida por el operador durante el precalentamiento, antes de la carga, para no provocar un segundo OOM global |

Las dos jornadas excluidas se repitieron con éxito sobre `d4b4a7f` y están en `aggregate-p0b.json`.

Las ejecuciones que el guard marca como inválidas **sí** aparecen en `aggregate.json`, con `runValid: false` y sus motivos en `guardReasons`.
