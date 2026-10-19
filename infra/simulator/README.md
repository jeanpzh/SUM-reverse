# Simulador PostgreSQL local

Este stack crea una campaña independiente con actores y credenciales sintéticos. Expone solo la interfaz por `http://127.0.0.1:5189`; PostgreSQL y las API quedan en la red interna de Compose. El proxy distribuye lecturas y escrituras entre dos API, y desactiva reintentos de upstream para evitar repetir envíos de matrícula.

[Resultados reales, capturas y límites de aceptación](../../evidence/local/simulador-produccion/fullstack-verification.md): diez rondas, 1.000 intentos, 100 aceptaciones y 900 rechazos por cupo, con auditoría SQL. Es un despliegue local controlado; antes de publicar hacen falta HTTPS, roles de DB separados y las comprobaciones operativas descritas en el informe.

Requisitos: Docker Engine y Docker Compose v2.24 o posterior. Desde la raíz, inicia el simulador con un comando:

```sh
docker compose up --build -d
```

Al abrir el dashboard en `http://127.0.0.1:5189`, Grafana está en `http://127.0.0.1:5190/d/sum-simulator-k6/sum-simulator-k6`. Para ejecutar la carrera k6 predeterminada y revisar sus resultados:

```sh
docker compose run --rm k6
```

La auditoría SQL opcional se ejecuta con `docker compose run --rm -e EXPECTED_ENROLLMENTS=10 -e EXPECTED_REQUESTS=100 audit`.

El primer arranque crea la configuración y secretos sintéticos dentro de `infra/simulator/runtime/`; no requiere Node ni un bootstrap en el host. La configuración se conserva al reiniciar. Para repetir matrícula, rota primero a una campaña fresca con `bash infra/simulator/rotate-campaign.sh <matrículas-actuales> <solicitudes-actuales> shared|distributed`; no se resetea la campaña automáticamente.

Compose incluye PostgreSQL, migración/seed, dos API, web, Prometheus y Grafana. PostgreSQL y las API quedan en la red interna; los puertos publicados escuchan solo en loopback. El simulador usa una campaña y actores sintéticos independientes. Ningún servicio se conecta a SUM ni monta snapshots.

## Escenarios k6

Todos leen el manifiesto sintético montado como solo lectura. Los contenedores API, seed y k6 usan UID/GID 1000, y el inicializador prepara los directorios privados para esa identidad. k6 apunta a `http://web`, el servicio Nginx de este Compose. La cabecera `Origin` aceptada queda limitada a la UI local. Los scripts nunca imprimen credenciales, cookies ni identificadores de alumno.

Lecturas aplica una tasa abierta de recorridos que sube de 10 a 25 y luego a la tasa objetivo (50 recorridos/s por defecto). Cada recorrido genera dos lecturas HTTP principales, más autenticación/sesión una vez por VU; por eso 50 recorridos/s no significa 50 solicitudes HTTP/s. `RATE` configura el último tramo y `DURATION` su duración:

```sh
docker compose --profile load run --rm k6 run /load/reads.js -e RATE=50 -e DURATION=2m
```

El escenario mantiene el cookie jar de cada VU entre iteraciones (`noCookiesReset: true`), igual que conserva su sesión académica en memoria; no vuelve a autenticarse en cada recorrido. Limita VUs a los 100 actores para no reutilizar credenciales simultáneamente y excluye los tags `auth` y `session` de las métricas con umbrales de lectura. `RAMP_10_DURATION` y `RAMP_25_DURATION` controlan los dos tramos iniciales (30 s cada uno por defecto); `READ_P95_MS` y `READ_P99_MS` cambian los umbrales solo si se pasan explícitamente. Fallan las verificaciones, los errores inesperados, los `dropped_iterations` o los límites p95/p99 configurados.

La matrícula usa una vuelta por cada uno de 100 actores sintéticos contra la misma sección de capacidad 10. Cada actor se autentica, crea sesión y lee contexto antes de esperar a una barrera común (60 s por defecto). `BARRIER_DELAY_MS` permite acortarla después de comprobar que todas las preparaciones caben; `BARRIER_TOLERANCE_MS` (1 s por defecto) limita y reporta el desfase del envío. La barrera aproxima inicios de envío, no garantiza simultaneidad exacta. Se verifican 10 aceptadas, 90 rechazadas por `SECTION_FULL`, cero resultados inesperados, cero iteraciones descartadas y p95/p99 de envío de 2/5 s:

```sh
docker compose --profile load run --rm k6 run /load/enrollment.js
bash load/audit-load.sh 10 100
```

Para pruebas de humo se pueden pasar, por ejemplo, `-e BARRIER_DELAY_MS=10000` y `-e MAX_DURATION=2m`. Si alguna preparación acaba fuera de la tolerancia, la ronda falla y no se cuenta como simultánea.

La auditoría backend verifica límites de capacidad, consistencia de ocupación, detalles, reportes y solicitudes aceptadas. Debe ejecutarse tras una ronda nueva de matrícula y su código de salida falla si las invariantes o el total esperado no coinciden.

La recuperación debe ejecutarse con una campaña fresca y sección disponible. Tras aceptar una solicitud, envía 20 replays concurrentes con el mismo UUID y compara cada respuesta completa canónica; cambia el payload conservando el UUID y comprueba `REQUEST_CONFLICT`, y luego prueba un UUID nuevo para el actor matriculado:

```sh
docker compose --profile load run --rm k6 run /load/recovery.js
bash load/audit-load.sh 1 2
```

El escenario de navegador usa la imagen oficial k6 con Chromium, inicia sesión en la UI y mide el tiempo hasta que aparecen `.sidebar`, `.topbar` y el nombre sintético del actor en `.account-button`. Mantén pocos VUs para no confundir este chequeo funcional con la carga HTTP:

```sh
docker compose --profile browser run --rm k6-browser run /load/browser.js
```

## Observabilidad local con Grafana

Prometheus y Grafana ya forman parte de `docker compose up --build -d`. Prometheus recibe remote-write desde k6, permanece interno y conserva muestras hasta 15 días o 1 GB. Grafana escucha solo en `127.0.0.1:5190`; el acceso anónimo tiene rol Viewer y la administración usa un secreto aleatorio local que no aparece en la configuración ni en logs de Compose. El dashboard provisionado usa UID `sum-simulator-k6` y filtro por `testid`.

`docker compose run --rm k6` crea un testid único, ejecuta la carrera de matrícula y envía sus métricas. Imprime el testid y enlace Grafana al comenzar. También se pueden ejecutar escenarios específicos con `sh load/run-observed.sh reads|enrollment|recovery|browser`. Los argumentos explícitos de k6 se conservan, por ejemplo `sh load/run-observed.sh reads -e RATE=50 -e DURATION=2m`. Las corridas anteriores a Grafana no se reconstruyen retroactivamente.

El dashboard conserva el historial disponible tras reiniciar. Las series identifican la corrida y no contienen identidad de actor, sesión, credenciales o campaña. Los contadores acumulativos se consultan con la última muestra de cada serie; los trends de latencia son percentiles calculados por intervalo y no representan el percentil global de la corrida. La auditoría SQL sigue siendo la comprobación de integridad de cupos.

El antiguo `compose.observability.yaml` se conserva como overlay vacío compatible con comandos existentes; la configuración activa vive en `compose.simulator.yaml` y la raíz `compose.yaml` la incluye.

`infra/simulator/bootstrap.sh` y `setup-observability.sh` quedan disponibles para instalaciones antiguas que todavía usan `.env`; no hacen falta para un entorno nuevo.

## Detener y conservar datos

```sh
docker compose down
```

Este comando conserva el volumen PostgreSQL y el manifiesto. No vuelvas a seedear una campaña ya creada. Para iniciar la siguiente de hasta diez rondas sobre la misma base, la rotación audita y cierra la campaña vigente, guarda su manifiesto bajo el UUID de campaña, crea nuevos UUIDs y vuelve a seedear una campaña independiente sin borrar el volumen:

```sh
bash infra/simulator/rotate-campaign.sh 10 100 distributed  # campaña anterior shared
bash infra/simulator/rotate-campaign.sh 100 100 shared     # campaña anterior distributed
```

Los dos primeros argumentos son las matrículas y solicitudes esperadas de la campaña que se cierra; usa `0 0` si solo hubo lecturas. El tercero configura la estrategia de contención de la campaña nueva. Para comparar estrategias, rota campañas frescas con el mismo resto de configuración. No borres el volumen; `down -v` eliminaría todas las rondas y resultados.

La rotación espera readiness de las APIs. Por defecto reconstruye imágenes; `SIMULATOR_REBUILD=0 bash infra/simulator/rotate-campaign.sh ...` reutiliza imágenes ya construidas cuando el código no cambió. La campaña `distributed` modifica el tamaño del catálogo y las aceptaciones, por lo que su tiempo no aísla por sí solo el coste de contención.

[Aceptación real de Grafana, captura y limitaciones de las gráficas](../../evidence/local/simulador-produccion/observability/verification.md). La corrida `cupos-20261019-grafana-02` muestra 10 aceptadas, 90 rechazos y 100 completadas; la prueba `lecturas-20261019-grafana-01` permite ver throughput con varias muestras. Selecciona el `testid` y un intervalo que incluya la ejecución.

La campaña dejada por esta aceptación tiene diez matrículas y cien solicitudes. Para repetir la carrera, audita y rota primero; los datos históricos de Prometheus/Grafana se conservan:

```sh
SIMULATOR_REBUILD=0 bash infra/simulator/rotate-campaign.sh 10 100 shared
sh load/run-observed.sh enrollment -e BARRIER_DELAY_MS=10000
bash load/audit-load.sh 10 100
```
