# Registro: simulador PostgreSQL y concurrencia

Fecha: 2026-10-19. Etapa actual: implementación y aceptación Docker sintética ejecutadas; publicación externa pendiente. Las secciones iniciales conservan el historial de planificación; el cierre de ejecución figura al final.

## Encargo y decisiones

Plan para producción del simulador propio con PostgreSQL, identidad temporal sustituible, exclusión de rematrícula y experimento k6 de cupos. Local conserva comportamiento y pantallas SUM. Complejidad/impacto altos; incertidumbre media. Fuente: requerimiento del usuario, código y contratos propios leídos estáticamente; documentación oficial de PostgreSQL, Oracle y k6 enlazada en el plan. Todo diseño nuevo es local-only. No hubo inspección SUM ni servidores locales, ejecución de carga ni acceso a datos privados.

[Plan](../plans/simulador-postgresql-concurrencia.md) y [extensión propuesta SIM-PUBLIC-1](../contracts/local-api/simulador-produccion.md). Reutilizan contratos matrícula regular/dashboard y sus reglas, resultados y vistas. No se acredita fidelidad nueva ni comportamiento de SUM.

## Roles

Se inició un worker con override real gpt-6.1-sol/high y se interrumpió al recibir la instrucción de eliminar delegación de planificación. El principal escribió el plan y el contrato. No se despachó implementación. Política actualizada en AGENTS.md, sum-workflow/SKILL.md y model-routing.md: planificación por principal, implementación gpt-6-luna/high. Validador de roles deja de requerir planner/reviewer. No existían directorios .codex/agents ni ~/.codex/agents en esta sesión; no se afirma haber borrado TOML inexistentes ni validado configuración runtime.

CodeGraph no inicializado: configuración disponible solo excluye datos-reales y no cumple las exclusiones completas requeridas. No se modificó ni indexó; lectura de archivos explícitos para planificación.

## Comprobaciones documentales reales

| Criterio | Comprobación | Resultado |
| --- | --- | --- |
| Principal planifica; Luna High implementa | Python3: ausencia sum-planner y presencia Luna High en tres documentos activos | PASS |
| Validador mantiene sintaxis | ast.parse de validate_routing.py, sin ejecutarlo ni crear hilos | PASS |
| Navegación de documentos | Resolver todos los enlaces relativos del plan y contrato | PASS |
| Aceptación medible | Presencia A1–A12 y revisión manual de resultados esperados/pendientes | PASS |
| Formato de cambios | git diff --check con archivos explícitos | PASS |

No se ejecutaron build/lint de aplicaciones, pruebas, migraciones, seed ni despliegue: no corresponden a esta etapa documental. Los resultados A1–A12 permanecen pendientes. El plan contiene SLO/carga/retención propuestos y decisiones de hosting/acceso a fijar antes de las tareas dependientes. No hay autorización inferida para ejecutar k6 contra una URL no identificada.

## Reorientación por síntoma reportado

2026-10-19: usuario propone bots y pide identificar primero el problema; confirma «La página demora o no carga». Testimonio sin traza del incidente. Principal añadió D0 al plan: caracterización de carga de página, hipótesis separadas y experimentos híbridos k6 HTTP/navegador. Integridad de cupos sigue en alcance, posterior a medición de lecturas y saturación. No se ejecutaron bots, pruebas ni inspección SUM; causa real desconocida.

## Implementación autorizada

Usuario «está bien, hazlo»: etapa de ejecución con entorno sintético aislado, previo a publicación. Principal coordina. Workers reales mediante override del harness: backend_simulator y frontend_simulator, gpt-6-luna/high, fork_turns=none, archivos disjuntos backend/** y client/**. No hay roles TOML disponibles; no se simula selección nativa. Principal mantiene docs/shared/infra y aceptación. CodeGraph CLI ausente; no se pudo init; configuración raíz completada con exclusiones de privados/deps y followSymlinks=false antes de workers.

Principal amplía únicamente tipo/validación de identidad compartida a IDs sintéticos válidos; catálogo fijo local permanece. Compatibilidad: DTOs intactos, ampliación aditiva para nuevos actores; no componente/contrato paralelo. Comprobaciones y resultados de implementación se registrarán al finalizar.

### Preparación real del entorno

Principal instaló PostgreSQL 18.6 y k6 v2.3.0 (binario oficial con SHA256 contrastado contra checksums de release). Inicializó un cluster nuevo en /tmp/sum-simulator-synthetic-pg, solo 127.0.0.1:55432, y creó base vacía sum_simulator_synthetic. No se usó el servicio existente del operador ni snapshots. Manifiestos/logs exclusivamente sintéticos de esta ejecución en /tmp/sum-simulator-artifacts, fuera del repositorio. CodeGraph no disponible; sin indexación. Infraestructura de pruebas confirmada sintética antes de iniciar servidores.

D0: hipótesis y mediciones ya especificadas; la causa SUM continúa unverified. P1: inventario de catorce claves públicas y proyecciones documentado en SIM-PUBLIC-1; DTO y catálogo local reutilizados. Ampliación de identidad shared validada con `node --test shared/local-profile-dashboard.test.mjs`: 8/8 PASS, incluye nuevos actores, IDs malformados y catálogo local fijo.

### Cambio solicitado: Docker reproducible

El usuario pide Docker para PostgreSQL y k6. Docker Engine 29.1.3 y Compose 2.40.3 disponibles; se ejecutó k6 2.3.0 dentro de contenedor y PostgreSQL 18.6 está operativo en un contenedor creado para esta tarea, puerto loopback 55433, base sum_simulator_synthetic. Imágenes fijadas por tag y digest para Compose. PostgreSQL host55432 solo preparatorio y no acredita el requisito Docker. Se prevé stack Compose con dos instancias propias y proxy, migración/seed explícitos y carga aislada.

Principal añadió .dockerignore con allowlist de fuentes app/infra y exclusiones finales de datos-reales, env, dependencias, llaves y runtime ANTES de cualquier docker build. No se enviaron datos privados al contexto. Runtime/manifiestos sintéticos quedan excluidos de git. Hardware del entorno de ejecución: linux x64, 2 CPU lógicas, 8 GiB RAM; no equivale al hosting final.

Regresión mock `pnpm --dir client verify` falló en script línea192 por títulos históricos: espera RESUMEN DEL HISTORIAL ACADÉMICO pero AcademicHistory vigente usa Resumen académico/Promedio por periodo. Componentes y ruta coinciden con HEAD, sin cambio de esta tarea. Se solicita actualizar la expectativa del script dentro de propiedad frontend; no se considera aprobado ni se modifica UI para acomodarlo.

### Avance de comprobaciones por capa

Worker frontend reportó comandos reales: build habitual PASS, build con variables de simulador PASS, lint PASS, test:data 182/182 PASS. Pendiente aceptación integrada propia del principal. El principal prepara scripts/verify-simulator.mjs como escenario de aceptación con navegador, base propia sintética y sin conexiones externas; por ahora solo `node --check` PASS, escenario aún no ejecutado.

Segundo intento `client verify` tras corregir títulos falló en línea194: selector legacy `.history-table thead th` devuelve vacío. Diagnóstico: script desactualizado también respecto a clases actuales de AcademicHistory. Se consumió una reparación automática del script; no se continúan arreglos sucesivos ni se modifica la pantalla. La regresión completa de ese script permanece fallida; no invalida por sí misma los checks de contrato pero impide declararla aprobada.


## Cierre de ejecución Docker, 2026-10-19

El principal reutilizó y completó el plan y contrato, dirigió dos workers reales gpt-6-luna/high y ejecutó la aceptación integrada. No hubo planificación delegada tras la instrucción del usuario ni subdelegación. El ownership posterior de frontend incluyó infra/simulator, Compose y load con handoff explícito; el principal hizo correcciones aisladas diagnosticadas en Dockerfile CMD, contexto allowlist raw-types, montajes de resultados y readiness de rotación. Las pantallas SUM se conservaron; únicamente la variante de acceso efímero estuvo autorizada.

Implementado: puerto EnrollmentStore y adaptador PostgreSQL transaccional, migración/seed/audit/cierre, identidad con cookie HttpOnly revocable y TTL15min, proveedores sustituibles en ambas capas, consultas existentes protegidas, catorce proyecciones desde DB, deduplicación durable y exclusión de rematrícula. Shared amplió solo la validación/tipo de ID SYN; el catálogo local conserva cuatro entradas. No hay fallback público a mocks o snapshots.

La preparación nativa inicial fue sustituida para aceptación por Docker. Cluster host55432 detenido. Contenedor auxiliar de tests55433 separado del stack; las carreras oficiales usan solo PostgreSQL interno Compose y dos API detrás del proxy en loopback5189. Runtime y manifiestos sintéticos son privados de operación y están excluidos de git/contexto Docker. No hubo acceso a datos-reales ni a sus contenidos por otras vías.

### Resultados comprobados

- Diez rondas Docker k6, cien alumnos/campaña y diez plazas: 1000 intentos, 100 aceptaciones, 900 SECTION_FULL, cero inesperados/descartes; diez auditorías exactas10/100. p95 por ronda máximo794,38ms; máximo desfase de barrera154ms.
- Control distributed100/100 y auditoría100/100; no se interpreta como comparación causal de rendimiento.
- Recovery k6: 20 replays concurrentes idénticos, conflicto409 por payload diferente y nueva clave ALREADY_ENROLLED; auditoría1/2.
- API detenida con SIGKILL durante INSERT de detalle bloqueado: rollback sin efectos parciales; reinicio de ambas, retry exactamente una vez, cuerpo confirmado descartado y lookup durable después de nuevo reinicio, veinte nuevas claves concurrentes rechazadas. Auditoría UI+crash2/22.
- Rampa de lecturas40s hasta50 recorridos/s (dos GET por recorrido): 1025 recorridos/2050 lecturas, cero errores/descartes, p9521,33ms/p9942,21ms. Dos Chromium durante carga llegan a identidad propia y shell, p95ready2355,7ms. No mide saturación ni capacidad sostenida del hosting final.
- Control negativo aislado p95<0,0001ms: HTTP/checks100%, cero inesperados, exit99 por umbral. Primera tentativa concurrente con crash se descartó como control aislado; solo repetición posterior sin caos se reporta.
- React→NestJS→PostgreSQL Playwright real1536×735: login/recarga/selección/matrícula/reporte/logout revocado/relogin/lookup PASS, sin red externa ni errores JS. Fidelidad nueva a SUM no acreditada; geometría local preservada.
- Backend build/lint/scripts PASS, e2ePostgres shared/distributed PASS y lock-timeout503/retry PASS. Unitarias focalizadas10archivos208/208PASS. Frontend builds/lint PASS y datos184/184PASS; shared8/8PASS. Bootstrap temporal: permisos/dueño/resultados/sobrescritura PASS. ConfigComposequiet y diffcheck PASS.

Los fallos de arnés UUID/cookies/HOME de k6 se conservaron y diagnosticaron; nunca se contaron como rondas aprobadas. Backend corrigió errores503, SQL de métricas y cierre de pool tras diagnóstico; al final corrigió errores PG de auth que podían mapearse401, logout y Retry-After429, con tres unitarias focalizadas y reconstrucción Docker. El algoritmo de cupos permaneció durante esa corrección final.

Regresiones globales no aprobadas: client verify conserva fallo de selector histórico tras una reparación; backend test global se interrumpió ante timeout del navegador legacy. No se modificaron pantallas para hacer pasar esas expectativas. A8 combinatoria PostgreSQL, A9 regresión global, A11backup/rollback de versión y publicación HTTPS quedan parciales/pendientes según matriz del informe. No se afirma producción lista ni causa real de caída de SUM.

Evidencia durable, números sanitizados, capturas propias y matriz criterio→escenario→resultado: [aceptación integrada](../../../evidence/local/simulador-produccion/fullstack-verification.md). Reproducción: [guía Docker](../../../infra/simulator/README.md). Se preservó volumen/campañas y no se publicaron credenciales. Cambios sin commit.

Cierre final: reconstrucción Docker de auth PASS; nueva carrera de confirmación10/90 y auditoría10/100 PASS (fuera de la serie original); HTTP real401/429+Retry-After60 PASS; rotación a campaña de revisión y Playwright completo sobre versión final PASS. Ambas APIs/PostgreSQL healthy, UI loopback5189. Contenedor auxiliar de pruebas detenido sin borrar volumen. Capturas actualizadas a esta versión, huella SHA256 de fuentes registrada y enlaces relativos resueltos.

## Extensión Grafana autorizada (2026-10-19)

Usuario «hazlo» tras propuesta concreta Grafana+Prometheus en Compose. Principal añadió diseño/tareas/criterios G1–G6 al plan existente antes del handoff. Worker real observability_implementation, gpt-6-luna/high, fork_turns=none, sin subdelegación, ownership overlay/infra observability/wrapper load y tags mínimos; no aplicación React/NestJS. Principal conserva evidencia/scripts de aceptación y navegador. Se preserva fidelidad visual y de interacción SUM; ninguna pantalla existente autorizada a cambiar. Estado: en ejecución.

Se reutilizó la campaña Docker independientemente sintética; antes de nueva carga se auditó y cerró la campaña de revisión anterior1/1 mediante rotación existente. No se borró volumen ni se inspeccionaron privados. Nueva observabilidad solo loopback5190; Prometheus interno. Las series históricas de las diez rondas no existen y no se reconstruyen de JSON agregados. Fuente técnica: documentación oficial remote-write k6, provisioning Grafana y almacenamiento Prometheus consultada durante esta extensión. Resultados reales G pendientes hasta aceptación.

### Instalación CodeGraph solicitada durante observabilidad

Principal instaló `@colbymchenry/codegraph@1.6.2` global mediante npm (paquete oficial colbymchenry/codegraph); CLI `codegraph --version` devuelve1.6.2. `codegraph telemetry off` ejecutado y variables CODEGRAPH_TELEMETRY=0/DO_NOT_TRACK=1 usadas al comprobar. No se ejecutó install auto-wiring, init/index, watcher ni MCP; no se modificaron configuraciones globales de agentes. La sesión no adquiere una herramienta MCP automáticamente por instalar CLI.

Hallazgo de revisión de fuentes instaladas: ProjectConfig soporta exclude pero no followSymlinks; extraction/index.js sigue symlinks explícitamente en el walker (y no garantiza quedarse en raíz para lectura de fuentes). Se eliminó la opción ineficaz de codegraph.json y se añadieron exclusiones explícitas runtime/exports/snapshots/datos-sinteticos/logs. El índice de este repositorio queda sin inicializar hasta disponer de un recorrido que no acceda a árboles privados a través de symlinks; las exclusiones textuales no se presentan como aislamiento técnico de esta sesión. Esto no bloquea la instalación pedida ni la implementación Grafana. No se leyeron/listaron/indexaron datos privados. Fuentes: README oficial y tipos/código del paquete instalado, no datos del proyecto.

### Cierre G1–G6: observabilidad verificada

Overlay ejecutado con Grafana13.2.4/Prometheus3.13.4 por digest; puerto5190solo127.0.0.1, Prometheusinterno, Vieweranónimo y administración con secreto nuevo propio. Datasource/dashboard provisionados, quince paneles y selector de testid. Root corrigió argumento booleano inválido de Prometheus (un cicloG1) y colores de stats; worker corrigió nombres reales de series tras diagnóstico (un cicloG2). No se tocaron pantallas SUM.

Carrera remota válida cupos-20261019-grafana-02: 10aceptadas/90SECTION_FULL/0inesperadas/100completadas; auditoríaSQL10/100, 144series sinlabelsdeidentidad. Latenciap95Prom0,73325767225s=733,25767225msJSON. Navegador real1536×1000 con stats ylatencias visibles, sinerrores JS/datasource ni redexterna. ReinicioGrafana+Prometheus preservódatos yprovisioning; consulta posterior aprobada. Lecturas40s:1024recorridos/2048lecturas, p9519,12ms/p9933,40ms, sinerrores/descartes. Controlnegativo99 conserva métricas y tag separado. Wrapperpreflight y prueba determinista de remote-write fallido0→1/99→99 PASS. Primera carrera sinreceptorready se conservó/auditó pero no cuenta como observabilidadaprobada.

`docker compose ... config --quiet`, promtoolcheckconfig, sh -n, JSON/IDsúnicos, node --check y git diff --check PASS. Sinbuild/lintapp extra: no cambió aplicación en esta extensión; load modificó solo nombres estáticos de operación. [Informe G y evidencia](../../../evidence/local/simulador-produccion/observability/verification.md). TodaslaspruebasG1–G6cumplen enDockerlocal; no implican producciónexterna ni diagnósticoSUM. CodeGraph CLI1.6.2instaladoytelemetríadesactivada; índice deliberadamentesininicializarporsemántica symlink delpaquete descritaarriba.

## Extensión H completada: setup con un comando (2026-10-19)

Principal produjo diseño/aceptación H y delegó infraestructura a `/root/simple_compose` con GPT-6 Luna High real. Sin planner ni subdelegación. Se preservaron fidelidad visual/interacciones SUM y las interfaces existentes; no hubo cambios React, backend de dominio ni shared. CodeGraph no se inicializó por la limitación de symlinks previamente diagnosticada.

`compose.yaml` descubre el stack canónico completo; inicializadores Docker crean configuración persistente y preparan permisos. Se reutilizan DB, seed, auth, escenarios k6 y dashboard. Overlay de observabilidad anterior queda compatible y vacío. Helpers audit/rotate usan Node de Docker en lugar del host. Se conserva el modo de escenarios en compose.local y el despliegue operador separado. El principal corrigió de forma aislada el vínculo completo del puerto en arnés/proxy y la allowlist nginx local tras diagnóstico registrado en H; no cambió pantallas.

Aceptación real: inicio desde fuentes sin .env/runtime, seis servicios saludables, dos carreras frescas10/90 sin errores, auditorías SQL10/100, persistencia tras down/up, rotación fresh y legacy, historial/credenciales preservados durante actualización y navegador2/2. Control SQL negativo exit1; wrapper simulado conserva99 y detecta remote-write exit0 como1. Pruebas Compose2/2 y checks de sintaxis/diff pasan. Resultado y límites: [evidencia H](../../../evidence/local/simulador-produccion/setup-compose/verification.md).

Se archivó explícitamente la campaña principal llena mediante auditoría10/100 y se dejó una campaña nueva100 alumnos/0 matrículas/0 solicitudes, lista para ejecutar `docker compose run --rm k6`. El stack principal permanece levantado en5189/5190; proyectos temporales detenidos sin borrar volúmenes. No se ejecutó SUM ni se accedió a snapshots privados. Cambios de esta extensión sin commit/push automático.

## Extensión I: Serve activo (2026-10-19)

Principal configuró Serve privado (sin Funnel): Grafana443 conservado, web/API8443 y Prometheus8444. Worker /root/tailnet_access, GPT-6 Luna High, implementó proxy/Compose/docs; sin planificación delegada ni cambios backend/client/shared/pantallas. Configuración del nodo permanece en runtime/tailscale.env ignorado; no se versiona DNS del dispositivo. Nginx normaliza únicamente Origin tailnet exacto y selecciona Host remoto para cookies __Host Secure; localhost/k6 conserva su rama original. Principal corrigió map_hash_bucket_size256 tras diagnóstico de longitud del dominio.

Verificación real: tres front pages/health HTTPS200; login, sesión, logout204 y revocación401 tanto por tailnet como loopback; Origin ajeno403; navegador HTTPS login/dashboard/recarga/cookieSecureHttpOnly sin errores JS ni requests externos; geometría280/64 conservada. k6-browser HTTP local1/1 exit0. nginx -t tanto con configuración del nodo como imagen defaults sin archivo tailnet pasa; Compose sin archivo opcional y tests2/2 pasan; historial Grafana conservado y Funnel deshabilitado. Se detectó además que Salir revoca correctamente, pero tras recarga previa la UI puede conservar la ruta anterior hasta recargar: reproducido igualmente en loopback y HTTPS; gap frontend existente, fuera de cambios de publicación, no corregido ni acreditado como navegación automática. No se ejecutaron matrículas ni se accedió a SUM o snapshots privados. Usuario pidió recibir únicamente enlaces web/Grafana; Prometheus sigue configurado por la autorización original de Serve.


## Extensión J — ejecución k6 y gráficas (2026-10-19)

Principal diagnosticó mediante Prometheus una sola muestra por ruta de la carrera; rate() necesita2. Implementación real delegada a grafana_sparse_points/gpt-6-luna/high en dashboard JSON y README, sin subdelegación;9paneles conpuntos visibles, queries idénticas. Ninguna pantalla SUM, backend ni contrato cambiados. CodeGraph sin init por limitación conocida.

Principal ejecutó carrera100actores10cupos exit0 (10aceptadas90full0inesperadas,p95submit948.78ms), auditó SQL10matrículas101solicitudes sinviolaciones (1solicitud preexistente), ejecutó80slecturas exit0 (2688HTTP0fallos,p95read22.48ms) y verificó ambas ejecuciones en Grafana/navegador real sinerrores. Auditoría posterior preserva10/101. Evidencia y criterios→resultados en [observability-sparse/verification.md](../../../evidence/local/simulador-produccion/observability-sparse/verification.md). Sin commits ni push en esta etapa.

## Cierre L — escenarios de 400 alumnos (2026-10-19)

El usuario aclaró que el 100 % de CPU correspondía a GitHub Codespaces y autorizó implementación, commits lógicos y push al terminar. Plan y contrato SIM-LOAD-2 escritos por el principal; implementación real `load_seed_400` y `load_scenarios_400` con GPT-6 Luna High, sin agentes planificadores ni subdelegación. El principal implementó la orquestación, observabilidad, pruebas integradas y correcciones aisladas diagnosticadas. No se inicializó CodeGraph por la limitación conocida del walker y symlinks.

Se implementaron doce escenarios y seis perfiles de campaña, conservando el único Compose y el frontend SUM. La batería de aceptación utilizó 400 identidades, campañas separadas y tiempos cortos. Los doce casos pasan verificaciones funcionales e invariantes SQL. Seis escenarios de matrícula incumplen SLO de latencia, sin alterar los límites: carrera p95 3.29 s frente a 2 s; otros picos llegan a 4.53 s. Retry recuperó 400 matrículas con 800 solicitudes tras 662 respuestas transitorias. Caída de API/base recuperó 400 sesiones; crash a mitad de transacción comprobó rollback y recuperación de respuesta descartada sin duplicación.

Backend build/tipos/lint exit0 (cuatro warnings previos), 17 pruebas unitarias backend, 13 Node checks y tres e2e HTTP reales con campaña aislada pasaron. Dos navegadores reales comprobaron login/dashboard propios. Grafana verificó 400/10/390 y paneles operativos con datos de ambas réplicas. HTTPS web/Grafana saludable. Se dejó campaña activa fresca de 400 alumnos, cero matrículas y cero solicitudes. No se ejecutó soak de 30 minutos ni renovación natural a los 15 minutos; su lógica tiene pruebas con reloj controlado y renovación HTTP real.

Diagnósticos, intentos descartados, métricas, capturas, límites y comandos en [scenarios-400/verification.md](../../../evidence/local/simulador-produccion/scenarios-400/verification.md). Estos resultados son locales y no identifican por sí solos la causa de lentitud del SUM ni certifican Oracle. No se accedió a snapshots privados ni a SUM.
