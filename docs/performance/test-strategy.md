# Estrategia de pruebas de rendimiento (k6 + observabilidad)

**Fecha:** 2026-10-22. **Autor:** principal. **Estado:** propuesta en modo plan. No se ejecutó ninguna prueba para redactarla.
**Alcance:** simulador propio `local-only` con datos construidos de forma independiente. Ninguna prueba se dirige al SUM institucional ni a snapshots privados (`datos-reales/`). k6 conserva la validación de destino actual: `web` o loopback ([common.js:21-32](../../load/common.js)).

Relacionados: [evaluación](assessment.md) · [plan P0–P3](plan.md).

## 1. Principios no negociables

1. **Umbrales fijos.** Se mantienen p95 < 2 s y p99 < 5 s donde ya existen: `http_req_duration{operation:submit}` en [enrollment.js:26](../../load/enrollment.js) y [mixed.js:33](../../load/mixed.js), y `{operation:read}` en [sessions.js:45](../../load/sessions.js) y [reads.js:40](../../load/reads.js). Los umbrales de corrección (`checks rate==1`, conteos exactos, `dropped_iterations==0`) también se mantienen. Las variables `ENROLLMENT_P95_MS` y similares no se usan en ejecuciones de aceptación.
2. **SLO nuevos (decisión D-2 del usuario, 2026-10-22).** Se aplican los mismos valores, p95 < 2 s y p99 < 5 s, a:
   - **el login:** `http_req_duration{name:auth-login}` en `login.js` y en el escenario de jornada;
   - **el envío en carga sostenida:** `{operation:submit}` en `enrollment-open.js`.

   retry y resilience siguen con `performancePassed: null`: su tráfico incluye reintentos provocados a propósito y caídas inyectadas, así que su latencia es informativa. Toda otra métrica nueva sin SLO aprobado es **informativa y no bloqueante**, y se etiqueta `local-only`.
3. **La carga no se reduce para aprobar.** No se alargan la barrera ni su tolerancia, no se excluyen peticiones lentas ni se reclasifican 5xx como esperados. 500, 401 y 403 nunca cuentan como transitorios.
4. **Corrección y rendimiento se reportan por separado.** La auditoría SQL es obligatoria tras cada ejecución con escrituras. Un verde de rendimiento sin auditoría no cuenta.
5. **Una ejecución vale solo si es válida.** Debe cumplir: generador no saturado (§5.3), remote write sin fallos, tamaños de tabla y entorno registrados, y huella de fuentes registrada.

## 2. Evaluación de la metodología actual

| Aspecto | Estado actual (`code`/`observed`) | Problema | Propuesta |
| --- | --- | --- | --- |
| Modelo de carga de matrícula | `per-vu-iterations` y barrera: N envíos casi simultáneos | Es un **impulso**: el p95 ≈ tiempo de vaciado de N. No mide capacidad sostenida | Mantenerlo como «impulso de apertura» con el umbral actual. Añadir una curva en llegada abierta (`ramping-arrival-rate`) **informativa** para obtener la rodilla latencia/throughput |
| stress / soak | `ramping-vus` hasta 400 VU, modelo cerrado; en modo rápido, rampas de 5 s y soak de 30 s | El p95 depende de VU/think time (ley de Little). «Stress» no supera 400; el «soak» rápido no es un soak | stress: escalones por tasa de llegada hasta romper. soak: 30 min o más, sin modo rápido. Reportar VU, tasa ofrecida y throughput logrado |
| reads | `ramping-arrival-rate` hasta 50 it/s, `maxVUs = actorCount` | Carga ligera (≈66 rps); no encuentra la saturación | Barrido abierto 25 → 300 it/s con `maxVUs` suficiente; `dropped_iterations` como señal de saturación del cliente |
| mixed | `constant-vus` 400; acciones en 10 fases (≈40 envíos por oleada) | Las oleadas son implícitas; el modo rápido cambia el think time | Documentar la oleada como parte del diseño. Solo el modo normal cuenta para la aceptación. Añadir una variante abierta con mezcla fija de tasas |
| Repeticiones | n = 1 | No se puede separar señal de ruido | n = 5 en la línea base de P0; n ≥ 3 en comparaciones de P2/P3 |
| Aislamiento | k6 en el mismo host y sin límites de CPU | Contaminación del generador (H6) | Cpusets separados (§4) y un *guard* de saturación (§5.3) |
| Estado inicial | Recreación completa y tablas que acumulan campañas | Arranque en frío y deriva entre ejecuciones | Precalentamiento explícito; registro de filas y campañas por ejecución; series comparativas sobre un volumen recién creado |
| Métricas | Duración HTTP total por operación | No atribuye el tiempo a pool, locks, commit o generador | Desglose de §5 |
| Idempotencia | retry y recovery verifican funcionalidad | Sin una medida de latencia estable bajo replays | Métrica informativa de la latencia del replay y de los transitorios por causa |
| Recuperación | resilience: caída de API y de la base | Correcto. La gracia de recuperación ya está acotada | Conservar. Añadir el tiempo hasta volver al p95 base, informativo |

## 3. Taxonomía de pruebas y modelos de carga

**Vocabulario obligatorio en los informes:**

- **VUs concurrentes:** usuarios virtuales activos (modelo cerrado: cada VU espera respuesta y think time antes de seguir).
- **Tasa de llegada:** iteraciones iniciadas por segundo, independiente de la latencia (modelo abierto, `*-arrival-rate`).
- **Throughput:** peticiones o envíos **completados** por segundo (`http_reqs.rate` por operación, o conteo de la auditoría / duración).
- **Actores:** identidades sintéticas de la campaña (`actorCount`). Que haya 1000 actores no implica 1000 VU simultáneas.

| Tipo | Objetivo | Script / executor | Umbral de aceptación | Parámetros |
| --- | --- | --- | --- | --- |
| **Smoke / baseline** | Comprobar que el sistema y el arnés funcionan y obtener la latencia sin contención | reads con llegada abierta baja (10 it/s, 2 min); race con 100 actores | Umbrales vigentes | n = 5 en la línea base de P0 |
| **Impulso de apertura** (spike de matrícula) | Medir la apertura simultánea de matrícula | `enrollment.js` con barrera, perfiles shared/last-seat/ample/multi-* | `submit` p95 < 2 s, p99 < 5 s y conteos exactos (vigentes) | Actores 100/200/400/**507**/800/1000 |
| **Load (sostenida)** | Comportamiento a una tasa objetivo constante | Nuevo `enrollment-open.js` (`constant-arrival-rate` de envíos) y `reads.js` | `submit` p95 < 2 s y p99 < 5 s (D-2); en lectura, el umbral vigente | Tasa = 25/50/75 % de la rodilla |
| **Stress (rotura)** | Encontrar la rodilla y el punto de rotura | `ramping-arrival-rate` en escalones de 60 s hasta superar el p95 o tener `dropped_iterations > 0` | Informativo: se reporta la tasa máxima con p95 < 2 s | Escalones de +25 it/s |
| **Franja FISI** (impulso realista) | Apertura de una franja con cohortes por escuela | `enrollment.js` con el perfil nuevo `fisi-schools` (cohortes disjuntas por escuela, proporciones de la franja; Escuela de IA como parámetro) | `submit` p95 < 2 s, p99 < 5 s y conteos exactos | Pico 12:00: 507 = 286/203/18 |
| **Jornada FISI** | Las 9 franjas como oleadas sucesivas, tiempo comprimido | Nuevo `jornada.js`: oleadas de 24/113/293/507/313/117/31/13/11 (+IA), intervalo `WAVE_INTERVAL` (120 s por defecto, equivale a 2 h), fracción inicial `WAVE_FRONTLOAD` (barrido 1,0 y 0,5); cada actor inicia sesión en su oleada y envía una vez | `submit` y `auth-login` p95 < 2 s, p99 < 5 s; auditoría exacta | 1422 + IA actores (requiere ampliar el límite, P0-07) |
| **Spike de lectura** | Ráfaga de lecturas sobre una línea base | reads: 20 → 200 → 20 it/s | Umbral de lectura vigente | — |
| **Soak** | Deriva: memoria, conexiones, crecimiento de tablas, renovación de sesiones (TTL 15 min) | `sessions.js` en modo normal ≥ 30 min | Umbral de lectura vigente y deriva < 20 % (informativa) | Sin modo rápido |
| **Concurrencia / integridad** | Cupos exactos con disputa | race, last-seat, multi-hotspot | Conteos exactos y auditoría con 0 violaciones | Igual que el impulso |
| **Idempotencia** | Replay y conflicto bajo carga | retry, recovery | Conteos funcionales (vigentes); latencia informativa | — |
| **Recuperación** | Caídas de API y de la base | resilience y el arnés de crash | Funcionales (vigentes); tiempo de recuperación informativo | — |

Los nuevos scripts abiertos (`enrollment-open.js`) **no** sustituyen a la barrera ni relajan sus umbrales. Responden a otra pregunta: la capacidad sostenida.

## 4. Entornos y hardware controlado

**Decisión D-3 (usuario, 2026-10-22):** el entorno disponible es la VM actual de **2 vCPU y 8 GB**.

| Entorno | Uso | Configuración |
| --- | --- | --- |
| **ENV-H (VM de 2 vCPU y 8 GB)** | **Entorno principal** de P0–P3. Todas las comparaciones antes/después se hacen dentro de ella | Sin cpusets fijos (fijarlos dejaría el SUT con 1 CPU). Grafana se detiene durante la medición; Prometheus sigue activo para el remote write. El resumen de k6 y la auditoría son la fuente de verdad. Los resultados se marcan `generatorSharesServerHost: true` y **no** se presentan como capacidad absoluta |
| ENV-H con cpusets (diagnóstico) | Solo para el experimento E4 | k6 en la CPU 0 y el SUT en la 1, mediante el override `compose.perf.yaml` |
| ENV-C (opcional) | Números absolutos, si más adelante se alquila temporalmente una VM de ≥ 8 vCPU para P0-06 y P3-01 | `cpuset` por servicio: k6 0–1, PostgreSQL 2–3, api-a 4, api-b 5, el resto 6–7. Se registran CPU, disco y `pg_test_fsync`. No se compara con ENV-H |

En ENV-H, el bucle principal de medición es el arnés `submit-bench` (sin HTTP ni k6), que elimina el ruido del generador. k6 queda como prueba de aceptación, con el guard de §5.3. Se añade el experimento E14 (una réplica de API frente a dos), porque en 2 vCPU dos procesos Node más PostgreSQL y k6 pueden competir más de lo que ayudan. La memoria no es un recurso crítico: cada API usa ≈110 MB.

## 5. Métricas

### 5.1 Lado cliente (k6)

- Siempre por `operation` y `name`: `http_req_duration` (med, p90, p95, p99, máx), `http_req_waiting` (TTFB), `http_req_blocked`, `http_req_connecting`, `http_req_failed`, `http_reqs`, `iteration_duration`, `dropped_iterations`, `vus` y `vus_max`.
- Matrícula: `submit_start_offset_ms` (ya existe) y, como nuevas, `burst_drain_ms` (último envío completado menos `notBefore`) y `burst_throughput` (envíos / vaciado). Ambas son informativas.
- Etiquetas acotadas (ya existentes): `testid`, `load_scenario`, `population`, `run_mode`, `profile`. Se añaden `env` (H/C) y `rep` (1..n). **Nunca** actor, sesión, credencial ni URL con identidad.

### 5.2 Lado servidor (instrumentación mínima, P1)

Se expone por el endpoint protegido existente `/simulator/metrics` y el exportador. No se añade tecnología nueva.

| Métrica | Tipo | Atribuye latencia a |
| --- | --- | --- |
| `pool_acquire_seconds{route_group}` (read, submit, auth, ops) | Histograma | Cola del pool (H3) |
| `pool_waiting_max` y `pool_total_max` desde el último scrape | Gauge de pico | Picos más cortos que el scrape (§4 de la evaluación) |
| `submit_phase_seconds{phase}`: `pre_lock` (BEGIN → actor bloqueado), `section_lock_wait` (petición → obtención del primer y del último lock de sección), `critical` (primer lock de sección → antes de COMMIT), `commit`, `total` | Histograma | Locks (H1), commit/fsync (H2), sentencias (H4) |
| `submit_statements_total{path}` (accepted, rejected, replay) | Contador | Verifica el número de sentencias antes y después de P2 |
| `storage_errors_total{cause}`: `pool_timeout`, `lock_timeout`, `deadlock`, `serialization`, `statement_timeout`, `other` | Contador | Separa los 503 que hoy comparten código |
| `submit_retries_total{code}` | Contador | Reintentos internos |
| `http_server_seconds{route,status}` | Histograma (sustituye avg/máx por minuto) | API frente a proxy, red y generador (comparado con k6) |
| `event_loop_delay_seconds` por ventana (reinicio por scrape, resolución ≤ 5 ms) | Gauge p50/p99/máx | CPU de Node |

Lado PostgreSQL (consultado desde el mismo endpoint, con agregados acotados):

- `pg_stat_activity` agrupado por `wait_event_type` **y** `wait_event` para `application_name='sum-simulator'`, muestreado a 1 s dentro de la API, con el **máximo** por ventana.
- `pg_locks` con `granted = false`, agrupado por `locktype`.
- `pg_stat_database`: commits, rollbacks, deadlocks, `blks_hit` y `blks_read`, temporales.
- `pg_stat_wal` / `pg_stat_io` (WAL): número de syncs y tiempo de sync, con `track_wal_io_timing=on`.
- `pg_stat_statements` (extensión contrib incluida en la imagen oficial; requiere `shared_preload_libraries`): las N sentencias principales por tiempo total y llamadas. Las consultas están parametrizadas y no contienen identidades. Se exporta como archivo de resultados por ejecución y no como serie de Prometheus.
- Solo durante ejecuciones diagnósticas: `log_lock_waits=on` y `deadlock_timeout=200ms` (umbral de registro de esperas), registradas como diagnóstico y no como configuración de aceptación.

Lado host/contenedor:

- Muestreador `docker stats` a 1 s → CSV de CPU% y memoria por contenedor (k6, api-a, api-b, postgres, web, prometheus, grafana). Si existe, también `/proc/pressure/cpu` (PSI). Script nuevo en `load/`, sin dependencias.

### 5.3 Guard de validez del generador

Una ejecución es **inválida** (no cuenta ni a favor ni en contra) si se cumple alguna de estas condiciones:

- La CPU de k6 supera el 85 % de su cpuset durante más de 5 s.
- p95 de `http_req_blocked` > 50 ms o `http_req_connecting` > 0 de forma sostenida, con keepalive esperado.
- `dropped_iterations > 0` en un escenario abierto antes de alcanzar el SLO. En ese caso se registra como «cliente sin VU suficientes», no como un fallo del servidor.
- Hay un fallo de remote write o falta el CSV de recursos.

**Escenarios de una iteración por VU** (`per-vu-iterations` con `iterations: 1`: enrollment, login, retry y jornada). Cada VU abre su propia conexión por diseño, así que no hay keepalive que comprobar. La regla de conexión cambia (`--connection-model per-vu` del guard):

- `http_req_connecting` no invalida la ejecución.
- El p95 de `http_req_blocked` debe quedar por debajo de max(50 ms, 10 % del p95 de `http_req_duration`). `http_req_duration` no incluye el tiempo bloqueado: ese tiempo solo retrasa las llegadas, por eso se acota en proporción a la latencia medida.

El resto de las reglas no cambia. Aprobado por el usuario el 2026-10-22, después de ver los datos de la línea base P0-06 (las 30 ejecuciones de una iteración por VU quedaban inválidas solo por esta regla). El umbral se eligió conociendo esos datos y por eso no es una predicción independiente.

### 5.4 Atribución de latencia (por petición de envío, a partir de las medianas y p95 de cada fase)

```
k6 http_req_duration
  = [generador + red + nginx]     ≈ k6 duration − http_server_seconds
  + auth (2 consultas + espera del pool)
  + pool_acquire(submit)
  + pre_lock + section_lock_wait + critical + commit
  + serialización de la respuesta
```

Si el desglose no cubre al menos el 90 % del p95 de k6, la atribución queda incompleta y se documenta.

## 6. Experimentos de diagnóstico

Todos se hacen en ENV-C (o en ENV-H marcado), con campaña nueva, n ≥ 3 y una sola variable cambiada por experimento. Se usan dos bucles:

- **Bucle interno (rápido, segundos):** arnés `submit-bench` (tarea P0-05) que lanza N `submit` concurrentes contra `PostgresEnrollmentStore` real y la base sintética del Compose, sin HTTP. Reporta p95, máximo, vaciado, envíos/s y fases. Es *red-capable*: falla si p95 > presupuesto (§3.2 de la evaluación).
- **Bucle externo (aceptación, minutos):** `load/scenarios.sh` con k6.

| ID | Hipótesis | Variable | Fija | Medida | Confirma si | Descarta si |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | H1, H11 | Escenario race a 100/200/400 | Pool 12, ENV-C | `section_lock_wait`, `critical`, wait events | Espera de lock > 60 % del p95 y máximo ≈ lineal en N | Espera de lock < 30 % del p95 |
| E2 | H1, H4 | Número de cohortes: 1, 5, 20 secciones disjuntas (bench) | N = 400, pool fijo | Vaciado, envíos/s | Vaciado ∝ 1/cohortes hasta una meseta (= X_global) | Sin cambio al pasar de 1 a 5 cohortes |
| E3 | H2 | — | — | `pg_test_fsync`; histograma `commit`; `pg_stat_wal` | Mediana de commit ≥ 3 ms y fsync ≥ 2 ms | Commit < 1 ms |
| E3b | H2 (diagnóstico) | Volumen PostgreSQL en tmpfs, **solo en el bench y nunca como configuración** | Igual que E1 | t_cs | t_cs baja ≥ 40 % | t_cs baja < 10 % |
| E4 | H2, H6 | k6 y el SUT compartiendo frente a separados por cpuset | Escenario race 400 | p95, CPU por contenedor, PSI | p95 baja ≥ 20 % al aislar | Sin cambio |
| E5 | H3, H8 | Pool 6 / 12 / 24 / 48 por réplica | race, multi-hotspot, mixed | `pool_acquire{read,auth}`, p95 por operación | Con pool mayor baja la espera del pool de read/auth y sube la de locks; el p95 del envío no mejora | El p95 del envío mejora de forma monótona con el pool (entonces no era HOL sino capacidad) |
| E6 | H4 | — | race y multi-uniform | Las N sentencias principales de `pg_stat_statements` | `loadRunState` y la campaña con `config` entre las 3 primeras por tiempo total | < 10 % del tiempo total |
| E7 | H4 | Catálogo de 3, 15 y 300 secciones (bench, perfil distributed) | N = 100 | envíos/s | El throughput cae con el tamaño del catálogo | Plano |
| E8 | H5 | reads abierto 25 → 300 it/s | ENV-C | Rodilla p95 frente a rps, CPU de PG y de API | Rodilla nítida con CPU o pool saturados | Lineal hasta 300 |
| E9 | H7 | Campañas retenidas: 1 frente a 20 | race 400 | `EXPLAIN (ANALYZE, BUFFERS)` de sesiones; t_cs | Seq Scan y t_cs creciente | Diferencia menor que el ruido |
| E10 | H8 | mixed en modo rápido frente a normal | 400 actores | p99 del envío, espera del pool por oleada | p99 normal < 5 s | p99 normal ≥ 5 s |
| E11 | H9 | Proporción de replays en el bench (0 %, 50 %) | Perfil ample | t_cs de envíos nuevos | Los replays aumentan t_cs de los nuevos | Sin efecto |
| E12 | H10 | Ola de login de 400 | — | Espera `Lock:tuple` en `simulator_rate_limits` | > 30 % del p95 de login | < 10 % |
| E13 | H12 | Exportador activo frente a detenido | race 400 | p95 | Diferencia > ruido | Diferencia ≤ ruido |
| E14 | H6 | 1 frente a 2 réplicas de API (ENV-H) | race 400, stress | p95, CPU por contenedor, throughput | Con 1 réplica el p95 no empeora fuera del ruido | Con 2 réplicas el p95 es claramente mejor |

## 7. Matriz progresiva 100 / 200 / 400 / 507 / 800 / 1000 y jornada

El objetivo de aceptación es **507**, el pico FISI de la franja de las 12:00 ([evaluación §2.4](assessment.md#24-perfil-de-demanda-fisi-testimony-aportado-por-el-operador-el-2026-10-22)). 800 (≈1,5 veces el pico) y 1000 son estrés: un incumplimiento allí se acepta y se documenta (D-1). Hoy el límite de actores es 1000 en cinco archivos; P0-07 lo amplía a 2000 para cubrir la jornada (1422 + IA). Cada celda usa una campaña nueva, auditoría SQL y n ≥ 3. Una población solo se ejecuta si la anterior fue **válida** (§5.3), aunque haya fallado su SLO: el objetivo es caracterizar.

| Familia | 100 | 200 | 400 | **507** | 800 | 1000 | Umbral |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Impulso race / last-seat / ample | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Vigente (submit p95/p99) |
| Impulso multi-uniform / multi-hotspot | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Vigente |
| Franja FISI (`fisi-schools`) | — | — | — | ✓ | ✓ | ✓ | Vigente |
| login (ola simultánea) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `auth-login` p95/p99 (D-2) |
| mixed (modo normal, 10 min) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Vigente |
| reads / stress abierto (barrido) | — | — | ✓ | ✓ | ✓ | ✓ | Lectura vigente; rodilla informativa |
| sessions (cerrado, think 1–3 s) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Lectura vigente |
| soak 30 min | — | — | — | ✓ | — | ✓ | Lectura vigente; deriva informativa |
| retry / resilience | — | — | — | ✓ | — | ✓ | Funcional |

**Jornada FISI:** 1422 actores (+ IA cuando haya dato), `WAVE_FRONTLOAD` ∈ {1,0; 0,5}, n ≥ 3. Umbrales de `submit` y `auth-login`.

Notas:

- La ola de login más grande es la de 1000 actores, y la oleada mayor de la jornada es de 507: ambas caben en el límite de login por IP (`SIMULATOR_LOGIN_IP_LIMIT=2000`/min, [run-api.sh:9](../../infra/simulator/run-api.sh)). En resilience o soak con relogins puede haber 429. **No se eleva en silencio:** si hace falta otro valor, se documenta en la ejecución conforme a SIM-PUBLIC-1 y requiere aprobación (D-4).
- Con 800–1000 actores sobre una sola sección caliente, el presupuesto t_cs ≤ 2,1–2,6 ms (evaluación §3.2) puede ser inalcanzable. El resultado se reporta como fallo de SLO **medido** y se acepta según D-1.

## 8. Reproducibilidad y protocolo de ejecución

1. Registrar el entorno (ENV-H o ENV-C), `git rev-parse HEAD`, la huella de fuentes (patrón `source-fingerprint.json`), las versiones de imágenes (ya fijadas por digest), la latencia de fsync y los cpusets.
2. **Estado inicial.** En series comparativas, usar un volumen PostgreSQL recién creado o registrar `count(*)` por tabla y el número de campañas antes de cada ejecución. Ejecutar un precalentamiento (reads a 10 it/s durante 30 s sobre la campaña nueva, excluido por la etiqueta `phase=warmup`) antes de la medición.
3. **Orden:** aleatorizar el orden de los escenarios entre repeticiones o, como mínimo, alternar A/B (ABAB) en las comparaciones de P2.
4. **Estadística.** Reportar la mediana de los p95 de las repeticiones y su rango [mín, máx]. Una mejora solo se declara si el rango del candidato no se solapa con el de la línea base **y** la mediana mejora más que el ruido base (rango de la línea base). No se reconstruyen percentiles globales sumando ejecuciones.
5. **Artefactos:** summary-export, auditoría, CSV de recursos, volcado de `pg_stat_statements` y las métricas del servidor por `testid`, en `infra/simulator/runtime/results/` (fuera de Git). A la evidencia versionada solo pasan agregados sanitizados.
6. **Lectura de resultados.** En summary-export, `thresholds[x] === true` significa **fallo**. La aceptación se decide por el código de salida, la auditoría y `failedThresholds`.

## 9. Criterios de aceptación por fase

| Fase | Criterio | Verificación |
| --- | --- | --- |
| P0 | Línea base n = 5 en ENV-H de race, ample, multi-uniform, multi-hotspot, mixed (normal) y stress a 400, más franja FISI 507, login 507 y una jornada, con rangos registrados y guard válido | `docs/performance/baseline-*.md` y resultados privados por `testid` |
| P1 | Desglose de §5.4 que cubre ≥ 90 % del p95 en race y ample; E1–E6 ejecutados; cada hipótesis H1–H6 marcada como confirmada o descartada con su evidencia | Informe de diagnóstico |
| P2 | Por optimización: equivalencia funcional (pruebas y auditoría), mejora fuera del rango de ruido en su escenario objetivo y ninguna regresión fuera de rango en el resto | Comparación A/B con n ≥ 3 |
| P3 | Matriz §7 completa en ENV-C; tabla antes/después; los seis escenarios de la evaluación con SLO evaluado sin cambiar umbrales; incumplimientos residuales documentados con causa | Informe final y evidencia sanitizada |
