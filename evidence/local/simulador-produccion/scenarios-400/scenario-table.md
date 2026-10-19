| Escenario | SQL matrículas / solicitudes | Integridad y checks | Rendimiento |
| --- | --- | --- | --- |
| login | 0 / 0 | pasa | sin SLO HTTP en este caso |
| race | 10 / 400 | pasa | p95 3.29 s; no cumple |
| last-seat | 10 / 409 | pasa | p95 3.14 s; no cumple |
| ample | 400 / 400 | pasa | p95 4.47 s; no cumple |
| mixed | 400 / 400 | pasa | p95 4.53 s; no cumple |
| multi-uniform | 100 / 400 | pasa | p95 2.57 s; no cumple |
| multi-hotspot | 100 / 400 | pasa | p95 3.59 s; no cumple |
| retry | 400 / 800 | pasa | sin SLO HTTP en este caso |
| resilience | 0 / 0 | pasa | sin SLO HTTP en este caso |
| stress | 0 / 0 | pasa | p95 1.67 s; cumple |
| soak (corto) | 0 / 0 | pasa | p95 1.61 s; cumple |
| reads | 0 / 0 | pasa | p95 0.02 s; cumple |
