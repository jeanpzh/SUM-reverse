# Diagnóstico P1-06 (ENV-H)

**Commit medido:** `6dd3c95`, que es master con P1-01 a P1-05 (#21–#24, #26) y los buckets de #28. **Fecha de ejecución:** 2026-10-22, desde las 14:57 UTC.
**Estado de todo el documento:** `local-only`. Mide el simulador propio con datos construidos de forma independiente, en una VM de 2 vCPU donde el generador y el servidor comparten host (`generatorSharesServerHost: true`). No acredita capacidad absoluta ni comportamiento del SUM institucional.

Documentos relacionados: [evaluación](assessment.md) · [estrategia §6](test-strategy.md#6-experimentos-de-diagnóstico) · [plan, tarea P1-06](plan.md#p1-06-ejecución-del-diagnóstico-e1e14) · [línea base](baseline-400.md).

> La §2 (reglas de interpretación) se escribió y se commiteó **antes** de ver los resultados de la campaña completa (commit `06f1729`, 14:59 UTC). Dos salvedades: (1) antes de escribirla ya se conocían los resultados de dos ejecuciones piloto sobre `8241b64` (race 400 y ample 400, con buckets anteriores), que mostraban la espera del pool como componente dominante; (2) la regla de excluir de las estadísticas las ejecuciones que el guard del generador marca inválidas se decidió durante la campaña, no antes. Las secciones de resultados se añadieron después, en commits posteriores.

## 0. Convenciones

- Etiquetas de evidencia de la [evaluación §0](assessment.md#0-convenciones-de-evidencia).
  - `observed` significa medido en esta campaña, con el agregado como fuente.
  - `inferred` lleva el experimento que lo confirmaría.
- Estadística (estrategia §8.4): mediana de las repeticiones y rango [mín, máx], con n = 3 salvo que se indique otra cosa. No se combinan percentiles entre ejecuciones.
- Veredictos por hipótesis: `confirmed`, `rejected` o `inconclusive`, contra los criterios «Confirma si» y «Descarta si» de la estrategia §6. Si un resultado cae entre ambos criterios, el veredicto es `inconclusive`.
- SLO D-2 sin cambios: p95 < 2000 ms y p99 < 5000 ms.

## 1. Condiciones

| Aspecto | Valor |
| --- | --- |
| Entorno | ENV-H: VM de 2 vCPU y 8 GB. No había otros proyectos con contenedores activos. Grafana detenido durante la medición; Prometheus y el exportador activos (salvo en E13) |
| Configuración | `compose.simulator.yaml` + `compose.perf.yaml`: `pg_stat_statements`, `track_io_timing` y `track_wal_io_timing`. cpusets **sin fijar** (`0-1`) salvo en E4. Pool `max=12` por réplica salvo en E5 |
| Diferencia con la línea base | La línea base P0-06 se midió sin `compose.perf.yaml` y sin la instrumentación P1. Las comparaciones de esta campaña son internas (todas sobre `6dd3c95`); las cifras de `baseline-400.md` no se comparan como si vinieran de la misma build |
| Preparación | `SCENARIO_ENV=H SCENARIO_WARMUP=1 SIMULATOR_RECREATE=app`: campaña nueva y 30 s de lecturas de precalentamiento por ejecución |
| Estado inicial | Sin volumen nuevo. Antes de cada ejecución se registran las campañas retenidas y las filas por tabla (`*.state.json`). Cada bloque empieza con un **centinela** race-400 con la configuración por defecto, para medir la deriva y no solo registrarla. Dentro de cada experimento, las variantes rotan de orden entre repeticiones (ABBA o cíclico) |
| Capturas del servidor | Deltas exactos de contadores e histogramas entre el inicio y el final de la medición (+20 s), mediante consultas instantáneas a Prometheus (sin `increase()`). Máximos por ventana de wait events, locks, picos del pool y event loop. `pg_stat_statements` se reinicia antes de cada ejecución y se vuelca después |

**Nota operativa.** `sudo -n docker` descarta las variables de entorno del llamador. Las variables `PERF_CPUSET_*`, `SIMULATOR_DB_POOL_MAX` y `COMPOSE_FILE` se pasan con `sudo -n /usr/bin/env … /usr/bin/docker`, y la configuración efectiva de cada ejecución (cpuset, pool, estado del exportador) se comprueba con `docker inspect` (`*.config`).

## 2. Reglas de interpretación declaradas antes de los resultados

### 2.1 Atribución (estrategia §5.4)

- **Descomposición por medias (exacta, `_sum/_count`).** La media del envío en k6 se reparte así:
  - brecha cliente+nginx: k6 − servidor HTTP;
  - espera del pool dentro de la petición: P1-02, grupo `/local/matricula-regular/v1/solicitudes`, que incluye los checkouts de autenticación y del store;
  - fases del store: `pre_lock`, `section_lock_wait`, `critical` y `commit`;
  - residuo: consultas de autenticación, serialización y event loop.

  Cobertura = 1 − residuo / media de k6.
- **p95.** Se compara el p95 exacto de k6 con el intervalo de bucket del p95 del servidor y de cada componente. Desde #28 los buckets son de 500 ms a 1000 ms entre 1 y 6 s. La cobertura del p95 se reporta como intervalo. El criterio P1 (≥ 90 %) se da por cumplido solo si el **límite inferior** del intervalo es ≥ 90 % en race y en ample.
- **Los percentiles no son aditivos.** La suma de los p95 por fase no se presenta como el p95 total.

### 2.2 Límites de cada experimento en ENV-H

- **E4** (cpusets) aísla k6, pero también deja al SUT con la mitad de la CPU. Puede **confirmar** H6 (si el p95 baja al menos un 20 % pese a tener menos CPU), pero no descartarla: un resultado nulo o peor es `inconclusive`. El guard usa `k6Cpus` = 1; con k6 fijado a una CPU, `GEN_CPU` puede invalidar ejecuciones, y en ese caso se indica.
- **E2** (cohortes) cambia también el número de admitidas (10 → 50 → 100) y, con él, la mezcla hacia la ruta de aceptación, que es más larga. Se comparan las fases por ruta (`accepted`/`rejected`), no el vaciado ni el throughput en bruto.
- **E7** con un catálogo menor que N reparte las secciones entre actores (≈34 actores por sección con 3 secciones). La contención se mezcla con el efecto del tamaño del catálogo: solo el paso de 15 a 300 aísla el tamaño.
- **E5** usa pools de 6, 12, 24 y 40 por réplica, no 48: `max_connections` = 100 (97 utilizables) no admite 2 × 48 más las conexiones del muestreador y de las herramientas. En el bench (E5b, sin APIs) sí se mide 48 (2 × 48 = 96).
- **E13** apaga el exportador, pero **no** el muestreador de 1 s ni las consultas `pg_*` de P1-03 dentro de las APIs, que no se pueden desactivar sin cambiar código. E13 mide solo el exportador y su sondeo de 2 s del endpoint de métricas. El coste del muestreador queda sin medir y se declara como gap.
- **E14** usa un override de Compose temporal, sin commitear, que monta un `nginx.conf` con api-a como único upstream. api-b sigue arrancado tras la rotación pero no recibe tráfico (solo su muestreador de 1 s y el sondeo del exportador).
- **E8** se ejecuta en ENV-H y se marca así: la estrategia lo sitúa en ENV-C. `scenarios.sh reads` no expone `RATE`, así que el barrido llama a `reads.js` directamente, con rampas de 5 s y 60 s sobre la campaña vigente. **[Corregido tras la campaña]** El script usa `ramping-arrival-rate`: tras las rampas de 5 s a 10 y 25 it/s, la tasa **sube linealmente de 25 it/s hasta el valor indicado durante los 60 s**; no es una tasa fija. Las tasas de §4 (100, 150…) son el valor final de la rampa y el it/s logrado es el promedio de toda la ejecución.
- **E3b y E9** usan un PostgreSQL desechable aparte, con el volumen en tmpfs o con N campañas sembradas, y el bench. Nunca tocan el volumen del stack.
- **Deriva de estado.** La campaña añade unas 130 campañas a la base. Q4 (sesiones académicas) ya hace `Seq Scan` en la ruta de envío (P1-04). Si los centinelas muestran una deriva mayor que el ruido de una repetición, las comparaciones entre bloques no se hacen, y dentro de cada bloque solo valen las de orden rotado.

### 2.3 Lo que no se decide aquí

- No se cambian umbrales, SLO ni contratos.
- Las tareas P2 se **recomiendan** según los veredictos, pero no se implementan en P1-06.

## 3. Atribución del envío (bloque A)

Mediana de 3 repeticiones válidas por escenario, en ms, sobre `6dd3c95`. La media se descompone de forma exacta (sumas y conteos); el reparto del p95 se da solo como intervalo (§2.1). Escenarios con perfil ENV-H y pool 12 por réplica.

| Escenario | n | Media k6 | Cliente+nginx | Espera de conexión | `pre_lock` | Espera del bloqueo de sección | `critical` | `commit` | Residuo | Cobertura de la media | p95 k6 | Cobertura del p95 (intervalo) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| race 100 | 3 | 543 | 25,9 | 299 | 5,3 | 185,6 | 6,4 | 1,3 | 5,8 | 99,0 % | 816 | 78–104 % |
| race 200 | 3 | 978 | 38,7 | 726 | 3,7 | 209,1 | 6,7 | 1,3 | 4,2 | 99,6 % | 1753 | 86–114 % |
| race 400 | 3 | 1803 | 38,4 | 1560 | 2,5 | 191,5 | 5,8 | 1,3 | 3,2 | 99,8 % | 3128 | 96–128 % |
| ample 400 | 3 | 3334 | 118 | 2839 | 3,3 | 352,7 | 13,8 | 1,2 | 4,1 | 99,9 % | 5777 | 87–104 % |
| multi-uniform 400 | 3 | 1959 | 149,7 | 1563 | 5,6 | 163,4 | 35,3 | 3,7 | 7,1 | 99,6 % | 3349 | 86–115 % |

Lecturas (`observed`):

- **La media queda explicada al 99–99,9 %** en los cinco escenarios; el residuo (consultas de autenticación, serialización y event loop) es de 3 a 7 ms.
- **La mayor parte del tiempo es espera de conexión**: 55–85 % de la media. Crece casi linealmente con N (299 → 726 → 1560 ms al pasar de 100 a 400 actores).
- **La espera del bloqueo de sección no crece con N** (186 → 209 → 192 ms; `observed`). `inferred`: con el pool de 12 por réplica solo 24 peticiones pueden esperar el bloqueo a la vez y las demás esperan antes, en la fila del pool, de modo que la cola se desplaza del bloqueo al pool (E5 lo respalda).
- **El trabajo serializado es corto**: `critical` de 6 ms y `commit` de 1,3 ms en race. En ample sube `critical` a 14 ms por la ruta de aceptación (≈22 sentencias).
- **Límite del criterio P1 sobre el p95 (≥ 90 %):** con buckets de 500 ms a 1 s, el intervalo del p95 del servidor es ancho. El límite inferior alcanza el 90 % solo en race 400 (96 %); en race 100, race 200, ample y multi-uniform queda entre 78 y 87 %. Por la regla de §2.1, **el criterio del p95 no se da por cumplido** en esas filas: la cobertura exacta se cumple en la media, no en el percentil. No se cambia la regla.
- **ample 400 acepta entre 322 y 400 de 400** según la repetición: hasta 78 envíos por ejecución terminan en `503` por timeout del pool (5 s). Es variabilidad del límite del pool, no un fallo de una repetición.

## 4. Veredictos por hipótesis

Cada veredicto aplica **literalmente** los criterios «Confirma si» y «Descarta si» de la estrategia §6, declarados antes de ver los datos. Si el resultado no cumple un criterio, se dice, aunque haya otra lectura que parezca más natural: esa lectura se escribe aparte y con etiqueta `inferred`. Mediana de n = 3 salvo indicación; los runs que el guard del generador marcó inválidos se excluyen de las estadísticas (se indica el n usado). Todo es `observed` en ENV-H salvo donde se marca `inferred`.

| Hipótesis | Veredicto | Evidencia (`observed`) | Límite |
| --- | --- | --- | --- |
| **H1** Serialización sobre la sección caliente | `inconclusive` por los criterios literales | **E1:** la espera medida del bloqueo es el 6 % del p95 (192 de 3128 ms en race 400), por debajo del 30 % que descartaría. **E2:** de 1 a 5 cohortes el vaciado baja de 3,28 s a 2,21 s (×1,5, no ×5) y de 5 a 20 sube a 2,55 s; no hay «cambio nulo» (descartaría), pero tampoco la proporcionalidad a 1/cohortes (confirmaría). | El mecanismo alternativo (cola en la sección caliente que se mide en el pool) está respaldado por E5 y por el ajuste de §4.1, pero es `inferred`. El criterio de E1 supone que la espera se ve como `section_lock_wait`; con un pool de 12 solo 24 peticiones pueden esperar ese bloqueo |
| **H2** Fsync del WAL en `COMMIT` | `inconclusive` | **E3:** `commit` con mediana en el bucket [1, 2] ms (por debajo de los 3 ms que confirmarían) y media de 1,3 ms; ≈ 1,9 ms por flush en producción de WAL (2,27 s en 1198 flushes); `pg_test_fsync` con `fdatasync` (el método por defecto) da ≈ 0,95 ms por escritura de 8 kB. **E3b (n = 3):** con el volumen en tmpfs t_cs baja de 4,7 a 3,4 ms (−27 %) y el vaciado de 1,88 a 1,37 s. El criterio confirma con una bajada ≥ 40 % y descarta con < 10 %: 27 % cae entre ambos. E4 no la apoya | El fsync explica una parte (≈ 1,2 ms de 4,7) pero no la mayoría. E3b corre en una base desechable sin API, así que su t_cs absoluto no es comparable con el del stack |
| **H3** Cabeza de cola en el pool | `confirmed` para lecturas y envío; la autenticación no mejora | **E5 (n = 3; pool 40 con n = 2):** el p95 del envío no mejora con el pool (3379 / 3535 / 3372 / 3423 ms con 6 / 12 / 24 / 40) mientras la espera de conexión baja (1850 → 1224 ms) y la del bloqueo sube (100 → 650 ms). Espera por checkout con pool 6 → 40: `contextos` (lectura) 402 → 284 ms, `solicitudes` 617 → 408 ms; `sesiones` (autenticación) queda plana (204 → 194 ms) y `login` sube (184 → 255 ms) | El criterio nombra la espera de lectura y autenticación: la de lectura baja; la de autenticación no. Un run por variante en race pool 40 y en hotspot pool 24 se excluyó por el guard |
| **H4** Volumen leído por envío | `confirmed` por E7 | **E7:** con 300 secciones el throughput es 56 envíos/s frente a 119–125 con 3 o 15 secciones. **E6:** `FOR UPDATE` de secciones es el 54–69 % del tiempo de sentencias; sesiones académicas, el 17–28 %; el `SELECT` de campaña con `config` no llega al 1 % | El coste está en leer todo el catálogo, no en `config`. El tiempo en `critical` con 300 secciones (328 ms) no se usa como evidencia: sin serialización hay hasta 24 transacciones simultáneas sobre 2 vCPU. El catálogo de 3 comparte secciones entre actores |
| **H5** Saturación de lecturas | `confirmed` | **E8 (n = 3):** el p95 de lectura pasa de 328 ms (rampa hasta 100 it/s) a 2048–2232 ms (rampa hasta 150) y aparecen iteraciones descartadas por k6 (≈ 650–700 con 150; ≈ 2000 con 200; ≈ 4600 con 300). En esos runs el pool está saturado: 12 de 12 conexiones en uso en ambas réplicas y hasta 106–150 peticiones esperando; el event loop no (p95 de ≈ 8 ms); 0 errores `pool_timeout` y 0 fallos HTTP | La tasa no es fija (rampa de 25 it/s al valor indicado en 60 s), así que el it/s logrado (23–72) es un promedio y no un techo medido. El criterio pide rodilla con CPU o pool saturados: se cumple por el pool. ENV-H: en un host mayor la rodilla se mueve |
| **H6** CPU compartida con k6 | `inconclusive` | **E4:** inconcluyente por diseño (aislar k6 deja al SUT con una CPU; p95 3886 frente a 3483 ms, con un rango de 3189–3798 ms en el brazo de control, 19 %). **E14 race:** con 1 réplica el p95 no empeora (3623 [3594–3692] frente a 3760 [3686–3914] ms), pero los rangos se solapan y 1 réplica también reduce a la mitad las conexiones totales (12 frente a 24), igual que pool 6 frente a pool 12 en E5 | E14 no aísla la CPU. E14 stress no se ejecutó (decisión del operador) |
| **H7** Seq Scan en sesiones académicas y deriva por campañas retenidas | `confirmed` (la deriva); la contribución del índice faltante no está aislada | **E9 (n = 3, base desechable):** con 3 campañas (1200 sesiones académicas) t_cs = 4,72 ms [4,59–4,86] y p95 1806 ms [1759–1863]; con 26 campañas (10 400 sesiones) t_cs = 5,37 ms [5,31–5,43] y p95 2049 ms [2033–2076]. Los rangos no se solapan: **+14 % en t_cs y +13 % en p95**. `EXPLAIN` muestra Seq Scan sobre `simulator_academic_sessions` (0,6 ms con 10 400 filas; 1,8 ms con 38 383 en el stack) | Crecieron todas las tablas, no solo esa: no se aísla el efecto del índice faltante (`inferred`). El `EXPLAIN` del brazo con 3 campañas se perdió (error mío: faltaba la extensión `pg_stat_statements`) |
| **H8** Oleadas de mixed | `confirmed` por el criterio de E10 (solo el modo normal) | **E10:** el p99 del envío en mixed normal con pool 12 es 2366 / 2736 / 3287 ms (n = 3), por debajo de los 5 s que lo descartarían. El p95 es 1809 / 2068 / 2404 ms: pasa el SLO una vez de tres | Los 3 runs de mixed rápido salieron `valid=false` (`HTTP_CONNECTING`) y se excluyen: no hay comparación válida rápido frente a normal. Su p99 (5,6–6,0 s) va en la dirección esperada |
| **H9** Replays que bloquean antes de detectar idempotencia | `rejected` por el criterio de E11 | **E11:** con 50 % de replays, `critical` de los envíos nuevos no sube (7,9 frente a 8,4 ms) y la espera del bloqueo baja (188 frente a 240 ms). Los propios replays esperan ≈ 202 ms el bloqueo de la sección (mecanismo de H9, observado) | E11 no mide el escenario retry; el efecto de resolver el replay antes de bloquear (P2-01) solo se mide con A/B |
| **H10** Rate limit del login | `inconclusive` | **E12:** sin esperas `Lock:tuple` en el muestreo de 1 s; dominan `LWLock:WALWrite` (hasta 16), `Lock:transactionid` (5–16) y `LWLock:LockManager`. Media de 758–923 ms; p95 en [1 s, 1,5 s]. El criterio literal descartaría H10 | Los 3 runs salieron `valid=false` (`RESOURCES_MISSING`: login demasiado corto para 2 muestras de recursos). Si k6 limitó la simultaneidad de la ola, la ausencia de `Lock:tuple` no es concluyente. Se excluye por la misma regla que los E10 rápidos |
| **H11** MultiXact por `FOR SHARE` de campaña | `rejected` | 0 de 87 runs con captura del servidor muestran esperas `LWLock:MultiXact*`. El muestreador y el exportador admiten cualquier evento (el filtro solo valida el formato del nombre) | Es un muestreo de 1 s con un máximo de 64 pares: una espera MultiXact muy breve podría no aparecer |
| **H12** Observabilidad en el pool | `rejected` | **E13:** exportador apagado 3660 [3629–3809] ms; activo 3715 [3710–3779] ms (+1,5 %, dentro del ruido) | El muestreador de 1 s y las consultas `pg_*` de P1-03 siguen activos en ambos brazos |

### 4.1 Lecturas `inferred` (no son hallazgos medidos directamente)

- **t_cs ≈ 8 ms.** La espera del bloqueo dividida por el número de peticiones que pueden esperarlo a la vez (2 réplicas × pool) da, en race 400 con pool 6 / 12 / 24 / 40: 100/12 ≈ 8,3, 213/24 ≈ 8,9, 402/48 ≈ 8,4 y 650/80 ≈ 8,1 ms. Es estable aunque la espera cambie por 6, y coincide con `critical` + `commit` (5,8 + 1,3 ms) más el traspaso del bloqueo.
- **p95 ≈ 0,95 · N · t_cs.** Con t_cs = 8,2 ms, 0,95 × 400 × 8,2 = 3116 ms frente a 3128 ms medidos en race 400; race 100 y race 200 se ajustan igual salvo una constante pequeña. Esto es lo que respalda que la cola esté en la sección caliente, aunque el criterio literal de H1 no se cumpla.
- **Quitar peticiones del pool solo mueve la espera.** E5 mostró que cambiar cuántas peticiones esperan en el pool desplaza la espera al bloqueo sin cambiar la suma. Por la misma razón, reducir los checkouts por petición (cada envío hace 3: 2 de autenticación y 1 del store) **no baja el p95 de race**: la palanca de race es t_cs o repartir la cohorte. Reducir checkouts sí ataca H3 (lecturas, autenticación y cohortes pequeñas que esperan detrás de la sección caliente).
- **Techo global ~120–180 envíos/s.** Coincide con CPU/WAL y no con bloqueos (E2 con 20 cohortes), pero 2 vCPU compartidas con k6 no permiten separar ambos.
- **La base con campañas acumuladas explica probablemente una parte grande de t_cs (`inferred`).** El mismo bench, con parámetros idénticos (400 actores, perfil shared, 2 pools de 12, 1 cohorte, presupuesto 60 000 ms), da `estimatedCriticalSectionMs` = 4,6–4,9 ms en una base desechable con 3 campañas (E9) y 8,2–8,4 ms en el stack (E5b, pool 12), con ≈ 120 campañas retenidas y 38 383 sesiones académicas. E9 mide +14 % por pasar de 3 a 26 campañas, y una extrapolación lineal a ≈ 120 campañas daría una subida del mismo orden. No está aislado: el stack difiere en otros aspectos (volumen con historia, procesos de observabilidad en reposo), y la causa solo se separa con una prueba A/B (P2-02 y limpieza de campañas).
- **Los 503 de ample** (0 a 78 por run) son timeouts del pool de 5 s (`observed`: causa `pool_timeout`); el pico llega a ≈ 190 conexiones esperando por réplica.

## 5. Presupuesto recalculado (evaluación §3.2, `inferred`)

Con t_cs ≈ 8,2 ms (§4.1) y «vaciado ≈ N × t_cs», p95 < 2 s exige t_cs ≤ 2000 / (0,95 · N):

| Cohorte caliente | t_cs máximo | Medido hoy | Resultado (p95 medido en race) |
| --- | --- | --- | --- |
| 100 | 21 ms | ≈ 8 ms | cumple (816 ms) |
| 200 | 10,5 ms | ≈ 8 ms | cumple justo (1753 ms) |
| 286 (Sistemas, 12:00) | 7,4 ms | ≈ 8 ms | no cumple por poco (no medido con 286) |
| 400 | 5,3 ms | ≈ 8 ms | no cumple (3128 ms) |
| 507 (pico FISI) | 4,2 ms | ≈ 8 ms | no cumple; se cumpliría bajando t_cs a ≈ 4 ms, o repartiendo la disputa |

Hasta ≈ 250 alumnos en una sola cohorte el presupuesto se cumple con la base del stack. Esa tabla usa el t_cs del stack; la diferencia con una base desechable (§4.1) es una hipótesis sin aislar y no se usa para el presupuesto. Si bajar t_cs a ≈ 4 ms es factible no está medido: `critical` es ≈ 6 ms con ≈ 10 sentencias en la ruta de rechazo.

## 6. Estado de aceptación de P1 (estrategia §9)

| Criterio | Estado |
| --- | --- |
| Desglose de §5.4 que cubre ≥ 90 % del p95 en race y ample | **Parcial.** La media se cubre al 99–99,9 % en ambos. El p95, con el intervalo de buckets, tiene límite inferior de 96 % en race 400 y de 87 % en ample 400: **no se cumple en ample** |
| E1–E6 ejecutados | **Cumplido:** E1, E2, E3 (histograma de commit y `pg_test_fsync`), E3b, E4, E5 y E6 |
| H1–H6 confirmadas o descartadas con evidencia | **No cumplido:** H3, H4 y H5 confirmadas; H1, H2 y H6 `inconclusive` por los criterios literales |

La puerta «sin evidencia suficiente de P1 no se ejecuta P2» **no está superada formalmente**. La evidencia sí identifica el mecanismo (cola en la sección caliente, t_cs ≈ 8 ms, 3 checkouts por petición), pero decidir si basta para activar P2 corresponde al operador.

## 7. Tareas P2 recomendadas, por palanca (`inferred`; ninguna se implementa en P1-06)

1. **Índice de sesiones académicas y limpieza de campañas retenidas** (P2-02): E9 mide +14 % de t_cs al pasar de 3 a 26 campañas. Es barato y de bajo riesgo para los invariantes, por lo que es lo primero que conviene probar con un A/B (con y sin índice, con y sin limpieza). La diferencia mayor entre la base desechable y el stack (§4.1) es una hipótesis: no se le atribuye todavía ningún efecto.
2. **Reducir t_cs** (P2-05, P2-04): menos sentencias bajo el bloqueo y no releer el catálogo completo (E7). Es la palanca directa de race: el p95 sigue a 0,95 · N · t_cs. Debe preservar el orden de locks, la idempotencia y los cupos.
3. **Menos checkouts por petición** (P2-03) y pool dimensionado (P2-07a): ataca H3. No se espera efecto en el p95 de race; sí en lecturas y autenticación.
4. **Replay antes de bloquear** (P2-01): solo relevante para retry; H9 no se confirmó en E11.

## 8. Huecos y límites de esta campaña

- E14 stress no se ejecutó (decisión del operador); mixed con pool 40 tiene n = 2 (decisión del operador).
- Runs excluidos por el guard: race pool 40 r2 y hotspot pool 24 r3 (`HTTP_BLOCKED`), y los 3 de login (`RESOURCES_MISSING`).
- **Deriva entre bloques.** Los centinelas race 400 van de 3199 a 3782 ms (≈ 18 %), frente a ≈ 2 % entre repeticiones de E1. Por la regla de §2.2, **no se comparan cifras entre bloques**; todas las comparaciones de este informe son dentro de su bloque.
- El coste del muestreador de 1 s y de las consultas `pg_*` no se midió (E13 solo apaga el exportador).
- E8 se ejecutó en ENV-H (la estrategia lo sitúa en ENV-C).
- E3b y E9 se ejecutaron en una base desechable (sin API ni observabilidad): sus valores absolutos no se comparan con los del stack, con una excepción deliberada y declarada en §4.1 (mismos parámetros del bench, E9 frente a E5b). En E9, el brazo con 3 campañas no tiene `EXPLAIN` (error de ejecución) y las 20 campañas de relleno se generaron con el propio bench (algunas ejecuciones devolvieron un código de salida distinto de cero por la comparación con el presupuesto; todas crearon su campaña: 26 al final).
- Los 3 runs de mixed rápido (E10) salieron inválidos por `HTTP_CONNECTING`.

## 9. Actualización posterior: P2-02 medido en el stack (2026-10-22, 19:11–19:23 UTC)

Después de mergear el índice de `simulator_academic_sessions` (PR #32), se midió en el stack (2 APIs, pool 12, race 400, base con 226 campañas y 83 790 sesiones académicas). Los dos brazos usan la **misma base de datos**: el índice se elimina o se crea por SQL entre ejecuciones, con el mismo `CREATE INDEX` de la migración 003. Orden A B B A A B (A = sin índice, B = con índice). Una ejecución A (A-4) salió inválida por `HTTP_BLOCKED` y se excluye. Detalle en `evidence/local/simulador-produccion/perf-diagnosis/p2-02/stack-ab.json`.

| Brazo | n válidas | p95 del envío | Espera de conexión | Espera del bloqueo de sección | `critical` |
| --- | --- | --- | --- | --- | --- |
| Sin índice | 2 | 4010 y 4143 ms | 1925 y 2060 ms | 242 y 250 ms | 7,9 y 8,2 ms |
| Con índice | 3 | 2543 / 2425 / 2421 ms | 1307 / 1157 / 1195 ms | 154 / 148 / 149 ms | 4,0 / 3,6 / 3,8 ms |

- **`observed`:** con el índice, el p95 baja ≈ 40 % (de ≈ 4,1 s a ≈ 2,4 s), `critical` se reduce a la mitad (≈ 8 a ≈ 3,8 ms) y los rangos de los dos brazos no se solapan. La ejecución A inválida (3928 ms) va en la misma dirección.
- **Efecto mucho mayor que en la base desechable** (−9 % de t_cs con 26 campañas): con 226 campañas la consulta sin índice recorre sesiones de todas las campañas retenidas. Esto es coherente con la hipótesis de §4.1 (la deriva por campañas retenidas explica una parte grande de t_cs en el stack), pero esa hipótesis era `inferred`; ahora hay una medición directa en el stack.
- **El SLO sigue sin cumplirse en race 400** (p95 ≈ 2,4 s frente a 2 s), pero queda a ≈ 20 % del límite.
- **Revisa las comparaciones de este informe:** las cifras de los bloques A–G se midieron con ≈ 120–135 campañas y sin el índice, es decir, con parte de la deriva incluida. La deriva entre bloques que se reportó (≈ 18 %) no se debía a azar sino, al menos en parte, a este efecto.
- **Límites:** n = 2 válidas sin índice; un solo escenario (race 400); el índice recién creado en B no tiene bloat y el brazo A lleva el de la tabla; mismo host de 2 vCPU con k6 compartido.

## 10. Estado de cierre y pendientes (2026-10-22)

**Cerrado por decisión del operador:** P0, P1 (diagnóstico P1-06) y **P2-02** (índice de sesiones académicas, medido en el stack: §9). El resto del plan queda **pendiente**; no se ha iniciado nada de ello.

| Pendiente | Qué falta | Nota |
| --- | --- | --- |
| Decisión sobre la puerta de P1 | H1, H2 y H6 `inconclusive`; p95 sin cubrir al 90 % en ample (§6) | Corresponde al operador antes de activar más tareas P2 |
| P2-00 | Arnés de equivalencia del envío (`simulator-submit-equivalence.e2e-spec.ts`) | Prerrequisito de P2-01, P2-04 y P2-05; no cambia comportamiento. Estimado 1–2 h |
| P2-01, P2-04, P2-05 | Replay antes de bloquear; quitar `config`; acortar el tiempo bajo bloqueo | Cambian el camino crítico de cupos. Estimado conjunto 5–7 h, con A/B por tarea |
| Limpieza de campañas retenidas | Política de retención/limpieza en el simulador | Candidata barata junto con el índice; sin A/B todavía |
| P2-03, P2-06 a P2-09 | Menos checkouts, lecturas, pool, métricas, PostgreSQL | No se esperan efecto en el p95 de race (P2-03); ver §7 |
| Medición del índice con más rigor | n = 2 sin índice, un solo escenario (race 400), 2 vCPU compartidas | Repetir con ABBA completo y más escenarios |
| Experimentos no ejecutados | E14 stress; 3.ª repetición de mixed con pool 40; E10 mixed rápido (inválido); E12 login (inválido) | Véase §8 |
| P3 | Validación final de la matriz en un host de 8 o más vCPU (ENV-C) | Requiere el entorno, que aporta el operador |
