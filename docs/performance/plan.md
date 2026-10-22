# Plan de rendimiento P0–P3

**Fecha:** 2026-10-22. **Autor del plan:** principal. Los workers no planifican: implementan tareas ya especificadas.
**Estado:** propuesto, pendiente de revisión. No se implementó nada ni se ejecutó carga.
**Base:** [evaluación](assessment.md) (hipótesis H1–H12) y [estrategia de pruebas](test-strategy.md) (experimentos E1–E13 y criterios por fase). Todo es `local-only`, con datos construidos de forma independiente.

## 0. Reglas comunes a todas las tareas

Todo handoff incluye estos elementos (AGENTS.md raíz §1 y §5):

- **Carpeta destino**, su `AGENTS.md` y su skill: backend → [backend/AGENTS.md](../../backend/AGENTS.md) + `backend/.agents/skills/sum-nestjs-implement/SKILL.md` (verificación: `sum-nestjs-verify`). `load/`, `infra/`, Compose y `docs/` son de la raíz → [AGENTS.md](../../AGENTS.md) + `.agents/skills/sum-workflow/SKILL.md` (aceptación integrada: `sum-fullstack-verify`).
- **Perfil:** `sum-implementer` o `sum-executor` (GPT-6 Luna High). Como máximo 2 workers simultáneos, sin subdelegación, con archivos exclusivos disjuntos. Cada worker comprueba CodeGraph y valida las exclusiones de `codegraph.json` antes de cualquier `codegraph init`.
- **Fidelidad SUM:** no hay pantallas autorizadas para cambios. `client/` no se modifica; la estructura, estilos, textos y navegación de las pantallas replicadas se conservan. Toda tarea debe reutilizar los módulos, contratos y validadores existentes ([SIM-PUBLIC-1](../reverse-engineering/contracts/local-api/simulador-produccion.md), [SIM-LOAD-2](../reverse-engineering/contracts/local-api/simulator-load-profiles.md)).
- **Datos:** solo sintéticos. Prohibido leer `datos-reales/`, snapshots privados o el SUM. La carga se dirige únicamente al Compose propio.
- **Invariantes** (evaluación §1.6): orden de locks campaña → actor → secciones una a una; cierre de campaña coordinado; deduplicación `(campaignId, actorId, requestId)`; `REQUEST_CONFLICT` 409; 503 `STORAGE_UNAVAILABLE` con el mismo envelope; atomicidad; sin caché de ocupación, advisory locks ni mutex; `synchronous_commit=on`.
- **Umbrales:** no se modifican (estrategia §1). Una tarea que solo «pasa» porque cambió un umbral o la carga se rechaza.
- **Reparación:** como máximo un ciclo automático tras una verificación fallida; después, diagnóstico del principal.
- **Ejecuciones de carga:** las hace el worker asignado o el operador, siempre contra el Compose sintético. Los resultados crudos quedan en `infra/simulator/runtime/results/` (fuera de Git); a la evidencia versionada solo pasan agregados sanitizados.

`[P]` marca las tareas que pueden ejecutarse en paralelo con otra `[P]` de la misma fase porque sus archivos son disjuntos.

## 1. Decisiones del usuario

| ID | Decisión | Estado (2026-10-22) | Efecto en el plan |
| --- | --- | --- | --- |
| D-1 | Qué hacer si t_cs no alcanza el presupuesto de 800/1000 actores | **Resuelta:** se acepta el incumplimiento medido; el algoritmo se revisa solo si corresponde | 800/1000 son estrés. P2-11 (revisión del algoritmo de locks) solo se activa si P1 demuestra que ni el pico de 507 es alcanzable |
| D-2 | SLO para escenarios sin umbral | **Resuelta:** sí, p95 < 2 s y p99 < 5 s | Se aplica al login (`auth-login`) y al envío en carga sostenida (P0-08). retry y resilience siguen informativos (estrategia §1) |
| D-3 | Hardware | **Resuelta:** VM de 2 vCPU y 8 GB | ENV-H es el entorno principal; cpusets solo para E4; ENV-C opcional (estrategia §4) |
| D-4 | Límite de login por IP si resilience o soak con 800/1000 producen 429 | Pendiente (bajo riesgo) | Mantener 2000/min salvo evidencia; cualquier otro valor se documenta en la ejecución |
| D-5 | Población y picos | **Dato aportado:** 1422 alumnos con PP (2026-I) más la Escuela de IA (cantidad desconocida); pico de 507 a las 12:00 (evaluación §2.4) | Objetivo de aceptación: 507. Límite de actores ampliado a 2000 y perfiles FISI (P0-07); escenario de jornada (P0-08) |

## 2. Grafo de dependencias

```
P0 (línea base)
  P0-02 ─▶ P0-03 ─▶ P0-04 ─┐
  P0-07a ─▶ P0-07b ────────┼─▶ P0-07c (tras P0-04) ─▶ P0-08 ─┐
  P0-01, P0-05 ────────────┴─────────────────────────────────┴─▶ P0-06

P1 (diagnóstico), después de P0-06
  P1-01, P1-02 ─▶ P1-03 ─┐
  P1-04 (tras P0-01) ────┼─▶ P1-06 (E1–E14)
  P1-05 (tras P0-05, P1-01) ┘

P2 (optimizaciones con gate), después de P1-06
  P2-00 ─▶ P2-01 ─▶ P2-04 ─▶ P2-05 ─▶ P2-03 ─▶ P2-10
                              ├─▶ P2-06
                              └─▶ P2-07a ─▶ P2-07b
  P2-02 [P]    P2-08 (condicional)    P2-09a ─▶ P2-09b (condicional)
  P2-05 + P2-09a ─▶ P2-11 (condicional, D-1)

P3: P2 activadas ─▶ P3-01 ─▶ P3-02 ─▶ P3-03 ─▶ P3-04
```

**Ruta crítica:** P0-07a → P0-07b → P0-08 → P0-06 → P1-01/02 → P1-03 → P1-06 → P2-00 → P2-05 → P3-01.

---

## P0 — Línea base y diagnóstico reproducible

Objetivo: resultados repetibles, generador controlado y un bucle rápido (*red-capable*) del problema. Ningún cambio en el comportamiento de la API.

### P0-01 [P] Override de rendimiento con cpusets (ENV-C)

- **Carpeta:** raíz. **Archivos exclusivos:** `compose.perf.yaml` (nuevo); sección «Rendimiento» en `infra/simulator/README.md`.
- **Contenido:** override de Compose con `cpuset` por servicio (estrategia §4; en ENV-H solo para E4: k6 en la CPU 0 y el SUT en la 1), variable `SIMULATOR_DB_POOL_MAX` explícita (12 por defecto, igual que hoy) y parámetros de PostgreSQL **solo diagnósticos**: `shared_preload_libraries=pg_stat_statements`, `track_io_timing=on`, `track_wal_io_timing=on`. Sin cambios en `compose.simulator.yaml`.
- **Dependencias:** ninguna (D-3 para ejecutarlo en el host definitivo).
- **Validación:** `docker compose -f compose.simulator.yaml -f compose.perf.yaml config --quiet` con exit 0; `docker inspect` muestra los cpusets; `SHOW shared_preload_libraries` incluye `pg_stat_statements` solo con el override; sin override, la configuración es idéntica a la actual (diff de `config`).
- **Aceptación:** el stack arranca sano con y sin override, y el health de ambas API devuelve 200.
- **Rollback:** borrar `compose.perf.yaml`; el stack por defecto no depende de él.

### P0-02 [P] Muestreador de recursos y guard del generador

- **Carpeta:** raíz. **Archivos exclusivos:** `load/resource-sampler.sh` (nuevo), `load/check-generator-guard.mjs` (nuevo).
- **Contenido:** `docker stats` cada 1 s → CSV (contenedor, CPU%, memoria) y `/proc/pressure/cpu` si existe. El guard evalúa el CSV y el summary-export de k6 según la estrategia §5.3 y devuelve `valid: true|false` con los motivos.
- **Dependencias:** ninguna.
- **Validación:** pruebas `node --test` del guard con CSV y summary sintéticos: un caso válido y tres inválidos (CPU de k6, `http_req_blocked`, `dropped_iterations`); `bash -n`.
- **Aceptación:** el guard identifica correctamente los cuatro casos; el muestreador no escribe identidades.
- **Rollback:** borrar los archivos.

### P0-03 Metadatos de ejecución y validez

- **Carpeta:** raíz. **Archivos exclusivos:** `load/scenarios.sh`, `infra/simulator/scenario-results.mjs` y su prueba.
- **Contenido:** por `testid`, registrar el entorno (`env` H/C, cpusets), `git rev-parse HEAD`, `count(*)` por tabla y número de campañas antes de la carga, y la salida del guard. Lanzar el muestreador en paralelo con k6. Añadir las etiquetas `env` y `rep`. El resultado incorpora `generatorGuard` y `runValid`. **No cambia** `performancePassed`, `correctnessPassed` ni los umbrales.
- **Dependencias:** P0-02.
- **Validación:** pruebas de `scenario-results.mjs` con resultados sintéticos válidos e inválidos; ejecución corta `SCENARIO_QUICK=1 bash load/scenarios.sh reads` sobre la campaña sintética, con el resultado mostrando los campos nuevos.
- **Aceptación:** una ejecución inválida queda marcada `runValid: false` sin alterar los demás campos; los resultados históricos se siguen leyendo.
- **Rollback:** `git revert` de la tarea.

### P0-04 Repeticiones, precalentamiento, orden y rotación sin recrear PostgreSQL

- **Carpeta:** raíz. **Archivos exclusivos:** `load/scenarios.sh`, `infra/simulator/rotate-campaign.sh`.
- **Contenido:** `SCENARIO_REPEATS=n`, con una campaña nueva por repetición. Fase `warmup` (reads a 10 it/s durante 30 s, etiqueta `phase=warmup`, excluida de los umbrales mediante el filtro de etiquetas existente). Opción `SCENARIO_ORDER=shuffle` con semilla registrada.
- **Rotación opcional `SIMULATOR_RECREATE=app`:** hoy el `up --force-recreate` completo es lo que ejecuta `migrate` y `seed` para la campaña nueva. Si solo se reiniciaran las API, `onModuleInit` no encontraría la fila de campaña y fallaría ([postgres-enrollment.store.ts:21-28](../../backend/src/persistence/postgres-enrollment.store.ts)). Además, `--force-recreate` con dependencias recrearía también PostgreSQL. Por eso esta opción ejecuta, en orden: `docker compose run --rm --no-deps migrate`, `docker compose run --rm --no-deps seed` y `docker compose up -d --wait --no-deps --force-recreate api-a api-b web` (web, porque [verification.md](../../evidence/local/simulador-produccion/scenarios-400/verification.md) indica que queda vinculada a la campaña nueva). El valor por defecto sigue siendo la recreación completa actual.
- **Dependencias:** P0-03 (mismo archivo).
- **Validación:** `bash -n`; `SCENARIO_REPEATS=2 SCENARIO_QUICK=1 bash load/scenarios.sh login` produce 2 `testid` con auditoría. Con `SIMULATOR_RECREATE=app`: la campaña nueva existe y está `open`, ambas API están sanas, la auditoría previa da 0 matrículas / 0 solicitudes, y el `StartedAt` del contenedor PostgreSQL no cambia (`docker inspect`).
- **Aceptación:** los valores por defecto reproducen exactamente el comportamiento actual (mismas llamadas a Compose). Con `app`, el login de la batería funciona sobre la campaña nueva.
- **Rollback:** `git revert`; las opciones nuevas son opt-in.

### P0-05 [P] Arnés rápido `submit-bench` (bucle interno *red-capable*)

- **Carpeta:** backend. **Archivos exclusivos:** `backend/scripts/bench-submit.ts` (nuevo), `backend/test/bench-submit.spec.ts` (nuevo, solo el parser de opciones y el cálculo de estadísticas).
- **Contenido:** crea una campaña sintética **aislada** reutilizando `createSyntheticLoadProfile` y la lógica del seed, sin tocar la campaña activa. Instancia `PostgresEnrollmentStore` con el pool real y lanza N `submit` concurrentes, con barrera en proceso y perfil configurable (shared, ample, multi-*, distributed). Escribe en JSON: p50, p95, p99, máximo, vaciado, envíos/s, admitidas y rechazadas, y una auditoría con las comprobaciones de `audit-simulator`. Sale con código ≠ 0 si p95 supera `--budget-ms` o si la auditoría falla. Al terminar, cierra la campaña de bench (no la borra).
- **Ejecución:** `docker compose run --rm --no-deps migrate node dist/scripts/bench-submit.js --actors 400 --profile shared --budget-ms 2000`.
- **Dependencias:** ninguna.
- **Validación:** `pnpm --dir backend build`, `lint`, `exec tsc -p tsconfig.scripts.json` y la prueba unitaria. Una ejecución con 100 actores shared contra la base sintética, comprobando que los conteos coinciden con el perfil (10 admitidas).
- **Condición roja:** el bench omite HTTP, autenticación y k6, así que su p95 puede quedar por debajo de 2 s aunque k6 falle. Por eso también va a rojo si el t_cs estimado (vaciado / N de la cohorte caliente) supera el presupuesto de la evaluación §3.2: 2000 / (0,95·N), es decir, 5,3 ms con 400. Con P1-01 disponible, se usa la mediana medida de `critical`.
- **Aceptación:** dura menos de 30 s con 400 actores. **Va a rojo** con `--budget-ms 2000` y 400 actores shared en el código actual (si no lo hace, eso ya es un hallazgo que se documenta) y a verde con un presupuesto holgado. Integridad: 0 violaciones.
- **Rollback:** borrar los archivos. Las campañas de bench quedan cerradas y no afectan a la activa.

### P0-07a Contrato SIM-LOAD-2: límite de 2000 actores y perfil `fisi-schools`

- **Carpeta:** raíz. **Archivos exclusivos:** `docs/reverse-engineering/contracts/local-api/simulator-load-profiles.md`.
- **Contenido:**
  - ampliar la población de 1..1000 a **1..2000**, para cubrir la jornada de 1422 alumnos más la Escuela de IA;
  - definir el perfil `fisi-schools`: cohortes disjuntas por escuela (Sistemas, Software, Ciencia de la Computación e IA opcional), con tamaños explícitos o proporciones de una franja de la evaluación §2.4, una selección compartida por cohorte y una capacidad parametrizable. El valor por defecto `ample` (todas admitidas) es la ruta más larga y, por tanto, la más pesimista para t_cs; la variante `scarce` usa capacidad limitada;
  - definir el manifiesto de la jornada: actor → número de oleada.
  - La procedencia queda como `testimony` aportado por el operador, con la URL del PDF y solo agregados.
- **Dependencias:** ninguna (aprobación del usuario del 2026-10-22).
- **Validación:** enlaces válidos; el contrato no cambia rutas, DTO ni frontend; `git diff --check`.
- **Aceptación:** el contrato define de forma verificable cómo derivar las admisiones esperadas del perfil, igual que los perfiles actuales.
- **Rollback:** `git revert`.

### P0-07b Perfil `fisi-schools` y límite de 2000 en el backend

- **Carpeta:** backend. **Archivos exclusivos:** `backend/scripts/synthetic-load-profile.ts`, `backend/scripts/seed-simulator.ts`, `backend/test/synthetic-load-profile.spec.ts`.
- **Contenido:** implementar P0-07a: el límite 2000 en `parseActorCount` y `createSyntheticLoadProfile` (líneas 28–30 y 54), el perfil `fisi-schools` con sus parámetros y la asignación de oleadas en el manifiesto. Los perfiles existentes no cambian.
- **Dependencias:** P0-07a.
- **Validación:** build, lint, `tsc -p tsconfig.scripts.json`; pruebas de 1, 1000, 1422 y 2000 actores, de 2001 rechazado, y de admisiones derivadas para `fisi-schools` (ample y scarce). Seed real de 1422 en la base sintética con auditoría 0/0.
- **Aceptación:** los perfiles existentes producen manifiestos idénticos a los actuales (prueba de instantánea).
- **Rollback:** `git revert`.

### P0-07c Límite de 2000 y perfil en el arnés de carga

- **Carpeta:** raíz. **Archivos exclusivos:** `load/profile-config.mjs` y su prueba, `infra/simulator/init-runtime.mjs`, `infra/simulator/rotate-campaign.sh`, `load/scenarios.sh` (expresiones `{0,3}` y `> 1000`, y el nuevo escenario `fisi-franja`). **Enmienda 2026-10-22 (coordinador):** se añade `infra/simulator/scenario-results.mjs`, que también rechazaba el perfil y debe calcular los conteos esperados de `fisi-franja`. Si `load-runtime-env.sh` filtra claves, también se añade, para que `SIMULATOR_FISI_*` llegue al seed. Las variables `SIMULATOR_FISI_*` se escriben en `config.env` solo con `fisi-schools` y se eliminan con cualquier otro perfil.
- **Dependencias:** P0-07a y P0-04 (mismo archivo `scenarios.sh`).
- **Validación:** pruebas `node --test` de `profile-config` (1422 válido, 2001 rechazado, `fisi-schools` con cohortes disjuntas); `bash -n`; `SCENARIO_ACTORS=1422` acepta la rotación.
- **Aceptación:** los valores por defecto siguen igual (100 en el seed, 400 en la batería).
- **Rollback:** `git revert`.

### P0-08 Escenarios: jornada, carga sostenida y SLO del login

- **Carpeta:** raíz. **Archivos exclusivos:** `load/jornada.js` (nuevo), `load/enrollment-open.js` (nuevo), `load/login.js`, `infra/simulator/scenario-results.mjs` (SLO declarado para login, jornada y enrollment-open). **Enmienda 2026-10-22 (coordinador):** se añade `load/scenarios.sh`, para registrar los escenarios `jornada` y `enrollment-open`, que quedan fuera de `all`. `enrollment.js` ya declara p95/p99 en `{operation:submit}` y no cambia: el único umbral nuevo en un script existente es `{name:auth-login}` en `login.js`.
- **Contenido:**
  - **`jornada.js`:** oleadas según el manifiesto de P0-07 y `WAVE_INTERVAL`/`WAVE_FRONTLOAD`. Cada actor inicia sesión en su oleada, crea sesión, lee el contexto y envía una vez. Contadores exactos frente a las admisiones derivadas.
  - **`enrollment-open.js`:** `constant-arrival-rate` de envíos con una población suficiente.
  - **Umbrales nuevos (D-2):** `http_req_duration{name:auth-login}` y `{operation:submit}` con p95 < 2000 y p99 < 5000. Los umbrales existentes no cambian.
- **Dependencias:** P0-07b, P0-07c.
- **Validación:** sintaxis de k6 (`k6 inspect`); ejecución corta de la jornada con 100 actores repartidos en 9 oleadas (proporciones de la evaluación §2.4) con auditoría exacta; login con 100 actores, con `performancePassed` no nulo.
- **Aceptación:** la jornada respeta las proporciones de cada oleada y cada actor envía como máximo una vez; un incumplimiento del umbral produce exit 99.
- **Rollback:** `git revert`; los escenarios existentes no dependen de estos archivos.

### P0-06 Línea base

- **Carpeta:** raíz (ejecuta el operador o un worker asignado). **Archivos exclusivos:** `docs/performance/baseline-400.md` (nuevo), `evidence/local/simulador-produccion/perf-baseline/` (agregados sanitizados).
- **Contenido:** en ENV-H (D-3), n = 5 de race, ample, multi-uniform, multi-hotspot, mixed **en modo normal** y stress a 400; franja FISI y login con 507; una jornada de 1422 con `WAVE_FRONTLOAD=1,0`; y `submit-bench` con 100, 200, 400 y 507 shared. Para cada uno: mediana y rango de p95/p99, throughput, validez del guard y tamaños de tabla.
- **Dependencias:** P0-01, P0-04, P0-05, P0-08.
- **Aceptación:** criterio P0 de la estrategia §9. Todas las ejecuciones son válidas o están excluidas con su motivo. El ruido base (rango del p95) queda registrado por escenario.
- **Rollback:** no aplica (solo documentación y evidencia).

---

## P1 — Instrumentación y confirmación de causas raíz

Objetivo: atribuir ≥ 90 % del p95 (estrategia §5.4) y confirmar o descartar H1–H6. La instrumentación no cambia respuestas, contratos ni códigos HTTP.

### P1-01 [P] Fases de la transacción de envío y causas de error de almacenamiento

- **Carpeta:** backend. **Archivos exclusivos:** `backend/src/persistence/store-metrics.ts` (nuevo: colector en memoria de histogramas y contadores con buckets fijos), `backend/src/persistence/postgres-enrollment.store.ts`, `backend/src/persistence/public-simulator.module.ts`.
- **Contenido:** medir `pre_lock`, `section_lock_wait` (primer y último lock), `critical`, `commit` y `total` por ruta (accepted, rejected, replay); contar sentencias por envío; contar `storage_errors_total{cause}` según el código PG o el timeout del pool, y `submit_retries_total{code}`. El colector se inyecta; no hay estado global.
- **Dependencias:** P0-06 (para comparar el overhead).
- **Validación:** build y lint; pruebas unitarias del colector; prueba de integración PG que fuerza `55P03` (patrón de la prueba de lock-timeout existente) y verifica `cause=lock_timeout` con la respuesta 503 sin cambios; `simulator-public.e2e-spec` pasa sin cambios.
- **Aceptación:** con el bench, el overhead de la instrumentación queda dentro del ruido base de P0-06. Las respuestas HTTP son idénticas byte a byte en las pruebas existentes.
- **Rollback:** `git revert`. El colector no tiene efectos externos.

### P1-02 [P] Espera del pool por grupo de ruta, picos, event loop por ventana e histograma HTTP

- **Carpeta:** backend. **Archivos exclusivos:** `backend/src/persistence/postgres.ts` (envoltorio instrumentado de `connect` y `query`, con **su propio** colector de histogramas exportado desde ese archivo) y `backend/src/auth/simulator-metrics.interceptor.ts` (`AsyncLocalStorage` con el grupo de ruta; histograma HTTP; event loop por ventana con resolución ≤ 5 ms y reinicio por lectura; picos del pool desde la última lectura). **No** toca `public-simulator.module.ts` ni `store-metrics.ts` (son de P1-01). La agregación en un único JSON corresponde a P1-03.
- **Dependencias:** P0-06.
- **Validación:** build y lint; pruebas unitarias del envoltorio (espera medida con un pool de tamaño 1); `simulator-read-unavailable.spec` y `simulator-auth-errors.spec` pasan.
- **Aceptación:** el pico de espera del pool queda registrado aunque dure menos que el scrape (prueba con una ráfaga de 200 ms). Sin cambio de semántica en errores del pool (`STORAGE_UNAVAILABLE`).
- **Rollback:** `git revert`.

### P1-03 Exposición: endpoint, exportador, PostgreSQL y Grafana

- **Carpeta:** backend (endpoint) + raíz (exportador y dashboard). Se ejecuta **secuencialmente** por un solo worker o se divide en P1-03a (backend) y P1-03b (raíz) con el JSON del endpoint fijado como contrato interno.
- **Archivos exclusivos:** `backend/src/auth/simulator-public-api.controller.ts` (solo `metrics`), `infra/simulator/metrics-exporter.mjs` y su prueba, `infra/simulator/observability/grafana/provisioning/dashboards/sum-simulator-k6.json`.
- **Contenido:** añadir al JSON protegido los datos de P1-01 y P1-02 y, del lado PostgreSQL, `wait_event` detallado (máximo por ventana con muestreo a 1 s), `pg_locks` sin conceder por `locktype`, `pg_stat_database` y WAL (estrategia §5.2). Limitar los `count(*)` existentes a la campaña activa. El exportador valida etiquetas con una lista blanca (patrón actual) y renderiza histogramas. Nuevos paneles: fases del envío, espera del pool por grupo, causas de 503, wait events y commit/WAL.
- **Dependencias:** P1-01, P1-02.
- **Validación:** prueba del exportador con un snapshot sintético (etiquetas sin identidad); verificador de observabilidad existente; consultas de panel válidas.
- **Aceptación:** ninguna etiqueta contiene actor, sesión, credencial ni URL. Los paneles muestran datos de una ejecución corta de race con 100 actores.
- **Rollback:** `git revert`; el dashboard anterior queda en el historial de Git.

### P1-04 [P] Volcado diagnóstico de PostgreSQL

- **Carpeta:** raíz. **Archivos exclusivos:** `load/pg-diagnostics.sh` (nuevo).
- **Contenido:** con el override P0-01 activo: `CREATE EXTENSION IF NOT EXISTS pg_stat_statements` en la base sintética (en el script de diagnóstico, **no** en una migración); reinicio de estadísticas antes de la carga; volcado de las N sentencias principales después; `EXPLAIN (ANALYZE, BUFFERS)` de las 7 consultas de `loadRunState`, del SELECT de campaña y de la sesión académica, usando un actor sintético del manifiesto sin imprimir credenciales; `pg_test_fsync` dentro del contenedor PostgreSQL (E3). Salida a `runtime/results/`.
- **Dependencias:** P0-01.
- **Validación:** `bash -n`; ejecución sobre la campaña sintética; la salida no contiene credenciales (grep de los patrones de 43 caracteres base64url).
- **Aceptación:** produce los tres artefactos (top-N, EXPLAIN, fsync) por `testid`.
- **Rollback:** borrar el script; `DROP EXTENSION pg_stat_statements` en la base sintética.

### P1-05 Variantes del bench para experimentos

- **Carpeta:** backend. **Archivos exclusivos:** `backend/scripts/bench-submit.ts`, `backend/test/bench-submit.spec.ts`.
- **Contenido:** opciones `--cohorts` (E2), `--catalog-sections` (E7), `--replay-ratio` (E11) y `--pool-max` (E5), y salida con las fases de P1-01.
- **Dependencias:** P0-05, P1-01.
- **Validación:** build, lint, prueba unitaria de opciones y una ejecución de cada variante con 100 actores.
- **Aceptación:** cada variante conserva la integridad (auditoría con 0 violaciones).
- **Rollback:** `git revert`.

### P1-06 Ejecución del diagnóstico E1–E14

- **Carpeta:** raíz (ejecuta el operador o un worker). **Archivos exclusivos:** `docs/performance/diagnosis.md` (nuevo), `evidence/local/simulador-produccion/perf-diagnosis/`.
- **Contenido:** ejecutar E1–E14 (estrategia §6) con n ≥ 3, cambiando una sola variable por experimento. Para cada H1–H12: `confirmed`, `rejected` o `inconclusive`, con su evidencia. Medir la componente fija y la variable de t_cs y recalcular el presupuesto de la evaluación §3.2. Recomendar qué tareas P2 se activan.
- **Dependencias:** P1-03, P1-04, P1-05.
- **Aceptación:** criterio P1 de la estrategia §9. Si la atribución cubre menos del 90 %, se documenta la brecha y se decide si añadir **una** sonda más (máximo un ciclo).
- **Rollback:** no aplica.

---

## P2 — Optimizaciones incrementales basadas en evidencia

Cada tarea se activa **solo** si P1-06 confirma su hipótesis (columna «Gate»). Se implementan de una en una sobre `postgres-enrollment.store.ts` (archivo compartido → secuencial) y cada una se mide por separado (A/B con n ≥ 3 en el escenario objetivo, más un smoke de regresión del resto). Las mejoras se expresan como `expected` hasta medirse.

Orden por impacto, esfuerzo y riesgo:

| ID | Propuesta | Hipótesis / evidencia | Impacto esperado | Esfuerzo | Riesgo | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| P2-00 | Arnés de equivalencia del envío | Requisito para P2-01/04/05 | — (seguridad) | M | Bajo | Siempre, si se ejecuta algún P2 sobre el store |
| P2-01 | Replay antes de bloquear secciones | H9 (`code`) | Alto en retry; nulo sin replays | S | Bajo | E11 o simple ausencia de regresión |
| P2-02 | Índice `(campaign_id, actor_id)` en sesiones académicas | H7 (`code`) | Bajo ahora; evita la deriva | S | Bajo | E9 |
| P2-03 | Autenticación en una sola consulta | H5, H4 | −1 sentencia y −1 checkout por petición | S | Bajo | E6 o E8 |
| P2-04 | No leer `config` de la campaña y verificar los campos que usa `RunState` | H4 (`code`: `config` no se usa) | Bajo/medio (detoast y parseo de JSONB) | S | Bajo | E6 |
| P2-05 | Acortar el intervalo bloqueado del envío | H1, H4 | **Alto**: 22→≈7 y 10→≈3 sentencias bajo lock (sin contar el `COMMIT`) | M | Medio | E1 y E6 confirmados |
| P2-06 | Menos viajes en las lecturas (dashboard y contexto) | H5 | Medio en stress/soak/mixed | M | Medio | E8 |
| P2-07a/b | Tamaño del pool y, si persiste, bulkhead envío/lectura | H3 | Medio en mixed/multi-hotspot | S/M | Medio | E5 confirmado **después** de P2-05 |
| P2-08 | Reducir el overhead de las métricas | H12 | Bajo | S | Bajo | E13 > ruido |
| P2-09a/b | Ajuste de PostgreSQL y almacenamiento seguro | H2 | Depende del fsync | S | Medio | E3 confirma que domina el commit |

### P2-00 Arnés de equivalencia del envío

- **Evidencia:** P2-01, P2-04 y P2-05 reordenan sentencias de `submitTransaction`; las invariantes de la evaluación §1.6 deben demostrarse antes y después. Hoy no existe una prueba diferencial del envío.
- **Carpeta:** backend. **Archivos exclusivos:** `backend/test/simulator-submit-equivalence.e2e-spec.ts` (nuevo).
- **Contenido:** prueba diferencial contra PostgreSQL sintético real (patrón de `simulator-public.e2e-spec.ts`). Secuencias deterministas por perfil: aceptación, `SECTION_FULL`, `ALREADY_ENROLLED`, replay idéntico, `REQUEST_CONFLICT`, sesión vencida, `PROFILE_CHANGED`, campaña cerrada con replay, último cupo concurrente (20 envíos) y 20 claves nuevas concurrentes del mismo actor. Compara: envelope HTTP (estado, causas y su orden), filas finales (`requests`, `enrollments`, `items`, `occupied`, `reports`) y la auditoría de 8 comprobaciones. Fija el comportamiento **actual** como referencia (instantánea) antes de cualquier cambio.
- **Dependencias:** P1-06.
- **Experimento:** no aplica (no es una optimización). Se valida con 3 ejecuciones consecutivas.
- **Validación:** pasa sobre el código actual 3 veces seguidas sin flakes.
- **Aceptación:** cubre todos los caminos de `submitTransaction` (`:110-157`): replay, rechazo, aceptación y los 4 códigos reintentables mediante inyección.
- **Rollback:** borrar la prueba.

### P2-01 Replay antes de bloquear secciones

- **Evidencia:** las secciones se bloquean (`:120`) antes de detectar el replay (`:122`). La clave del replay es por actor, y el actor ya está bloqueado (`:118`).
- **Cambio:** después de `actor FOR UPDATE`, leer la solicitud por PK. Si existe, evaluar el replay con el estado del actor y hacer `COMMIT` sin tocar secciones. Se mantienen la comparación de payload canónico y `REQUEST_CONFLICT`.
- **Archivos:** `backend/src/persistence/postgres-enrollment.store.ts`.
- **Dependencias:** P2-00.
- **Experimento:** E11 (bench `--replay-ratio 0.5`) y el escenario retry A/B.
- **Aceptación:** P2-00 en verde; retry con 400 actores: 400 matrículas y 800 solicitudes, auditoría con 0 violaciones; mediana de t_cs de envíos nuevos con 50 % de replays mejor que la línea base, fuera del rango de ruido. El p95 de retry es informativo (D-2).
- **Rollback:** `git revert` del commit aislado.

### P2-02 [P] Índice de sesiones académicas

- **Evidencia:** `simulator_academic_sessions` solo tiene PK `(session_id)` ([001_simulator.sql:47-54](../../backend/migrations/001_simulator.sql)). `loadRunState` filtra por `(campaign_id, actor_id)` dentro del intervalo bloqueado (store `:221`). H7.
- **Cambio:** `backend/migrations/003_academic_sessions_actor_idx.sql` con `CREATE INDEX IF NOT EXISTS simulator_academic_sessions_actor_idx ON simulator_academic_sessions(campaign_id, actor_id)`. Es aditiva y compatible con la versión previa; el migrador existente la aplica en orden.
- **Archivos exclusivos:** la migración nueva. Es paralelizable con cualquier tarea que no toque `migrations/`.
- **Dependencias:** P1-06 (resultado de E9).
- **Experimento:** E9 antes y después (1 frente a 20 campañas retenidas); `EXPLAIN (ANALYZE, BUFFERS)` muestra Index Scan.
- **Aceptación:** migración idempotente (dos ejecuciones); `simulator-public.e2e-spec` en verde; t_cs con 20 campañas retenidas ≈ t_cs con 1 (dentro del ruido).
- **Rollback:** `DROP INDEX IF EXISTS simulator_academic_sessions_actor_idx` y borrar la fila de `simulator_schema_migrations`. Ningún código depende del índice.

### P2-03 Autenticación en una sola consulta

- **Evidencia:** `current()` llama a `authenticateSession` y después a `sessionExpiry` con el mismo predicado ([simulator-auth.service.ts:30-36](../../backend/src/auth/simulator-auth.service.ts), store `:195-205`). Son dos sentencias y dos checkouts del pool en cada petición autenticada (H5, H4).
- **Cambio:** una consulta que devuelve el principal y `expires_at`. Se conservan los errores `UNAUTHENTICATED` y `STORAGE_UNAVAILABLE` y el `expiresAt` de `GET /session` (sin ampliar el TTL).
- **Archivos:** `backend/src/auth/simulator-auth.service.ts`, `backend/src/persistence/postgres-enrollment.store.ts` (después de P2-05 para evitar conflictos).
- **Dependencias:** P1-06, P2-05.
- **Experimento:** `sessions.js` y reads abierto A/B (n ≥ 3); `pg_stat_statements` antes y después (llamadas por petición).
- **Aceptación:** `simulator-auth-errors.spec` y e2e en verde; 1 sentencia menos por petición, verificada con `pg_stat_statements`; p95 de lectura mejor fuera del ruido, o al menos sin regresión.
- **Rollback:** `git revert`.

### P2-04 No leer `config` y verificar el uso de `RunState`

- **Evidencia:** `SELECT run_id,status,config` (`:52`, `:115`, `:210`); `config` (con `profiles` y `offer` de la campaña) no se usa en el store, y las reglas leen los perfiles desde `simulator_profiles` (H4).
- **Cambio:**
  1. Documentar en el PR qué campos de `RunState` usan `commit` y las reglas: `state.offer` completo, `profiles`, y `sessions`, `requests`, `enrollments` del actor (véase [matricula-regular.service.ts:54-111](../../backend/src/matricula-regular/matricula-regular.service.ts)).
  2. **Verificación estática de ocupación**, requisito de P2-05: listar todas las lecturas de `occupied` y `capacity` en la ruta de envío. A 2026-10-22 (`code`) solo aparecen para secciones **elegidas**: [rules.ts:305-309](../../backend/src/matricula-regular/rules.ts) (`SECTION_FULL`) y [matricula-regular.service.ts:136,149](../../backend/src/matricula-regular/matricula-regular.service.ts). La única otra lectura es la proyección de dashboard `scenario-reference-projection.ts:17-18`, que no participa del envío. El PR confirma o actualiza esta lista.
  3. Quitar `config` de los tres SELECT y del tipo `CampaignRow`.
- **Archivos:** `backend/src/persistence/postgres-enrollment.store.ts`.
- **Dependencias:** P2-01.
- **Experimento:** E6 antes y después (tiempo total y bytes del SELECT de campaña en `pg_stat_statements`); bench shared con 400.
- **Aceptación:** P2-00 y e2e en verde; reducción medida del tiempo del SELECT de campaña; el bench no empeora fuera del ruido.
- **Rollback:** `git revert`.

### P2-05 Acortar el intervalo bloqueado de `submitTransaction`

- **Evidencia:** evaluación §1.3 y §3.1 (H1, H4).
- **Cambio, conservando el orden de adquisición registrado (una sentencia `FOR UPDATE` por sección, en orden):**
  1. `BEGIN` → campaña `FOR SHARE` (sin `config`) → actor `FOR UPDATE` → solicitud por PK (replay, P2-01).
  2. **Antes de bloquear secciones:** leer los datos del actor (perfil, sesiones, solicitudes, matrícula y reportes, que son estables porque el actor está bloqueado), los perfiles de la campaña (inmutables durante la apertura, según SIM-PUBLIC-1) y los **metadatos estáticos** del catálogo (curso, horario, capacidad). Si es posible, combinarlos en una o dos sentencias (`json_agg`).
  3. Bloquear cada sección elegida en orden con `SELECT capacity, occupied … FOR UPDATE` y **usar la ocupación devuelta** como fuente de verdad del estado evaluado, sin una lectura posterior.
  4. Evaluar con las reglas sin cambios. El estado de las secciones **no elegidas** procede de la lectura previa. La verificación estática de P2-04 muestra que su ocupación no se lee en la ruta de envío; P2-00 lo confirma de forma dinámica. Si cualquiera de las dos lo contradice, se leen bajo lock solo los campos necesarios.
  5. Escrituras agrupadas: `INSERT` de la solicitud; si se acepta, `INSERT` de la matrícula, `INSERT` multifila de los ítems, un único `UPDATE … FROM (VALUES …) WHERE occupied < capacity RETURNING` que exige `rowCount = k`, e `INSERT` del reporte. La verificación posterior con SELECT (`:143-149`) se sustituye por el `RETURNING`, que conserva la detección de divergencia.
  6. `COMMIT`.
- **Resultado esperado (`expected`):** sentencias bajo lock: aceptada ≈ 2 (locks restantes) + 5 escrituras + `COMMIT`, frente a 22 + `COMMIT`; rechazada ≈ 2 + 1 + `COMMIT`, frente a 10 + `COMMIT`. Sentencias totales: aceptada ≈ 15 y rechazada ≈ 11, frente a 26 y 15. Con el ajuste de la evaluación §3.1 (≈6,1 ms fijos + 0,27 ms por sentencia), el t_cs esperado queda en ≈8 ms para aceptadas (hoy ≈12) y ≈7 ms para rechazadas (hoy ≈8,8): **insuficiente por sí solo para 400 en ample** si el commit domina. Ese resultado activa P2-09a o D-1, no un cambio de umbrales.
- **Archivos:** `backend/src/persistence/postgres-enrollment.store.ts`.
- **Dependencias:** P2-00, P2-04, E1 y E6 confirmados.
- **Experimento:** bench (shared, ample, multi-uniform con 400) A/B y luego la batería de impulso a 400 (n ≥ 3); `submit_statements_total` y `critical` antes y después.
- **Aceptación:** P2-00 en verde sin cambiar la instantánea; las 8 comprobaciones de auditoría con 0 violaciones en las 6 baterías; prueba de caída (patrón `crash-result.json`) con `passed: true`; el p95 del submit en race y ample mejora fuera del rango de ruido. El cumplimiento del SLO **no** es requisito de esta tarea: se reporta tal cual.
- **Rollback:** `git revert` del commit único. Mientras dure la comparación puede mantenerse temporalmente la implementación anterior seleccionable con `SIMULATOR_SUBMIT_PATH=legacy` para la prueba diferencial. Se elimina en P3-03.

### P2-06 Menos viajes en lecturas

- **Evidencia:** ≈13 sentencias por dashboard (evaluación §1.4); H5.
- **Cambio:** en `readDashboardSnapshot` y `readSnapshot`, combinar las lecturas del actor y del catálogo en ≤ 3 sentencias dentro de la misma transacción `REPEATABLE READ READ ONLY` (se conserva la consistencia de instantánea), reutilizando las consultas de P2-05.
- **Archivos:** `backend/src/persistence/postgres-enrollment.store.ts`.
- **Dependencias:** P2-05, E8 confirmado.
- **Experimento:** E8 (reads abierto 25 → 300 it/s) y `sessions.js` cerrado, A/B con n ≥ 3.
- **Aceptación:** `local-profile-dashboard-http.spec`, e2e y los validadores de respuesta (`validateDashboardReadResponse`) en verde; respuestas idénticas a las de referencia en las 14 claves del dashboard para un actor sintético; rodilla de reads desplazada fuera del ruido.
- **Rollback:** `git revert`.

### P2-07a Tamaño del pool (configuración, raíz)

- **Evidencia:** colas de ≈188/187 por API (`observed`, [verification.md](../../evidence/local/simulador-produccion/scenarios-400/verification.md)); H3, que se decide con E5 repetido **después** de P2-05.
- **Cambio:** fijar `SIMULATOR_DB_POOL_MAX` según el barrido, manteniendo el total de conexiones de las réplicas por debajo del presupuesto de PostgreSQL (plan del simulador, línea 112).
- **Archivos:** `infra/simulator/run-api.sh` (variable con valor por defecto).
- **Dependencias:** P2-05, E5 repetido.
- **Experimento:** E5 (pool 6/12/24/48) en race, multi-hotspot y mixed, n ≥ 3.
- **Aceptación:** espera del pool de `read`/`auth` en mixed y multi-hotspot fuera del rango base; sin aumento de 503 ni de `dropped_iterations`; auditoría con 0 violaciones.
- **Rollback:** restaurar el valor anterior (12).

### P2-07b Bulkhead de envíos (backend, condicional)

- **Evidencia:** solo se activa si, tras P2-07a, la espera del pool de `read`/`auth` durante ráfagas sigue por encima del rango base (H3 persistente).
- **Cambio:** semáforo por réplica para transacciones de envío (`SIMULATOR_SUBMIT_CONCURRENCY`), de modo que la autenticación y las lecturas no esperen detrás de los que esperan un lock. Una espera superior al timeout del pool devuelve 503 `STORAGE_UNAVAILABLE`, el mismo contrato. **No** decide cupos: los cupos siguen garantizados por los locks de PostgreSQL.
- **Archivos:** `backend/src/persistence/postgres-enrollment.store.ts`.
- **Dependencias:** P2-07a.
- **Experimento:** mixed y multi-hotspot A/B (n ≥ 3), con la espera del pool por grupo de ruta.
- **Aceptación:** igual que P2-07a, más P2-00 y e2e en verde.
- **Rollback:** `git revert`, o desactivarlo dejando la variable sin definir.

### P2-08 Overhead de las métricas (condicional)

- **Evidencia:** `count(*)` sin filtro de campaña cada 2 s por réplica y upsert por segundo desde ambas réplicas sobre las mismas filas ([simulator-public-api.controller.ts:139-143](../../backend/src/auth/simulator-public-api.controller.ts), [simulator-metrics.interceptor.ts:59-84](../../backend/src/auth/simulator-metrics.interceptor.ts)); H12.
- **Cambio:** `count(*)` filtrado por la campaña activa (si P1-03 no lo hizo); flush del interceptor cada 5 s.
- **Archivos:** `backend/src/auth/simulator-metrics.interceptor.ts`, `backend/src/auth/simulator-public-api.controller.ts`.
- **Dependencias:** P1-03, P1-06 (E13 > ruido).
- **Experimento:** E13 (exportador activo frente a detenido) antes y después.
- **Aceptación:** diferencia de E13 dentro del ruido tras el cambio; la prueba del exportador y el verificador de observabilidad siguen en verde.
- **Rollback:** `git revert`.

### P2-09a Ajuste seguro de PostgreSQL en el override (raíz, condicional)

- **Evidencia:** solo si E3 confirma que domina el commit (mediana ≥ 3 ms y fsync ≥ 2 ms); H2.
- **Cambio:** permitidos `wal_sync_method` según `pg_test_fsync`, `wal_buffers`, `shared_buffers`, y `checkpoint_timeout`/`max_wal_size` si hay checkpoints en la ventana, aplicados mediante `command` en `compose.perf.yaml`. **Prohibidos:** `synchronous_commit=off`, `fsync=off` y `full_page_writes=off` (rompen A4/A5). `commit_delay` solo con evidencia: no ayuda a las transacciones serializadas sobre una misma fila.
- **Archivos:** `compose.perf.yaml`.
- **Dependencias:** P1-06 (E3), P0-01.
- **Experimento:** E3 y race/ample A/B con n ≥ 3.
- **Aceptación:** mediana de `commit` y t_cs mejores fuera del ruido; prueba de caída (patrón [crash-result.json](../../evidence/local/simulador-produccion/crash-result.json)) con `passed: true`.
- **Rollback:** quitar los parámetros del override.

### P2-09b Promoción a la configuración por defecto (raíz, condicional)

- **Evidencia:** P2-09a aceptada.
- **Cambio:** trasladar los parámetros aceptados a `compose.simulator.yaml` (`command` del servicio `postgres`). Cambiar de disco o de host es D-1b/D-3 y no forma parte de esta tarea.
- **Archivos:** `compose.simulator.yaml`.
- **Dependencias:** P2-09a.
- **Experimento:** smoke de las seis baterías de impulso a 400 sin override.
- **Aceptación:** mismos resultados que P2-09a dentro del ruido; `docker compose config --quiet` con exit 0.
- **Rollback:** `git revert`.

### P2-10 Login con dos sentencias

- **Evidencia:** el login ejecuta 4 sentencias: 2 upserts de rate limit, el SELECT de credencial y el INSERT de sesión ([simulator-auth.service.ts:18-28,50-61](../../backend/src/auth/simulator-auth.service.ts)). Con 400 logins simultáneos, el p95 fue de 1972 ms (`observed`), en el límite del nuevo SLO (D-2). El sistema **no usa JWT**: el token es aleatorio y opaco, y la sesión se persiste como hash.
- **Cambio:** (1) un único upsert multifila para los dos buckets de rate limit, con `RETURNING`, conservando el orden de evaluación (primero IP, después credencial) y los 429; (2) un `INSERT … SELECT` que crea la sesión solo si la credencial existe en la campaña, con `RETURNING`. Se mantienen los errores 401 genéricos, `STORAGE_UNAVAILABLE`, la cookie y el TTL.
- **Archivos:** `backend/src/auth/simulator-auth.service.ts`, `backend/src/persistence/postgres-enrollment.store.ts` (`authenticateCredential` y `createAccessSession`).
- **Dependencias:** P2-03 (mismos archivos).
- **Experimento:** login con 507 A/B (n ≥ 3); `pg_stat_statements` muestra 2 sentencias por login.
- **Aceptación:** `simulator-auth-errors.spec` (incluido el 429 en el sexto intento) y e2e en verde; p95 de `auth-login` mejor fuera del ruido.
- **Rollback:** `git revert`.

### P2-11 Revisión del algoritmo de locks (condicional, D-1)

- **Evidencia:** solo se activa si, tras P2-05 y P2-09a, P1/P3 miden t_cs > 4,2 ms en el pico de 507 sobre una sección (evaluación §3.2) y la componente fija del `COMMIT` lo explica.
- **Cambio:** primero un documento de diseño, no código: opciones, invariantes afectadas y cambios de contrato. Opciones: adquisición en una sola sentencia (revisa la decisión de la línea 106 del plan del simulador); rechazo `SECTION_FULL` con ocupación confirmada leída sin lock (revisa SIM-PUBLIC-1); sustitución del `FOR SHARE` de campaña. Solo se implementa tras aprobación explícita del usuario.
- **Archivos:** `docs/performance/lock-algorithm-options.md` (nuevo); el código, en una tarea posterior.
- **Dependencias:** P1-06, P2-05, P2-09a.
- **Experimento:** prototipo en el bench con la prueba de equivalencia P2-00 y la auditoría.
- **Aceptación:** decisión del usuario registrada; ninguna invariante cambia sin ella.
- **Rollback:** no aplica (documento).

### Opciones descartadas o diferidas

| Opción | Motivo |
| --- | --- |
| `synchronous_commit=off` o `fsync=off` | Rompe la durabilidad acreditada (A4/A5); el «éxito» ocultaría pérdida de confirmaciones |
| Caché de ocupación o rechazo sin lock | SIM-PUBLIC-1 prohíbe caché de ocupación para decidir. El rechazo con ocupación confirmada leída sin lock cambia el orden de causas y la semántica → D-1 |
| Bloqueo en una sola sentencia `IN (...) ORDER BY ... FOR UPDATE` | Contradice la decisión registrada (plan del simulador, línea 106) → D-1 |
| JWT o sesiones sin estado, o caché de sesiones en memoria | SIM-PUBLIC-1 exige sesiones persistentes, revocables y compartidas entre réplicas. Un logout seguiría funcionando en la otra réplica hasta que expire la caché o el token. Una lista de revocados en la base vuelve a añadir la consulta que se quería evitar |
| Advisory locks, mutex de proceso o cola en memoria | Prohibidos por el plan (línea 69) y no multiinstancia |
| SERIALIZABLE | Más abortos y reintentos bajo filas calientes; sin evidencia de beneficio |
| PgBouncer, Redis, colas o más réplicas de API | Ninguna medición muestra el pool de conexiones ni la CPU de Node como cuello de botella; se reconsideran solo si P1 lo demuestra |
| Cambiar `SIMULATOR_LOGIN_IP_LIMIT` o la protección para pruebas | SIM-PUBLIC-1: «no desactivar protección global para pruebas» (D-4) |

---

## P3 — Benchmarks comparativos, regresión y documentación final

### P3-01 Matriz comparativa

- **Carpeta:** raíz (ejecuta el operador o un worker). **Archivos exclusivos:** `docs/performance/results.md` (nuevo), `evidence/local/simulador-produccion/perf-p3/`.
- **Contenido:** matriz de la estrategia §7 en ENV-C con n ≥ 3. Tabla antes/después (P0-06 frente a final) con mediana y rango; los seis escenarios fallidos evaluados contra los umbrales **sin modificar**; atribución por fases en race y ample.
- **Dependencias:** las tareas P2 activadas.
- **Aceptación:** criterio P3 de la estrategia §9. Cada incumplimiento residual tiene causa medida y una referencia a D-1, D-2 o D-3.

### P3-02 Puerta de regresión

- **Archivos exclusivos:** `load/perf-regression.mjs` (nuevo) y su prueba.
- **Contenido:** compara un resultado con `perf-baseline/` y `perf-p3/` y marca regresión si la mediana del p95 empeora más que el ruido registrado o si `submit_statements_total` por ruta aumenta. Es informativa: **no sustituye ni altera** los umbrales de k6. El bench 400 shared con `--budget-ms` se documenta como bucle rápido previo a cualquier cambio del store.
- **Dependencias:** P3-01.
- **Aceptación:** prueba con resultados sintéticos de regresión y sin regresión.
- **Rollback:** borrar el script.

### P3-03 Limpieza

- Eliminar `SIMULATOR_SUBMIT_PATH=legacy` y el código duplicado si P2-05 se aceptó. Retirar los parámetros diagnósticos que no deban quedar (`log_lock_waits`, `deadlock_timeout`). Comprobar que no quedan sondas temporales (grep del prefijo acordado).
- **Dependencias:** P3-01. **Aceptación:** build, lint, P2-00 y e2e en verde. **Rollback:** `git revert`.

### P3-04 Documentación final

- Actualizar [assessment.md](assessment.md) con el estado de las hipótesis y [infra/simulator/README.md](../../infra/simulator/README.md) (sección de rendimiento y comandos), y añadir la decisión de P2-05 al [plan del simulador](../reverse-engineering/plans/simulador-postgresql-concurrencia.md). Los contratos SIM-PUBLIC-1 y SIM-LOAD-2 **no cambian**; si alguna tarea lo requiriera, se detiene y se escala.
- **Dependencias:** P3-01, P3-03. **Aceptación:** enlaces válidos, `git diff --check` limpio y separación entre `observed` y `expected` revisada.

---

## 3. Conversión a Spec Kit

Propuesta: feature `specs/003-performance-slo/` con `spec.md` (objetivos y umbrales vigentes de la estrategia §1), `plan.md` (enlace a este documento) y `tasks.md`, usando la tabla de handoff de [specs/002-local-profile-dashboard/tasks.md](../../specs/002-local-profile-dashboard/tasks.md) (ID/owner · archivos exclusivos · dependencias/aceptación). Asignación de IDs:

| Spec Kit | Tarea | Owner (carpeta) | Paralelo | Depende de | Gate |
| --- | --- | --- | --- | --- | --- |
| T001 | P0-01 Override cpusets | raíz | [P] | — | — |
| T002 | P0-02 Muestreador y guard | raíz | [P] | — | — |
| T003 | P0-03 Metadatos de ejecución | raíz | — | T002 | — |
| T004 | P0-04 Repeticiones y rotación | raíz | — | T003 | — |
| T005 | P0-05 Arnés submit-bench | backend | [P] | — | — |
| T006 | P0-06 Línea base | raíz (ejecución) | — | T001, T004, T005, T032 | — |
| T007 | P1-01 Fases y causas de error | backend | [P] con T008 | T006 | — |
| T008 | P1-02 Pool, event loop, HTTP | backend | [P] con T007 | T006 | — |
| T009 | P1-03 Endpoint, exportador, Grafana | backend + raíz (a/b) | — | T007, T008 | — |
| T010 | P1-04 Volcado diagnóstico PG | raíz | [P] | T001 | — |
| T011 | P1-05 Variantes del bench | backend | — | T005, T007 | — |
| T012 | P1-06 Diagnóstico E1–E13 | raíz (ejecución) | — | T009, T010, T011 | — |
| T013 | P2-00 Arnés de equivalencia | backend | — | T012 | Algún P2 sobre el store activado |
| T014 | P2-01 Replay antes de secciones | backend | — | T013 | H9 / sin regresión |
| T015 | P2-02 Índice de sesiones | backend (migración) | [P] | T012 | H7 (E9) |
| T016 | P2-04 Sin `config` + verificación estática | backend | — | T014 | H4 (E6) |
| T017 | P2-05 Intervalo bloqueado corto | backend | — | T013, T016 | H1 y H4 confirmadas |
| T018 | P2-03 Auth en una consulta | backend | — | T017 | H5 o H4 |
| T019 | P2-06 Lecturas con menos viajes | backend | — | T017 | H5 (E8) |
| T020 | P2-07a Tamaño del pool | raíz | [P] con T019 | T017 | H3 (E5 tras T017) |
| T021 | P2-07b Bulkhead | backend | — | T020 | H3 persistente |
| T022 | P2-08 Overhead de métricas | backend | — | T009, T012 | H12 (E13) |
| T023 | P2-09a Ajuste PG en el override | raíz | [P] | T001, T012 | H2 (E3) |
| T024 | P2-09b Promoción a Compose | raíz | — | T023 | P2-09a aceptada |
| T025 | P3-01 Matriz comparativa | raíz (ejecución) | — | P2 activadas | — |
| T026 | P3-02 Puerta de regresión | raíz | — | T025 | — |
| T027 | P3-03 Limpieza | backend + raíz | — | T025 | — |
| T028 | P3-04 Documentación final | raíz | — | T025, T027 | — |
| T029 | P0-07a Contrato SIM-LOAD-2 (2000 y `fisi-schools`) | raíz | [P] con T005 | — | — |
| T030 | P0-07b Perfil y límite en el backend | backend | — | T029 | — |
| T031 | P0-07c Límite y perfil en el arnés | raíz | [P] con T030 | T029, T004 | — |
| T032 | P0-08 Jornada, carga sostenida y SLO del login | raíz | — | T030, T031 | — |
| T033 | P2-10 Login con dos sentencias | backend | — | T018 | Sin regresión; SLO del login |
| T034 | P2-11 Revisión del algoritmo de locks | raíz (diseño) | — | T012, T017, T023 | D-1: pico de 507 inalcanzable |

Los IDs T029–T034 se añadieron después sin renumerar los anteriores. Las tareas backend que tocan `postgres-enrollment.store.ts` (T007, T014, T016, T017, T018, T019, T021, T033) son secuenciales en un solo worker. `[P]` solo se combina con tareas de archivos disjuntos y con un máximo de 2 workers. Las tareas con gate se ejecutan solo si `docs/performance/diagnosis.md` marca la hipótesis como `confirmed`. La revisión `speckit-analyze` debe comprobar que ninguna tarea modifica umbrales, `client/` ni los contratos SIM-PUBLIC-1/SIM-LOAD-2.
