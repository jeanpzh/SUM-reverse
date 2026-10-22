# Línea base P0-06 (ENV-H)

**Fecha de ejecución:** 2026-10-22, de 02:47 a 04:52 UTC y de 11:25 a 11:49 UTC. **Commit medido:** `c29b9d5` (master con #6–#18).
**Estado de todo el documento:** `local-only`. Mide el simulador propio con datos construidos de forma independiente, en una VM de 2 vCPU donde generador y servidor comparten host (`generatorSharesServerHost: true`). No acredita capacidad absoluta ni comportamiento del SUM institucional.

Documentos relacionados: [evaluación](assessment.md) · [estrategia](test-strategy.md) · [plan, tarea P0-06](plan.md#p0-06-línea-base). Agregados sanitizados: [`evidence/local/simulador-produccion/perf-baseline/`](../../evidence/local/simulador-produccion/perf-baseline/).

## 0. Convenciones

Se usan las etiquetas de la [evaluación §0](assessment.md#0-convenciones-de-evidencia). `observed` aquí significa medido en esta ejecución, con el archivo agregado como fuente. `inferred` lleva el experimento que lo confirmaría.

- Estadística (estrategia §8.4): mediana de los p95 de las repeticiones y rango [mín, máx]. No se combinan percentiles entre ejecuciones.
- Métrica clave por escenario: `http_req_duration{operation:submit}` en los escenarios de envío, `{operation:read}` en stress y `{name:auth-login}` en login. SLO D-2 sin cambios: p95 < 2000 ms y p99 < 5000 ms.
- Validez: la decide el guard del generador (estrategia §5.3, `load/check-generator-guard.mjs`). Una ejecución inválida no cuenta a favor ni en contra; sus cifras se muestran como **indicativas**.
- Corrección: integridad de la auditoría SQL más los umbrales de conteo y `checks` de k6.

## 1. Condiciones

| Aspecto | Valor |
| --- | --- |
| Entorno | ENV-H: VM de 2 vCPU y 8 GB, sin cpusets. Grafana detenido; Prometheus activo para el remote write |
| Topología | nginx → api-a + api-b (pool `max=12`, `connectionTimeoutMillis=5000`, `lock_timeout=5s`, `statement_timeout=20s`) → PostgreSQL 18.6 |
| Preparación | `SCENARIO_ENV=H SCENARIO_WARMUP=1 SIMULATOR_RECREATE=app`. Cada repetición rota la campaña (PostgreSQL se conserva) y precalienta 30 s de lecturas, excluidas de la medición |
| Datos | Campañas sintéticas; el número de campañas y filas por tabla antes de cada ejecución queda en `run-meta-<testid>.json` (privado) y resumido en los agregados |
| Orden | Bloques secuenciales sin k6 simultáneos: ráfagas a 400, mixed, stress, franja FISI, login, jornada y bench |

**Interrupción.** La cuarta repetición de stress se cortó a las 04:52 UTC: es la hora de los últimos ficheros escritos, y `uptime -s` indica que la VM arrancó de nuevo a las 11:19. Esa ejecución quedó sin resultado y se **excluye**. stress queda con n = 3, la reducción que ya se había propuesto para los escenarios largos. El resto continuó a las 11:25 sobre el mismo commit, tras comprobar que no quedaban ficheros de rotación pendientes.

## 2. Resultados por escenario (k6)

Fuente: [`aggregate.json`](../../evidence/local/simulador-produccion/perf-baseline/aggregate.json) (`observed`). Latencias en ms; p95 y p99 como mediana [mín, máx] de las repeticiones. «Válidas», «correctas» y «SLO» cuentan repeticiones.

| Escenario | n | Válidas | Correctas | SLO | p95 métrica clave | p99 métrica clave | req/s (mediana) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| race 400 | 5 | 0 | 5 | 0 | 2633 [2426, 2698] | 2711 [2500, 2819] | 69,5 |
| ample 400 | 5 | 0 | 0 | 0 | 6097 [5564, 6770] | 6607 [5982, 7397] | 59,4 |
| multi-uniform 400 | 5 | 0 | 5 | 0 | 2794 [2633, 2864] | 2895 [2782, 2960] | 69,0 |
| multi-hotspot 400 | 5 | 0 | 5 | 0 | 2968 [2927, 3005] | 3058 [3038, 3257] | 68,4 |
| mixed 400 (10 min) | 5 | 5 | 1 | 0 | 9394 [6127, 12555] | 10997 [7008, 16220] | 128,7 |
| stress 400 (lecturas) | 3 | 3 | 1 | 3 | 188 [186, 202] | 301 [300, 305] | 174,3 |
| franja FISI 507 | 5 | 0 | 0 | 0 | 7048 [5858, 9647] | 7809 [6405, 10015] | 71,8 |
| login 507 | 5 | 0 | 5 | 4 | 1614 [1551, 2022] | 1655 [1615, 2284] | 336,8 |
| jornada 1422 (`WAVE_FRONTLOAD=1` y `0`) | 0 | — | — | — | sin resultado: §5.5 | — | — |

Ruido base (anchura del rango del p95 de la métrica clave): race 272 ms, ample 1206, multi-uniform 231, multi-hotspot 78, stress 16 y login 471. En mixed (6428 ms) y en la franja FISI (3789 ms) el rango no mide ruido sino dos regímenes distintos (§5.3) o aceptaciones muy distintas entre repeticiones (§5.2).

**Lectura de cada fila:**

- **race, multi-uniform y multi-hotspot:** los conteos son exactos en las 15 repeticiones (10/400 y 100/400). Falla solo la latencia del envío. Son inválidas solo por el guard (§3).
- **ample:** acepta 335–381 de 400 (mediana 349). Las 224 peticiones restantes devuelven 503, con un máximo de 6,5 s (§4). La auditoría SQL pasa en todas: no hay efectos parciales.
- **mixed:** los conteos son 400/400 en las cinco. El p95 del envío falla siempre, incluso en las repeticiones «buenas» (6,1–9,4 s). La corrección falla en cuatro por respuestas inesperadas: 4, 2457, 1, 3203 y 0.
- **stress:** solo lecturas y cumple el SLO en las tres. La corrección falla en dos por `sessions_unexpected`: 313 y 2. En esas ventanas no hay respuestas HTTP ≥ 400 (§4), así que el origen está en una comprobación del cliente y **no está atribuido**.
- **franja FISI:** acepta 353–449 de 507 (mediana 391). Las 563 restantes devuelven 503 (máximo 9,5 s).
- **login:** el p95 de `auth-login` queda por debajo de 2000 ms en 4 de 5. La repetición 2 marca 2022 ms (p99 2284).

## 3. Validez de las ejecuciones (guard)

| Motivo del guard | Escenarios afectados | Qué mide |
| --- | --- | --- |
| `HTTP_CONNECTING` (p95 de `http_req_connecting` > 1 ms) | Las 20 ráfagas a 400, franja FISI y login | Conexiones TCP nuevas. Valores de 23–163 ms |
| `HTTP_BLOCKED` (p95 de `http_req_blocked` > 50 ms) | 14 de las 20 ráfagas, franja FISI (5/5) y login (5/5) | Espera del cliente antes de enviar. Valores de 28–262 ms |
| `GEN_CPU` (k6 > 85 % de 1 CPU durante > 5 muestras) | franja FISI (5/5) | k6 con media del 62–74 % y p90 del 176–186 % (sin cpuset puede usar las 2 CPU) |

mixed y stress (modelo cerrado con keepalive) son **válidas**. Las 30 ejecuciones de una iteración por VU son **inválidas**, así que el criterio P0 de la estrategia §9 («guard válido») **no se cumple** en esos escenarios.

**Limitación del criterio** (`inferred`). La estrategia §5.3 condiciona `http_req_connecting > 0` a que haya keepalive esperado. En un escenario de una iteración por VU, cada VU abre su propia conexión, así que la condición se cumple siempre. La implementación (`load/check-generator-guard.mjs`) la aplica sin esa salvedad. Aun así, el coste de conexión es acotado:

- `http_req_blocked` (p95 ≤ 165 ms en las ráfagas) es menos del 7 % del p95 del envío (≥ 2426 ms).
- La métrica del lado servidor reproduce el mismo orden de magnitud sin HTTP (§5.1).

Las cifras de las filas inválidas sirven como **indicativas** de la latencia del servidor, no como medición aceptada. Para cumplir el criterio hace falta una de dos cosas: corregir el guard para que distinga el modelo de una iteración por VU (y fije un límite propio para `blocked`), o cambiar la medición (§6).

## 4. Errores HTTP y su causa

Fuente: [`http-errors.json`](../../evidence/local/simulador-produccion/perf-baseline/http-errors.json): `simulator_http_metrics` por ventana de cada bloque y el log de PostgreSQL (`observed`).

| Ventana | Ruta | Estado | Peticiones | Máximo (ms) |
| --- | --- | --- | --- | --- |
| ample (5 rep.) | `POST …/solicitudes` | 503 | 224 | 6495 |
| franja FISI (5 rep.) | `POST …/solicitudes` | 503 | 563 | 9500 |
| mixed rep. 1 | consultas de perfil + `solicitudes` | 503 | 3 + 1 | 6339 |
| mixed rep. 2 | consultas de perfil / `contextos` / `solicitudes` | 503 | 1943 / 500 / 14 | 12580 |
| mixed rep. 4 | consultas de perfil / `contextos` / `solicitudes` | 503 | 2557 / 628 / 18 | 12903 |

El conteo de 503 coincide exactamente con las solicitudes no aceptadas: ample 224 = 35 + 51 + 54 + 19 + 65 y franja FISI 563 = 96 + 154 + 139 + 116 + 58.

**El 503 no procede de `lock_timeout`.** Entre las 02:40 y las 11:49 el log de PostgreSQL registra 0 cancelaciones por lock timeout (`observed`). Las únicas cancelaciones son 2 por statement timeout, a las 11:44:22. Fueron sobre una consulta de monitorización a `pg_stat_activity`, durante el episodio de memoria de la jornada (§5.5) y fuera de cualquier ejecución medida. En el código, un `55P03` se reintenta hasta tres veces antes del 503 (`backend/src/persistence/postgres-enrollment.store.ts:99-106`, `code`), así que ese camino no produce un 503 a los 5–6,5 s.

En cambio, `pool.connect()` con `connectionTimeoutMillis=5000` (`backend/src/persistence/postgres.ts:11`) lanza un error sin código SQL, que `submitTransaction` traduce directamente a `503 STORAGE_UNAVAILABLE` (`postgres-enrollment.store.ts:153-156`, `code`).

La interpretación (`inferred`, confirmable con E5) es que las transacciones que esperan el `FOR UPDATE` de las secciones calientes retienen sus conexiones. Los 12 slots de cada réplica se agotan y las peticiones siguientes esperan más de 5 s para obtener una. Es el patrón **H1 → H3** de la evaluación. Corrige la lectura previa de este trabajo, que atribuía los 503 de ample al `lock_timeout`. Las colas de 9,5 s (franja FISI) y de 12–13 s (lecturas de mixed, con varios checkouts por petición) no están desglosadas.

## 5. Hallazgos

### 5.1 La latencia del envío está en el servidor y escala con la cola (H1, `observed` + `inferred`)

`submit-bench` (sin HTTP ni k6, pool 2 × 12, perfil shared; fuente: `aggregate.json`, clave `bench`):

| Actores | p95 (ms) | p99 (ms) | Vaciado (ms) | Envíos/s | t_cs estimado (ms) | Presupuesto t_cs (ms) | Veredicto |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 710 [677, 842] | 730 [698, 861] | 736 | 136 | 7,4 [7,1, 8,7] | 21,1 | verde 5/5 |
| 200 | 1330 [1195, 1575] | 1377 [1242, 1646] | 1389 | 144 | 6,9 [6,3, 8,3] | 10,5 | verde 5/5 |
| 400 | 2388 [2288, 2881] | 2507 [2367, 2959] | 2528 | 158 | 6,3 [6,0, 7,5] | 5,3 | rojo 5/5 |
| 507 | 3108 [2963, 3278] | 3202 [3071, 3384] | 3228 | 157 | 6,4 [6,1, 6,7] | 4,2 | rojo 5/5 |

- Aceptadas: 10/10 en las 20 ejecuciones, sin errores y con la auditoría al 100 %.
- El p95 crece de forma casi lineal con N, mientras el throughput se estanca en unos 157 envíos/s.
- Con 400 actores, el bench (2388 ms) explica el 91 % del p95 de race por HTTP (2633 ms). Esto refuerza que el generador y la red añaden poco y que **la serialización en el servidor domina**.
- Para cumplir p95 < 2000 ms con 400 en la misma cohorte, t_cs tendría que bajar de ≈6,3 a ≤5,3 ms. Con 507 haría falta ≤4,2 ms.

Confirmar la parte de espera de lock frente al resto exige la instrumentación P1-01 (E1).

### 5.2 Rechazos por agotamiento del pool en ráfagas con aceptación larga (H3, `inferred`)

ample y la franja FISI (perfil `fisi-schools`, capacidad amplia) son las ráfagas donde la mayoría de envíos **acepta**, es decir, recorren la ruta larga de la transacción. Son también las únicas con 503 (§4).

La variación de aceptadas entre repeticiones (335–381 y 353–449) muestra un sistema en el límite del timeout de 5 s del pool. Un cambio pequeño de tiempos mueve decenas de peticiones a un lado u otro.

### 5.3 mixed muestra dos regímenes: PostgreSQL saturado en las repeticiones 2 y 4 (nuevo, `observed`; causa `inferred`)

| Rep. | req/s | Inesperadas | CPU media de PostgreSQL | CPU media de api-a/api-b | PSI de CPU del host | p95 de todas las peticiones (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 129 | 4 | 54 % | 20 % / 20 % | 41 % | 139 |
| 2 | 35 | 2457 | 166 % | 7 % / 8 % | 96 % | 12381 |
| 3 | 130 | 1 | 54 % | 20 % / 21 % | 40 % | 102 |
| 4 | 36 | 3203 | 165 % | 8 % / 8 % | 96 % | 12174 |
| 5 | 132 | 0 | 53 % | 21 % / 21 % | 41 % | 106 |

En las repeticiones 2 y 4:
- PostgreSQL consume ≈1,65 CPU de 2 haciendo ≈¼ del trabajo, lo que significa unas 11 veces más CPU por petición.
- Las APIs están ociosas.
- Los 503 caen sobre las **lecturas** (consultas de perfil y `contextos`).
- Ninguna otra variable registrada distingue los dos regímenes: el número de campañas crece de forma monótona (68→72) y las repeticiones buenas y malas se alternan.

Hechos relacionados (`code` + `observed`):

- `simulator_academic_sessions` solo tiene índice por `session_id`. `loadRunState`, que se ejecuta en cada lectura de contexto y en cada envío, la filtra por `(campaign_id, actor_id)` (`postgres-enrollment.store.ts:221`).
- `EXPLAIN` sobre la base sintética da `Seq Scan` de toda la tabla.
- `pg_stat_user_tables` acumula ≈712 000 `seq_scan` en ella, sobre ≈23 500 filas. La tabla crece en cada campaña rotada: de 10 272 a 27 195 filas durante esta línea base.
- `simulator_campaigns` se re-analizó (`last_autoanalyze`) a las 03:27:09, al inicio de la repetición 2. Es su único autoanalyze (`autoanalyze_count=1`), así que no explica la repetición 4 y no se toma como causa.

El escaneo coincide con **H7** de la evaluación, que suponía un impacto probablemente bajo; estos datos lo ponen en duda. La alternancia de regímenes es nueva y se registra como **H13** (`inferred`): un cambio de plan, o el coste creciente de ese escaneo y de otras consultas sin índice por campaña, satura PostgreSQL de forma intermitente cuando se mezclan lecturas y envíos.

- Predicción: con `pg_stat_statements` (P1-02), las consultas de `loadRunState` dominan el tiempo total en las repeticiones lentas.
- Predicción: un índice `(campaign_id, actor_id)` elimina el régimen lento. Ese cambio es una optimización P2 y requiere su propia comparación A/B (con E9 de H7).

### 5.4 Deadlocks en el volcado de métricas HTTP (H12, `observed`)

El log de PostgreSQL registra 8 `deadlock detected`, todos sobre `simulator_http_metrics`, al insertar o bloquear tuplas. Cada proceso de API vuelca cada segundo un `INSERT … ON CONFLICT DO UPDATE` de varias filas, en el orden de inserción del `Map` (`backend/src/auth/simulator-metrics.interceptor.ts:59-72`, `code`). Los procesos implicados no están atribuidos a una réplica concreta. Uno de los casos es una cadena de tres procesos.

Comparando la hora de cada deadlock con las ventanas medidas:
- 6 ocurrieron durante la rotación o el precalentamiento (02:48:23, 02:48:27, 02:53:42, 04:50:28, 11:27:31 y 11:30:37). En la rotación se recrean api-a y api-b, y el volcado final de las instancias salientes (`onModuleDestroy`) puede solaparse con las nuevas (`inferred`).
- 1 cayó dentro de una medición válida: 04:08:47, en mixed rep. 5.
- 1 cayó en la ejecución excluida de stress: 04:50:55.

El efecto sobre las cifras de esta línea base es, por tanto, marginal.

El `catch` reencola el lote, así que no se pierden muestras. Pero cada deadlock retiene una conexión del pool hasta que se detecta (`deadlock_timeout`). El impacto en la latencia **no está medido**.

Corrección candidata (fuera de P0): ordenar las filas por la clave del conflicto antes del upsert.

### 5.5 La jornada de 1422 no se puede ejecutar en ENV-H con el arnés actual (`observed` + `code`)

Con `WAVE_FRONTLOAD=1`, el kernel mató a k6 por falta de memoria global durante la inicialización: llevaba ≈605 de 1422 VUs y 5,6 GB de RSS (`dmesg`), unos 9 MB por VU. No hubo summary-export y la ejecución queda **excluida**.

La causa probable (`code`) es que cada VU parsea su propia copia del manifiesto de 0,7 MB (`load/common.js:30`, `JSON.parse(open(file))` en el contexto de inicialización) en lugar de compartirlo con `SharedArray`.

La variante `WAVE_FRONTLOAD=0` se detuvo durante su precalentamiento, antes de lanzar la carga, para no provocar otro OOM global que podía alcanzar a PostgreSQL. También queda **excluida**.

### 5.6 Generador en el límite de CPU

Fuente: CSV de recursos (`observed`). En multi-uniform y multi-hotspot, k6 tiene una media del 44–51 % pero un p90 del 176–191 %: durante la ráfaga ocupa casi las 2 CPU. El guard no lo marca porque la ráfaga dura menos de 5 muestras.

En la franja FISI y en login (507 VUs) sí se supera de forma sostenida. Es la limitación H6 de compartir host, prevista en ENV-H.

## 6. Estado del criterio de aceptación P0 (estrategia §9)

| Requisito | Estado |
| --- | --- |
| n = 5 de race, ample, multi-uniform, multi-hotspot y mixed a 400 | Cumplido |
| n = 5 de stress a 400 | Parcial: n = 3 (interrupción por reinicio; §1) |
| franja FISI 507 y login 507 | Ejecutados, n = 5 |
| una jornada | **No cumplido**: OOM de k6 (§5.5) |
| `submit-bench` 100/200/400/507 | Cumplido, n = 5 |
| rangos registrados por escenario | Cumplido (§2 y §5.1) |
| guard válido | **No cumplido** en las 30 ejecuciones de una iteración por VU (§3); cumplido en mixed y stress |
| ejecuciones válidas o excluidas con motivo | Cumplido: inválidas marcadas y exclusiones explicadas (§1, §5.5) |

**P0-06 queda como línea base parcial.** Basta para orientar P1, porque el bench es válido y coherente con k6. Pero no basta para declarar mejoras P2 contra los escenarios k6 inválidos ni contra la jornada.

## 7. Tareas que se proponen (no ejecutadas)

1. **Guard:** distinguir el modelo de una iteración por VU, sin exigir `connecting = 0`, y definir para `blocked` un umbral relativo al p95 medido. Requiere cambiar la estrategia §5.3 con aprobación, porque es un criterio de validez, no un umbral de SLO.
2. **Arnés de jornada:** cargar el manifiesto con `SharedArray` y medir la memoria por VU con 1422 VUs antes de repetir la jornada.
3. **P1-01/P1-02** (ya planificadas): fases de la transacción, espera del pool y `pg_stat_statements`, para confirmar H1/H3, H7 y H13.
4. **Deadlock de métricas:** ordenar las filas del upsert (cambio pequeño; candidato a P2 con su prueba).
5. **Estado inicial:** las tablas crecieron de 48 a 86 campañas durante la línea base. Para las comparaciones P2, usar un volumen nuevo o registrar el tamaño, como pide la estrategia §8.2, y evaluar H13 con el mismo número de campañas en A y B.

## 8. Reproducción

1. Stack del simulador en `c29b9d5`, Grafana detenido. Variables: `SCENARIO_ENV=H SCENARIO_WARMUP=1 SIMULATOR_RECREATE=app`. En cada bloque: `SCENARIO_REPEATS=5 SCENARIO_ACTORS=400 bash load/scenarios.sh <escenario>`; para la franja, `bash load/scenarios.sh fisi-franja`; para login, `SCENARIO_ACTORS=507 … login`.
2. Bench: `docker compose run --rm --no-deps migrate node dist/scripts/bench-submit.js --actors <N> --profile shared --budget-ms 2000 --out /runtime/results/bench-shared-<N>-r<R>.json`.
3. Agregados: `node evidence/local/simulador-produccion/perf-baseline/aggregate.mjs infra/simulator/runtime/results c29b9d5 normal <salida>.json`. El script filtra por `gitSha` y modo, y sustituye los testids.

Los resultados privados por `testid` (summary-export, auditorías, CSV de recursos, run-meta) quedan en `infra/simulator/runtime/results/`, fuera de Git.
