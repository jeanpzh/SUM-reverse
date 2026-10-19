# Simulador PostgreSQL: aceptación integrada

Fecha: 2026-10-19 (UTC). Autor de planificación, contratos y aceptación: principal. Implementadores reales: `backend_simulator` y `frontend_simulator`, `gpt-6-luna` / `high`, sin subdelegación. Fuente de esta evidencia: `observed`, entorno propio `local-only` con datos construidos independientemente. No se inspeccionó ni cargó SUM, ni se accedió a snapshots privados. Oracle en UNMSM y la lentitud de SUM son `testimony`; su causa permanece `unverified`.

## Entorno y alcance comprobado

Docker Engine 29.1.3, Compose 2.40.3, PostgreSQL 18.6, k6 2.3.0; Linux x64, 2 CPU lógicas y 8 GiB RAM compartidos por generador y aplicación. Imágenes base fijadas por digest, dependencias con lockfiles. [Huella de fuentes finales](source-fingerprint.json) (árbol de trabajo; sin commit nuevo). Dos procesos NestJS, PostgreSQL interno y proxy Nginx. Único puerto publicado: `127.0.0.1:5189`. Base nueva `sum_simulator_synthetic`, sin importaciones. Campañas independientes conservadas en el mismo volumen, auditadas y cerradas antes de rotar. No se borró el volumen para conseguir resultados.

El modo público es opt-in y tiene autenticación/campaña/almacenamiento explícitos. El modo local conserva su configuración por defecto, catálogo de cuatro actores y almacenamiento previo. El único cambio visual autorizado es la variante de acceso de `/local/login`; se reutilizan dashboard, matrícula, selección y reporte existentes. PostgreSQL guarda actores, perfiles, oferta, sesiones, solicitudes y resultados; las catorce proyecciones de dashboard usan el actor autenticado.

## Concurrencia real de cupos

[Resultados numéricos de las diez rondas](concurrency-results.json). Cada ronda tiene 100 alumnos distintos, tres cursos de cuatro créditos, una sección limitada a 10 plazas y las otras dos con capacidad 100. Cada participante prepara login, sesión y contexto antes de una barrera común de 10 s. Se usa una iteración por VU. El máximo desfase observado al iniciar los envíos fue 154 ms; la barrera aproxima inicios y no promete simultaneidad exacta.

**Diez rondas: 1.000 intentos, 100 aceptaciones, 900 rechazos SECTION_FULL, cero resultados inesperados y cero iteraciones descartadas. Las diez auditorías SQL comprobaron exactamente 10 matrículas y 100 solicitudes por campaña, ocupación coherente, detalles y reportes íntegros.**

p95 de envío por ronda entre 698,22 y 794,38 ms. En rondas 2–10, p99 máximo 810,18 ms; ronda 1 no exportó p99 numérico, aunque su umbral pasó y máximo fue 757,28 ms. Son percentiles por ronda, no un percentil global de 1.000 muestras. Después de la última corrección de errores de autenticación se reconstruyeron las APIs y se hizo una ronda adicional: 10 aceptadas/90 SECTION_FULL, cero inesperados, auditoría 10/100; está separada de las diez rondas originales en load-results.json.

Control funcional con secciones por alumno: 100/100 aceptados, cero resultados inesperados, auditoría 100 matrículas/100 solicitudes. No se interpreta como comparación causal de velocidad: el catálogo tiene 300 secciones frente a tres y el número de escrituras aceptadas difiere.

Garantía implementada: una transacción bloquea campaña en modo compartido, actor y secciones ordenadas; evalúa reglas reutilizadas y confirma solicitud, matrícula, detalles, contador y reporte juntos. Restricciones únicas refuerzan una matrícula por actor/campaña y una respuesta por clave. El algoritmo depende de transacciones/bloqueos/unicidad, implementados mediante un adaptador PostgreSQL. **No se ejecutó Oracle**; un adaptador Oracle deberá pasar la misma conformidad.

## Recuperación, lecturas y navegador

[Resumen sanitizado k6](load-results.json), [caída real](crash-result.json), [traza UI](browser/result.json).

- Recuperación k6: una aceptación, veinte replays concurrentes con respuesta canónica completa idéntica, payload distinto con la misma clave → 409 REQUEST_CONFLICT, clave nueva → ALREADY_ENROLLED. Auditoría: una matrícula y dos solicitudes persistidas.
- Caída real: bloqueo administrativo de INSERT de detalle; se observó la API detenida dentro de una transacción ya iniciada y se envió SIGKILL a su contenedor. Cero solicitudes/matrículas parciales y ocupación sin cambios. Tras reiniciar ambas APIs, misma clave aceptada una sola vez. Se descartó el cuerpo de respuesta confirmada, se reiniciaron ambas y el resultado se recuperó desde PostgreSQL. Veinte claves nuevas concurrentes del mismo actor fueron rechazadas. Auditoría junto al escenario UI: dos matrículas, veintidós solicitudes.
- Lecturas: rampa abierta de 40 s: 10 recorridos/s durante 10 s, transición a 25 durante 10 s y transición a 50 durante 20 s. Cada recorrido tiene dos lecturas más preparación una vez por VU. 1.025 recorridos, 2.050 lecturas, cero errores/descartes; p95 21,33 ms y p99 42,21 ms de lectura. No es una prueba sostenida manteniendo 50 recorridos/s, ni determinó el punto de saturación.
- Dos Chromium de k6 accedieron durante la carga HTTP y alcanzaron sidebar, topbar y nombre propio; ambos completaron. Pantalla utilizable: p95 2.355,7 ms (dos muestras, no estimación poblacional).
- Playwright real a 1536×735: login → dashboard → recarga → selección de tres cursos → matrícula → reporte → logout con revocación → login del mismo actor → resultado durable. Sidebar 280 px/topbar 64 px. Cero solicitudes externas y errores JS. Capturas: [inicio](browser/home.png), [selección](browser/enrollment-before.png), [reporte](browser/report.png). No se realizó una comparación equivalente contra SUM y no se acredita paridad visual nueva.
- Control negativo aislado: umbral imposible p95 < 0,0001 ms, con checks HTTP al 100%, cero errores/descartes. k6 terminó con código 99 únicamente por el umbral. En los JSON heredados de summary-export, `thresholds: false` indica umbral no fallido; la aceptación usa el código de salida y las métricas, no una lectura invertida de ese booleano.

## Matriz de aceptación y límites

| Criterio original | Comprobación real / resultado | Estado |
| --- | --- | --- |
| A1 cupos / A10 repetición | 10 rondas k6 contra dos APIs + diez auditorías SQL exactas | Cumple alcance ejecutado |
| A2 unicidad | 20 claves nuevas concurrentes después de matrícula; relogin y reinicios | Cumple |
| A3 idempotencia | 20 replays concurrentes completos y payload conflictivo; reglas canónicas reutilizadas | Cumple escenarios ejecutados |
| A4 atomicidad | Fallo SQL inyectado en PG real y SIGKILL a mitad de escritura; auditoría posterior | Cumple |
| A5 recuperación | Caída precommit, descarte de cuerpo postcommit, reinicio de ambas APIs, lookup y replay | Cumple |
| A6 identidad | Expiración forzada, relogin estable, sesión y reporte ajenos, renovación y revocación | Cumple escenarios ejecutados |
| A7 superficie pública | Catálogo libre ausente y rutas públicas restringidas; datos solo de principal | Cumple escenarios ejecutados |
| A8 coherencia | Campañas nuevas sin contaminación, control distributed, cierre/replay y validaciones previas | Parcial: no se ejecutó toda combinación de vacío/capacidad cero/cierre concurrente contra PostgreSQL |
| A9 UI/local | Escenario integrado real pasa; builds/lint/datos pasan | Parcial: scripts globales de regresión UI fallan, ver abajo |
| A11 operación | Tres lock-timeouts PG reales → 503 sin efectos; retry posterior aceptado; auth storage errores controlados | Parcial: restauración de backup y rollback de versión no ensayados |
| A12 métricas | Agregados HTTP/DB/pool/event loop protegidos; carga separada y control negativo | Cumple humo; capacidad sostenida y saturación no determinadas |

## Validación y limitaciones de regresión

- `pnpm --dir client build`, build público y `lint`: PASS; `test:data`: 184/184 PASS. `node --test shared/local-profile-dashboard.test.mjs`: 8/8 PASS, incluyendo catálogo local fijo y nuevos IDs.
- `pnpm --dir backend build`, `lint`, TypeScript de scripts: PASS. Lint mantiene cuatro warnings previos en local-profile-session. Suite PostgreSQL dedicada con dos instancias: shared y distributed pasaron; prueba posterior de lock-timeout pasó (un caso seleccionado, dos omitidos). Auth errores: 3/3 PASS.
- Regresión backend focalizada: `pnpm exec vitest run --no-file-parallelism` con foundation, us1–us6, wire, cause-order y simulator-auth-errors: **10 archivos, 208/208 PASS**. No ejecuta escenarios de navegador ni importa snapshots privados; se rechazó cualquier variable `_SNAPSHOT_DIR` antes del comando.
- `pnpm --dir client verify`: FALLA. Tras una actualización de títulos históricos en el script, la siguiente aserción legacy `.history-table thead th` no corresponde a clases vigentes. Una reparación automática consumida; no se cambió UI para satisfacer expectativas antiguas. No se declara regresión global aprobada.
- HTTP real tras la última reconstrucción: credencial sintética desconocida → 401 en cinco intentos; sexto → 429 con Retry-After: 60. Playwright integrado volvió a pasar con esa versión.
- `pnpm --dir backend test`: ejecución global interrumpida tras diagnosticar el escenario de navegador heredado `matricula-regular-us5-us6.integration.spec.ts`, que agota timeout esperando `.enrollment-calendar-panel` visible. No se presenta como prueba aprobada. Las suites dedicadas descritas tienen resultados independientes.
- Bootstrap comprobado en una copia temporal: permisos 0600 de entorno, 0700 de runtime/results, dueño correcto y rechazo de sobrescritura. `docker compose config --quiet`, sintaxis de scripts y `git diff --check`: comprobaciones finales registradas en workflow.

Hubo fallos reales del arnés conservados fuera de git: UUID generado incorrectamente por k6 al tratar ArrayBuffer como array; cookies borradas entre iteraciones de lecturas; HOME de Chromium no escribible para el UID elegido. Cada uno se diagnosticó y se corrigió antes de contar sus pruebas. La primera carrera inválida dejó cero efectos y se auditó 0/0. La carga de lecturas fallida terminó con código 99, no se contó como rendimiento válido. Los resultados anteriores incluyen solo corridas aprobadas, salvo el control negativo explícito.

## Reproducir y publicar

[Guía Docker](../../../infra/simulator/README.md), [plan](../../../docs/reverse-engineering/plans/simulador-postgresql-concurrencia.md), [contrato SIM-PUBLIC-1](../../../docs/reverse-engineering/contracts/local-api/simulador-produccion.md). Los comandos usan exclusivamente esta campaña sintética y el servicio interno `web`. No usar k6 contra SUM.

La aplicación está desplegada en loopback para revisión. Ambas APIs y PostgreSQL están healthy; el contenedor auxiliar de pruebas fue detenido conservando su volumen. Se dejó una campaña nueva de revisión con una matrícula sintética del último smoke UI (nueve plazas restantes en la sección limitada); las campañas de carga permanecen cerradas y conservadas. **No está publicada en Internet ni acreditada para lanzamiento productivo.** Antes de ese lanzamiento quedan hosting/dominio/HTTPS, separación del rol de migración del usuario runtime PostgreSQL, presupuesto de recursos y prueba sostenida en ese hosting, respaldo/restauración y reversión de versión. Compose usa NODE_ENV=test y cookie loopback sin Secure; no exponerlo externamente tal cual. Las incógnitas sobre la caída real de SUM no se resuelven con estos resultados del simulador.
