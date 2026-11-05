# E1 — revisión docente: aceptación local

Fecha2026-11-04. Rama schedule-pt1. Clase observed/local-only. Autor aceptación:
principal. Fuente funcional: requisitos explícitos del usuario y plan
docs/reverse-engineering/plans/programacion-academica-teacher-review.md.
No prueba procedimientos o aprobación oficial del SUM/UNMSM.

## Entorno y seguridad

Proyecto Compose propio sum-academic-acceptance, http://127.0.0.1:5280, iniciado
con `--env-file NUL`, `SUM_PORT=5280` y fixtures incorporados explícitamente sintéticos.
Fuente de catálogo: scenario-reference.seed.ts confirmado sintético por operador.
No se inspeccionaron servidor operador5180, datos-reales, PDF o sesiones privadas.
Navegador Chrome headless1440×1000, ruta /local/programacion-academica, API real NestJS,
sin mocks ni llamadas externas. Se reutilizó volumen existente de propuestas.
No nuevas dependencias, Docker/configuración nueva, migraciones, commits o push.

## Criterio → prueba → resultado

| Criterio | Escenario | Resultado |
| --- | --- | --- |
| Enviar una propuesta guardada | Generar, guardar borrador, Escuela simulada envía a revisión |200, ronda1, in-review |
| Respuesta y observación | Docente seleccionado solicita cambios con observación |200, changes-requested y evento con versión |
| Consulta escolar compacta | Volver a Escuela y consultar observación en mismo panel | Visible, sin otro portal o tarjetas por docente |
| Resolver usando editor existente | Editar bloque +60min, guardar |200, affected outdated y evento invalidated; no repetir generador |
| Nueva revisión | Reenviar y responder conformidad | Ronda2, pending→conformity, ready-for-approval |
| Invalidación selectiva | Vitest dos docentes conformes, cambiar solo un bloque | Solo afectado outdated; otro conserva conformidad; reenvío conserva no afectado |
| Regreso de asignación | Vitest A→B→A en misma ronda | Se guarda sin error; exige nuevo envío y conformidad |
| Integridad y concurrencia | Versiones/rondas antiguas, huella inconsistente aunque checksum resele, límite200 | Rechazo sin reemplazar archivo válido |
| Persistencia | Cerrar navegador, restart backend, nuevo proceso y contexto Chrome, Mis propuestas/Continuar edición | Mismo ID, versión6, ronda2, cinco eventos y estado listo para aprobación |
| Compatibilidad | Archivos anteriores sin review y persistencia anterior | Pruebas pasaron, sin migración |
| Matrícula aislada | Comparar oferta antes/después de revisión y recuperación | Idéntica |
| Regresión existente | ERP180/45 manual + Compose flujo estudiante y matrícula idempotente | Pasó; ninguna oferta cambiada por E1 |

Resultado nuevo visible: revisión de PROGRAMACIÓN Y COMPUTACIÓN (INE002), horario
continuo de3h con componentes T+P, un docente responsable. Capturas review-approved.png
y review-recovered.png muestran solo panel de instancia sintética. Checkpoint
synthetic-review.json contiene ID/versión/curso/estado/ronda/cantidad de eventos, sin
historial o identificadores de estudiantes. Regresión ERP verifica cuatro secciones
y coherencia de tabla/calendario por separado.

## Comandos y resultados finales

- `pnpm --dir backend test programacion-academica test/matricula-regular-regression.spec.ts test/enrollment-scenarios.spec.ts`:18 archivos,336/336, incluye6 nuevos de revisión y51 de matrícula.
- `pnpm --dir backend build`: pasó, también dentro de Docker.
- `pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false`: pasó después de corrección final.
- `pnpm --dir backend lint`: sin errores;4 advertencias anteriores unbound-method en test/local-profile-session.spec.ts:52,68,89,135.
- `pnpm --dir client build`: pasó, incluye tipos; también en Docker.
- `pnpm --dir client lint`: pasó.
- `pnpm --dir client test:data`:200/200.
- `node --test shared/programacion-academica-api.test.mjs shared/programacion-academica-demand.test.mjs shared/programacion-academica-persistence.test.mjs shared/programacion-academica-teacher-review.test.mjs`:17/17.
- `node --experimental-strip-types --test backend/test/programacion-academica-section-sizing.test.mjs backend/test/programacion-academica-schedule.test.mjs backend/test/programacion-academica-generator.test.mjs`:203/203; son casos reutilizados en Vitest, no se suman como cobertura independiente.
- `node --test scripts/academic-compose-config.test.mjs`:2/2; local aislado/público deshabilitado.
- `SUM_PORT=5280 docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance up --build --detach --wait`: pasó; ambos contenedores disponibles.
- `SUM_ACADEMIC_TEACHER_REVIEW_SYNTHETIC=1 node client/scripts/verify-academic-teacher-review.mjs --phase=save`: pasó.
- Mismo proyecto Compose `restart backend`: pasó; memoria backend descartada, volumen conservado.
- Mismo verificador `--phase=resume` en nuevo proceso: pasó.
- `SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 node client/scripts/verify-academic-manual.mjs`: pasó.
- Mismo entorno `node client/scripts/verify-academic-compose.mjs`: pasó; matrícula aceptada e idempotente y navegación estudiantil intacta.
- Comparación SHA256 de10 archivos existentes de generador/validación/cálculo: todos idénticos al inicio de esta entrega.
- `git diff --check`: pasó, aviso previo LF/CRLF de routeTree.gen.ts.

## Hallazgos corregidos y límites

La revisión estática detectó y corrigió antes de aceptación el manejo de conformidad
invalidada en la misma ronda, la comparación de huellas al regresar a una asignación
anterior y la selección de la última decisión del docente. Se agregó regresión A→B→A.
Hubo una pasada inicial de test:data con fixture incompleto; se corrigió ese fixture
y200/200 pasaron. Las pruebas de navegador finales pasaron al primer intento.
Principal añadió una aserción de observación visible en Escuela y captura al recuperar.

No hay autenticación ni autoría comprobada: roles simulados, cualquier usuario de la
instancia puede seleccionar ambos. Conservación selectiva por huella es política local
explicada, no norma institucional. Sin resultado completo no se envía a revisión.
Historial básico hasta200 eventos; se rechaza crecimiento, no se trunca. Checksum e
integridad no son firma/auditoría inmutable. Una instancia escritora, sin respaldo o
migración automática. Sesiones RAM conservan su caducidad anterior. No aprobación,
publicación, correo, E2/E3 o cambios a matrícula.

## Archivos de esta entrega

Nuevos: backend/src/programacion-academica/teacher-review.ts;
backend/test/programacion-academica-teacher-review.spec.ts;
client/src/screens/AcademicTeacherReview.tsx y .css;
client/scripts/verify-academic-teacher-review.mjs;
shared/programacion-academica-teacher-review.test.mjs;
plan, guía, workflow de mismo slug y esta carpeta de evidencia.

Extendidos: backend/src/programacion-academica/saved-draft.service.ts y
demo.controller.ts; client/src/screens/AcademicScheduling.tsx y .css;
client/src/data/academicScheduling.ts y .test.ts; shared/programacion-academica-api.mjs
y .d.mts; docs/reverse-engineering/contracts/local-api/programacion-academica-demo.md.

Muchos archivos E1 siguen sin rastrear en Git por etapas anteriores; git status no
equivale a cambios de esta entrega. Se conservaron todos. Los siete archivos rastreados
ya modificados al inicio siguen siendo los mismos; no se tocó generador, reglas,
oferta/escenarios, pantallas de matrícula ni package.json/lockfiles.
