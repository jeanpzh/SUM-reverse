# Simulador PostgreSQL local

Este stack crea una campaña independiente con actores y credenciales sintéticos. Expone solo la interfaz por `http://127.0.0.1:5189`; PostgreSQL y las API quedan en la red interna de Compose. El proxy distribuye lecturas y escrituras entre dos API, y desactiva reintentos de upstream para evitar repetir envíos de matrícula.

[Resultados reales, capturas y límites de aceptación](../../evidence/local/simulador-produccion/fullstack-verification.md): diez rondas, 1.000 intentos, 100 aceptaciones y 900 rechazos por cupo, con auditoría SQL. Es un despliegue local controlado; antes de publicar hacen falta HTTPS, roles de DB separados y las comprobaciones operativas descritas en el informe.

Requisitos del host: Docker Engine con Compose, Node.js para generar UUID criptográficamente aleatorios y el directorio de runtime del usuario que ejecuta los contenedores (el bootstrap configura su UID/GID).

## Crear y arrancar

Desde la raíz del repositorio:

```sh
sh infra/simulator/bootstrap.sh
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml up --build -d
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml ps
```

El bootstrap crea secretos aleatorios y la carpeta privada `infra/simulator/runtime/results`, propiedad del UID/GID que ejecuta los contenedores y con modo `0700`, para los reportes k6. Compose ejecuta migración y seed antes de iniciar las API. El manifiesto `manifest.json` contiene exclusivamente credenciales sintéticas y permanece con modo `0600`; no lo copies ni lo imprimas. La API limita intentos por IP a 2000 por minuto para permitir 100 autenticaciones de preparación en una ronda con un margen finito. El límite por credencial sigue activo.

La primera construcción compila el cliente con `VITE_SUM_SIMULATOR=1`, `VITE_SUM_DATA_MODE=local` y `VITE_SUM_API_BASE_URL=/api`. Ningún servicio se conecta a SUM. El listener HTTP y la cookie sin `Secure` solo son válidos para loopback local; no publiques el servicio en otra interfaz.

## Escenarios k6

Todos leen el manifiesto privado montado como solo lectura. El contenedor k6 corre con el mismo UID/GID configurado por bootstrap y apunta a `http://web`, el servicio Nginx de este Compose. La cabecera `Origin` aceptada queda limitada a la UI local. Los scripts nunca imprimen credenciales, cookies ni identificadores de alumno.

Lecturas aplica una tasa abierta de recorridos que sube de 10 a 25 y luego a la tasa objetivo (50 recorridos/s por defecto). Cada recorrido genera dos lecturas HTTP principales, más autenticación/sesión una vez por VU; por eso 50 recorridos/s no significa 50 solicitudes HTTP/s. `RATE` configura el último tramo y `DURATION` su duración:

```sh
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml --profile load run --rm k6 run /load/reads.js -e RATE=50 -e DURATION=2m
```

El escenario mantiene el cookie jar de cada VU entre iteraciones (`noCookiesReset: true`), igual que conserva su sesión académica en memoria; no vuelve a autenticarse en cada recorrido. Limita VUs a los 100 actores para no reutilizar credenciales simultáneamente y excluye los tags `auth` y `session` de las métricas con umbrales de lectura. `RAMP_10_DURATION` y `RAMP_25_DURATION` controlan los dos tramos iniciales (30 s cada uno por defecto); `READ_P95_MS` y `READ_P99_MS` cambian los umbrales solo si se pasan explícitamente. Fallan las verificaciones, los errores inesperados, los `dropped_iterations` o los límites p95/p99 configurados.

La matrícula usa una vuelta por cada uno de 100 actores sintéticos contra la misma sección de capacidad 10. Cada actor se autentica, crea sesión y lee contexto antes de esperar a una barrera común (60 s por defecto). `BARRIER_DELAY_MS` permite acortarla después de comprobar que todas las preparaciones caben; `BARRIER_TOLERANCE_MS` (1 s por defecto) limita y reporta el desfase del envío. La barrera aproxima inicios de envío, no garantiza simultaneidad exacta. Se verifican 10 aceptadas, 90 rechazadas por `SECTION_FULL`, cero resultados inesperados, cero iteraciones descartadas y p95/p99 de envío de 2/5 s:

```sh
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml --profile load run --rm k6 run /load/enrollment.js
bash load/audit-load.sh 10 100
```

Para pruebas de humo se pueden pasar, por ejemplo, `-e BARRIER_DELAY_MS=10000` y `-e MAX_DURATION=2m`. Si alguna preparación acaba fuera de la tolerancia, la ronda falla y no se cuenta como simultánea.

La auditoría backend verifica límites de capacidad, consistencia de ocupación, detalles, reportes y solicitudes aceptadas. Debe ejecutarse tras una ronda nueva de matrícula y su código de salida falla si las invariantes o el total esperado no coinciden.

La recuperación debe ejecutarse con una campaña fresca y sección disponible. Tras aceptar una solicitud, envía 20 replays concurrentes con el mismo UUID y compara cada respuesta completa canónica; cambia el payload conservando el UUID y comprueba `REQUEST_CONFLICT`, y luego prueba un UUID nuevo para el actor matriculado:

```sh
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml --profile load run --rm k6 run /load/recovery.js
bash load/audit-load.sh 1 2
```

El escenario de navegador usa la imagen oficial k6 con Chromium, inicia sesión en la UI y mide el tiempo hasta que aparecen `.sidebar`, `.topbar` y el nombre sintético del actor en `.account-button`. Mantén pocos VUs para no confundir este chequeo funcional con la carga HTTP:

```sh
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml --profile browser run --rm k6-browser run /load/browser.js
```

## Observabilidad local con Grafana

La extensión es un overlay del proyecto Compose existente. Conserva el modo local por defecto y no cambia ninguna pantalla React. No recoge series históricas anteriores a su instalación. Prometheus recibe solo remote-write desde k6, no expone un puerto del host y conserva muestras en un volumen propio con retención de 15 días y límite de 1 GB. Grafana escucha solo en 127.0.0.1:5190; el acceso anónimo tiene rol Viewer. Su contraseña administrativa aleatoria se guarda en el .env privado existente y nunca se imprime.

Después de crear el entorno base, prepara el secreto de Grafana y arranca el stack combinado:

~~~sh
sh infra/simulator/setup-observability.sh
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml -f compose.observability.yaml up --build -d
~~~

El setup añade únicamente GRAFANA_ADMIN_PASSWORD cuando falta, preserva la campaña actual y no muestra el contenido de .env. Las imágenes oficiales quedan fijadas en Prometheus v3.13.4 y Grafana 13.2.4, cada una por digest en el overlay. No se habilitan telemetría, comprobaciones de actualización ni plugins externos.

Abre http://127.0.0.1:5190/d/sum-simulator-k6/sum-simulator-k6. El dashboard se provisiona con UID sum-simulator-k6, datasource simulator-prometheus y filtro obligatorio de corrida testid. La ventana inicial es la última hora y se puede cambiar sin mezclar corridas; tras cerrar y reabrir los servicios, los volúmenes conservan el historial disponible.

Ejecuta un escenario observando solo el simulador local. El wrapper asigna un UUID nuevo por defecto. Para aceptación se puede fijar un ID sintético estable mediante OBSERVABILITY_TEST_ID; debe tener entre 1 y 64 caracteres ASCII alfanuméricos, _ o -, y ser único para cada corrida. Los argumentos siguientes se pasan a k6:

~~~sh
sh load/run-observed.sh reads -e RATE=50 -e DURATION=2m
sh load/run-observed.sh enrollment
sh load/run-observed.sh recovery
sh load/run-observed.sh browser
~~~

Cada ejecución usa --out experimental-prometheus-rw hacia http://prometheus:9090/api/v1/write dentro de la red Compose y el tag global testid. El resumen JSON y log quedan bajo infra/simulator/runtime/results/ (modo 0700); el wrapper solo imprime testid, escenario, estado y ruta del resumen. Conserva sin alterar el código 99 de k6 cuando fallan thresholds y los demás códigos no cero; si k6 devuelve cero pero su log dice que no pudo enviar time series, devuelve 1 y marca la corrida como no disponible en Grafana. Los nombres de operación HTTP son estáticos y url se excluye de systemTags; no se exportan actor, sesión, credencial o campaña como etiquetas. Las métricas de navegador también excluyen name, que podría reflejar una URL.

Métricas y consultas PromQL útiles, siempre filtradas por el testid elegido:

~~~promql
sum(rate(k6_http_reqs_total{testid="$TEST_ID"}[1m]))
sum(k6_http_reqs_total{testid="$TEST_ID"})
max by (operation, name) (k6_http_req_failed_rate{testid="$TEST_ID",operation!=""}) * 100
sum(k6_vus{testid="$TEST_ID"})
min(k6_checks_rate{testid="$TEST_ID"}) * 100
(sum(last_over_time(k6_enrollments_accepted_total{testid="$TEST_ID"}[$__range])) or on() (0 * sum(last_over_time(k6_iterations_total{testid="$TEST_ID"}[$__range]))))
(sum(last_over_time(k6_enrollments_section_full_total{testid="$TEST_ID"}[$__range])) or on() (0 * sum(last_over_time(k6_iterations_total{testid="$TEST_ID"}[$__range]))))
(sum(last_over_time(k6_enrollments_unexpected_total{testid="$TEST_ID"}[$__range])) or on() (0 * sum(last_over_time(k6_iterations_total{testid="$TEST_ID"}[$__range]))))
(sum(last_over_time(k6_enrollment_iterations_completed_total{testid="$TEST_ID"}[$__range])) or on() (0 * sum(last_over_time(k6_iterations_total{testid="$TEST_ID"}[$__range]))))
1000 * k6_http_req_duration_p95{testid="$TEST_ID",operation!=""}
~~~

Los contadores k6_enrollments_accepted_total, k6_enrollments_section_full_total, k6_enrollments_unexpected_total y k6_enrollment_iterations_completed_total son acumulativos. El dashboard recupera la última muestra por serie dentro del periodo seleccionado y suma esos últimos valores; sumar todas las muestras volvería a contar acumulados. Si un contador sin incrementos no aparece en remote-write, la consulta devuelve 0 solo cuando existe k6_iterations_total para ese testid; sin una corrida observada conserva No data. Los cuatro resultados de Trend configurados en k6 (p95, p99, avg, max) son gauges calculados por intervalo de envío, 5 s por defecto. Las líneas de duración permanecen separadas por operación y nombre estático de ruta; no se colapsan ni promedian percentiles de rutas diferentes. El panel de checks presenta la tasa mínima entre checks individuales. La tasa de fallo HTTP se presenta como peor tasa por ruta desde el gauge de k6, no como una media global. La gráfica de solicitudes acumuladas sigue siendo útil en ejecuciones cortas donde una ruta solo exporta una muestra y rate() no dispone de dos puntos. Las métricas de duración se expresan en segundos y el dashboard las multiplica por 1.000 para mostrarlas en milisegundos. Un p95/p99 de intervalo no es un percentil global de toda la corrida ni se debe sumar o promediar entre series. Las aceptaciones/rechazos son Outcomes académicos; SECTION_FULL con HTTP 200 no cuenta como error HTTP. La auditoría SQL del simulador sigue siendo la comprobación de integridad de cupos.

Para detener los servicios, conserva los volúmenes eliminando solo contenedores:

~~~sh
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml -f compose.observability.yaml down
~~~

## Detener y conservar datos

```sh
docker compose --env-file infra/simulator/.env -f compose.simulator.yaml down
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
