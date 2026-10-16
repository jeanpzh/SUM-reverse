# Acceso unificado y modos desde consola

Registro histórico: el arranque DEV descrito aquí fue sustituido por SIM al abrir el Compose local. Véase `compose-standardization.md` para la corrección y comandos vigentes.

Fecha: 2026-10-16. Estado: observado exclusivamente en entorno local sintético (`local-only`).

## Alcance y procedencia

El usuario autorizó implementar directamente, sin nuevos planes, el arranque con Compose, el selector local de escenarios/perfiles y las asignaciones `MODE = SIM` / `MODE = DEV`. Solo cambia visualmente el acceso local; se reutilizan las pantallas, componentes, diálogos y navegación SUM del dashboard.

Los nueve escenarios incorporados usan semillas independientes de `backend/src/matricula-regular/enrollment-scenarios.ts#selectedPlanValues`. Los artefactos JSON separados usan únicamente el archivo del conjunto que el operador confirmó íntegramente sintético. No se usaron snapshots privados, servidores existentes ni producción. Estas pruebas no acreditan reglas ni fidelidad observable del SUM real.

## Criterios y resultados

| Criterio | Comprobación sintética | Resultado real |
| --- | --- | --- |
| Arranque sin Node/pnpm del operador ni montajes de datos | Compose construido desde cero; ambos servicios saludables | Pasó |
| DEV muestra las vistas existentes; SIM cambia automáticamente al acceso local | Asignaciones literales en Chromium y recarga de DEV | Pasó |
| Nueve escenarios y cuatro perfiles; mensajes y cursos coherentes | Validadores compartidos, HTTP, cliente y selector en navegador | Pasó |
| Prerrequisitos ya filtrados en prematrícula | C13 ausente en matrícula; vista previa explica su exclusión | Pasó |
| Matrícula aceptada y reporte persistido | Regular / SYN-SIS-A, C09–C11 mediante diálogos existentes | Pasó |
| Rechazo académico | Tutoría / SYN-SIS-B, C07–C10 | Pasó |
| Configuración desconocida no produce aceptación | Horario no conocido / SYN-SOFT-A | Pasó |
| Cada inicio prepara una ejecución nueva | HTTP comprueba sesiones, solicitudes, matrícula, reporte y cupos reiniciados; ejecución anterior rechazada | Pasó |
| Solicitudes inválidas no alteran estado | HTTP: escenario desconocido, parámetros extra y ejecución anterior | Pasó |
| Cambio de modo preserva recuperación y descarta identidad anterior | Pruebas del controlador de modo y sesión | Pasó |
| Selector adaptable | Chromium 1440×1000 y 390×844; sin desbordamiento horizontal | Pasó |

## Validación

- `pnpm --dir client build`: pasó.
- `pnpm --dir client lint`: pasó.
- `pnpm --dir client test:data`: 177 pruebas pasaron.
- `pnpm --dir backend build`: pasó.
- `pnpm --dir backend lint`: pasó con cinco advertencias existentes en pruebas ajenas al cambio.
- `pnpm --dir backend test test/local-scenarios-http.spec.ts test/local-profile-dashboard-http.spec.ts test/local-profile-dashboard-bootstrap.spec.ts test/enrollment-scenarios.spec.ts test/enrollment-scenarios-http.spec.ts`: 27 pruebas pasaron; incluye la matriz HTTP de 36 combinaciones escenario/perfil.
- `node --test shared/local-profile-dashboard.test.mjs scripts/enrollment-scenarios.test.mjs scripts/start-local-profile-dashboard.test.mjs`: 10 pruebas pasaron.
- `node scripts/generate-enrollment-scenarios.mjs`: nueve paquetes sintéticos y guía actualizados; no necesario para arrancar.
- `git diff --check` y `docker compose config --quiet`: pasaron.

La integración usó únicamente el proyecto Compose aislado `sum-scenarios-console-e9c4`, con puerto efímero 46027, entorno explícito y sin volúmenes de datos. El verificador reproducible es `client/scripts/verify-local-scenarios.mjs`; requiere origen local y confirmación explícita de procedencia sintética. `browser-results.json` registra el resultado; las capturas adyacentes registran los estados locales. Chromium no observó errores de página ni solicitudes externas.

Se ajustó el verificador móvil para seleccionar un perfil antes de esperar su vista previa: inicialmente esperaba esa región sin elegir estudiante. `failure.png` conserva aquel diagnóstico del verificador; la ejecución posterior completa pasó y actualizó `browser-results.json` y `simulation-mobile.png`. Se cerró el proyecto Compose de pruebas al terminar; el operador inicia el suyo con el comando documentado.

## Ejecución y correcciones diagnosticadas

El worker `scenario_backend` ejecutó el perfil real GPT-6 Luna High para archivos backend asignados. El principal mantuvo contrato compartido, frontend, arranque y aceptación integrada; no se creó otro plan. El principal completó correcciones aisladas tras diagnosticar: respuesta POST predeterminada 201 frente al contrato 200, lista de controladores de bootstrap tras incorporar el controlador de escenarios y asociación de errores de validación con `body.scenarioId`. Se verificaron de nuevo los casos afectados. También corrigió metadatos para no recomendar C13 ni atribuir al archivo de datos el hash de la semilla incorporada.

El acceso advierte que iniciar otra prueba reinicia el escenario para las demás pestañas del mismo servidor. El modo persiste por pestaña. DEV continúa siendo la réplica local con fixtures; no representa una conexión a producción. No se afirma paridad visual por píxel.
