# Plan: simulador público con PostgreSQL y concurrencia de matrícula

Fecha: 2026-10-19. Autor: agente principal. Estado: implementación y experimento Docker ejecutados; publicación externa pendiente. [Resultados y aceptación](../../../evidence/local/simulador-produccion/fullstack-verification.md).

## Objetivo y alcance

Desplegar la réplica como simulador con alumnos exclusivamente sintéticos, persistencia PostgreSQL, acceso temporal sustituible y una matrícula por alumno/campaña. Demostrar con k6 que varios alumnos con prematrícula semejante compiten por cupos limitados sin sobreventa ni duplicados, incluso con varias instancias NestJS. El funcionamiento local actual permanece disponible con sus mismos valores por defecto, fixtures, sesiones y pantallas.

Planificación: principal sin delegación. Implementación realizada por dos workers GPT-6 Luna High, con aceptación integrada por el principal. El agente de planificación iniciado antes de la corrección del usuario fue interrumpido; no es autor de este plan. El diseño original de las secciones siguientes se conserva como antecedente; las decisiones concretas y resultados de ejecución están en el informe enlazado.

Complejidad alta (persistencia, identidad y ambas capas), incertidumbre media (hosting/volumen y política de entrega de accesos), impacto alto (integridad concurrente). Todas las decisiones siguientes son diseño propio `local-only`, no arquitectura ni comportamiento verificado del SUM. Oracle en UNMSM es testimonio del usuario; no se inspeccionó SUM.

## Evidencia e interfaces reutilizadas

Revisión estática del 2026-10-19, sin acceso a servidores ni datos privados:

- `backend/src/matricula-regular/matricula-regular.repository.ts`: estado clonado y cola Promise singleton. Serializa solo en un proceso; no coordina varias réplicas ni persiste al reiniciar.
- `backend/src/matricula-regular/matricula-regular.service.ts`: validaciones, resultado todo-o-nada, `ALREADY_ENROLLED`, payload canónico y recuperación por requestId. Reutilizar estas reglas; separar evaluación de publicación en memoria.
- `backend/src/matricula-regular/store.types.ts`: perfiles, actores, oferta, sesiones, solicitudes, matrículas y reportes ya definidos.
- `backend/src/local-profile-dashboard/local-profile-session.service.ts`: catálogo fijo de cuatro actores; no usar su selección libre como autenticación pública.
- `backend/src/local-profile-dashboard/local-profile-dashboard.controller.ts`: consultas con identidad suministrada por cliente. En despliegue público debe comprobarla contra identidad autenticada.
- `client/src/data/config.ts`, `transport.ts`, `matriculaRegular.ts`, `localProfileSession.ts`: conservar modos actuales y validadores; extender adaptadores.
- `shared/matricula-regular.mjs`, `.d.mts` y [contrato de matrícula](../contracts/local-api/matricula-regular.md): DTO, causas, replay y reporte existentes. [Contrato de dashboard](../contracts/local-api/local-profile-dashboard.md): proyecciones existentes.

Preservar fidelidad visual y de interacción al SUM: estructura, tablas, estilos, textos, navegación, selección, resultado y reportes actuales. El nuevo acceso efímero es la única pantalla nueva propuesta. Su composición visual requiere revisión antes de implementarla; reutilizar controles disponibles. Adaptar identidad y transporte a las pantallas existentes. No atribuir al SUM esta pantalla ni estas decisiones de concurrencia.

## Prioridad revisada: diagnóstico antes de elegir mitigaciones

Actualización del usuario, 2026-10-19: «La página demora o no carga». Fuente `testimony`; paso exacto, fecha/hora del incidente, duración, HTTP y alcance de afectados aún desconocidos. No hay evidencia que atribuya una caída de SUM a Oracle, locks o cupos. La arquitectura transaccional de este plan protege integridad del simulador; no es un diagnóstico de disponibilidad de SUM.

Antes de P1, el principal completa D0: caracterizar el síntoma y diseñar los experimentos siguientes. No desplegar bots ni ejecutar carga en esta etapa. No correr bots/k6 contra SUM. Evidencia de referencia admisible: relato del usuario y observaciones previamente sanitizadas, sin identificadores, cookies ni cuerpos privados. La inspección productiva SUM mantiene su gate y carácter de solo lectura; no se necesitan internos privados para proponer experimentos propios.

| Hipótesis, aún no confirmada | Señal que permitiría distinguirla | Experimento del simulador |
| --- | --- | --- |
| Conectividad, DNS, TLS o proxy | Tiempo de conexión elevado; documento inicial no llega; separar un cliente afectado de varios | Medir conexión y TTFB de documento y health mínimo con carga incremental |
| HTML o archivos estáticos lentos | HTML rápido pero JS/CSS pendientes; API aún no se solicita | Cargar pantalla con navegadores y separar tiempos por tipo de recurso |
| APIs de inicio lentas | Documento/JS listos; vista espera perfil/cursos; TTFB alto en rutas concretas | Solo lecturas de inicio, sin enviar matrículas; medir consultas y fan-out por visita |
| Saturación de backend/pool/DB | Throughput deja de crecer mientras suben latencia, colas, espera de conexión/CPU/I/O | Correlacionar métricas del simulador con tasa de llegada, tiempos por fase y réplicas |
| Contención de escrituras | Esperas de locks aumentan solo cuando se envía matrícula concurrente | Comparar lecturas solas, escrituras en secciones distintas y misma sección a igual carga |
| Amplificación por recargas/reintentos | Peticiones por usuario y tráfico crecen tras la primera lentitud | Comparar sin reintentos y con política acotada/reproducible, en campaña aislada |
| Bloqueo de renderizado/JS | API responde bien pero pantalla no está utilizable; tareas largas/errores JS | Navegadores con métricas de renderizado, errores y tiempo hasta pantalla utilizable |

Enfoque híbrido: k6 HTTP genera la mayor parte de carga y un grupo pequeño de bots de navegador (inicialmente 2–5, ajustado al generador) ejecuta la interacción real. Puede usarse k6/browser para ambos escenarios. No hacen falta bots con IA: scripts deterministas con identidades y tiempos definidos dan resultados reproducibles. Instrumentar también CPU/red del generador para no confundir su saturación con la del servidor.

Secuencia de experimentos propuesta:

1. Línea base con un usuario: documento → recursos → login → perfil/cursos → pantalla utilizable, sin confirmar matrícula. Registrar solicitudes por visita y latencias por fase.
2. Solo lecturas: aumentar tasa de llegadas por escalones con un modelo abierto, duración y pausas fijadas. Registrar llegadas previstas/reales, iteraciones descartadas, throughput y p95/p99. Un modelo cerrado puede reducir la carga ofrecida cuando el servidor se vuelve lento y ocultar saturación.
3. Pico de apertura: ráfaga de llegadas con escenario reproducible y mezcla de rutas documentada; comparar a igual número de solicitudes una llegada distribuida en el tiempo.
4. Añadir escrituras con suficientes alumnos nuevos; primero secciones distintas y después una sección compartida. Comparar con el escenario de lecturas para aislar contención.
5. Solo tras reproducir un cuello de botella, aplicar una mitigación y repetir igual dataset, infraestructura, carga y estado inicial. No atribuir mejora a una causa cambiando a la vez varias variables.

Instrumentación del simulador: correlación por ID de petición no sensible entre proxy/API/traza DB; tiempos de conexión, TTFB, respuesta y pantalla utilizable; CPU/RAM/event loop, colas, pool activo/en espera, consultas, locks y disco. PostgreSQL permite observar wait events y actividad; usar agregados sin datos privados. k6 por sí solo muestra el síntoma externo, no prueba la causa interna. Si todo el tiempo se concentra en lecturas iniciales, priorizar ese camino antes de ampliar el experimento de cupos.

Salida D0: mapa de carga de página, matriz hipótesis/señal/experimento, instrumentación requerida y criterio para comparar mitigaciones. Estado actual: diseño documental listo; causa SUM desconocida; mediciones y diagnóstico del simulador pendientes. D0 no exige descubrir la causa real del SUM para continuar trabajo propio: esa atribución requiere evidencia suficiente y puede permanecer unverified.

Fuentes técnicas: [k6, carga híbrida](https://grafana.com/docs/k6/latest/testing-guides/load-testing-websites/) y [PostgreSQL, actividad y esperas](https://www.postgresql.org/docs/current/monitoring-stats.html). Sustentan herramientas generales; no explican por sí mismas el incidente reportado.

## Arquitectura y opciones

Recomendación: transacciones cortas con bloqueo de filas, restricciones únicas y repositorio transaccional. PostgreSQL es el primer adaptador. Las reglas de matrícula dependen de un puerto de persistencia, no de SQL, códigos de error ni primitivas específicas de PostgreSQL.

| Alternativa | Ventaja | Coste / decisión |
| --- | --- | --- |
| Bloquear alumno y secciones dentro de una transacción | Una decisión consistente para una selección de varios cursos; fácil de auditar | Esperas bajo contención; elegida con orden global y timeout |
| Actualizaciones optimistas con versión/CAS | Útil con baja contención | Reintentos abundantes por la última plaza; requiere transacción para varios cursos |
| Cola externa por curso | Permite regular admisión | Mayor infraestructura y coordinación multicurso; no sustituye unicidad ni transacción; fuera de alcance inicial |

PostgreSQL y Oracle documentan bloqueo de filas y transacciones; no comparten necesariamente sintaxis, drivers, aislamiento por defecto ni códigos de errores. La portabilidad comprometida es del algoritmo y contrato del repositorio. Un adaptador Oracle futuro deberá ejecutar la misma suite de conformidad; este trabajo no acredita compatibilidad Oracle ejecutada. No usar advisory locks específicos ni mutex del proceso como garantía de cupos. No se promete orden FIFO de ganadores.

## Modos y datos

Proponer `SIMULATOR_DEPLOYMENT=public` y `SIMULATOR_STORAGE=postgres` explícitos en backend. Ausencia conserva el modo local existente. En público, fallar al iniciar si faltan base de datos, proveedor de identidad o campaña; nunca fallback a memoria, mocks o snapshots privados. `NODE_ENV=production` por sí solo no selecciona datos ni permisos.

Frontend conserva `mock/api/local`; añadir una configuración de despliegue separada que selecciona el proveedor de acceso público y la API propia bajo `/api`, sin cambiar el modo por defecto ni sus convenciones de validación. Reverse proxy de mismo origen con HTTPS para publicación.

El seed construye alumnos independientes, códigos sintéticos y prematrículas desde generadores sintéticos permitidos; no migra exports ni lee `datos-reales`. Los mocks actuales permanecen para uso local. PostgreSQL contiene la fuente de verdad pública para actores, perfiles académicos, oferta, prematrícula, solicitudes, matrícula y reportes. El dashboard genera sus DTO actuales a partir de esos registros. Para otros módulos visibles, inventariar sus fixtures y mover los datos sintéticos al repositorio público por módulo; no dejar una pantalla mostrando otro alumno fijo. Estados vacíos deben conservar el contrato y aspecto existentes. Assets, textos y estructura de UI no son datos académicos que migrar.

Tablas propuestas: `campaigns`, `actors`, `academic_profiles`, `courses`, `sections`, `pre_enrollments`, `access_credentials`, `auth_sessions`, `enrollment_sessions`, `requests`, `enrollments`, `enrollment_items`, `reports`, y registros de proyección de módulos secundarios según contratos existentes. Datos académicos siempre versionados por facultad, periodo, escuela y plan. No imponer reglas FISI a otros perfiles.

- Campaña identifica un experimento completo; un `runId` UUID estable se asigna a ella y se conserva tras reinicios. No crear una campaña por login: todos los competidores deben compartir las mismas secciones.
- Unicidad de matrícula: `(campaign_id, actor_id)`; solicitudes: `(campaign_id, actor_id, request_id)`; detalle: `(enrollment_id, course_id)`.
- Relaciones incluyen campaña para impedir referencias cruzadas. Secciones: `0 <= occupied <= capacity`; reconciliar occupied con detalles de matrículas confirmadas.
- El resultado y reporte se conservan durante toda la campaña, aunque expire la sesión. Campañas cerradas no admiten nuevas escrituras; recuperación autenticada sigue disponible durante retención.
- Propuesta de retención: campaña cerrada 30 días; limpieza administrativa explícita de toda la campaña, nunca borrar solo deduplicación mientras siguen vigentes sus matrículas.

## Identidad temporal sustituible

La sesión es efímera; el alumno es estable. Proponer credencial aleatoria preemitida por alumno/campaña, distribuida por el operador y guardada como hash en la base. La misma credencial recupera siempre el mismo alumno. No ofrecer creación ilimitada de alumnos por navegador: borrar cookies o abrir incógnito no debe producir otra identidad.

Esto evita rematrícula por identidad asignada; no demuestra que una persona física tenga una única credencial. Para esa garantía se necesitaría identidad verificada o una política externa de entrega, reemplazando el proveedor temporal.

Puertos propuestos: backend `IdentityProvider.authenticate(credential): Promise<Principal>` y `authenticateSession(token): Promise<Principal>`; `Principal={campaignId,actorId}`. Frontend `AccessProvider` con `login`, `current`, `logout`. Los componentes consumen este puerto. El ID declarado en URL/body nunca concede autoridad.

Sesión de acceso opaca de 15 minutos, cookie HttpOnly/Secure/SameSite, sin token en localStorage ni URL; hash persistido, revocación en logout y comprobación de origen en operaciones mutantes. Una nueva autenticación vuelve al mismo alumno. No confundirla con la sesión académica de matrícula existente: esta última conserva sus reglas de expiración y recuperación. Aplicar guard a contextos, consultas, envíos, resultados y reportes. Quitar del registro público las rutas de catálogo libre, cambio de actor, reset y escenarios; conservarlas en modo local.

Contrato público propuesto: [SIM-PUBLIC-1](../contracts/local-api/simulador-produccion.md). Es una extensión de despliegue de contratos existentes; ningún DTO de matrícula paralelo.

## Algoritmo de concurrencia

Puerto propuesto `EnrollmentStore.submit(principal, submission): Promise<MatriculaRegularEnvelope<MatriculaRegularOutcome>>`, además de lecturas de contexto, resultado y reporte compatibles con contratos actuales. Adaptador memoria conserva comportamiento local; adaptador PostgreSQL implementa lo siguiente:

1. Validar estructura y autenticar; comparar identidad solicitada con principal. Leer campaña activa y su run estable. No permitir replay de otro alumno.
2. Iniciar transacción y bloquear fila de alumno/campaña existente. Es la exclusión para dos claves distintas del mismo alumno. Lectura/estado de campaña debe impedir cierre concurrente que permita nuevos commits tras cierre; bloquear campaña en modo compartido compatible entre envíos y exclusivo para cierre, con orden campaña → alumno.
3. Consultar solicitud por clave. Si existe y payload canónico coincide, devolver resultado original; si difiere, `REQUEST_CONFLICT`. Excluir sessionId del payload como hoy. El replay exige autenticación vigente, pero no una sesión académica vigente.
4. Para solicitud nueva, comprobar sesión académica, revisión, oferta y pertenencia. Bloquear cada fila de sección en orden global por `(campaign,course,section)` mediante operaciones de adquisición ordenadas; no confiar solo en un ORDER BY para el orden real de bloqueo de un plan SQL.
5. Recargar ocupación bajo locks; evaluar reglas actuales con snapshot coherente de perfiles/catálogos. Mantener configuración académica inmutable durante campaña abierta; cambios generan revisión/campaña nueva.
6. Si hay rechazo o brecha, guardar únicamente Outcome. Si acepta, insertar matrícula única y detalles, incrementar cada cupo, guardar Outcome y reporte en la misma transacción. Restricciones únicas y límites son defensa adicional.
7. Commit antes de responder. Fallo intermedio revierte todos los cambios. Si se pierde confirmación de commit, consultar por la misma clave; no emitir otra identidad ni afirmar que no hubo efectos.
8. Deadlock/conflicto transitorio confirmado como rollback: máximo tres intentos con espera acotada y jitter, conservando requestId. Agotamiento: 503 transitorio sin inventar Outcome; frontend conserva intento incierto. No reintentar automáticamente errores de negocio ni commit ambiguo como solicitud nueva.

Timeouts de transacción y pool configurables, métricas de espera y duración. Conexiones máximas totales de réplicas por debajo del presupuesto de PostgreSQL. No hay I/O remoto ni espera de usuario dentro de la transacción.

## Tareas y handoff

Todas pendientes; reparación automática máxima una por tarea antes de diagnóstico del principal. Cada worker recibe restricciones de datos, contrato SIM-PUBLIC-1, instrucciones raíz/carpeta, archivos exclusivos, criterios de abajo y obligación de fidelidad SUM. Máximo dos workers, sin subdelegación. CodeGraph solo podrá inicializarse tras validar exclusiones de datos privados, dependencias y symlinks; su configuración actual insuficiente no autoriza indexar.

| ID | Resultado / archivos asignados | Dependencia | Responsable / aceptación |
| --- | --- | --- | --- |
| P1 | Fijar contrato y revisar todos los consumidores de `shared/matricula-regular.*`, `shared/local-profile-dashboard.*`; clasificar fixtures de cada módulo y endpoints públicos. Documentar mapeos de proyección y campos de actor que hoy están cerrados a cuatro IDs | D0 y este plan | Principal; cobertura de todas las pantallas publicadas y ningún contrato duplicado |
| P2 | Crear `backend/src/persistence/enrollment-store.ts`, `postgres-enrollment.store.ts`, `backend/migrations/`, `backend/scripts/seed-simulator.ts`; adaptar repositorio/module/service de matrícula y proyecciones de `local-profile-dashboard/`. Añadir driver `pg` y tipos con lockfile asignado a este worker | P1 | Luna High backend, skill sum-nestjs-implement; A1–A5, A8 |
| P3 | Crear `backend/src/auth/` (puerto/proveedor/guard/controller), configuración pública en `app.module.ts` y `main.ts`; proteger consultas de módulos publicados y desregistrar controles locales del modo público | P2; secuencial por archivos compartidos | Luna High backend; A6–A7 |
| P4 | Crear `client/src/data/accessProvider.ts`, proveedor público y acceso; adaptar `localProfileSession.ts`, `useLocalProfileSession.ts`, `localProfileDashboard.ts`, `matriculaRegular.ts`, `config.ts` y `LocalSessionControls.tsx`; reusar rutas y componentes actuales | P1 y contrato fijo; integración tras P3 | Luna High frontend, sum-react-implement; A6–A9. Pantalla de acceso revisada antes de implementación |
| P5 | Crear `backend/test/simulator-concurrency.e2e-spec.ts`, `backend/test/simulator-auth.e2e-spec.ts`, pruebas frontend en `client/src/data/`; actualizar escenarios sintéticos de integración | P2–P4 | Luna High con ownership separado por carpeta; principal coordina sum-fullstack-verify; A1–A9 |
| P6 | Crear `load/k6/enrollment.js`, `load/k6/recovery.js`, `load/k6/README.md`, `backend/scripts/audit-simulator.ts`, documentación de despliegue y métricas | P5 | Luna High ejecución; principal acepta A10–A12 |
| P7 | Despliegue controlado, migración/seed, smoke y carga contra URL propia delimitada; registrar artefactos sanitizados en `evidence/local/simulador-produccion/` | P6 y target/recursos/ventana definidos | Principal; operación posterior, no ejecutada por esta solicitud de plan |

P2 incluye implementación de repositorios públicos de datos secundarios inventariados en P1: asignar lista exacta por módulo antes de despachar; no modificar loaders privados para convertirlos en fuente pública. Las ampliaciones de validadores compartidos corresponden al principal con pruebas en el mismo contrato, antes de P4. No correr backend y frontend en paralelo si requieren editar esos mismos archivos.

## Aceptación y escenarios previstos

La tabla define los criterios originales. Los resultados reales, incluidos casos pendientes y límites de regresión, están en la matriz del informe de aceptación; un criterio planeado no cuenta como aprobado.

| Criterio | Escenario sintético / comprobación | Resultado esperado |
| --- | --- | --- |
| A1 Cupos | 100 alumnos elegibles, 10 plazas compartidas, selección válida en créditos/prerrequisitos/horarios, >=2 procesos API y conexiones independientes | Exactamente 10 alumnos aceptados, 90 rechazados por SECTION_FULL; ocupación 10 |
| A2 Unicidad | Un alumno envía 20 requestId distintos concurrentes; logout/login/reinicio posterior | Una matrícula; nuevas solicitudes rechazadas ALREADY_ENROLLED |
| A3 Idempotencia | 20 envíos de la misma clave/payload; variar orden de selección y sesión; luego cambiar selección | Un efecto y resultado idéntico; payload distinto 409 REQUEST_CONFLICT |
| A4 Atomicidad | Selección multicurso con una sección llena; fallo inyectado entre detalle e incremento | Cero escrituras académicas parciales; rollback también de contador y reporte |
| A5 Recuperación | Caída antes del commit; caída después del commit antes de respuesta; reiniciar dos réplicas | Antes: ningún efecto; después: mismo resultado/reporte por requestId, sin duplicados |
| A6 Identidad | Sesión expirada, renovación/login, actor ajeno en URL/body/query, reporte ajeno | 401 sin sesión; identidad recuperada estable; acceso ajeno denegado; ningún efecto ajeno |
| A7 Superficie pública | Invocar catálogo libre/reset/escenarios/creación de sesión ajena en modo público | Ruta ausente o acceso denegado; modo local conserva sus endpoints |
| A8 Coherencia | Campañas/perfiles distintos, sección capacity=0, sin oferta, perfil incompleto, cierre concurrente | Sin contaminación, sin sobrecupo; brechas siguen pendientes, no fallback; cierre excluye nuevos commits |
| A9 UI/local | Flujo React → NestJS → PostgreSQL; replay y reporte; ejecutar regresión mock/local y comparar misma ruta/viewport/estado/contenido | Interfaces SUM conservadas; datos del alumno correcto; local funciona como antes |
| A10 k6 | Carrera repetida 10 veces con campaña nueva por ronda y 2+ réplicas; auditoría DB al drenar | A1 se cumple cada vez, cero duplicados/desajustes; evidencia por ronda |
| A11 Operación | PostgreSQL no disponible/config ausente, pool saturado, restart y rollback de versión | Sin fallback; error controlado; datos confirmados conservados |
| A12 Métricas | Carga sostenida separada de carrera finita; umbrales y controles de fallo intencional | Checks/thresholds fallan realmente ante violación; reporte con latencias y contención |

Checks de implementación: `pnpm --dir backend build`, `lint`, `test`, `test:e2e`; `pnpm --dir client build`, `lint`, `test:data`, y `verify` solo tras revisar scripts y procedencia sintética. Suite PostgreSQL aislada con migraciones y seed propios; pruebas unitarias en memoria no acreditan concurrencia real. No ejecutar estos comandos en etapa de planificación.

## Experimento k6 y producción del simulador

Producción significa el despliegue propio del simulador, exclusivamente sintético. Nunca apuntar k6 a SUM. Ejecutar el experimento en campaña reservada y ventana sin participantes humanos; la campaña separa datos pero no elimina interferencia de CPU/pool/base. Usar despliegue dedicado o ventana exclusiva para medir capacidad reproducible.

Preparar 100 credenciales sintéticas distintas, campaña y 10 plazas; no usar un alumno distinto con su propio curso/campaña. Autenticar cada competidor y obtener contexto/sesión antes de una hora de apertura común del perfil sintético. Usar `per-vu-iterations`, un VU por alumno, una solicitud por alumno; barrera temporal compartida y registrar dispersión real de tiempos, sin afirmar simultaneidad perfecta. Payload incluye otros cursos sin cuello de botella si las reglas requieren mínimo de créditos. Medir matrícula separada del login.

Después, escenarios específicos para duplicados, dos claves de un alumno, pérdida de respuesta y reinicios. Una prueba sostenida necesita suficientes alumnos NUEVOS y oferta adecuada; repetir alumnos ya matriculados solo mediría rechazos rápidos. Declarar distribución, duración y throughput objetivo antes de ejecutar. Propuesta inicial: escalones 10/50/100 usuarios durante 60 s cada uno, recalibrados según presupuesto del hosting; no una garantía de capacidad.

Métricas: aceptaciones únicas, rechazos por causa, conflictos de identidad, errores inesperados, replay, p50/p95/p99 de envío, espera de locks/pool, reintentos, conexiones y CPU. `SECTION_FULL` y `ALREADY_ENROLLED` son HTTP 200 con Outcome rejected en el contrato actual; no convertirlos artificialmente en 409. Los 409 protocolarios esperados se contabilizan por escenario, nunca se excluyen todos los errores 4xx de forma global.

Umbrales iniciales propuestos: checks de integridad 100%, cero sobrecupos/duplicados/inconsistencias, errores inesperados <1%, p95 de envío <2 s y p99 <5 s. Los umbrales de latencia se aceptan para una carga y hardware documentados, no universalmente. `checks` solo no hace fallar la corrida: definir thresholds. Para caos, evaluar recuperación separadamente de disponibilidad y no aplicar el presupuesto normal de errores a fallos inyectados.

Al terminar, detener admisión, drenar solicitudes en vuelo y ejecutar auditoría administrativa de DB: conteos de matrículas únicas, detalles, ocupación, requests y reportes, sin depender de los HTTP recibidos. La auditoría debe fallar ante cualquier invariante y combinar su código de salida con k6. Si quedan solicitudes sin resolver o expiradas por tiempo máximo, corrida inconclusa/fallida, no interpretar automáticamente todos los restantes como SECTION_FULL. No exponer un endpoint público de dump/reset. Guardar versión de código, seed, campaña, réplicas, motor/versión, límites de recursos, configuración de carga y resumen sanitizado.

## Despliegue y reversión

Fijar hosting, versión PostgreSQL soportada, recursos, dominio propio y horario de carga antes de P7. Migraciones versionadas ejecutadas una vez por job administrativo; usuarios de runtime con permisos mínimos sin DDL. Seed idempotente por campaña; rechazar reseed destructivo de campaña abierta. Ingreso HTTPS, proxy same-origin, readiness DB, backups y restauración comprobada con datos sintéticos.

Usar migraciones aditivas compatibles con la versión previa. Revertir aplicación solo a versión compatible con esquema/contrato. Ante problema de integridad cerrar admisión, drenar y preservar evidencia; no cambiar a memoria ni resetear campaña para ocultar fallos. No desplegar dos backends apuntando a bases independientes para una misma campaña.

## Decisiones abiertas que no bloquean este documento

Hosting y presupuesto de conexiones; volumen final y SLO; aceptación de acceso por credenciales preemitidas frente a identidad externa; diseño mínimo de pantalla de acceso; retención de 30 días propuesta. Esas decisiones se fijan antes de sus tareas dependientes. El núcleo de concurrencia, unicidad e idempotencia no depende de ellas.

## Fuentes técnicas

Consultadas el 2026-10-19; respaldan mecanismos generales, no internos SUM:

- [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html): bloqueos de filas y prevención de deadlocks mediante orden consistente.
- [Oracle: Automatic Locks in DML Operations](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/Automatic-Locks-in-DML-Operations.html): bloqueos asociados a DML y SELECT FOR UPDATE.
- [k6: Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) y [Checks](https://grafana.com/docs/k6/latest/using-k6/checks/): criterios de fallo de la corrida frente a comprobaciones por petición.

## Extensión autorizada G: Grafana + Prometheus (2026-10-19)

El usuario aprobó integrar Grafana y Prometheus en Docker para visualizar los experimentos k6. Complejidad media, incertidumbre baja, impacto medio. Principal planifica y verifica; worker Luna High implementa. Se preserva fidelidad visual y de interacción SUM: no se autoriza cambiar ninguna pantalla React existente; Grafana es una herramienta operativa separada. Se reutilizan las métricas y escenarios load existentes, sin nuevo contrato académico ni adaptador de datos de alumno.

Diseño: overlay `compose.observability.yaml` sobre `compose.simulator.yaml`, mismo proyecto/red; Prometheus interno con receptor remote-write y volumen persistente (retención15d y límite1GB); Grafana loopback5190 con datasource y dashboard provisionados localmente. Sin Grafana Cloud, plugins remotos ni scrapes del operador. Acceso anónimo Viewer local con administración protegida por secreto aleatorio propio; desactivar telemetría/actualizaciones externas. Generar secreto para entornos existentes mediante script que no reescribe campañas ni expone valores. Imágenes oficiales fijadas por versión/digest resueltos.

k6 envía vía `experimental-prometheus-rw` y exporta trends p95/p99/avg/max. Cada ejecución tiene tag `testid` único, no ID de actor/campaña/sesión. Conservar systemTags sin url y dar nombres estáticos a toda ruta que incluya identidad. No exportar credenciales, cookies ni respuestas. Un wrapper explícito configura ambos Compose y la salida, conserva exit status de k6 incluso con thresholds fallidos y guarda summary JSON. Métricas de negocio existentes: enrollments_accepted, enrollments_section_full, enrollments_unexpected, enrollment_iterations_completed; no confundir rechazos académicos HTTP200 con fallos HTTP. SQLaudit sigue comprobación separada de integridad; el dashboard no acredita por sí solo ausencia de sobrecupos.

Dashboard estable UID sum-simulator-k6: filtro testid, aceptadas/rechazadas/inesperadas/completadas, VUs, throughput HTTP, proporción de errores, checks, dropped_iterations y latencias p95/p99 por operación (segundos convertidos a milisegundos). Totales deben recuperar el último contador por serie dentro del intervalo elegido; no sumar muestras acumuladas. Trends exportados son percentiles del generador por intervalo y no percentiles globales recalculados. Mostrar ausencia de datos como tal y nunca mezclar automáticamente todas las corridas. Ventana inicial que incluya la última ejecución; historial disponible al volver a abrir y tras reiniciar servicios. Las diez rondas previas no se reconstruyen como series: no se almacenaron esas muestras.

| Tarea | Archivos exclusivos / responsable | Criterio y comprobación |
| --- | --- | --- |
| G1 infraestructura | overlay, infra/simulator/observability/** y script setup, bootstrap/README pertinentes; Luna High | Compose válido, puertos solo5190loopback; PG/API intactos; versiones fijadas; promtool válido |
| G2 dashboard | provisioning datasource/dashboard y JSON; mismo worker | UID estable, selector por testid, consultas ejecutables, sin datos de alumnos; acceso Viewer sin edición |
| G3 exportación k6 | load/run-observed.sh, mínimo ajuste de tags en load/enrollment.js; mismo worker | env remoto explícito, testid único, nombres estáticos, código de salida conservado |
| G4 aceptación | scripts/verify-simulator-observability.mjs y evidence/local/simulador-produccion/observability/**; principal | Ejecutar carrera nueva100/10 y SQLaudit10/100; PromQL y Grafana muestran10/90/0 por testid |
| G5 UI e historial | navegador root secuencial | Grafana carga sin errores de datasource; captura de paneles con datos; al reiniciar Grafana/Prometheus se conserva la ejecución |
| G6 control de errores y cierre | principal | corrida de lecturas con umbral imposible devuelve99 y permanece observable; docs/enlaces/diffcheck válidos, app no modificada |

Fuentes primarias revisadas: https://grafana.com/docs/k6/latest/results-output/real-time/prometheus-remote-write/ , https://grafana.com/docs/grafana/latest/administration/provisioning/ , https://prometheus.io/docs/prometheus/latest/storage/ . Nuevos supuestos operativos son local-only. Aceptación con datos independientemente sintéticos del stack propio, nunca datos-reales ni SUM. No se ejecuta carga contra operador/producción. Se permite una corrección automática por fallo; si persiste, principal diagnostica y registra la decisión.

Cierre G, 2026-10-19: G1–G6 ejecutadas y aprobadas en Docker local por el principal, con una corrección diagnosticada de arranque y una de nombres de series. Ver [informe de observabilidad](../../../evidence/local/simulador-produccion/observability/verification.md), que conserva los fallos iniciales y límites de `rate()` en ráfagas. Grafana queda activo en loopback5190; sin cambios de pantallas SUM ni publicación externa.

## Extensión H: arranque con un Compose (2026-10-19)

Solicitud explícita: simplificar setup a `docker compose up --build -d`. Principal diseña; Luna High implementa infraestructura; principal acepta. Decisión local, no evidencia SUM. Se preserva fidelidad visual y de interacción SUM; ninguna pantalla tiene autorización de cambio y se reutilizan las interfaces existentes.

Diseño H1: `compose.yaml` descubre automáticamente el stack sintético completo; `compose.simulator.yaml` queda como definición canónica con PostgreSQL, inicialización, migración/seed, dos API, web, Prometheus y Grafana. El overlay anterior queda compatible. Inicializador dentro de Docker prepara runtime y secretos aleatorios persistidos con permisos privados, sin Node ni scripts previos en host. Puede importar la configuración sintética legacy mediante env_file opcional; nunca genera nuevas credenciales sobre un entorno ya configurado salvo rotación explícita legacy. Un wrapper carga exclusivamente la configuración generada para cada proceso; no exponer secretos en logs/config de Compose. PostgreSQL y Grafana conservan volúmenes. Compose local y operador permanecen explícitos e independientes; ningún montaje de snapshots en el simulador. No cambiar contratos SIM-PUBLIC-1, matrícula, catálogo ni pantallas.

H2: k6 tiene comando por defecto para carrera existente con testid único y remote-write; ejecución `docker compose run --rm k6`, sin carga automática al levantar. Mantener llamadas explícitas previas y checks k6. Primera campaña fresca; repeticiones siguen requiriendo campaña disponible, sin reset destructivo oculto.

H3: aceptación principal: config válido sin .env y sin invocar bootstrap; levantar proyecto nuevo con runtime sintético aislado/puertos alternos, salud real web/API/Grafana; secretos/manifest persistidos con permisos y sin valores en logs; una carrera 100 actores ->10/90 y auditoría SQL10/100; dashboard recibe testid; reinicio conserva misma campaña/secretos/cupos/historial. Renderizar compatibilidad legacy con configuración existente sin imprimirla, y revisar pruebas estáticas de Compose actualizando expectativa histórica de exactamente dos archivos. No ejecutar compose.prod ni acceder datos-reales. Evidencia breve con comandos y resultados reales. Sin nuevos tests duplicativos ni builds app adicionales si no cambia su fuente.

Propiedad worker H: compose.yaml, compose.simulator.yaml, compose.observability.yaml, infra/simulator/** excepto runtime/.env (solo lectura funcional al correr contenedores), load/run-observed.sh y load/audit-load.sh si necesita compatibilidad. Principal posee este plan, workflow, evidencia y scripts/compose-config.test.mjs. No editar backend/client/shared. Un ciclo de corrección tras fallo; informar diagnóstico.

Decisiones tras diagnóstico H: el primer arranque fresh falló porque Compose descarta CMD al sustituir entrypoint; worker corrigió postgres.command explícito (único ciclo automático H1). El segundo arranque desde otro contexto nuevo pasó. La prueba H3 en puertos aislados detectó el guard histórico k6 fijado a5189; principal diagnostica y corrige exclusivamente el arnés: puerto explícito compartido por Compose/k6 y comparación exacta de Origin loopback con ese puerto, conservando prohibición de targets externos. No modifica backend ni relaja origen hacia hosts externos. El test estático existente normalizaba false omitido por Compose e ignoraba perfiles inactivos: principal adaptó render a --profile '*' y normalización false, ambos tests pasan. Además restauró allowlist client/nginx.conf en .dockerignore para mantener el Dockerfile local existente.

Diagnóstico ampliado H3: después del guard k6, el proxy Nginx conservaba Origin/Host fijos a5189 y devolvió403 a las100 preparaciones; no hubo matrículas ni carrera válida. Decisión explícita del principal tras revisar el recorrido completo: parametrizar el mismo puerto loopback en proxy/API/k6 mediante template envsubst oficial Nginx, conservando mapa exacto de orígenes y sin aceptar hosts arbitrarios. Archivos aislados adicionales: infra/simulator/nginx.conf, Dockerfile.web y load/common.js. Reconstruir solo web y repetir prueba; excluir ambos intentos fallidos de resultados de concurrencia.

Simplificación operativa adicional del principal: auditoría delega directamente al script SQL existente dentro del servicio audit (ya verifica los dos totales y devuelve no cero); elimina el parser duplicado en Node host. Rotación genera UUID mediante Node de la imagen existente, conservando crypto.randomUUID y sin exigir Node instalado en host. No modifica reglas ni efectos.

Cierre H: H1–H3 verificadas por el principal; [evidencia de aceptación](../../../evidence/local/simulador-produccion/setup-compose/verification.md). Inicio limpio sin .env/runtime exit0, config/sintaxis y tests2/2, dos carreras10/90 con SQL10/100, restart conserva datos/historial, rotación fresh/legacy y navegador2/2. Stack principal actualizado preservando configuración legacy, luego rotación explícita auditada dejó campaña nueva0/0 para la prueba del usuario. No cambios de pantallas ni contratos. Proyectos de prueba detenidos sin borrar volúmenes.

## Extensión I: acceso por Tailscale Serve (2026-10-19)

Usuario autoriza ejecutar Serve para los servicios del simulador. Principal interpreta interfaces web: Grafana443 existente, web/API8443 y Prometheus8444. API permanece bajo /api de la web (misma sesión/origen); PostgreSQL y jobs administrativos no son interfaces web. Solo tailnet mediante Serve, sin Funnel ni publicación global. Fuente: decisión local explícita, no evidencia SUM. Principal planifica/configura Serve y posee navegador/aceptación; Luna High implementa infraestructura. Fidelidad visual e interacción SUM obligatoria: ninguna pantalla autorizada para cambio, reutilizar interfaces existentes; sin cambios de backend/client/shared.

I1 (worker): Nginx acepta exclusivamente un Origin HTTPS tailnet configurado adicional a los dos orígenes locales existentes; normaliza Origin hacia el backend local actual. Selección de Host de upstream basada en autoridad del Host original, exacta y configurada, no basada en Origin (GET sesión no siempre envía Origin); hostname tailnet no loopback activa las cookies __Host Secure ya existentes del backend. No relajar CORS/CSRF hacia comodines. Mantener Host local para k6/loopback. Proveer tres variables de proxy (origin, authority, hostname) mediante runtime/tailscale.env opcional únicamente en web; defaults inactivos seguros en imagen. Sin nombre de dispositivo versionado. Compose publica Prometheus únicamente en127.0.0.1:9090 para Serve. Mantener arranque default sin archivo opcional. Documentar comandos Serve múltiples puertos y regeneración de configuración sin dependencias nuevas ni cambios visuales.

I2 (principal): configurar Serve en8443 a5189, preservar443 a5190;8444 a9090. Generar configuración local ignorada con autoridad/origen exactos desde estado Serve del propio nodo; no guardar identidades/secrets en evidencia. Antes de inspeccionar una URL confirmar target propio sintético. Si Host reenviado difiere de lo previsto, diagnosticar y registrar corrección aislada de proxy, sin modificar auth por aproximación.

I3 (principal): config Compose válido sin tailscale.env; nginx -t; tres URLs HTTPS con health/query válidos; navegador real login web propio sintético +cookie Secure/HttpOnly __Host +sesión/dashboard/logout; Origin ajeno403; login HTTP local y arnés k6 local permanecen funcionales, sin consumir cupos (lecturas/smoke); auditoría0/0 final si nadie matriculó. Publicación registrada fuera del código; no snapshots, acceso SUM ni datos privados. No indexar con CodeGraph por limitación conocida de symlinks. Máximo un ciclo automático de reparación antes de diagnóstico/decisión principal.

Propiedad worker: compose.simulator.yaml, infra/simulator/nginx.conf, infra/simulator/Dockerfile.web, infra/simulator/README.md, script nuevo infra/simulator/configure-tailnet.mjs opcional para configuración local validada si hace falta (no ejecutar Serve, no modificar runtime/.env). Principal: plan/workflow/evidencia, runtime local y pruebas integradas. No workers adicionales ni subdelegación. Contrato SIM-PUBLIC-1 sin cambios; reutilizar cookies/control de Host existentes.

Diagnóstico I: revisión previa detectó clave duplicada de Origin cuando el default expandía al mismo disabled.invalid; worker la eliminó y cambió sentinel a disabled (no Origin válido de navegador). La primera carga real con dominio tailnet encontró map_hash_bucket_size64 insuficiente por longitud de clave HTTPS; principal aplica corrección aislada map_hash_bucket_size256 y repite nginx -t/arranque, sin cambiar permisos/auth. Prueba estática actualizada por el principal exige Prometheus únicamente loopback9090 conforme al nuevo alcance autorizado.

Cierre I: publicación y autenticación HTTPS verificadas, acceso local/k6 conservado; tres interfaces HTTPS200 sin Funnel, configuración privada persistente y tests2/2. Navegación automática después de Salir tras recarga presenta un gap preexistente reproducible en local y tailnet, aunque logout revoca la sesión401 correctamente; no se cambia frontend en esta etapa. Usuario solicita finalmente solo los enlaces web y Grafana.


## Extensión J — k6 solicitado y gráficas con muestras escasas (2026-10-19)

Autor del diagnóstico y plan: principal. Alcance local-only, exclusivamente simulador independiente sintético. Reutiliza observabilidad existente y contrato SIM-PUBLIC-1 sin cambios. Conservar fidelidad visual/interacción SUM; ninguna pantalla React autorizada para cambios. Complejidad baja, incertidumbre baja tras consulta Prometheus, impacto bajo de presentación.

J1 principal: ejecutar docker compose run --rm k6 y auditar SQL sin reiniciar campaña. Resultado real: testid00aea5d4-8d70-4023-8e02-b040a042d542 exit0,100completadas10aceptadas90SECTION_FULL, p95submit948.78ms/p99970.85ms. Auditoría10matrículas101solicitudes (incluye actividad previa, no atribuir101 a k6), todas invariantes sin violaciones.

J2 diagnóstico: count_over_time(k6_http_reqs_total{testid=...}[15m]) devuelve exactamente una muestra por ruta; rate requiere al menos dos. No fabricar tasas ni rellenar con ceros. Handoff implementación gpt-6-luna/high, grafana_sparse_points, únicamente dashboard JSON y párrafo README: mostrar puntos siempre en timeseries y explicar ráfaga/lecturas sostenidas; no modificar consultas ni backend/client/shared. CodeGraph sin init por limitación conocida de symlinks.

J3 principal: ejecutar reads sintético sostenido de80s sin efectos de matrícula; verificar rate/latencia con varias muestras reales vía Grafana→Prometheus, reload provisión Grafana y navegador real con capturas sintéticas. Criterios: k6 exit0,10/90 carrera, SQL sin sobrecupos, puntos explícitos en timeseries y consultas originales intactas, curvas con muestras/rate no vacío para reads, sin errores de datasource. Registrar evidencia y enlaces específicos por testid.

Cierre J: J1–J3 verificadas; consultas intactas,9paneles conmarcadores, curva sostenida con16muestras reales/ruta, cero errores de datasource/navegador, auditoría final10/101sinviolaciones. Evidencia: evidence/local/simulador-produccion/observability-sparse/verification.md.


## Análisis K — batería propuesta de400alumnos (2026-10-19; pendiente de implementación)

Solicitud: analizar escenarios realistas incluyendo400alumnos y casos adversos. Principal responsable del análisis; sin delegación, cambios de aplicación ni ejecución de nuevas cargas. Supuesto explícito:400alumnos sintéticos distintos y hasta400sesiones concurrentes; no400peticiones/s ni400navegadores.400es objetivo de prueba, no peor caso absoluto ni demanda SUM verificada. Preservar fidelidad visual e interacción SUM; ninguna pantalla autorizada para cambio. Local/scenarios existente se conserva; nuevos perfiles exclusivos del simulador.

Hallazgos revisados en código: backend/scripts/seed-simulator.ts crea100actores y capacidades10/100/100 en shared; distributed crea una sección por actor y curso. load/common.js exige exactamente100 y expectativas10/100; load/enrollment.js deriva VUs del manifiesto, no de --vus. load/reads.js usa llegada abierta con techo de actores, no asegura400sesiones activas. Script de verificación de observabilidad y documentación también asumen100. Ventana sintética seed4h y autenticación efímera15min exigen renovación/precondiciones en pruebas largas.

Batería propuesta, no ejecutada:

| ID | Preparación y carga | Aceptación específica |
| --- | --- | --- |
| K1 pico login |400identidades login dentro de5s, sin matrícula |400sesiones aisladas; medir429/5xx/p95 y no confundir rate-limit con caída |
| K2 carrera10cupos |400actores elegibles preautenticados; barrera de envío |10aceptadas390SECTION_FULL y400resultados;sin sobrecupos/duplicados; medir desfase de barrera |
| K3 escrituras completas |400actores, cupos>=400en cada sección seleccionada |400aceptadas y400reportes completos; ningún efecto parcial |
| K4 últimos cupos |Campaña con9/10ocupados,400actores nuevos |1aceptada399SECTION_FULL; totalfinal10 |
| K5 mezcla |400sesiones con pausas1–5s;aproximación70%consulta20%preparación10%envío;duración10min |Una matrícula máxima poractor;distinguir resultados académicos esperados y fallos técnicos;reportar tráfico real |
| K6 varias secciones |Catálogo fijo y grupos de demanda uniforme y80/20, capacidades definidas |Invariantes porsección y atomicidad de selección multicurso; no atribuir diferencias solo a locks si cambia catálogo |
| K7 reintentos |Dobleclick/replay mismoUUID,UUIDnuevo tras aceptación,payloadcambiado,tabsmúltiples |MismoUUID/payload devuelve mismoresultado;payload cambiado409;sin doblescupos;ALREADY_ENROLLED para UUIDnuevo |
| K8 recuperación |400sesiones+carga controlada;caída1API y respuesta perdida tras commit, luegoDBbrevemente no disponible |Errores transitorios clasificados;rollback/replay correctos;reconciliación final sin efectos parciales;recuperación medida |
| K9 carga escalonada y duración |50→100→200→400sesiones;complementar con llegada abierta crecientey10–30min mantenidos |Ubicar saturación y medir drenaje después;renovar sesión;sin crecimiento no acotado de colas/memoria |

Todos son diseños locales sintéticos, no testimonios observados de tráfico SUM. K2/K3 requieren campañas frescas y catálogo/capacidades coherentes; K4preseed explícito de ocupación íntegra. Cada repetición con testid y campaña independientes, configuración y recursos registrados, sin borrar historia. Repetir carrera mínimo3veces y no calcular percentiles globales sumando/mezclando p95 deintervalos.

Hipótesis locales por medir: pool12conexiones porAPI (24con2réplicas por defecto), espera de locks de secciones compartidas y alcance de la transacción, lecturas repetidas de todoel catálogo en loadRunState, contador login porIP en una misma fila y coste de autenticación/metricas compartiendoBD. run-api fija límiteIP2000/min; no afirmar que el default120sea efectivo. Ninguna hipótesis demuestra causa de lentitud de SUM.

Observabilidad propuesta: además de HTTP k6 y resultados académicos porcausa, series temporales CPU/RAM porservicio,eventloop,esperapool,locks/conexiones/latenciaSQL,errores429/503/timeouts,reintentos,dropped_iterations y desfasedebarrera. Endpoint operativo actual JSON protegido es un punto de partida, no está automáticamente scrapeado ni graficado porGrafana. Etiquetas acotadas sinidentificadores de alumno ni credenciales. Dashboard debe distinguir escenario/población/cargaobjetivo/cargaobtenida/réplicas. AuditoríaSQL final obligatoria, no deducir integridad degráficas.

Método recomendado: suitek6HTTP parametrizable +2–5navegadores para experienciaUI; mantener un Compose. Primer tramo50/100/200/400sobrehostactual para integridad; para medircapacidad aislar generador enotrohost o registrarcontención deCPU juntoaaplicación/observabilidad. Umbrales2s/5s existentes p95/p99son objetivos locales iniciales y el estrés debe ubicar límite sin desactivar checks de integridad. Pruebas de fallo admiten errores técnicos esperados acotados; no reutilizar el check happy-path100%éxito como criterio de recuperación.

Agnosticismo: comprobar invariantes de negocio/contrato (capacidad,unicidad,atomicidad,idempotencia,recuperación), sinincluir SQL PostgreSQL en cliente ni k6. Locks/errores/reintentos viven en adaptadores. Un resultadoPostgreSQL no certifica Oracle; requeriría suite equivalente contraadaptadorOracle real enentorno sintético.

Fuentes primarias de metodología consultadas: https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/ y https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/ . Próximo trabajo propuesto: parametrizar seed/manifiesto/precondiciones, añadir escenarios anteriores porfases, ampliar métrica/dashboard y auditar cadaejecución. No implementado en estaetapa.

## Implementación L — escenarios400 (2026-10-19)

Autorización usuario: implementar bateríaK; aclaración100%CPU se refería a GitHubCodespaces, no alhostactual. Principal planifica sinagentesplanificadores; contrato SIM-LOAD-2 listo en contracts/local-api/simulator-load-profiles.md. Fidelidad SUM obligatoria; noautoriza cambiospantallasReact, contratosHTTP ni reglasacadémicas. Solo entorno sintético independiente.

L1 backend LunaHigh: backend/scripts/seed-simulator.ts y helpernuevo synthetic-load-profile.ts y testnuevo en backend/test; parametrización100compatible/400,5perfiles+legacy, prefill9store real,manifiestoSIM-LOAD-2. Build/lint/tests focalizados.
L2 load LunaHigh: load/common.js,enrollment.js,reads.js,browser.js,recovery.js si precisa, nuevoslogin/mixed/retry/resilience/sessions.js y tests. ConsumircontratoL1sinmutarlo; max1actor/VU, renovar sesión largas,checksdeclaranerroresesperados. Noeditar run-observed.sh/audit-load.sh/scenarios.sh (principal).
L3 principal: init-runtime/load-runtime/run-api/rotate/Compose config nuevos campos y runnerload/scenarios.sh; colector interno+Prometheus/Grafana; actualizar crashharness y verificaciones sinleerprivados; docs/aceptaciónintegrada/evidencia. AmbosworkerssinSubdelegación,CodeGraphsininitporlimitaciónsymlinks, máx2.
L4 aceptación principal: carrera40010/390,lastseat1/399,ample400,multi100/300,retry400sin duplicación,login400,mixed ystress/resilience con400objetivoyreportarcargaobtenida, auditorías yrestauración, navegador2usuarios,Grafana. Soak30min ysesiónrenovada planificados/ejecutados según duraciones reales; no confundirhumoconsoak.

Diagnósticos L del principal: la compilación de scripts del worker encontró tipos SYN-string incompatibles; se reutilizó parseSubmissionRequest del DTO existente, sin inventar contratos. El manifiesto multigrupo exige selección poractor en vez de una selección global; preflight ahora deriva admisiones de capacidad/demanda porcohortes y conserva legado. Last-seat poblacionesmenores9 necesitan capacidadextra en los otroscursos; corregido y probado. Se etiquetan escenarios reales porSCENARIO_NAME y el dashboard diferencia iteraciones de alumnos.

Ejecución inicial: login400pasa; carrera10/390,last-seat1/399,ample400,mixed400,multi100/300 conservan todas invariantesSQL. Umbrales p95<2s incumplidos con400, registrados sinrelajarlos; pool observado hasta188/187en espera. Retry singleshot encontró65respuestastransitorias y335matrículas; decisión explícita: escenario de reintento realiza recuperaciones HTTP acotadas con mismoUUID,backoff y métrica retry_transient_responses, conservando verificación completa y400resultadosfinales. No se modificó backend para esconder sobrecarga. Primera inyección de fallos usó start --wait no soportado por CLIinstalado; servicios restaurados y caso repetido con up -d --wait --no-deps. Ensayo de crash arrancado porerror junto arotación se interrumpió porrecreación deBD y no se cuenta; arnés ahora toma el mismoflock de suite antes de acceder a campaña. Principal conserva ejecución serial de campañas.

Diagnóstico de recuperación L: segunda prueba recuperó400sesiones pero detectó1HTTP500 durante apagado y6transitorios inmediatamente después de la ventana de caída; el log deAPI identificó `Cannot use a pool after calling end on the pool`. Corrección aislada del principal en readSnapshot/readDashboardSnapshot: adquisición del pool dentro de try/catch para devolver STORAGE_UNAVAILABLE503 conforme al contrato existente; pruebas focalizadas2/2. El escenario distingue una gracia de recuperación acotada por el límite ya configurado, sin aceptar500,401,403 ni errores indefinidos. Bashn pasó, pero editar el archivo del runner durante su ejecución produjo un error de lectura del shell; se descartó ese ensayo y se congeló el runner antes de repetir. Rerun final de recuperación exit0,400sesiones recuperadas, ambasAPI yDBhealthy; retry conbackoff exit0,400matrículas800solicitudes. Permanencias cortas se etiquetanquick, no se acreditan30min reales.

Cierre L: implementación terminada; los doce escenarios se ejecutaron con población400 y tiemposquick. Funcionalidad e invariantesSQL12/12; SLO HTTP fallido en6escenarios de matrícula, registrado como hallazgo sinrelajar umbrales. Build/tipos/lint,17unitbackend,13Node,3e2eHTTP,2navegadores,Grafana,rollback/replay y falloAPI/DB verificados. Soak30min natural noejecutado, límite explícito. Evidencia completa: evidence/local/simulador-produccion/scenarios-400/verification.md. Campañaactiva400sharedfresca0/0. Commit/push autorizados porusuario alfinal deaceptación.
