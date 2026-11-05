# Revisión y aceptación local de PR #35

Fecha: 2026-11-05 UTC. Principal: revisión, plan y aceptación integrada.
Rama original: `schedule-pt1`, commit `c79ac61`; base `ddf3d63`.
Fuentes: contratos y planes E1/E2 de la propia PR, evidencia histórica local
reutilizada únicamente como contexto y ejecuciones sintéticas nuevas descritas aquí.
Clasificación: `observed` local para estos resultados, `local-only` para el diseño
del prototipo. No se acredita comportamiento ni fidelidad visual de producción SUM.

Entorno: worktree separado `/tmp/sum-pr35-review`; NestJS propio en loopback
33535, Vite en 5280 con proxy a ese backend. Variables de servidor explícitas
mediante `env -i`; fixtures incorporados independientes y namespaces de persistencia
temporales nuevos. Sin snapshots privados, producción ni servidores del operador.
El principal conserva la propiedad del navegador. Trabajadores solo modifican los
archivos exclusivos del [plan](../../../docs/reverse-engineering/plans/pr35-review-fixes.md).

| Criterio | Escenario/comando | Esperado y resultado real |
| --- | --- | --- |
| Contrato/backend estático | `pnpm --dir backend build`, `pnpm --dir backend lint`, repetidos por implementador después de F2 | Pasan; cuatro warnings preexistentes de métodos sin binding en pruebas de sesión |
| Cliente estático | `pnpm --dir client build`, `pnpm --dir client lint`, repetidos por implementador después de F1 | Pasan; sin cambios de estilos, textos o estructura |
| Datos del cliente | `pnpm --dir client test:data` | 211/211 pasan |
| Contratos/configuración nuevos | `node --test shared/prematricula*.test.mjs shared/programacion-academica*.test.mjs scripts/academic-compose-config.test.mjs` | 32/32 pasan |
| Backend perfil CI después de F2 | `vitest run --exclude 'test/matricula-regular-us1*' --exclude 'test/matricula-regular-us2-us3*' --exclude 'test/matricula-regular-us5-us6*'` | 50 archivos, 737/737 pasan |
| F2 errores de publicación | `vitest run test/prematricula-service.spec.ts` | 20/20 pasan: 503 STORAGE_UNAVAILABLE con envelope, 404 ausencia, 409 publicación inválida |
| E1 selector, Escuela y Estudiante | `SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 node client/scripts/verify-academic-compose.mjs` | Pasa contra Vite/NestJS propios; generación, recursos, catálogo, navegación; oferta no alterada por E1, matrícula idempotente y ocupación actualizada solo al matricular |
| E2 persistencia y aislamiento | `SUM_E2_BROWSER_VERIFY=1 SUM_E2_PHASE=save\|resume node client/scripts/verify-e2-prematricula.mjs`, con reinicio real del backend entre fases | Ambas fases pasan: guardado independiente, CAS, aislamiento, edición, cruces, reporte conservado y recuperación tras reinicio |
| Intenciones y agregados | `SUM_E2_INTENTION_SYNTHETIC=1 SUM_E2_INTENTION_PHASE=save\|resume node client/scripts/verify-e2-intention.mjs`, reiniciando el backend | Ambas fases pasan: registro, historial, deduplicación, aislamiento, publicación inmutable y recuperación tras reinicio |
| F1 respuesta tardía | `SUM_E2_BROWSER_VERIFY=1 node client/scripts/verify-e2-hydration.mjs` | Pasa: A guardada demorada, consulta/edición de B, liberación de A, selección B preservada y guardada por API real. Se demora una respuesta real con Playwright; no se inventa su contenido |
| Higiene | `git diff --check`, ESLint de scripts y `node --check client/scripts/verify-e2-hydration.mjs` | Pasan; 323 entradas de caché eliminadas, exclusión añadida a Git y CodeGraph |

La primera recuperación E2 se detuvo por un selector ambiguo de texto de cruce;
se diagnosticó y acotó al aviso del panel, conservando la aplicación. La repetición
usa almacenamiento sintético nuevo. La suite antigua de navegador de matrícula
se interrumpió localmente después de varios minutos sin completar; no se cuenta
como aprobada. Su job remoto `backend-browser` se informa por separado de los
checks requeridos `client` y `backend`; estos resultados locales no lo sustituyen.

Se preservan interfaces existentes; esta revisión no incluye comparación visual
equivalente con SUM. La oferta E3 2027-I sigue pendiente por decisión explícita
del alcance original, sin presentarla como integrada por esta PR.
