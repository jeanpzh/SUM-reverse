# Dos Compose y entrada local directa

Fecha: 2026-10-16. Corrección solicitada directamente por el usuario, sin planificación adicional ni delegación. Alcance visual: ninguna modificación de pantallas; reutilización del selector y las vistas SUM existentes.

Diagnóstico: el operador informó que `docker compose up --build` mostraba fixtures antiguos y no el selector. El controlador local usaba DEV por defecto. Además, los dos overlays de snapshots heredaban las banderas de simulación del Compose base. La antigüedad concreta de los datos observados por el operador no se inspeccionó; se corrigió la causa comprobada de la entrada equivocada y la mezcla de configuraciones.

Cambios:

- Solo `compose.local.yaml` y `compose.prod.yaml`, ambos completos e independientes. Retirados `compose.yaml`, `compose.synthetic.yaml` y `compose.snapshots.yaml`.
- Local: proyecto `sum-local`, puerto 5180, escenarios incorporados, sin montajes, consola MODE disponible y SIM predeterminado.
- Prod: proyecto `sum-prod`, puerto 5181, JSON del operador en lectura, simulación y consola desactivadas. Conserva `SUM_SNAPSHOT_SOURCE_DIR` y los cargadores existentes. No implica conexión a SUM ni verificación de un despliegue público.
- Los nombres de proyecto separan contenedores, redes e imágenes. README, guía de escenarios, contrato, README backend y lanzador de compatibilidad apuntan a los dos archivos vigentes. Se conservan registros históricos identificados como tales.
- Una selección DEV explícita se conserva por pestaña; MODE = SIM permite regresar. El README indica detener el arranque anterior con Ctrl+C antes de ocupar nuevamente 5180.

| Criterio | Validación | Resultado |
| --- | --- | --- |
| Solo dos archivos y configuración independiente | `node --test scripts/compose-config.test.mjs scripts/start-local-profile-dashboard.test.mjs` | 2/2 pasaron; no arranca prod ni accede a snapshots |
| Pestaña nueva abre SIM; DEV explícito permanece | Regresión primero falló con DEV; corrección y `pnpm --dir client test:data` | 177/177 pasaron; prueba focalizada final 2/2 |
| Cliente compilable y lint correcto | `pnpm --dir client build`, `pnpm --dir client lint` | Pasaron |
| Arranque real con archivo local | `docker compose --env-file /dev/null -p sum-compose-check-e9c4 -f compose.local.yaml up -d --build --wait`, entorno limpio y puerto 46027 | Ambos servicios construidos y saludables |
| Selector inmediato e integración | `client/scripts/verify-local-scenarios.mjs`, origen propio sintético y Chromium nuevo | Pasó: entrada sin comandos, nueve escenarios, cuatro perfiles, aceptación/reporte, rechazo por tutoría, horario pendiente, cambio MODE y móvil sin desbordamiento |
| Higiene | `git diff --check` | Pasó |

El resultado de navegador actualizado está en `browser-results.json`. Se cerraron únicamente los contenedores del proyecto de comprobación. No se inspeccionaron servidores del operador, datos privados ni producción. La configuración prod se validó estáticamente; su integración con JSON privados corresponde al operador. Evidencia observada local y decisiones `local-only`, sin afirmación de paridad con SUM real.
