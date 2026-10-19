# Escenarios de carga con 400 alumnos

**Fecha:** 2026-10-19 UTC. **Fuente:** `observed`, aplicación propia con datos construidos independientemente desde fixtures sintéticos. **Alcance:** `local-only`; no se inspeccionó ni se probó SUM. No acredita comportamiento ni capacidad de Oracle.

## Implementación

- Población configurable de 1 a 1000; valor de la batería: 400. El seed original conserva su default de 100 para compatibilidad. El runner prepara una campaña fresca por caso y conserva las anteriores.
- Perfiles `shared`, `ample`, `last-seat`, `multi-uniform`, `multi-hotspot` y el perfil `distributed` legado. El último cupo se prepara mediante nueve matrículas completas usando el store real; no se fabrican contadores de ocupación sin sus registros asociados.
- Se reutiliza SIM-PUBLIC-1 sin cambios de rutas, DTOs ni frontend. El manifiesto interno se extiende mediante [SIM-LOAD-2](../../../../docs/reverse-engineering/contracts/local-api/simulator-load-profiles.md). Las validaciones derivan las admisiones esperadas de demanda y capacidades.
- Doce escenarios con datos, cookies e identidad separados por usuario virtual. El modo mixto envía como máximo una primera matrícula por alumno. Los reintentos conservan UUID y payload, usan backoff acotado y registran los errores transitorios.
- Un solo Compose. El runner usa Bash, Docker Compose y flock; no requiere Node instalado para preparar, ejecutar o auditar los escenarios.
- Grafana permite elegir escenario y ejecución. Diferencia población configurada, iteraciones completadas y matrículas; muestra también CPU/RAM de las API, event loop, conexiones, cola del pool y esperas PostgreSQL.
- No se modificaron pantallas, estilos, navegación, datos del modo local de escenarios ni código React. Los nuevos grupos tienen etiquetas sintéticas distintas.

## Recursos y método

Este host dispone de **2 CPU lógicas y 7775 MiB de RAM**. k6, aplicación, base y observabilidad comparten el host. La aclaración del usuario fue que el 100 % de CPU se refería a GitHub Codespaces; no se atribuye esa medición a este host. Estos resultados no aíslan la capacidad de un servidor con generador externo.

Se ejecutó la población real de 400 con `SCENARIO_QUICK=1`: barrera de matrícula de 20 s; escalones de 5 s; pausas de 0.2–0.5 s; permanencia de 30 s (60 s para recuperación). Cada caso se auditó contra SQL, separadamente. `reads` utiliza llegada abierta y un conjunto disponible de 400 identidades; no exige 400 VUs activos al mismo tiempo. `stress`, `soak`, `mixed` y `resilience` sí alcanzan 400 VUs/sesiones según sus verificaciones.

**No se ejecutaron los 30 minutos de soak ni una renovación natural después de 15 minutos.** Las configuraciones largas están implementadas. El mantenimiento de sesión se comprobó con reloj controlado en pruebas unitarias y la renovación académica se comprobó mediante HTTP real en la integración.

## Resultados reales

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

Las cifras SQL incluyen las nueve matrículas y solicitudes iniciales de `last-seat`: la carrera agrega exactamente **una aceptación y 399 rechazos**. Los otros casos de carrera tuvieron 400 solicitudes nuevas. Todos los checks SQL de cupos, detalles, enlaces de solicitud/reporte y ausencia de efectos de rechazos dieron cero violaciones.

**La integridad y las verificaciones funcionales pasan en los doce casos; seis casos no cumplen el objetivo de rendimiento.** Se conservaron p95 < 2 s y p99 < 5 s. No se ampliaron los límites para obtener un resultado verde. La batería devuelve un código distinto de cero cuando incumple un umbral, aunque las invariantes SQL pasen.

El reintento final resolvió los 400 alumnos y verificó 800 replays, 400 conflictos de payload, 400 rechazos por matrícula previa, 400 consultas de resultado y 400 reportes. Registró **662 respuestas transitorias** antes de recuperarlas. Su p95 HTTP global fue aproximadamente 10.68 s; este caso evalúa recuperación e idempotencia y no tiene un SLO HTTP declarado. Su éxito funcional no significa ausencia de sobrecarga.

El caso de recuperación registró fallos transitorios de API y base, recuperó las 400 sesiones y dejó ambas API y PostgreSQL saludables. HTTP 500, 401 y 403 no se aceptan como transitorios. La gracia de recuperación está acotada y se mide por separado. El caso determinista adicional mató una API durante un INSERT de detalles no confirmado, comprobó rollback completo, reinició ambas API, descartó una respuesta ya confirmada y recuperó el mismo resultado desde almacenamiento; 20 UUID nuevos fueron rechazados sin duplicar la matrícula. Véase [crash-result.json](crash-result.json).

## Verificaciones

| Criterio | Comprobación ejecutada | Resultado |
| --- | --- | --- |
| Build y tipos backend/scripts | `pnpm --dir backend build`; `pnpm --dir backend exec tsc -p tsconfig.scripts.json` | exit 0 |
| Lint backend | `pnpm --dir backend lint` | exit 0; cuatro warnings previos en local-profile-session.spec.ts |
| Perfiles, errores de auth y pérdida del pool | Vitest de synthetic-load-profile, simulator-auth-errors y simulator-read-unavailable | 17/17 |
| Configuración y seguridad de la carga | Node tests de load-scenarios, session-maintenance, compose-config y metrics-exporter | 13/13 |
| Integración HTTP real | simulator-public.e2e-spec con campaña aislada de 400 en la BD sintética | 3/3; origen, identidad, matrícula, replay, renovación, rollback y reportes |
| Integración React → API propia → PostgreSQL | k6-browser con dos navegadores reales y población 400 | 2/2; dashboard con identidad propia, cero iteraciones fallidas |
| Grafana → Prometheus → k6 | verify-simulator-observability con expectativas 400/10/390 | exit 0, consultas de panel válidas, captura real, sin etiquetas de identidad |
| Métricas operativas reales | snapshot protegido → colector → Prometheus → Grafana | ambas réplicas disponibles; CPU, RAM, pool, event loop y esperas con datos |
| Publicación existente | health HTTPS de web y Grafana en Tailscale | 200; web identifica procedencia independently-synthetic |
| Estado final | audit de la campaña activa después del login y navegador | passed=true; 400 actores; cero matrículas y cero solicitudes |
| Higiene | `git diff --check`, sintaxis Bash y JSON | exit 0 |

## Diagnósticos y correcciones

1. El intento inicial de reintentos sin recuperación de errores transitorios terminó con 335 matrículas; no hubo sobrecupos. Se añadió reintento HTTP acotado con el mismo UUID y un contador de transitorios; la repetición final terminó en 400/800.
2. La primera inyección usó `docker compose start --wait`, no soportado por el CLI instalado. Se restauraron servicios y se cambió a `up -d --wait --no-deps`. Ese intento no se acredita.
3. Una prueba posterior encontró HTTP 500 por adquisición del pool fuera del bloque de manejo de errores durante el apagado. El principal corrigió aisladamente `readSnapshot` y `readDashboardSnapshot` para devolver `STORAGE_UNAVAILABLE` 503, con dos pruebas de regresión. La repetición final pasó sin admitir HTTP 500.
4. La ventana de caída terminaba antes que la recuperación efectiva. Ahora se distingue una gracia de recuperación finita; no se clasifica cualquier error como esperado.
5. Un ensayo de crash lanzado junto a una rotación y un ensayo cuyo runner fue editado mientras Bash lo ejecutaba se descartaron. El arnés de crash toma el mismo flock y las ejecuciones finales fueron secuenciales con el runner congelado.

Estos incidentes y los resultados fallidos permanecen documentados; no se convierten en evidencia de éxito. Las latencias y colas observadas son del simulador: se midieron máximos de aproximadamente 188/187 solicitudes esperando conexión en cada API. Esto respalda investigar pool y contención, pero no demuestra la causa de lentitud del SUM.

## Archivos de evidencia

- [results.json](results.json): métricas agregadas, auditorías, criterios y rangos de tiempo absolutos por ejecución. Los enlaces históricos siguen mostrando el intervalo de prueba hasta que expire la retención de Prometheus.
- [browser-result.json](browser-result.json), [final-audit.json](final-audit.json), [crash-result.json](crash-result.json).
- [Grafana de carrera](grafana/grafana-dashboard.png), [paneles operativos](grafana-operations.png), [resultado operativo](operational-metrics-result.json).
- [Verificación Grafana](grafana/metrics-result.json), [verificación del navegador de Grafana](grafana/browser-result.json).
- [source-fingerprint.json](source-fingerprint.json): SHA-256 de los archivos de implementación comprobados.

Los manifiestos, códigos de acceso, cookies, secretos y logs completos permanecen fuera de Git en runtime. No se exportaron datos reales, respuestas de SUM ni material de autenticación a la evidencia.

## Reproducción

```bash
docker compose up --build -d
SCENARIO_QUICK=1 bash load/scenarios.sh all
```

Para la permanencia real configurada:

```bash
bash load/scenarios.sh soak
```

Los casos de pico pueden terminar en fallo de umbral de latencia en este host; consultar los campos `correctnessPassed`, `performancePassed`, `failedThresholds` y la auditoría SQL. Un SLO no declarado aparece como `null`, no como rendimiento aprobado. Cada ejecución rota la campaña y sus códigos; la web queda vinculada a la campaña nueva.
