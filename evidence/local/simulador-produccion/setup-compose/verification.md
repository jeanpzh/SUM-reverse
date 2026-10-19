# Arranque del simulador con un Compose

Fecha: 2026-10-19. Fuente observada: stacks Docker propios, fixture independiente de `backend/src/matricula-regular/fixtures.ts`. Decisión local autorizada por el usuario; no se inspeccionó SUM ni se consumieron snapshots. Plan y aceptación: extensión H del plan de concurrencia. Principal diseña/verifica; worker `simple_compose`, GPT-6 Luna High, implementa infraestructura. No hubo planificación delegada.

## Resultado

Desde la raíz basta `docker compose up --build -d`. Se inicializan secretos privados, PostgreSQL, migración/seed, dos API, web, Prometheus y Grafana. No se necesita Node en el host ni bootstrap previo. `docker compose run --rm k6` ejecuta la carrera existente, genera un testid y muestra su enlace Grafana. La carga no arranca automáticamente al levantar la aplicación.

| Criterio | Comprobación real | Resultado |
| --- | --- | --- |
| Inicio limpio | Copia de fuentes sin `.env` ni runtime, proyecto `sum-simulator-ready-check`, puertos5289/5290; `docker compose up --build -d --wait` | exit0; seis servicios saludables; init/migrate/seed completados |
| Secretos y permisos | Config renderizada comparada con secretos generados, modos runtime/results0700 y config/manifest0600 | Valores ausentes del render; permisos correctos |
| Autenticación mediante proxy | Login/logout por UI loopback5289; solicitud con Origin externo contra el mismo servidor local | 200/204; origen externo403 |
| Carrera predeterminada | `docker compose run --rm k6`, barrera60s | exit0;100 intentos,10 aceptadas,90 SECTION_FULL,0 inesperados/dropped |
| Integridad SQL | Servicio audit, esperados10 matrículas/100 solicitudes | exit0; todas las invariantes sin violaciones |
| Grafana real | Consultas a Prometheus mediante datasource Grafana con testid de la carrera |10 aceptadas,90 rechazos,100 completadas |
| Persistencia | down sin borrar volúmenes, up y comparación de huellas sin exponer valores privados | Misma configuración/manifest, campaña y métricas conservadas |
| Rotación sin configuración legacy | Script con PATH del host sin NVM; UUID y auditoría dentro de Docker; recreación de procesos | exit0; nueva campaña0/0, anterior conservada; segunda carrera10/90 y SQL10/100 |
| Control negativo SQL | Esperados999/999 contra campaña10/100 | exit1 |
| Códigos del runner | Binario k6 simulado en contenedor aislado: threshold99 y error remote-write con exit0 | Runner devuelve99 y1 respectivamente; no son corridas de carga |
| Actualización legacy | Arranque nuevo sobre instalación existente y mismos volúmenes | `.env`/manifest idénticos antes de rotación explícita; historial Grafana conservado |
| Login con navegador | `docker compose run --rm k6-browser run /load/browser.js` | exit0;2/2 dashboards,0 fallos y50 solicitudes navegador sin error |
| Listo para el usuario | Rotación auditada explícita final del stack principal |100 alumnos,0 matrículas/solicitudes; cupos disponibles; stack saludable |
| Configuración y sintaxis | `node --test scripts/compose-config.test.mjs`, `sh -n`, `bash -n`, `node --check`, `git diff --check` |2/2 tests; resto exit0 |

Los conteos, testids y métricas sanitizadas están en [result.json](result.json). Las huellas cubren exclusivamente código/configuración versionable en [source-fingerprint.json](source-fingerprint.json). Nunca se versionan manifiestos de credenciales ni configuración privada. Los builds reales de backend y cliente se ejecutaron dentro del build Docker. El proyecto temporal de aceptación quedó detenido, conservando sus volúmenes; el stack principal quedó activo en5189/5190.

## Diagnósticos y límites

El primer arranque encontró que sustituir entrypoint en Compose descarta CMD de la imagen: PostgreSQL recibía cero argumentos. Worker realizó su único ciclo de reparación H1 añadiendo `command: [postgres]`. Se repitió desde otro contexto limpio y pasó.

Las preparaciones iniciales del arnés en puerto alternativo fallaron por dos vínculos históricos a5189: guard k6 y mapa Origin/Host del proxy. El principal diagnosticó ambos y completó la configuración exacta del puerto loopback en k6/API/template Nginx. No se admiten hosts externos. Los intentos fallidos no se cuentan como carreras válidas. El test estático histórico requería dos archivos y una representación de false que el Compose actual omite: se actualizó a los entrypoints vigentes y perfiles explícitos. También se restauró la inclusión de client/nginx.conf en Dockerignore, requerida por el Dockerfile local existente.

Las dos carreras válidas corresponden a campañas frescas; no prueban escalabilidad universal ni concurrencia contra SUM. p95 de envío:1098.01ms y1018.88ms; los umbrales existentes pasaron. La prueba de navegador acredita acceso y estructura del dashboard, sin nueva comparación visual. Las pantallas y contratos académicos no cambiaron. `compose.local.yaml` conserva el modo de escenarios y `compose.prod.yaml` sigue separado; solo se renderizó su configuración, nunca se arrancó con datos privados. Los scripts avanzados de rotación conservan su dependencia de Bash/Linux; el arranque normal requiere únicamente Docker Compose.
