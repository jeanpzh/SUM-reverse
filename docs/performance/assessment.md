# Evaluación de rendimiento del simulador PostgreSQL

**Fecha:** 2026-10-22. **Autor:** principal (modo plan; sin cambios de código ni ejecución de carga).
**Alcance:** `backend/` (persistencia del simulador público), `load/`, `infra/simulator/`, `compose.simulator.yaml` y `evidence/local/simulador-produccion/`.
**Estado de todo el documento:** `local-only`. Describe el simulador propio con datos construidos de forma independiente. No acredita comportamiento, capacidad ni causas de lentitud del SUM institucional ni de su base Oracle.

Documentos relacionados: [estrategia de pruebas](test-strategy.md) · [plan P0–P3](plan.md).

## 0. Convenciones de evidencia

Cada afirmación lleva una de estas etiquetas:

| Etiqueta | Significado |
| --- | --- |
| `observed` | Medición ya registrada en `evidence/local/simulador-produccion/` (fecha 2026-10-19 salvo indicación), con su archivo fuente. |
| `code` | Hecho estático verificable leyendo el código o la configuración citados (con número de línea a 2026-10-22, commit `a17eb3e`). |
| `inferred` | Deducción a partir de `observed` y `code`. Tiene una incertidumbre explícita y un experimento para confirmarla o descartarla. |
| `expected` | Mejora esperada de una propuesta. **No está medida.** Solo P3 puede convertirla en `observed`. |

Las métricas `observed` son agregados de k6 (`summary-export`) y de las auditorías SQL. En ese formato heredado, `thresholds: {"p(95)<2000": true}` significa que el umbral **falló**; `false`, que pasó (comprobado con el control negativo en [fullstack-verification.md](../../evidence/local/simulador-produccion/fullstack-verification.md)).

---

## 1. Arquitectura actual: HTTP → NestJS → PostgreSQL

### 1.1 Topología (`code`)

```
k6 (contenedor, mismo host)
  └─▶ web: nginx  (least_conn, keepalive 32, proxy_read_timeout 30s)     infra/simulator/nginx.conf:20-45
        ├─▶ api-a: NestJS (Express) ─┐  Pool pg max=12, connect timeout 5s  backend/src/persistence/postgres.ts:3-16
        └─▶ api-b: NestJS (Express) ─┤  lock_timeout 5s, statement_timeout 20s
                                     └─▶ postgres:18.6  (configuración por defecto, volumen Docker)
metrics-exporter ──(cada 2 s)──▶ /simulator/metrics de cada API ──▶ Prometheus (scrape 5 s) ──▶ Grafana
k6 ──(remote write 5 s)──▶ Prometheus
```

- `compose.simulator.yaml` no fija `cpus`, `cpuset` ni `mem_limit` para ningún servicio. k6, nginx, ambas API, PostgreSQL, Prometheus y Grafana compiten por las mismas **2 CPU lógicas y 7775 MiB** (`observed`, [results.json](../../evidence/local/simulador-produccion/scenarios-400/results.json) `resources`, `generatorSharesServerHost: true`).
- PostgreSQL arranca sin parámetros propios ([postgres-entrypoint.sh](../../infra/simulator/postgres-entrypoint.sh)). Usa los valores por defecto de la imagen: `shared_buffers` 128 MB, `max_connections` 100, `synchronous_commit=on`, sin `pg_stat_statements` ni `log_lock_waits`.
- El pool admite 12 conexiones por réplica: 24 en total. `SIMULATOR_DB_POOL_MAX` existe como variable, pero ni [run-api.sh](../../infra/simulator/run-api.sh) ni Compose la fijan.
- Cada rotación de campaña ejecuta `docker compose up --force-recreate -d --wait` sin lista de servicios ([rotate-campaign.sh](../../infra/simulator/rotate-campaign.sh), última línea). Eso recrea todos los contenedores, incluido PostgreSQL: cada escenario empieza con la caché de la base y el JIT de Node en frío. Las campañas anteriores se conservan, así que las tablas crecen de una ejecución a otra.

### 1.2 Módulos y responsabilidades (`code`)

| Módulo | Responsabilidad | Observación de diseño |
| --- | --- | --- |
| `SimulatorPublicApiController`, `SimulatorPublicDashboardController` | Validación HTTP (origen, query, body) y resolución del principal | Cada ruta llama `principal()` → `SimulatorAuthService.require()` → **2 consultas** (`authenticateSession` + `sessionExpiry`) antes del trabajo propio ([simulator-auth.service.ts:30-36](../../backend/src/auth/simulator-auth.service.ts)). |
| `SimulatorAuthService` | Login, rate limit, sesión de acceso | El login hace 2 upserts de rate limit (IP y credencial), 1 SELECT de credencial y 1 INSERT de sesión ([simulator-auth.service.ts:18-28,50-61](../../backend/src/auth/simulator-auth.service.ts)). |
| `PostgresEnrollmentStore` | Adaptador de `EnrollmentStore` y de `IdentityProvider`: lecturas consistentes, envío transaccional, sesiones | Interfaz pequeña (7 métodos) e implementación profunda: es el **seam** correcto para optimizar sin tocar controladores, DTO ni contratos. Concentra todo el SQL de la ruta caliente ([postgres-enrollment.store.ts](../../backend/src/persistence/postgres-enrollment.store.ts)). |
| `evaluateAndCommitSubmission` / `commit` | Reglas puras sobre un `RunState` en memoria | Puro y sin I/O: el coste de CPU por envío es despreciable frente al SQL (`inferred`). Usa `state.offer` **completo** (`offeredIds`, horarios) y `state.profiles`, `sessions`, `requests`, `enrollments` del actor ([matricula-regular.service.ts:54-111](../../backend/src/matricula-regular/matricula-regular.service.ts), [rules.ts:211-244](../../backend/src/matricula-regular/rules.ts)). |
| `SimulatorMetricsInterceptor` | Agregados HTTP por minuto | Cada segundo hace un upsert sobre `simulator_http_metrics` desde **cada** réplica, usando el pool compartido ([simulator-metrics.interceptor.ts:59-84](../../backend/src/auth/simulator-metrics.interceptor.ts)). |
| `SimulatorOperationsController.metrics` | Endpoint protegido para el exportador | Cada 2 s y por réplica ejecuta `count(*)` sin filtro de campaña sobre `simulator_requests`, `simulator_enrollments` y `simulator_sessions`, más una agregación de `simulator_http_metrics` y `pg_stat_activity` ([simulator-public-api.controller.ts:134-147](../../backend/src/auth/simulator-public-api.controller.ts)). |

La división en capas es adecuada: el controlador valida, las reglas son puras y el store aísla el SQL. **No se propone ninguna refactorización arquitectónica.** Las optimizaciones caben dentro de la implementación de `PostgresEnrollmentStore` y de `SimulatorAuthService`, detrás de sus interfaces actuales.

### 1.3 Ruta de envío: `submit` → `submitTransaction` (`code`)

[postgres-enrollment.store.ts:98-158](../../backend/src/persistence/postgres-enrollment.store.ts):

| # | Sentencia | Lock adquirido | Línea |
| --- | --- | --- | --- |
| — | 2 consultas de autenticación (fuera de la transacción, cada una con su propio checkout del pool) | — | auth `:195-205` |
| 1 | `pool.connect()` (cola del pool; espera máxima de 5 s y luego error) | — | `:113` |
| 2 | `BEGIN` (READ COMMITTED) | — | `:114` |
| 3 | `SELECT run_id,status,config FROM simulator_campaigns … FOR SHARE` | Lock compartido sobre **la única fila de campaña**, que comparten todos los envíos. Trae `config` (JSONB con `{profiles, offer}`), que **no se usa** | `:115` |
| 4 | `SELECT … simulator_actors … FOR UPDATE` | Exclusivo por actor | `:118` |
| 5..4+k | `SELECT … simulator_sections … FOR UPDATE`, una sentencia por sección y en orden global | Exclusivo por sección (**fila caliente**) | `:120` |
| +7 | `loadRunState`: actor, perfiles, **todas las secciones de la campaña**, sesiones académicas, solicitudes, matrícula con `jsonb_agg` y reportes | — | `:121`, `:217-243` |
| — | Si `requestId` ya existe: replay, `COMMIT` | (las secciones **ya estaban bloqueadas**) | `:122-126` |
| +1 | `INSERT simulator_requests` | FK → `KEY SHARE` sobre actor | `:132` |
| +1 | (aceptada) `INSERT simulator_enrollments` | | `:135` |
| +2k | (aceptada) por ítem: `INSERT enrollment_items` y `UPDATE sections SET occupied=occupied+1 WHERE occupied<capacity` | | `:136-140` |
| +1 | (aceptada) `INSERT simulator_reports` | | `:141` |
| +k | `SELECT occupied` por cada sección modificada (verificación) | | `:143-149` |
| +1 | `COMMIT` (espera el flush del WAL: `synchronous_commit=on`) | libera todos | `:150` |

Con k = 3 secciones, la transacción ejecuta **26 sentencias** si la solicitud se acepta, **15** si se rechaza y **14** si es un replay. De ellas, **≈22, 10 y 9** se ejecutan **después de obtener el primer lock de sección**, sin contar el `COMMIT`, que se suma a ellas, que incluye el fsync del WAL. Cada sentencia es un viaje de ida y vuelta Node ↔ PostgreSQL. Todas las secciones elegidas permanecen bloqueadas durante ese tiempo.

`submit` reintenta hasta 3 veces ante `40P01`, `40001`, `55P03` (`lock_timeout`) o `57014` (`statement_timeout`), con un backoff de 25–95 ms. Cada reintento vuelve a la cola del pool. Al agotarse responde 503 `STORAGE_UNAVAILABLE` (`:98-107`). Un timeout del pool (5 s) también termina en 503, con el mismo código (`:152-156`).

### 1.4 Rutas de lectura (`code`)

- **Dashboard** (`readDashboardSnapshot`, `:45-62`): `BEGIN REPEATABLE READ READ ONLY`, sesión académica, campaña (con `config`), las 7 consultas de `loadRunState` y `COMMIT`. Con las 2 de autenticación suman **≈13 sentencias** por petición, más un checkout del pool para la transacción y uno por cada consulta de autenticación.
- **Contexto** (`readSnapshot`, `:30-43`): estructura equivalente, ≈12 sentencias.
- **Resultado** y **reporte**: 1–2 consultas indexadas.

### 1.5 Índices (`code`, [001_simulator.sql](../../backend/migrations/001_simulator.sql))

Las búsquedas de la ruta caliente están cubiertas por PK o UNIQUE (`simulator_requests` PK `(campaign_id, actor_id, request_id)`, `simulator_enrollments` UNIQUE `(campaign_id, actor_id)`, `simulator_sections` PK, `simulator_sessions` PK por hash), con dos excepciones:

- `simulator_academic_sessions` solo tiene PK `(session_id)`. La consulta `WHERE campaign_id=$1 AND actor_id=$2` de `loadRunState` (`:221`), que se ejecuta **dentro** del intervalo con secciones bloqueadas, no tiene índice: la FK no lo crea. Recorre las sesiones de **todas** las campañas conservadas, y su coste crece con cada ejecución de la batería.
- `simulator_rate_limits` y `simulator_http_metrics` no tienen limpieza. Crecen sin límite, pero se consultan por PK; el impacto es bajo (`inferred`).

### 1.6 Concurrencia e invariantes que cualquier cambio debe preservar (`code` + contratos)

Fuentes: [SIM-PUBLIC-1](../reverse-engineering/contracts/local-api/simulador-produccion.md) y [el plan del simulador](../reverse-engineering/plans/simulador-postgresql-concurrencia.md) (líneas 61–69 y 104–112).

1. **Orden de locks:** campaña (compartido) → actor → secciones adquiridas **una a una** en orden `(campaign, course, section)`. El plan registra la decisión de **no** confiar en `ORDER BY` de una sola sentencia para fijar el orden real de adquisición (línea 106). Revisarla exige una decisión explícita.
2. **El cierre de campaña** excluye los commits posteriores: los envíos toman `FOR SHARE` y el cierre necesita un lock exclusivo (línea 104).
3. **Deduplicación durable** por `(campaignId, actorId, requestId)` con payload canónico. `REQUEST_CONFLICT` responde 409. El replay devuelve el resultado inmutable, también después del cierre.
4. **Atomicidad:** la solicitud, la matrícula, los ítems, los contadores y el reporte se confirman juntos. Ningún 5xx garantiza por sí mismo que no hubo commit.
5. **Prohibido:** caché de ocupación para decidir la aceptación, advisory locks y mutex de proceso como garantía de cupos (SIM-PUBLIC-1 «Compatibilidad»; plan línea 69).
6. **Durabilidad:** las pruebas de caída (A4/A5, [crash-result.json](../../evidence/local/simulador-produccion/crash-result.json)) recuperan desde la base un resultado ya confirmado. Para eso se necesita `synchronous_commit=on`.

---

## 2. Benchmarks existentes

### 2.1 Batería de 400 actores, modo rápido (`observed`, 2026-10-19)

Fuente: [scenarios-400/results.json](../../evidence/local/simulador-produccion/scenarios-400/results.json) y [verification.md](../../evidence/local/simulador-produccion/scenarios-400/verification.md). Ejecución única por escenario (n = 1), `SCENARIO_QUICK=1`, barrera de 20 s, escalones de 5 s, think time de 0,2–0,5 s.

Latencias de la operación con umbral (`submit` o `read`), en ms:

| Escenario | Perfil / secciones disputadas | Admitidas / solicitudes | med | p95 | p99 | máx | Umbral fallido |
| --- | --- | --- | --- | --- | --- | --- | --- |
| race | shared: 3 secciones, 10 plazas | 10 / 400 | 2103 | **3294** | 3380 | 3532 | p95 |
| last-seat | 1 plaza libre | 1 / 400 nuevas | 2338 | **3144** | — | 3673 | p95 |
| ample | 3 secciones compartidas, todas admitidas | 400 / 400 | 2739 | **4467** | — | 4785 | p95 |
| mixed | ample + lecturas en oleadas | 400 / 400 | 2576 | **4531** | **>5000** | 7709 | p95 y **p99** |
| multi-uniform | 5 cohortes disjuntas de 80 | 100 / 400 | 1829 | **2572** | — | 2717 | p95 |
| multi-hotspot | cohorte 0 = 320 actores; 4 × 20 | 100 / 400 | 2003 | **3594** | — | 3843 | p95 |
| stress (rápido) | lecturas, rampa a 400 VU | — | 1295 | 1671 | <5000 | 1998 | — |
| soak (30 s, no es soak) | idem | — | 1239 | 1609 | <5000 | 1867 | — |
| reads | llegada abierta, 50 it/s | — | 5,9 | 18,6 | — | 44 | — |

Sin SLO HTTP declarado: `login` tuvo un p95 de 1972 ms con 400 logins simultáneos; `retry`, un p95 global de 10 676 ms y 662 respuestas transitorias; `resilience`, un p95 de 1713 ms. Todas las auditorías SQL dieron **0 violaciones** (`observed`). **La corrección funcional pasa, pero eso no acredita el rendimiento.**

Throughput observado: stress ≈ 210 peticiones/s y soak ≈ 214/s con 400 VU en modelo cerrado; mixed ≈ 197/s; reads ≈ 66/s en modelo abierto (`observed`, `http_reqs.rate`).

### 2.2 Referencias previas (`observed`, 2026-10-19)

| Fuente | Configuración | p95 submit | máx |
| --- | --- | --- | --- |
| [concurrency-results.json](../../evidence/local/simulador-produccion/concurrency-results.json) | race, 100 actores, 10 rondas | 698–794 ms | ≈727–815 ms |
| [observability/enrollment-summary.json](../../evidence/local/simulador-produccion/observability/enrollment-summary.json) | race, 100 actores | 733 ms | 760 ms |
| [load-results.json](../../evidence/local/simulador-produccion/load-results.json) `distributed` | 100 actores, **300 secciones**, sin disputa, 100 admitidas | 1045 ms | 1061 ms |
| [load-results.json](../../evidence/local/simulador-produccion/load-results.json) `reads` | llegada abierta hasta 50 it/s | 21 ms (lectura) | 359 ms |

### 2.3 Lo que la evidencia actual **no** permite afirmar

- **Uso real de CPU durante la carga.** El valor de CPU en [operational-metrics-result.json](../../evidence/local/simulador-produccion/scenarios-400/operational-metrics-result.json) (≈0,005) y la cola de 200/199 son una instantánea posterior a la ejecución. No sirven como evidencia de saturación ni de holgura.
- **El p95 del event loop.** Se acumula durante toda la vida del proceso con una resolución de 20 ms ([simulator-metrics.interceptor.ts:12](../../backend/src/auth/simulator-metrics.interceptor.ts)). No mide la ventana de la ráfaga.
- **La causa de cada 503.** Timeout del pool, `lock_timeout` y `statement_timeout` llegan todos como `STORAGE_UNAVAILABLE`.
- **La varianza.** n = 1 por escenario en la batería de 400.
- **Un soak real ni la saturación del generador.** No se ejecutó un soak de 30 min y no se midió la CPU de k6.

### 2.4 Perfil de demanda FISI (`testimony`, aportado por el operador el 2026-10-22)

**Fuente:** conteos agregados por el operador a partir del PDF institucional público [Ranking de promedio ponderado por escuelas, matrícula del semestre 2026-I](https://sistemas.unmsm.edu.pe/site/images/Ranking_promedio_ponderado_por_Escuelas_-_Matr%C3%ADcula_Semestre_2026-I.pdf). El operador verificó que contabilizó los 1422 registros. El agente **no descargó** el PDF (lista alumnos) y solo usa estos agregados. Los cortes de PP coinciden con los turnos FISI 2026-II del dossier ([as-is-process.md](../domain/fisi/2026-II/as-is-process.md), fuente F6). Los conteos son de 2026-I. **Supuesto `local-only`:** la distribución de PP es parecida entre semestres. Este dato sirve para dimensionar el simulador; no acredita el comportamiento del SUM.

| Franja (lunes de matrícula) | PP desde | Acumulado | **Nuevos al abrir** | Sistemas | Software | Ciencia de la Computación |
| --- | --- | --- | --- | --- | --- | --- |
| 06:00–08:00 | 17.00 | 24 | 24 | 16 | 7 | 1 |
| 08:00–10:00 | 16.00 | 137 | 113 | 67 | 40 | 6 |
| 10:00–12:00 | 15.00 | 430 | 293 | 135 | 137 | 21 |
| 12:00–14:00 | 14.00 | 937 | **507** | **286** | 203 | 18 |
| 14:00–16:00 | 13.00 | 1250 | 313 | 201 | 96 | 16 |
| 16:00–18:00 | 12.00 | 1367 | 117 | 77 | 34 | 6 |
| 18:00–20:00 | 11.00 | 1398 | 31 | 16 | 12 | 3 |
| 20:00–22:00 | 10.00 | 1411 | 13 | 3 | 7 | 3 |
| 22:00–23:59 | 0.00 | 1422 | 11 | 3 | 5 | 3 |
| **Total** | | | **1422** | 804 | 541 | 77 |

- **Población total:** 1422 alumnos con PP en tres escuelas, más la **Escuela de Inteligencia Artificial**, cuya cantidad no consta en la fuente (vacío; parámetro de los perfiles). Este dato sustituye la estimación previa de ≈2000.
- **La población no es concurrente.** El pico ocurre al abrir cada franja, cuando entran los recién habilitados más los rezagados de franjas anteriores (cantidad desconocida).
- **Pico:** franja de las 12:00, con **507** alumnos nuevos (Sistemas 286, Software 203, Ciencia de la Computación 18). Le siguen las 14:00 (313) y las 10:00 (293).
- **Vacíos:** qué fracción de cada franja envía en los primeros segundos; cuántos rezagados se acumulan; qué parte de las secciones disputadas es común entre escuelas.

---

## 3. Diagnóstico de los seis escenarios fallidos

### 3.1 Modelo cuantitativo (`inferred`)

En los escenarios de matrícula, los 400 envíos parten en una ventana de menos de 1 s (barrera). El último envío de una cohorte que comparte secciones espera, en el mejor caso, a que se completen todos los anteriores. Por eso **máximo ≈ N_cohorte × t_cs**, donde t_cs es el tiempo que una transacción mantiene bloqueadas las secciones.

| Fuente | N en la cohorte caliente | máx (ms) | t_cs estimado |
| --- | --- | --- | --- |
| race, 100 | 100 | ≈757 | **≈7,6 ms** |
| race, 400 | 400 | 3532 | **≈8,8 ms** |
| last-seat, 400 | 400 (+9 previas) | 3673 | ≈9,2 ms |
| multi-hotspot, cohorte 0 | 320 | 3843 | ≈12 ms |
| ample, 400 (todas admitidas) | 400 | 4785 | **≈12 ms** |

- **Escala casi lineal.** De 100 a 400 actores, el p95 de race pasa de ≈0,73 s a 3,29 s (×4,5). Es lo que predice la serialización y no lo que predice un coste fijo.
- **La ruta de aceptación es más larga.** ample (≈22 sentencias bajo lock) da ≈12 ms; race (≈390 rechazos con ≈10 sentencias) da ≈8,8 ms. Con un ajuste de dos puntos, t_cs ≈ 6,1 ms fijos (incluido el `COMMIT`) + 0,27 ms por sentencia. **La componente fija domina.** Es compatible con el coste del `COMMIT` (fsync del WAL), con el traspaso del lock entre procesos y con la planificación de CPU en un host sobresuscrito. Hasta medirla en P1, es una hipótesis: el ajuste usa dos puntos, y el desfase de inicio (hasta ≈150 ms) y la cola del pool lo contaminan.
- **Además existe un límite global.** multi-uniform tiene 5 cohortes disjuntas de 80; por bloqueo, cada cohorte necesitaría solo ≈80 × 9 ms ≈ 0,7 s. Aun así, el máximo fue 2,7 s: ≈148 envíos/s en total. `distributed`, sin ninguna disputa, rindió ≈94 envíos/s con un catálogo de 300 secciones. Por lo tanto **hay un techo de throughput independiente de los locks** (X_global ≈ 100–150 envíos/s en este host), que depende al menos del número de sentencias y del tamaño del catálogo leído por envío.

Modelo de trabajo: **tiempo de vaciado de la ráfaga ≈ max(N_caliente × t_cs, N_total / X_global)**.

### 3.2 Presupuesto para cumplir el SLO (`inferred`, objetivo medible)

Para p95 < 2 s en una ráfaga de N envíos simultáneos sobre **una** cohorte, hace falta t_cs ≤ 2000 / (0,95·N) y X_global ≥ 0,95·N / 2 s:

| N actores | t_cs máximo | X_global mínimo |
| --- | --- | --- |
| 100 | 21 ms | 48 envíos/s |
| 200 | 10,5 ms | 95/s |
| 286 (cohorte Sistemas, 12:00) | 7,4 ms | 136/s |
| 400 | 5,3 ms | 190/s |
| **507 (pico FISI, 12:00; objetivo de aceptación)** | **4,2 ms** | **241/s** |
| 800 | 2,6 ms | 380/s |
| 1000 | **2,1 ms** | **475/s** |

Hoy t_cs ≈ 8,8–12 ms y X_global ≈ 100–150/s. **Para el pico FISI de 507 (§2.4) sobre una sección hay que reducir t_cs a algo más de un tercio (≤ 4,2 ms) y duplicar X_global (≥ 241/s).** Si se reparte la demanda por escuela, el caso más exigente es la cohorte de Sistemas (286): t_cs ≤ 7,4 ms, todavía por debajo de lo medido hoy. Con 800–1000 actores en una única sección caliente, t_cs ≤ 2,1–2,6 ms puede ser inalcanzable si el fsync del `COMMIT` ocurre dentro del intervalo bloqueado y cuesta ≳2 ms en el almacenamiento del host.

**Decisión D-1 (usuario, 2026-10-22):** 800 y 1000 son pruebas de estrés. Si no cumplen, el incumplimiento medido se acepta y se documenta. Revisar el algoritmo de locks (P2-11) solo se activa si P1 demuestra que ni siquiera el pico de 507 es alcanzable con el algoritmo actual. No se resolverá modificando umbrales.

### 3.3 Hipótesis priorizadas

Formato: si la hipótesis es cierta → predicción → experimento (detallado en [test-strategy.md §6](test-strategy.md#6-experimentos-de-diagnóstico)).

| ID | Hipótesis | Estado | Predicción falsable | Experimento |
| --- | --- | --- | --- | --- |
| **H1** | La serialización sobre filas calientes de `simulator_sections`, con un intervalo bloqueado largo (10–22 sentencias + `COMMIT`), domina la latencia de race, last-seat, ample y multi-hotspot | `inferred` (fuerte: escala lineal y orden por sentencias) | El tiempo medido de espera de locks (`Lock:transactionid`/`tuple`) explica más del 60 % del p95. Duplicar el número de cohortes con el pool fijo reduce el máximo ≈ ×2 hasta llegar a X_global | E1, E2 |
| **H2** | La componente fija de t_cs (≈6 ms) procede del `COMMIT` (fsync del WAL) o de la planificación de CPU, no de los viajes de ida y vuelta | `inferred` (ajuste de dos puntos) | El histograma de `COMMIT` en la ruta de envío tiene una mediana ≥3 ms. `pg_test_fsync` da ≥2 ms por flush. Con la CPU aislada del generador, t_cs baja ≥30 % | E3, E4 |
| **H3** | Las conexiones que esperan un lock ocupan el pool (24) y bloquean en cabeza de cola (*head of line*) a otras cohortes, a la autenticación y a las lecturas. La cola de ≈188 por API es un **síntoma** de H1 | `inferred` | Durante la ráfaga, la espera de adquisición del pool en las rutas `read` y `auth` supera los 500 ms. En multi-hotspot, las cohortes 1–4 esperan en el pool aunque sus secciones estén libres | E5 |
| **H4** | El techo X_global depende del número total de sentencias por envío (26/15) y del volumen leído: `loadRunState` trae todas las secciones de la campaña y `config` (JSONB con perfiles y oferta) aunque no se use | `inferred` (multi-uniform ≈148/s; distributed con 300 secciones ≈94/s) | `pg_stat_statements` muestra el coste de `loadRunState` y del SELECT de campaña entre los primeros 3 por tiempo total. El throughput de vaciado de multi-uniform crece al reducir sentencias, sin cambiar locks | E6, E7 |
| **H5** | La ruta de lectura (stress/soak) está saturada: ≈13 sentencias y 3 checkouts del pool por dashboard, con ≈210 rps de techo. En modelo cerrado, el p95 queda fijado por la ley de Little: R ≈ N/X − Z ≈ 400/210 − 0,35 ≈ 1,55 s | `inferred` (reads a 66 rps da 18 ms; stress a 210 rps da 1,67 s) | En llegada abierta, el p95 se dispara en una rodilla entre 100 y 210 rps. Con 800 VU y el mismo think time, el p95 supera los 3 s si X no cambia | E8 |
| **H6** | Generador y SUT comparten 2 CPU: parte de la latencia es de k6 o de la planificación, no del servidor | `inferred` (no hay métricas de k6) | Con cpusets separados, el p95 cae de forma apreciable sin cambiar código. Durante la ráfaga, `http_req_blocked`/`connecting` o la CPU de k6 se acercan a una CPU completa | E4 |
| **H7** | La consulta de `simulator_academic_sessions` sin índice, dentro del intervalo bloqueado, y el crecimiento por campañas conservadas producen una deriva entre ejecuciones | `code` (falta el índice); impacto `inferred`, probablemente bajo | `EXPLAIN` muestra Seq Scan. t_cs aumenta con el número de campañas retenidas | E9 |
| **H8** | Mixed incumple también el p99 porque los envíos llegan en oleadas de ≈40 (fases del VU) mientras ≈160 rps de lecturas compiten por el pool. El think time de 0,2–0,5 s del modo rápido intensifica el efecto (1–5 s en modo normal) | `inferred` | Mixed en modo normal reduce el p99 del envío. La espera del pool de las lecturas sube en cada oleada | E5, E10 |
| **H9** | Los replays bloquean las secciones antes de detectar la idempotencia (`:120-126`). En retry, los 800 replays se serializan sin necesidad junto a los envíos nuevos | `code`; impacto `inferred` | Con el replay resuelto antes de bloquear las secciones, el p95 de retry y las respuestas transitorias bajan; las auditorías no cambian | E11 |
| **H10** | El login de las 400 VU incrementa una sola fila de rate limit por IP: `request.ip` es la del nginx y no hay `trust proxy`. Es un artefacto de la topología de prueba | `code`; impacto `inferred`, bajo (un upsert en autocommit) | La espera `Lock:tuple` sobre `simulator_rate_limits` durante la ola de login supera el 30 % del p95 de login | E12 |
| **H11** | Hay contención MultiXact por el `FOR SHARE` simultáneo de todos los envíos sobre la fila de campaña | `inferred`, baja probabilidad | Aparecen esperas `LWLock:MultiXact*` en el muestreo | E1 (subproducto) |
| **H12** | La observabilidad añade carga al pool: un upsert por segundo y por réplica sobre las mismas filas de `simulator_http_metrics` y `count(*)` sin filtro cada 2 s | `code`; impacto `inferred`, bajo | Desactivar el exportador durante race cambia el p95 menos que el ruido base | E13 |

**Causas confirmadas:** ninguna en sentido estricto. H1 es la mejor sostenida. H7, H9, H10 y H12 son hechos de código confirmados, pero su impacto no está medido.

### 3.4 Atribución por escenario fallido (`inferred`)

| Escenario | Factores principales | Secundarios |
| --- | --- | --- |
| race | H1 (400 en la misma cohorte) | H2, H3, H6 |
| last-seat | H1 (idéntico a race; un solo ganador) | H2, H6 |
| ample | H1 con la ruta larga de aceptación (t_cs ≈12 ms) | H2, H4 |
| mixed | H1 + H3 + H8 (oleadas y lecturas en el mismo pool) | H5, H6 |
| multi-uniform | H4/X_global (las cohortes no se bloquean entre sí) | H3, H6 |
| multi-hotspot | H1 sobre la cohorte de 320 + H3 (HOL de las cohortes pequeñas) | H4 |

---

## 4. Riesgos de método en los benchmarks actuales

1. **El generador comparte host y CPU** con el SUT y no hay medición de la CPU de k6 (H6).
2. **n = 1** por escenario a 400: no se puede distinguir una mejora del ruido.
3. **Arranque en frío en cada escenario** (`--force-recreate` de todos los servicios) y **crecimiento de tablas** por campañas conservadas: los resultados dependen del orden de ejecución.
4. **El modo rápido cambia la carga.** El think time de mixed baja de 1–5 s a 0,2–0,5 s; «soak» dura 30 s; las rampas de stress duran 5 s. No hay que comparar resultados rápidos con normales.
5. **Ráfagas más cortas que la resolución de las métricas.** La ráfaga dura 3–5 s, el exportador muestrea cada 2 s y Prometheus cada 5 s. Los gauges instantáneos pueden no registrar el pico.
6. **El modelo cerrado acopla latencia y carga.** En stress y soak, el p95 depende de VU/think time (ley de Little). No mide la capacidad en una tasa de llegada fija.
7. **La barrera es una prueba de impulso.** Con ella, el p95 equivale casi al tiempo de vaciado de N envíos. Es legítima para la apertura de matrícula, pero no sustituye una curva de throughput frente a latencia.

## 5. Conclusiones

1. La causa más probable de los seis incumplimientos es **H1 (serialización con un intervalo bloqueado largo) sumada a un techo de throughput global (H4/H6)**, con el bloqueo en cabeza de cola del pool (H3) como amplificador. Falta confirmarla con instrumentación (P1).
2. Antes de optimizar hay que **separar la componente fija de t_cs** (H2: commit, fsync o CPU) de la variable (sentencias bajo lock). Si domina el fsync, reducir sentencias no basta para 800–1000 actores.
3. Hay mejoras de **bajo riesgo** que preservan contratos: replay antes de bloquear secciones, índice en sesiones académicas, autenticación en una consulta, no leer `config`, `RETURNING` en lugar de la verificación con SELECT. La reestructuración del intervalo bloqueado es la de **mayor impacto** esperado. Sus impactos son `expected` hasta P3.
5. **Objetivo de aceptación:** el pico FISI de 507 envíos simultáneos (§2.4), con 800 y 1000 como estrés. Se suma un escenario de jornada completa (1422 alumnos más la Escuela de IA, en 9 oleadas).
6. Opciones **descartadas** por chocar con invariantes o por falta de evidencia: `synchronous_commit=off`, caché de ocupación o rechazo sin lock basado en ocupación leída fuera del lock (requiere una decisión de contrato), advisory locks o mutex, SERIALIZABLE, JWT o caché de sesiones (rompen la revocación inmediata exigida por SIM-PUBLIC-1) y nuevas tecnologías (colas, Redis, PgBouncer) sin una medición que las justifique. Detalle en [plan.md §P2](plan.md#p2--optimizaciones-incrementales-basadas-en-evidencia).
