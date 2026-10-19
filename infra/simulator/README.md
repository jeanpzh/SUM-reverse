# Simulador PostgreSQL local

Este stack crea una campaña independiente con actores y credenciales sintéticos. Expone la interfaz por `http://127.0.0.1:5189` y, opcionalmente, mediante Tailscale Serve; PostgreSQL y las API quedan en la red interna de Compose. El proxy distribuye lecturas y escrituras entre dos API, y desactiva reintentos de upstream para evitar repetir envíos de matrícula.

## Acceso tailnet opcional

El acceso remoto del simulador se publica únicamente a través de Tailscale Serve. El proxy web mantiene `/api` en el mismo origen de la interfaz. Sin `infra/simulator/runtime/tailscale.env`, el acceso local y k6 conservan su configuración habitual. Prometheus publica su puerto en `127.0.0.1:9090` para Serve y no escucha en interfaces de red.

Después de configurar Serve para el servicio `web` en el puerto 8443 y Prometheus en 8444, obtén del propio nodo sus URL/autoridad HTTPS exactas y guarda solo estos tres valores en el archivo local ignorado `infra/simulator/runtime/tailscale.env`:

```dotenv
SIMULATOR_TAILNET_ORIGIN=https://<host-tailnet>:8443
SIMULATOR_TAILNET_AUTHORITY=<host-tailnet>:8443
SIMULATOR_TAILNET_HOST=<host-tailnet>
```

`ORIGIN` y `AUTHORITY` deben coincidir exactamente con el origen y el `Host` que llegan a Nginx; no se aceptan patrones. `HOST` es el nombre no loopback enviado a la API para que use la cookie segura `__Host-simulator-session`. El backend conserva su origen público local para la validación de mutaciones; Nginx acepta el origen tailnet configurado y lo normaliza al origen local antes de reenviar la solicitud.

Ejemplo de configuración de Serve, ejecutado por el operador desde el nodo tailnet. Mantén el listener de Grafana en 443 que ya esté configurado, no habilites Funnel y no publiques PostgreSQL ni las API directamente:

```sh
tailscale serve --bg --https=8443 http://127.0.0.1:5189
tailscale serve --bg --https=8444 http://127.0.0.1:9090
tailscale serve status
```

La opción `--bg` deja activos ambos listeners mientras se configura el siguiente; consulta la [referencia oficial de `tailscale serve`](https://tailscale.com/docs/reference/tailscale-cli/serve) para la sintaxis vigente.

Tras regenerar el archivo con las URLs y autoridad actuales del nodo, recrea solo el proxy para que lea el entorno actualizado:

```sh
docker compose up -d --force-recreate web
```

Los valores de nombre de nodo pueden cambiar al renombrar el dispositivo o cambiar de tailnet. No guardes esos valores en el repositorio ni en evidencia; al quitarlos, elimina el archivo local y recrea el servicio `web` para volver a defaults inactivos. El archivo se inyecta solo en `web`; no se alteran las pantallas ni el cliente SUM existente.

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

Prometheus y Grafana ya forman parte de `docker compose up --build -d`. Prometheus recibe remote-write desde k6, publica su puerto solo en loopback y conserva muestras hasta 15 días o 1 GB. Grafana escucha solo en `127.0.0.1:5190`; el acceso anónimo tiene rol Viewer y la administración usa un secreto aleatorio local que no aparece en la configuración ni en logs de Compose. El dashboard provisionado usa UID `sum-simulator-k6` y filtro por `testid`.

`docker compose run --rm k6` crea un testid único, ejecuta la carrera de matrícula y envía sus métricas. Imprime el testid y enlace Grafana al comenzar. También se pueden ejecutar escenarios específicos con `sh load/run-observed.sh reads|enrollment|recovery|browser`. Los argumentos explícitos de k6 se conservan, por ejemplo `sh load/run-observed.sh reads -e RATE=50 -e DURATION=2m`. Las corridas anteriores a Grafana no se reconstruyen retroactivamente.

La carrera de matrícula termina rápido y puede dejar una sola muestra real por ruta: los marcadores del dashboard la muestran como punto, pero `rate()` necesita al menos dos muestras reales y no se interpolan ni sintetizan muestras o tasas. Para ver curvas de lectura sostenidas, ejecuta un escenario `reads` más largo con un `testid` único en cada corrida:

```sh
docker compose run --rm -e RATE=10 -e RAMP_10_DURATION=10s -e RAMP_25_DURATION=10s -e DURATION=1m k6 run --tag testid=reads-demo-$(cat /proc/sys/kernel/random/uuid) --out experimental-prometheus-rw /load/reads.js
```

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

## Escenarios con 400 alumnos

Se mantiene **un solo Compose**. La batería crea una campaña sintética fresca por escenario, conserva el historial anterior, publica métricas en Grafana y audita PostgreSQL al terminar. Los alumnos y los códigos son nuevos al rotar campaña; un código anterior deja de servir para la campaña activa. No modifica el modo local de escenarios ni las pantallas SUM.

```bash
# Batería completa: incluye carga mixta de 10 min y permanencia de 30 min.
bash load/scenarios.sh all

# Misma población de 400, con tiempos cortos para verificar el funcionamiento.
SCENARIO_QUICK=1 bash load/scenarios.sh all

# Ejecutar solo un caso.
bash load/scenarios.sh race
```

| Nombre | Qué hace | Resultado esperado en campaña fresca |
| --- | --- | --- |
| `login` | Acceso de 400 identidades en una ventana de 5 s | 400 accesos y contextos válidos; ninguna matrícula |
| `race` | Confirmaciones sincronizadas contra 10 cupos | 10 aceptados, 390 rechazos `SECTION_FULL` |
| `last-seat` | Nueve matrículas iniciales y 400 nuevos contendientes | 1 nuevo aceptado, 399 rechazos; SQL termina con 10 matrículas y 409 solicitudes |
| `ample` | Cupos suficientes para todos | 400 matrículas completas y reportes |
| `mixed` | Consultas, preparación y una confirmación por alumno con pausas | 400 matrículas únicas, sin solicitudes duplicadas; las acciones de envío pasan a lectura después de matricularse |
| `multi-uniform` | Cinco grupos con demanda uniforme, mismo catálogo | 100 aceptados y 300 rechazos; sin sobrecupos por sección |
| `multi-hotspot` | 80 % solicita el primer grupo; 20 % se reparte entre los otros cuatro | 100 aceptados y 300 rechazos; permite comparar contención con el mismo catálogo |
| `retry` | Doble clic concurrente, payload cambiado, UUID nuevo y consulta posterior | 400 matrículas, 800 solicitudes persistidas; replays sin efectos nuevos |
| `resilience` | Detiene una API y después PostgreSQL durante lecturas de 400 sesiones | Fallos transitorios acotados, todas las sesiones recuperadas, sin cambios de matrícula |
| `stress` | Escalones de 50, 100, 200 y 400 sesiones; mantiene 400 durante 10 min | Medir latencia, capacidad de respuesta y colas; cero errores inesperados |
| `soak` | Los mismos escalones, con 30 min a 400 sesiones | Observar memoria, colas y renovación de sesiones antes de expirar |
| `reads` | Llegadas de lecturas por segundo, independientes del tiempo de respuesta | Medir carga objetivo/obtenida y `dropped_iterations`; no representa 400 navegadores |

El modo `SCENARIO_QUICK=1` reduce los escalones a 5 s, las pausas a 0.2–0.5 s y la permanencia a 30 s (60 s para recuperación). **No equivale a una prueba de duración de 30 minutos**. `SCENARIO_DURATION=2m` permite cambiar explícitamente la permanencia; `SCENARIO_ACTORS=400` es el valor por defecto y admite 1..1000 para exploración. Las expectativas se calculan según población y perfil; las cifras de la tabla corresponden a 400.

Cada ejecución imprime su `testid`, URL de Grafana y resultado con conteos SQL esperados/reales. El proceso devuelve un código distinto de cero si falla un umbral o una auditoría; conserva el informe para distinguir **integridad**, **verificaciones funcionales** y **rendimiento**. No aumenta silenciosamente los objetivos actuales de p95 < 2 s / p99 < 5 s. Los logs y resúmenes quedan en `infra/simulator/runtime/results/`, excluidos de Git. No ejecute dos baterías ni el arnés de fallos contra la misma campaña a la vez; comparten un bloqueo local. Interrumpir el caso de recuperación intenta restaurar los servicios.

El runner necesita Bash, Docker Compose y `flock`; los UUID, lectores de JSON y auditorías se ejecutan dentro de los contenedores existentes. Después del primer build se puede usar `SCENARIO_BUILD=0` si el código backend no cambió. El arranque habitual `docker compose up --build -d` sigue siendo válido; `docker compose run --rm k6` conserva la prueba de matrícula de la campaña que esté activa, que debe estar fresca para que sus expectativas se cumplan.

### Métricas para explicar las demoras

Los paneles k6 filtran por `testid`. Los nuevos paneles operativos muestran el despliegue durante el intervalo elegido: CPU y memoria de cada API, demora del event loop, conexiones y espera del pool, categorías de espera en PostgreSQL y disponibilidad del colector. Estas series operativas son comunes a las ejecuciones; no incluyen identificadores de alumnos. El colector usa internamente el endpoint protegido y no publica ningún puerto al host. Las esperas globales de PostgreSQL se combinan con `max` entre observadores para no contarlas dos veces. El p95 de event loop corresponde a la vida del proceso; no es el p95 de solicitudes.

La CPU indicada por el usuario al 100 % correspondía a GitHub Codespaces. Los resultados de otro host se informan con sus propios recursos y no se extrapolan a Codespaces ni al SUM. Para medir capacidad del servidor sin que el generador compita por CPU, ejecutar k6 en un host separado requiere una configuración explícita de entorno sintético; los scripts actuales mantienen el guard de destino local/Docker.
