# Grafana + Prometheus: aceptación

Fecha: 2026-10-19. Fuente: observaciones del simulador propio, datos independientemente sintéticos (`observed`, `local-only`). [Plan G1–G6](../../../../docs/reverse-engineering/plans/simulador-postgresql-concurrencia.md). Principal planificó y verificó; worker observability_implementation implementó con modelo real gpt-6-luna/high, sin subdelegar. Ninguna pantalla React/NestJS modificada por esta extensión. Sin producción SUM, privados ni Grafana Cloud.

**Estado: aceptación completada en el entorno Docker local.**

## Acceso

[Dashboard de la carrera](http://127.0.0.1:5190/d/sum-simulator-k6?orgId=1&var-testid=cupos-20261019-grafana-02&from=now-24h&to=now). Acceso anónimo Viewer; administración protegida por un secreto aleatorio propio no publicado. El selector Test run permite ver cada ejecución. Ajustar el intervalo temporal si la ejecución queda fuera de él. Solo puerto5190loopback; Prometheus no publica puerto al host.

Grafana13.2.4 y Prometheus3.13.4 fijados por digest. Volúmenes separados conservan datos/configuración; retención Prometheus15d limitada también a1GB. No hay consultas a fuentes ajenas al stack. `K6_NO_USAGE_REPORT=true`; analítica y comprobaciones externas Grafana desactivadas. [Guía y comandos](../../../../infra/simulator/README.md).

## Resultados reales

| Criterio | Comprobación ejecutada | Resultado |
| --- | --- | --- |
| G1 Docker local | Compose config quiet, promtool check config, puertos y readiness por datasource | PASS |
| G2 dashboard | Provisioning datasource simulator-prometheus, UID sum-simulator-k6, selector testid, quince consultas válidas y latencia existente | PASS |
| G3 exportación | k6 remote-write, 144 series de carrera, labels inspeccionados sin identidad/url ni nombres de ruta con alumno | PASS |
| G4 resultados | Carrera cien alumnos/diez cupos y auditoría SQL10/100; PromQL y UI10 aceptadas/90 SECTION_FULL/0 inesperadas/100 completadas | PASS |
| G5 UI/historial | Chromium1536×1000, cero errores JS/datasource/red externa; reinicio real de Grafana+Prometheus y mismos contadores desde volumen | PASS |
| G6 errores | Control negativo exit99 y métricas persistidas; wrapper con fallo remote-write0→1 y conservación99; sintaxis/diff/enlaces | PASS |

- Carrera `cupos-20261019-grafana-02`: 100 intentos, 10 aceptados, 90 SECTION_FULL; sin descartes ni inesperados. k6exit0 y auditoríaSQL10matrículas/100solicitudes. Prometheus p95 de envío0,73325767225s coincide con733,25767225ms del resumen k6; conversión de unidades comprobada.
- Lecturas `lecturas-20261019-grafana-01`: rampa abierta40s, 1024 recorridos/2048 consultas principales, cero errores/descartes, p9519,12ms/p9933,40ms. k6exit0 y contador persistido coincide exactamente con su propio resumen. El número de llegadas depende de la planificación temporal, no se fuerza al valor de otra corrida.
- Control `control-20261019-grafana-01`: umbral p95<0,0001ms incumplido con checksHTTP100%, cero errores/descartes, k6exit99 preservado. Su contador de lecturas también coincide con el resumen y está separado por testid.
- Pruebas deterministas del wrapper con Docker simulado y preflight real: mensaje de fallo remote-write convierte código0 en1 y mantiene99. No se contaron como carga ni series reales.

## Evidencia

[Captura de cupos](grafana-dashboard.png), [captura de lecturas](grafana-reads.png), [serie de throughput validada](throughput-result.json), [métricas verificadas](metrics-result.json), [navegador](browser-result.json), [persistencia tras reinicio](persistence-result.json), [resumen de carrera](enrollment-summary.json), [lecturas y control negativo](read-runs-result.json), [huella de fuentes](source-fingerprint.json). CLI/logs/manifiestos operativos privados permanecen fuera de git; estos archivos contienen solo agregados y testid de ejecución.

## Semántica y límites

El dashboard mide lo observado por k6. Ausencia de sobrecupos se acredita mediante auditoría SQL separada. SECTION_FULL es rechazo académico HTTP200, separado de errores de transporte. Un cero de contadores ausentes se muestra únicamente cuando existen iteraciones de esa ejecución; sin ejecución se conserva No data. Los totales usan el último contador por serie, no la suma de muestras acumuladas.

Percentiles exportados son gauges del generador por ruta/operación, no un percentil global reconstruido. La mayor tasa de fallo por ruta tampoco es una tasa HTTP global ponderada. Las unidades reales de esta versión de k6 son segundos pese a que los nombres de serie no incluyen `_seconds_`; el dashboard multiplica por1000 para ms. Remote-write sigue siendo una salida experimental; las versiones se fijaron y validaron juntas.

Una carrera corta puede producir solo una muestra por serie HTTP: `rate()` necesita al menos dos y muestra No data en el panel solicitudes/s. El panel de solicitudes acumuladas y las latencias sí muestran esa carrera; las lecturas de40s permiten observar throughput. Las diez rondas antiguas no tienen series guardadas y no se inventaron muestras para dibujarlas. La ventana temporal y el testid seleccionados delimitan qué se ve.

## Correcciones durante aceptación

1. Prometheus rechazó `--web.enable-admin-api=false` con unexpected false. Principal eliminó el argumento: admin API ya está desactivada por defecto. Primera carrera mantuvo integridad10/90 pero no exportó series porque el receptor aún reiniciaba; se auditó10/100, cerró y conservó su campaña, y se excluyó de la aceptación de Grafana. Wrapper ahora verifica readiness y rechaza fallos de envío incluso si k6 sale0.
2. Primer dashboard consultaba nombres con `_seconds_`, que la versión real no emite. Se diagnosticó comparando series y resumen, se corrigió una vez y se repitió aceptación. El verificador exige ahora que la serie de latencia exista, además de validar sintaxis y contadores. Se añadieron acumuladas para ráfagas cortas y colores adecuados para100 completadas/errores inesperados.

El entorno quedó activo para revisión. La campaña de la carrera tiene10matrículas/100solicitudes y la sección limitada llena; una nueva carrera necesita rotación auditada, sin borrar volúmenes. Esta extensión no publica el simulador en Internet ni resuelve las tareas operativas pendientes del [informe fullstack](../fullstack-verification.md).
