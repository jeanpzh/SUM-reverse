# Verificación local — matrícula regular con interfaz SUM

Fecha: 2026-10-14. Entorno: dashboard sintético aislado (`scripts/start-local-profile-dashboard.mjs --skip-build`, tras
`pnpm --dir backend build`), backend `127.0.0.1:3100`, Vite `127.0.0.1:5743`, Chromium headless 1366×900 (Playwright 1.63).
Datos: fixtures `SYN-*`; sin `datos-reales/`, sin SUM de producción, sin el navegador CDP 9222. Ejecución nueva del dashboard
para el escenario final (SYN-SIS-A sin matrícula previa).

| Criterio | Fuente | Escenario / comprobación | Esperado | Obtenido |
| --- | --- | --- | --- | --- |
| AC-SUM-01 Información habilitada | V-01 | Script (pantalla habilitada, `01-…png`); `sumEnrollmentFormat.test.ts` | Franja HABILITADA, 4 recuadros, «Iniciar Matrícula» | Pasa |
| AC-SUM-02 Información con matrícula registrada | O-UI-01, L-11 | Script tras el reporte (`08-…png`); pruebas `O-UI-01`/`L-11` | Mensaje «Usted registra matrícula…» + «Ver Matrícula», sin «Iniciar» | Pasa |
| AC-SUM-03 Tabla de registro | V-02, V-03 | Script `02-registro.png`; `sumEnrollmentTable.test.ts` | Columnas, orden por ciclo, «(*)», fila roja y tooltip | Pasa la tabla y el orden. La fila roja y el tooltip se verifican solo por prueba unitaria (`retakeCourseIds`) y por el backend: SYN-SIS-A no tiene repitencias y no se capturó SYN-SOFT-B |
| AC-SUM-04 Modal de secciones | V-04 | Script `03-secciones.png`; prueba `V-04` y `full sections stay selectable` | Columnas, radio, Aceptar/Cancelar; sección llena seleccionable | Pasa |
| AC-SUM-05 Selección y totales | V-05 | Script `04-seleccion.png` (3 asignaturas, 12 créditos, tope 26); prueba `choose replaces…` | Sección elegida, papelera, totales, «Ejecutar Matrícula» | Pasa |
| AC-SUM-06 Confirmación | V-06 | Script `05-confirmacion.png` | Texto literal, EJECUTAR/CANCELAR | Pasa |
| AC-SUM-07 Éxito y redirección | V-07, L-10 | Script `06-exito.png` → URL del reporte | Aviso literal y redirección automática | Pasa (redirección en ≤ 10 s) |
| AC-SUM-08 Rechazo | T-01, L-06, L-08 | Script `09-rechazo.png` (SYN-SIS-B: 4 créditos y sección ya llena) | Todas las causas; ACEPTAR deja la selección vacía | Pasa: CREDIT_LOAD_INVALID y SECTION_FULL listadas; selección vacía tras ACEPTAR |
| AC-SUM-09 Reporte | V-08 | Script `07-reporte.png`; `sumEnrollmentReport.test.ts` | Estructura V-08, «Mostrando 1 - N de N registros» | Pasa |
| AC-SUM-10 Sesión | T-01, L-07 | Script (recarga → reloj 00:14/00:15); `localProfileSession.test.ts` | Recarga y vuelta renuevan; vencida o inválida → selector | Recarga: pasa en navegador. Vuelta a la pestaña: solo prueba unitaria de `bindVisibilityRenewal`, no verificada en navegador. Vencida o inválida: pruebas unitarias |
| AC-SUM-11 Cabecera | V-02 | Script (sin «Renovar sesión») | Reloj, nombre, Salir | Pasa |
| AC-SUM-12 Contrato | MR-CONTRACT-3 | `matriculaRegularContractV3.test.ts`, `matricula-regular-sum-ui.spec.ts` | MR2 válido; campos MR3 validados | Pasa |

## Comandos y resultados

| Comando | Resultado |
| --- | --- |
| `pnpm --dir client build` | Exit 0 |
| `pnpm --dir client lint` | Exit 0 |
| `pnpm --dir client test:data` | 169/169 pruebas pasan |
| `pnpm --dir backend build` | Exit 0 |
| `pnpm --dir backend lint` | Exit 0 con 4 advertencias previas de `local-profile-session.spec.ts` (`unbound-method`) |
| `pnpm --dir backend exec vitest run --no-file-parallelism --exclude '**/*.integration.spec.ts'` | 18 archivos, 302/302 pruebas pasan |
| `node client/scripts/verify-matricula-sum-ui.mjs` | `OK: escenarios sintéticos verificados`, 9 capturas |

El script tuvo tres fallos de selector propios (espera de carga, coincidencia por subcadena de «EJECUTAR» y texto duplicado
en el panel plegado). Se corrigieron en el script; no hubo cambios de comportamiento de la UI.

## Conocido y fuera del alcance

- `matricula-regular-us1.integration.spec.ts`, `matricula-regular-us2-us3.integration.spec.ts` y
  `matricula-regular-us5-us6.integration.spec.ts` (14 pruebas) fallan: usan el selector de actores
  (`.regular-enrollment select`, `.pre-enrollment-panel`) de la pantalla antigua, que la ruta actual no muestra. Se agotan por
  tiempo de espera antes de leer datos; no están relacionadas con este cambio y no se corrigieron.
- `pnpm --dir client verify` (script antiguo) no se ejecutó.

## Límites

- Fidelidad visual aproximada: V-01…V-08 son de otra facultad y periodo, y los colores no se midieron. Las capturas locales
  no son comparables píxel a píxel.
- La renovación al cambiar de página del menú SUM (otra lectura de «pestaña») no está implementada ni verificada.
- La alerta de error y su literal son inferencia local (L-08), no comportamiento SUM observado.
- Las capturas locales (9 PNG en esta carpeta) contienen solo datos `SYN-*`.
