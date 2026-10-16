# Dashboard local — verificación en curso

Fecha: 2026-10-14. Estado: 10/12 unidades implementadas y comprobadas en raíz; aceptación integrada todavía pendiente.

Contrato: LPD-CONTRACT-1, decisiones Claude LPD-DEC-1, spec002 LP-A01–12. Fuente: código y factories independientes sintéticas; diseño local-only/N1. No observación SUM nueva ni aceptación N3.

| Unidad / criterio | Comprobación real en raíz | Esperado | Resultado |
| --- | --- | --- | --- |
| LP-R1 / parte de LP-A12 | `pnpm --dir backend test test/matricula-regular-cause-order.spec.ts test/matricula-regular-us3.spec.ts test/matricula-regular-us4.spec.ts test/matricula-regular-regression.spec.ts test/matricula-regular-foundation.spec.ts` | Rechazo HTTP válido con todas las causas, sin escrituras académicas; regresión conserva comportamiento | PASS 198/198, cinco archivos, exit0 |
| LP-R1 estático | `pnpm --dir backend build`, `pnpm --dir backend lint` | Compilación/lint sin error | PASS ambos exit0 |
| LP-S1 / frontera LP-A01/A10 | `node --test shared/local-profile-dashboard.test.mjs` | Catálogo exacto, correlación, campos/fechas válidos, payload validado y reporte nullable solo en lectura dashboard | PASS 7/7, exit0 |
| LP-B1–B4 y bootstrap V1 | Diez archivos Vitest: cause-order, local-profile-session/projection/academic/dashboard-http/dashboard-bootstrap, MR regression/foundation/us3/us4 | API propia, correlación, sesión, proyecciones y regresiones sintéticas | PASS 237/237, exit0 (incluye regresión HTTP del envelope compatible) |
| Backend estático actualizado | `pnpm --dir backend build`, `pnpm --dir backend lint` | Compilación y lint sin errores | PASS ambos exit0; cuatro warnings unbound-method del test B1 |
| LP-F1–F4 datos | `pnpm --dir client test:data` | Transporte, sesión, cachés, estados académicos y regresiones de datos | PASS 141/141, exit0 |
| Frontend estático | `SUM_LOCAL_PROFILE_BACKEND_ORIGIN=http://127.0.0.1:5742 pnpm --dir client run build --config vite.local-profile-test.config.ts`, `pnpm --dir client lint` | Compilación sintética sin dotenv del operador y lint sin errores | PASS ambos exit0; la compilación no contacta servicios en5742 |
| LP-V1/V2 / LP-A01–12 completo | Recorridos reales React → NestJS → estado | Cuatro perfiles, 64 visitas, reloj/sesión, matrícula/reporte/recuperación y aislamientos | PENDIENTE; no integración global acreditada todavía |

La revisión de R1 comparó los cinco archivos contra el baseline y preservó exclusivamente orden/deduplicación de causas (incluyendo fuente), sin cambiar reglas académicas ni el validador MR2. Los tres archivos S1 se revisaron y copiaron desde el worktree API al principal y UI tras el hito compartido. No se aceptan entregas por planificación o build solamente.

Procedencia y hashes: [provenance.md](provenance.md), api-baseline.json, ui-baseline.json. R1 reporte del implementador: [r1-worker-report.md](r1-worker-report.md).

Feature001 conserva 42/51 aceptadas y nueve pendientes; LP-R1 no equivale a completar T030, equivalencias MR-MODEL-3 ni matrices242/170. La fidelidad visual de pantallas nuevas y la paridad SUM siguen sin acreditar.

Adopción de entregas: backend/bootstrap17 archivos y UI31 archivos comparados por SHA256 contra sus baselines antes de copiar; manifiestos backend-adopted.json y ui-adopted.json. Claude Sonnet finalizó backend/bootstrap y Codex Luna la UI. Estas comprobaciones de capa todavía no acreditan el navegador React→Nest.

Previo al GO integrado se volvieron a comparar los17 hashes backend/bootstrap y31 UI tanto en raíz como en el worktree verificador:96 comparaciones coincidentes, sin divergencias.

## Criterios de aceptación integrada

| Criterio | Escenario obligatorio | Soporte de capa ya aprobado | Resultado integrado |
| --- | --- | --- | --- |
| LP-A01 | Selector exacto de cuatro actores, una sesión por entrada y doble clic | S1, HTTP, transport/store | PENDIENTE navegador |
| LP-A02 |16 rutas ×4 actores; identidad y sesión estables | Proyecciones y loaders tipados | PENDIENTE64 visitas |
| LP-A03 | Contador visible,899999 activo,900000 expirado, reloj cliente no amplía servidor | Sesión y bootstrap237 | PENDIENTE navegador |
| LP-A04 | Solo renovación explícita, mismo ID/startedAt, nuevo plazo desde servidor | Sesión y store | PENDIENTE navegador |
| LP-A05 | Entrada protegida y recarga vuelven a selector sin sesión persistida | Store/router141 | PENDIENTE navegador |
| LP-A06 | Salida cero HTTP, respuesta tardía A no contamina B | Store/generación141 | PENDIENTE navegador |
| LP-A07 | Ver matrícula dentro del Shell, mismo actor/sesión y gates MR2 | Context y proyección académica237 | PENDIENTE navegador |
| LP-A08 | Reporte/horario vacíos antes, solo snapshot comprometido después | Proyección académica/HTTP237 | PENDIENTE navegador |
| LP-A09 | Commit con respuesta perdida, A→B→A, consulta manual sin POST duplicado, reset | Regresión MR2 y store | PENDIENTE navegador |
| LP-A10 | Estructura/correlación inválida falla explícitamente, sin fallback | S1/HTTP y transporte | PENDIENTE navegador |
| LP-A11 | Composición propia, fixtures independientes, reloj sintético y separación del operador | Bootstrap/provenance237 y arranque Claude | PENDIENTE comprobación del runner |
| LP-A12 | Multicausa real, estados honestos y teclado | R1, regresiones backend/frontend | PENDIENTE navegador/teclado |

Los números237 y141 corresponden a las suites combinadas, no a un recuento independiente por criterio. Su reutilización no sustituye los escenarios obligatorios del navegador.

Arranque propio en raíz: `node scripts/start-local-profile-dashboard.mjs --skip-build` imprimió frontend46315/backend45907. Comprobación Node real: frontend200 y catálogo por el proxy200 con exactamente SYN-SIS-A/B y SYN-SOFT-A/B. Instancia/provenance en demo-instance.json; es smoke de arranque/API, todavía no aceptación React.

Primer intento del runner integrado: FAIL antes de visitas, catálogo500. Diagnóstico acotado confirmó error exclusivo del runner (`controlledClock.now` devolvía string, contrato exige Date). El catálogo de la instancia propia con reloj correcto responde200 y pasa `validateProfileCatalogResponse`. Se autorizó corrección dirigida del callback; no se alteró producto ni se redujo aceptación. La nueva ejecución sigue pendiente.

Corrección directa autorizada por el usuario: servicio compatible MI entregaba datos sin el envelope existente. Nueva regresión HTTP RED reprodujo formularioDatos.message ausente; servicio + dos tests ajustados. Resultado actualizado:10 archivos/237 tests PASS, build/lint backend PASS con4 warnings anteriores;28 respuestas HTTP reales de4actores×7claves pasaron los parsers S1/cliente sin escrituras académicas. Manifest envelope-repair.json preserva hashes anteriores/nuevos. Esta corrección no debilita contrato ni validadores.
