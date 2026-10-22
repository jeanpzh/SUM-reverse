# Línea base P0-06 (ENV-H)

**Fecha de ejecución:** 2026-10-22, de 02:47 a 04:52 UTC y de 11:25 a 11:49 UTC. **Commit medido:** `c29b9d5` (master con #6–#18).
**Ejecuciones complementarias:** 2026-10-22, de 12:09 a 12:55 UTC, sobre `d4b4a7f` (#20). Son stress, repeticiones 4 y 5, y la jornada de 1422. #20 cambia solo el arnés de carga (manifiesto compartido y guard por VU); el backend es el mismo que en `c29b9d5`.
**Estado de todo el documento:** `local-only`. Mide el simulador propio con datos construidos de forma independiente, en una VM de 2 vCPU donde generador y servidor comparten host (`generatorSharesServerHost: true`). No acredita capacidad absoluta ni comportamiento del SUM institucional.

Documentos relacionados: [evaluación](assessment.md) · [estrategia](test-strategy.md) · [plan, tarea P0-06](plan.md#p0-06-línea-base). Agregados sanitizados: [`evidence/local/simulador-produccion/perf-baseline/`](../../evidence/local/simulador-produccion/perf-baseline/).

## 0. Convenciones

Se usan las etiquetas de la [evaluación §0](assessment.md#0-convenciones-de-evidencia). `observed` aquí significa medido en esta ejecución, con el archivo agregado como fuente. `inferred` lleva el experimento que lo confirmaría.

- Estadística (estrategia §8.4): mediana de los p95 de las repeticiones y rango [mín, máx]. No se combinan percentiles entre ejecuciones.
- Métrica clave por escenario: `http_req_duration{operation:submit}` en los escenarios de envío, `{operation:read}` en stress y `{name:auth-login}` en login. SLO D-2 sin cambios: p95 < 2000 ms y p99 < 5000 ms.
- Validez: la decide el guard del generador (estrategia §5.3, `load/check-generator-guard.mjs`), con el modelo de una iteración por VU de #20 (§3). Una ejecución inválida no cuenta a favor ni en contra; sus cifras se muestran como **indicativas**.
- Corrección: integridad de la auditoría SQL más los umbrales de conteo y `checks` de k6.

## 1. Condiciones

| Aspecto | Valor |
| --- | --- |
| Entorno | ENV-H: VM de 2 vCPU y 8 GB, sin cpusets. Grafana detenido; Prometheus activo para el remote write |
| Topología | nginx → api-a + api-b (pool `max=12`, `connectionTimeoutMillis=5000`, `lock_timeout=5s`, `statement_timeout=20s`) → PostgreSQL 18.6 |
| Preparación | `SCENARIO_ENV=H SCENARIO_WARMUP=1 SIMULATOR_RECREATE=app`. Cada repetición rota la campaña (PostgreSQL se conserva) y precalienta 30 s de lecturas, excluidas de la medición |
| Datos | Campañas sintéticas; el número de campañas y filas por tabla antes de cada ejecución queda en `run-meta-<testid>.json` (privado) y resumido en los agregados |
| Orden | Bloques secuenciales sin k6 simultáneos: ráfagas a 400, mixed, stress, franja FISI, login, jornada y bench |

**Interrupción.** La cuarta repetición de stress se cortó a las 04:52 UTC: es la hora de los últimos ficheros escritos, y `uptime -s` indica que la VM arrancó de nuevo a las 11:19. Esa ejecución quedó sin resultado y se **excluye**. Sobre `c29b9d5`, stress queda con n = 3; las repeticiones 4 y 5 se ejecutaron después, como complementarias (abajo). El resto continuó a las 11:25 sobre el mismo commit, tras comprobar que no quedaban ficheros de rotación pendientes.

**Ejecuciones complementarias.** Las repeticiones 4 y 5 de stress y las dos jornadas se ejecutaron después, sobre `d4b4a7f`, con la misma configuración y Grafana detenido. Para entonces la base había crecido: 109–112 campañas y unas 34 000 filas en `simulator_academic_sessions`, frente a 73–75 campañas y unas 21 000 filas en las repeticiones 1–3 de stress. Por eso se agregan aparte ([`aggregate-p0b.json`](../../evidence/local/simulador-produccion/perf-baseline/aggregate-p0b.json)) y no se mezclan con las de `c29b9d5`.

## 2. Resultados por escenario (k6)

Fuentes: [`aggregate.json`](../../evidence/local/simulador-produccion/perf-baseline/aggregate.json) y, para las filas marcadas con `d4b4a7f`, [`aggregate-p0b.json`](../../evidence/local/simulador-produccion/perf-baseline/aggregate-p0b.json) (`observed`). Latencias en ms; p95 y p99 como mediana [mín, máx] de las repeticiones. «Válidas», «correctas» y «SLO» cuentan repeticiones. La validez es la del guard de #20 (§3).

| Escenario | n | Válidas | Correctas | SLO | p95 métrica clave | p99 métrica clave | req/s (mediana) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| race 400 | 5 | 5 | 5 | 0 | 2633 [2426, 2698] | 2711 [2500, 2819] | 69,5 |
| ample 400 | 5 | 5 | 0 | 0 | 6097 [5564, 6770] | 6607 [5982, 7397] | 59,4 |
| multi-uniform 400 | 5 | 5 | 5 | 0 | 2794 [2633, 2864] | 2895 [2782, 2960] | 69,0 |
| multi-hotspot 400 | 5 | 5 | 5 | 0 | 2968 [2927, 3005] | 3058 [3038, 3257] | 68,4 |
| mixed 400 (10 min) | 5 | 5 | 1 | 0 | 9394 [6127, 12555] | 10997 [7008, 16220] | 128,7 |
| stress 400 (lecturas), rep. 1–3 | 3 | 3 | 1 | 3 | 188 [186, 202] | 301 [300, 305] | 174,3 |
| stress 400 (lecturas), rep. 4–5, `d4b4a7f` | 2 | 2 | 1 | 2 | 364 [222, 506] | 573 [322, 824] | 171,2 |
| franja FISI 507 | 5 | 0 | 0 | 0 | 7048 [5858, 9647] | 7809 [6405, 10015] | 71,8 |
| login 507 | 5 | 3 | 5 | 4 | 1614 [1551, 2022] | 1655 [1615, 2284] | 336,8 |
| jornada 1422, `WAVE_FRONTLOAD=1`, `d4b4a7f` | 1 | 1 | 0 | 0 | 10918 (login: 1680) | 12749 (login: 1812) | 10,6 |
| jornada 1422, `WAVE_FRONTLOAD=0`, `d4b4a7f` | 1 | 1 | 0 | 0 | 19018 (login: 11827) | 26025 (login: 13043) | 9,6 |

Ruido base (anchura del rango del p95 de la métrica clave): race 272 ms, ample 1206, multi-uniform 231, multi-hotspot 78, stress 16 y login 471. En mixed (6428 ms) y en la franja FISI (3789 ms) el rango no mide ruido sino dos regímenes distintos (§5.3) o aceptaciones muy distintas entre repeticiones (§5.2).

**Lectura de cada fila:**

- **race, multi-uniform y multi-hotspot:** los conteos son exactos en las 15 repeticiones (10/400 y 100/400). Falla solo la latencia del envío.
- **ample:** acepta 335–381 de 400 (mediana 349). Las 224 peticiones restantes devuelven 503, con un máximo de 6,5 s (§4). La auditoría SQL pasa en todas: no hay efectos parciales.
- **mixed:** los conteos son 400/400 en las cinco. El p95 del envío falla siempre, incluso en las repeticiones «buenas» (6,1–9,4 s). La corrección falla en cuatro por respuestas inesperadas: 4, 2457, 1, 3203 y 0.
- **stress:** solo lecturas. Cumple el SLO y es válida en las cinco repeticiones. La corrección falla en tres por `sessions_unexpected`: 313 y 2 en las repeticiones 2 y 3, y 2 en la 5. En esas ventanas no hay respuestas HTTP ≥ 400 (§4), así que el origen está en una comprobación del cliente y **no está atribuido**.
- **stress, repeticiones 4–5:** el p95 de lecturas (506 y 222 ms) queda fuera del rango de las repeticiones 1–3 (186–202 ms). Partían de otra base (§1): 109–110 campañas y unas 34 000 sesiones, con PostgreSQL al 75 % de CPU media frente al 65 %. La diferencia **no está atribuida**. H7 encaja, porque el escaneo de `simulator_academic_sessions` crece con la tabla, pero nada aquí lo prueba.
- **franja FISI:** acepta 353–449 de 507 (mediana 391). Las 563 restantes devuelven 503 (máximo 9,5 s).
- **login:** el p95 de `auth-login` queda por debajo de 2000 ms en 4 de 5. La repetición 2 marca 2022 ms (p99 2284).
- **jornada:** ver §5.5.

## 3. Validez de las ejecuciones (guard)

**Criterio vigente (#20, estrategia §5.3).** En los escenarios de una iteración por VU (enrollment, login, retry y jornada), cada VU abre su propia conexión por diseño. Para ellos el guard aplica el modelo `per-vu`:
- `http_req_connecting` no invalida la ejecución;
- el p95 de `http_req_blocked` debe quedar por debajo de max(50 ms, 10 % del p95 de `http_req_duration`).

El resto de las reglas no cambia. El usuario aprobó el criterio el 2026-10-22 **después** de ver estos datos, así que el umbral no es una predicción independiente.

Las 30 ejecuciones de una iteración por VU se re-evaluaron sin conexión con el guard nuevo, sobre los mismos CSV de recursos, summary-export y logs ([`guard-reeval.json`](../../evidence/local/simulador-produccion/perf-baseline/guard-reeval.json), `observed`):

| Escenario | Válidas con el guard anterior | Válidas con el guard de #20 | Motivo de las inválidas |
| --- | --- | --- | --- |
| race, ample, multi-uniform, multi-hotspot | 0/20 | 20/20 | — |
| franja FISI 507 | 0/5 | 0/5 | `GEN_CPU`: k6 por encima del 85 % de 1 CPU durante 7–9 muestras seguidas (media del 62–74 %, p90 del 176–186 %) |
| login 507 | 0/5 | 3/5 | `HTTP_BLOCKED` en las repeticiones 2 y 3: 262 y 227 ms, por encima del 10 % del p95 (183 y 165 ms) |

mixed y stress (modelo cerrado con keepalive) eran ya válidas y siguen siéndolo. Las dos jornadas y las repeticiones 4–5 de stress, ejecutadas con el guard de #20, son válidas.

La franja FISI sigue sin una medición válida en ENV-H: con 507 VUs, k6 compite por las 2 CPU con el servidor (H6). Es una limitación del entorno, no del criterio.
## 4. Errores HTTP y su causa

Fuentes: [`http-errors.json`](../../evidence/local/simulador-produccion/perf-baseline/http-errors.json) y, para las ejecuciones complementarias, [`http-errors-p0b.json`](../../evidence/local/simulador-produccion/perf-baseline/http-errors-p0b.json): `simulator_http_metrics` por ventana de cada bloque y el log de PostgreSQL (`observed`).

| Ventana | Ruta | Estado | Peticiones | Máximo (ms) |
| --- | --- | --- | --- | --- |
| ample (5 rep.) | `POST …/solicitudes` | 503 | 224 | 6495 |
| franja FISI (5 rep.) | `POST …/solicitudes` | 503 | 563 | 9500 |
| mixed rep. 1 | consultas de perfil + `solicitudes` | 503 | 3 + 1 | 6339 |
| mixed rep. 2 | consultas de perfil / `contextos` / `solicitudes` | 503 | 1943 / 500 / 14 | 12580 |
| mixed rep. 4 | consultas de perfil / `contextos` / `solicitudes` | 503 | 2557 / 628 / 18 | 12903 |
| jornada `WAVE_FRONTLOAD=1` | `contextos` / `sesiones` / `solicitudes` | 503 | 452 / 18 / 156 | 10082 |
| jornada `WAVE_FRONTLOAD=0` | `contextos` / `sesiones` / `solicitudes` / login | 503 | 57 / 84 / 51 / 76 | 14302 |

stress (las cinco repeticiones) no tiene respuestas ≥ 400.

El conteo de 503 coincide exactamente con las solicitudes no aceptadas en ample (224 = 35 + 51 + 54 + 19 + 65), en la franja FISI (563 = 96 + 154 + 139 + 116 + 58) y en la jornada con `WAVE_FRONTLOAD=1` (626 = 1422 − 796). En la jornada con `WAVE_FRONTLOAD=0` hay 268 respuestas 503, 270 inesperadas en k6 y 269 no aceptadas; 1–2 quedan sin atribuir.

**Ningún 503 viene de un `lock_timeout`.** En las dos ventanas registradas (02:40–11:49 y 12:09–12:55), el log de PostgreSQL tiene 0 cancelaciones por lock timeout (`observed`). `lock_timeout=5000` y `statement_timeout=20000` se aplican en cada conexión a través de las opciones del pool (`backend/src/persistence/postgres.ts:14`), sin ningún override en la configuración del runtime (`code`). En el código, un `55P03` se reintenta hasta tres veces antes del 503 (`backend/src/persistence/postgres-enrollment.store.ts:99-106`, `code`), así que ese camino no produce un 503 a los 5–6,5 s.

En cambio, `pool.connect()` con `connectionTimeoutMillis=5000` (`backend/src/persistence/postgres.ts:11`) lanza un error sin código SQL, que `submitTransaction` traduce directamente a `503 STORAGE_UNAVAILABLE` (`postgres-enrollment.store.ts:153-156`, `code`).

**Cancelaciones por statement timeout.**
- **Línea base:** 2, a las 11:44:22, sobre una consulta de monitorización a `pg_stat_activity`. Fue durante el episodio de memoria de la jornada original, fuera de cualquier ejecución medida.
- **Jornada con `WAVE_FRONTLOAD=0`:** 5, entre las 12:50:32 y las 12:51:25, todas sobre `SELECT … FROM simulator_sections … FOR UPDATE` (`observed`).

Es decir, un `FOR UPDATE` sobre una sección estuvo 20 s sin terminar, sin que se disparase el `lock_timeout` de 5 s. Esto **matiza la lectura anterior**: «0 lock timeouts» no implica que la espera de locks sea corta. `lock_timeout` acota cada adquisición de lock, no la espera total. Dos explicaciones posibles (`inferred`; P1-01 las separa):
- con varias transacciones esperando la misma fila, una petición puede encadenar varias esperas de menos de 5 s;
- PostgreSQL estaba saturado de CPU (p90 del 182 % en esa ejecución) y la sentencia avanzaba despacio.

Además, `57014` está en la lista de reintentos. Una petición cancelada así puede retener conexiones más de 20 s antes de obtener su respuesta: el p99 del envío en esa jornada es de 26 s (`observed`).

La interpretación (`inferred`, confirmable con E5 y P1-01) es que las transacciones que esperan el `FOR UPDATE` de las secciones calientes retienen sus conexiones. Los 12 slots de cada réplica se agotan y las peticiones siguientes esperan más de 5 s para obtener una. Es el patrón **H1 → H3** de la evaluación. Corrige la lectura previa de este trabajo, que atribuía los 503 de ample al `lock_timeout`. Las colas de 9,5 s (franja FISI), de 10–14 s (jornada) y de 12–13 s (lecturas de mixed, con varios checkouts por petición) no están desglosadas.

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

El log de PostgreSQL registra 11 `deadlock detected`: 8 en la línea base y 3 en las ejecuciones complementarias. Todos son sobre `simulator_http_metrics`, al insertar o bloquear tuplas. Cada proceso de API vuelca cada segundo un `INSERT … ON CONFLICT DO UPDATE` de varias filas, en el orden de inserción del `Map` (`backend/src/auth/simulator-metrics.interceptor.ts:59-72`, `code`). Los procesos implicados no están atribuidos a una réplica concreta. Uno de los casos es una cadena de tres procesos.

Comparando la hora de cada deadlock con las ventanas medidas:
- 6 ocurrieron durante la rotación o el precalentamiento (02:48:23, 02:48:27, 02:53:42, 04:50:28, 11:27:31 y 11:30:37). En la rotación se recrean api-a y api-b, y el volcado final de las instancias salientes (`onModuleDestroy`) puede solaparse con las nuevas (`inferred`).
- 4 cayeron dentro de mediciones válidas: 04:08:47 (mixed rep. 5), 12:10:41 y 12:11:34 (stress rep. 4, cuyo precalentamiento terminó hacia las 12:10:17) y 12:48:43 (jornada con `WAVE_FRONTLOAD=0`).
- 1 cayó en la ejecución excluida de stress: 04:50:55.

Cuatro de 11 caen dentro de mediciones válidas, así que **no se pueden descartar como marginales**. El `catch` reencola el lote, así que no se pierden muestras. Pero cada deadlock retiene una conexión del pool hasta que se detecta (`deadlock_timeout`). El impacto en la latencia **no está medido**.

Corrección candidata (fuera de P0): ordenar las filas por la clave del conflicto antes del upsert.

### 5.5 Jornada de 1422 (`observed`; causas `inferred`)

**Primer intento, sobre `c29b9d5`.** Con `WAVE_FRONTLOAD=1`, el kernel mató a k6 por falta de memoria global durante la inicialización: llevaba ≈605 de 1422 VUs y 5,6 GB de RSS (`dmesg`). Cada VU parseaba su propia copia del manifiesto (`load/common.js:30`), ≈9,9 MB por VU medidos. La variante `WAVE_FRONTLOAD=0` se detuvo en el precalentamiento para no provocar otro OOM. Ambas quedan **excluidas**.

**Segundo intento, sobre `d4b4a7f`.** El manifiesto se comparte entre VUs con `SharedArray` (#20) y k6 ocupa ≈600 MiB con 1422 VUs. Las dos variantes terminan y son válidas para el guard:

| Variante | Aceptadas | 503 | p95 / p99 del envío (ms) | p95 / p99 del login (ms) | CPU de PostgreSQL (media / p90) |
| --- | --- | --- | --- | --- | --- |
| `WAVE_FRONTLOAD=1` (cada ola llega de golpe) | 796 / 1422 | 626 | 10918 / 12749 | 1680 / 1812 | 31 % / 167 % |
| `WAVE_FRONTLOAD=0` (cada ola se reparte en su minuto) | 1153 / 1422 | 268 | 19018 / 26025 | 11827 / 13043 | 59 % / 182 % |

Las dos fallan la corrección y el SLO del envío. Las invariantes SQL pasan en ambas: no hay efectos parciales; la auditoría marca integridad falsa porque hay menos inscripciones de las esperadas. Los 503 caen también sobre las lecturas de contexto, las sesiones académicas y, en la segunda, el login (§4).

**La comparación entre variantes está confundida** y no confirma ninguna hipótesis. Con llegadas repartidas hay menos 503 (268 frente a 626), pero la latencia del envío y del login sube mucho y aparecen statement timeouts (§4). Además, `WAVE_FRONTLOAD=0` se ejecutó siempre después, sobre una base más grande (112 campañas y unas 36 000 sesiones, frente a 111 y unas 34 600). Separar el efecto del patrón de llegada y el del tamaño de la base exige repetirlas en orden alterno y con el mismo estado inicial (§7).

### 5.6 Generador en el límite de CPU

Fuente: CSV de recursos (`observed`). En multi-uniform y multi-hotspot, k6 tiene una media del 44–51 % pero un p90 del 176–191 %: durante la ráfaga ocupa casi las 2 CPU. El guard no lo marca porque la ráfaga dura menos de 5 muestras.

En la franja FISI y en login (507 VUs) sí se supera de forma sostenida. Es la limitación H6 de compartir host, prevista en ENV-H.

## 6. Estado del criterio de aceptación P0 (estrategia §9)

| Requisito | Estado |
| --- | --- |
| n = 5 de race, ample, multi-uniform, multi-hotspot y mixed a 400 | Cumplido; válidas 5/5 |
| n = 5 de stress a 400 | Cumplido con salvedad: 5 válidas que cumplen el SLO, pero las repeticiones 4–5 parten de otro estado inicial y otro commit del arnés (§1, §2); la distribución de latencias se da por grupos |
| franja FISI 507 y login 507 | Ejecutados, n = 5. Válidas: franja 0/5 (`GEN_CPU`, limitación de ENV-H) y login 3/5 |
| una jornada | Cumplido: dos variantes válidas, sobre `d4b4a7f` (§5.5) |
| `submit-bench` 100/200/400/507 | Cumplido, n = 5 |
| rangos registrados por escenario | Cumplido (§2 y §5.1) |
| guard válido | Cumplido en todos los escenarios salvo la franja FISI y 2 repeticiones de login, con el criterio de #20 (§3) |
| ejecuciones válidas o excluidas con motivo | Cumplido: inválidas marcadas y exclusiones explicadas (§1, §3, §5.5) |

**P0-06 queda completa con dos salvedades:**
- la franja FISI no tiene una medición válida en ENV-H, porque el generador satura su CPU;
- el estado inicial creció durante la ejecución, de 48 a 112 campañas, y las comparaciones dentro de esta línea base entre bloques ejecutados en momentos distintos están confundidas por ese crecimiento.

Basta como referencia para P1. Para comparaciones A/B de P2 hace falta controlar el estado inicial (§7).

## 7. Tareas que se proponen

Hechas en #20:
1. **Guard:** modelo de una iteración por VU, aprobado y documentado en la estrategia §5.3.
2. **Arnés de jornada:** manifiesto compartido con `SharedArray` y offsets por ola calculados una sola vez.

Pendientes:
3. **P1-01/P1-02** (ya planificadas): fases de la transacción, espera del pool y `pg_stat_statements`, para confirmar H1/H3, H7 y H13 y separar las dos explicaciones de los statement timeouts (§4).
4. **Deadlock de métricas:** ordenar las filas del upsert (cambio pequeño; candidato a P2 con su prueba). Ya afecta a 4 mediciones válidas (§5.4).
5. **Estado inicial:** las tablas crecieron de 48 a 112 campañas. Para las comparaciones P2, usar un volumen nuevo o registrar el tamaño (estrategia §8.2), y evaluar H7/H13 con el mismo número de campañas en A y B. Las dos variantes de jornada deben repetirse en orden alterno y desde el mismo estado.
6. **`sessions_unexpected` en stress:** 3 de 5 repeticiones fallan la corrección sin respuestas HTTP ≥ 400. Hay que localizar qué comprobación del cliente falla.

## 8. Reproducción

1. Stack del simulador en `c29b9d5`, Grafana detenido. Variables: `SCENARIO_ENV=H SCENARIO_WARMUP=1 SIMULATOR_RECREATE=app`. En cada bloque: `SCENARIO_REPEATS=5 SCENARIO_ACTORS=400 bash load/scenarios.sh <escenario>`; para la franja, `bash load/scenarios.sh fisi-franja`; para login, `SCENARIO_ACTORS=507 … login`.
2. Bench: `docker compose run --rm --no-deps migrate node dist/scripts/bench-submit.js --actors <N> --profile shared --budget-ms 2000 --out /runtime/results/bench-shared-<N>-r<R>.json`.
3. Ejecuciones complementarias, con el stack en `d4b4a7f` y las mismas variables: `SCENARIO_REP=4 bash load/scenarios.sh stress` (y `SCENARIO_REP=5`), y luego `WAVE_FRONTLOAD=1 bash load/scenarios.sh jornada` y `WAVE_FRONTLOAD=0 bash load/scenarios.sh jornada`.
4. Agregados, desde la carpeta de evidencia:
   - `node aggregate.mjs infra/simulator/runtime/results c29b9d5 normal aggregate.json`
   - `node aggregate.mjs infra/simulator/runtime/results d4b4a7f normal aggregate-p0b.json variants-p0b.json --no-bench`

   El script filtra por `gitSha` y modo, y sustituye los testids. `variants-p0b.json` separa las dos jornadas por su hora de inicio, porque `run-meta` no registra `WAVE_FRONTLOAD`.
5. Re-evaluación del guard: `node guard-reeval.mjs infra/simulator/runtime/results c29b9d5 load/check-generator-guard.mjs > guard-reeval.json`, con el guard de #20.

Los resultados privados por `testid` (summary-export, auditorías, CSV de recursos, run-meta) quedan en `infra/simulator/runtime/results/`, fuera de Git.
