# Grafana: ráfaga de matrícula y curvas de lectura

Fecha: 2026-10-19. Fuente observed, exclusivamente simulador independiente sintético propio; local-only, sin consultas SUM, snapshots ni datos privados. No acredita rendimiento de SUM.

## Criterios y resultados

| Criterio | Comprobación | Resultado real |
| --- | --- | --- |
| Concurrencia10cupos/100actores | `sudo -n docker compose run --rm k6` | exit0;100completadas,10aceptadas,90SECTION_FULL,0inesperadas; p95submit948.78ms/p99970.85ms |
| Integridad SQL | Servicio audit sin expectativas predeterminadas, antes y después de lecturas | Ambas passed:true;10matrículas101solicitudes10reportes; todas8invariantes con0violaciones;101incluye1solicitud previa a esta prueba |
| Diagnóstico de gráficas | count_over_time por ruta de la carrera en Prometheus | Una muestra real por ruta; rate() no puede calcularse con una sola muestra |
| Presentación de muestras aisladas | JSON, dashboard servido, revisión contra HEAD |9timeseries conshowPoints:always/pointSize5; todas consultas originales idénticas |
| Curvas con tráfico sostenido | k6 reads80s; RATE10,RAMP_10_DURATION10s,RAMP_25_DURATION10s,DURATION1m | exit0;1324iteraciones,2688HTTP,0fallos; p95lecturas22.48ms/p9939.20ms |
| Datos y render real | Grafana datasource proxy→Prometheus y Chromium1536x1000 |16muestras por ruta read,15puntos de tasa positivos,2serieslatencia;7canvas,22frames convariospuntos;0errores JS/datasource |
| Resultado de carrera en Grafana | scripts/verify-simulator-observability.mjs | exit0;10aceptadas90full100completadas0inesperadas, sin etiquetas de identidad; captura real |
| Higiene | git diff --check | exit0 |

## Evidencia

- `run-summary.json`: agregados k6, sin credenciales ni identificadores personales.
- `reads-curves-result.json` y `grafana-reads.png`: curvas reales de lectura.
- `enrollment/metrics-result.json`, `enrollment/browser-result.json`, `enrollment/grafana-dashboard.png`: carrera y navegador.
- Carrera testid: `00aea5d4-8d70-4023-8e02-b040a042d542`.
- Lecturas testid: `reads-20261019-graficas-01`.

## Límites

La carrera concentra envíos en aproximadamente1s después de una barrera60s. Su tasa por ruta queda sin datos por insuficiencia de muestras; no se inventan ceros ni tasas. La prueba reads alimenta curvas de tráfico/latencia y no incrementa contadores de matrícula, que por eso muestran0 en esa ejecución. Las cifras dependen de este host compartido y no representan capacidad de SUM. No se cambió React, NestJS ni el contrato SIM-PUBLIC-1.
