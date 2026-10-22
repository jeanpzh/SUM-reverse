# Diagnóstico P1-06 (ENV-H)

**Commit medido:** `6dd3c95`, que es master con P1-01 a P1-05 (#21–#24, #26) y los buckets de #28. **Fecha de ejecución:** 2026-10-22, desde las 14:57 UTC.
**Estado de todo el documento:** `local-only`. Mide el simulador propio con datos construidos de forma independiente, en una VM de 2 vCPU donde el generador y el servidor comparten host (`generatorSharesServerHost: true`). No acredita capacidad absoluta ni comportamiento del SUM institucional.

Documentos relacionados: [evaluación](assessment.md) · [estrategia §6](test-strategy.md#6-experimentos-de-diagnóstico) · [plan, tarea P1-06](plan.md#p1-06-ejecución-del-diagnóstico-e1e14) · [línea base](baseline-400.md).

> La §2 (reglas de interpretación) se escribió y se commiteó **antes** de ver los resultados de la campaña. Las secciones de resultados se añaden después, en commits posteriores.

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
- **E8** se ejecuta en ENV-H y se marca así: la estrategia lo sitúa en ENV-C. `scenarios.sh reads` no expone `RATE`, así que el barrido llama a `reads.js` directamente, con rampas de 5 s y 60 s a tasa fija, sobre la campaña vigente.
- **E3b y E9** usan un PostgreSQL desechable aparte, con el volumen en tmpfs o con N campañas sembradas, y el bench. Nunca tocan el volumen del stack.
- **Deriva de estado.** La campaña añade unas 130 campañas a la base. Q4 (sesiones académicas) ya hace `Seq Scan` en la ruta de envío (P1-04). Si los centinelas muestran una deriva mayor que el ruido de una repetición, las comparaciones entre bloques no se hacen, y dentro de cada bloque solo valen las de orden rotado.

### 2.3 Lo que no se decide aquí

- No se cambian umbrales, SLO ni contratos.
- Las tareas P2 se **recomiendan** según los veredictos, pero no se implementan en P1-06.

## 3. Atribución del envío (resultado parcial: bloque A, `observed`)

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
- **La espera del bloqueo de sección no crece con N** (186 → 209 → 192 ms). Con el pool de 12 por réplica solo 24 peticiones pueden esperar el bloqueo a la vez; las demás esperan antes, en la fila del pool. La cola se desplaza del bloqueo al pool.
- **El trabajo serializado es corto**: `critical` de 6 ms y `commit` de 1,3 ms en race. En ample sube `critical` a 14 ms por la ruta de aceptación (≈22 sentencias).
- **Límite del criterio P1 sobre el p95 (≥ 90 %):** con buckets de 500 ms a 1 s, el intervalo del p95 del servidor es ancho. El límite inferior alcanza el 90 % solo en race 400 (96 %); en race 100, race 200, ample y multi-uniform queda entre 78 y 87 %. Por la regla de §2.1, **el criterio del p95 no se da por cumplido** en esas filas: la cobertura exacta se cumple en la media, no en el percentil. No se cambia la regla.
- **ample 400 acepta entre 322 y 400 de 400** según la repetición: hasta 78 envíos por ejecución terminan en `503` por timeout del pool (5 s). Es variabilidad del límite del pool, no un fallo de una repetición.
