# Tasks: matrícula regular virtual FISI 2026-II

**Entrada:** [plan revisión4](plan.md), [spec](spec.md), [research](research.md), [modelo](data-model.md), [catálogo](acceptance-catalog.md), [MR-CONTRACT-2](../../docs/reverse-engineering/contracts/local-api/matricula-regular.md).
**Etapa actual:** implementación autorizada por el usuario el 2026-10-11; casillas marcadas corresponden a comprobaciones registradas en `evidence/local/matricula-regular-fisi/verification.md` y `handoff.md`.
Diseño local listo para handoff; código solo tras asignación/etapa autorizada. N3 no está cerrado.
Tests requeridos explícitamente por spec/usuario, exclusivamente synthetic y con procedencia de proceso entero.
No duplicar proyectos/dependencias, contratos legacy ni controles. No producción/datos privados/exportadores.
Por autorización explícita del usuario (2026-10-13), el límite operativo actual es **3 workers concurrentes**, con archivos disjuntos y sin subdelegar; sustituye el límite histórico de 2 para esta ejecución. Codex/Luna High, Claude/Sonnet High y Antigravity/Gemini Flash Medium reciben tareas según complejidad; el principal posee contratos y aceptación integrada. El plan y contrato funcionales siguen fijos.

## Estado de ejecución — actualizado 2026-10-14

**Ejecución detenida por solicitud del usuario (2026-10-14).** Los terminales de Sonnet
(`ctx_a740612b1278`) y Opus (`ctx_1b36e58e1974`) se cerraron con confirmación
`ptyKilled:true`; sus worktrees y cambios se conservan. No se despachó implementación nueva.
Opus entregó el plan acotado MR-MODEL-3/r5, pendiente de adopción por raíz. Sonnet diagnosticó
un rechazo HTTP convertido en 500 por la ordenación de causas en `rules.ts`, incompatible
con el validador compartido; la corrección y su verificación siguen pendientes. Esta pausa
no cambia las casillas ni acepta entregas parciales.

**42/51 aceptadas; 9 pendientes de aceptación.** Una casilla `[x]` requiere comprobaciones
aprobadas del alcance asignado. Una entrega de código aún pendiente de verificación conserva
`[ ]`; su avance se muestra aquí. No se cambian requisitos, contrato ni dependencias.

| Tareas | Estado real | Evidencia y siguiente comprobación |
| --- | --- | --- |
| 42 tareas con `[x]` | Aceptadas localmente | [Registro de verificación](../../evidence/local/matricula-regular-fisi/verification.md). No acredita paridad SUM/N3. |
| T004, T028, T030 | Reabiertas para completar la equivalencia sintética aprobada | [Decisión](../../evidence/local/matricula-regular-fisi/decision-matrix-surfaces.md) y [aprobación](../../evidence/local/matricula-regular-fisi/proposed-matrix-decisions.md): modelo interno explícito, evaluador y controles negativos por ambas escuelas. |
| T032 | Código y checks de cliente entregados; pendiente registro SC-002 | Sonnet prepara el subconjunto aprobado de 50 known +16 pending y us4.md; requiere ejecución real antes de aceptación. |
| T038, T039, T041, T043, T044, T045, T046 | Aceptadas por raíz | 108 pruebas de datos, build/lint, 10 SSR y 12/12 recorridos reales de integración US5/US6 con ambas escuelas, foco, recuperación y snapshots. |
| T007, T036, T042 | Correcciones de contexto/capacidad/publicación verificadas | [Diagnóstico Opus](../../evidence/local/matricula-regular-fisi/opus-decisions-us4-us6.md) y [corrección de composición](../../evidence/local/matricula-regular-fisi/handoff-context-composition-fixes.md). El coordinador ejecutó 184/184 pruebas seriales, build, lint y smoke T007/T008, más 12 reproducciones independientes por ambas escuelas. [Cierre A1](../../evidence/local/matricula-regular-fisi/worker-context-missing-rules.md): unknown, no aplicable y regla ausente conservan gaps sin causas inventadas; capacidad, fallos atómicos y lookup por actor/run verificados en sus suites. La integración completa sigue pendiente. |
| T047 | Preparación del harness transferida a la sesión Claude Sonnet tras dos fallos de creación del terminal Codex; ejecución condicionada a integración aceptada y navegador libre | [Asignación](../../evidence/local/matricula-regular-fisi/handoff-codex-matrix.md). Catálogo de 242 instancias; no se cuentan manifiestos ni comprobaciones planeadas como ejecución. |
| T049 | Entrega Claude verificada por raíz; aceptación final espera las historias | [Regresión](../../evidence/local/matricula-regular-fisi/regression.md): 48 casos nuevos, 52/52 con wire sintético en raíz; build/lint exit0. Sin navegador, puertos fijos ni datos privados. |
| T048, T050, T051 | Pendientes de sus dependencias | 170 celdas ACC y cierre documental. |

**Estado operativo:** Sonnet (ctx_a740612b1278) terminó SC-002 parcial: 58 ejecutadas y 8 retenidas, exit3; todavía no hay 242 instancias aprobadas ni cierre de T047. El análisis señala además que MAT-04-V04 ×2 solo probó aprobación directa, por lo que ese crédito debe retirarse como equivalencia. Opus (ctx_bdb24d45950e) entregó la decisión y su terminal terminado fue cerrado.
El usuario aprobó Q1, Q2 y Q3. Se reabren T004/T028/T030 por el alcance de equivalencias; primero revisión documental MR-MODEL-3/plan y luego implementación/pruebas. Sonnet conserva el navegador para los casos afectados independientes; no puede cambiar el modelo, contrato, spec o plan.
Este bloque y las casillas se actualizan después de cada aceptación o reapertura registrada.

## Phase 1: Setup

Objetivo: reutilizar proyectos inicializados y fijar handoff/procedencia antes de tocar código.
- [x] T001 Registrar revisión MR-CONTRACT-2, modelos efectivos Luna High, AGENTS raíz/carpeta, skill propia, archivos exclusivos y límites de privacidad en `evidence/local/matricula-regular-fisi/handoff.md`; no código hasta asignación, no workers adicionales.
- [x] T002 [P] Revisar scripts existentes sin recrear proyectos ni agregar dependencias; documentar comandos reales y scripts futuros no disponibles en `specs/001-matricula-regular-fisi/quickstart.md`; depende T001.
- [x] T003 [P] Documentar factories independientes, reloj, run/reset y shell auxiliar sintético de TODO proceso en `evidence/local/matricula-regular-fisi/provenance.md`; no basta localhost/env snapshots desactivado; depende T001.

## Phase 2: Foundation

Bloquea las seis historias hasta T004–T012 y sus checks; contrato común fijo antes de client/backend.
T004/T005/T006 son archivos independientes tras Setup; máximo dos a la vez.
- [ ] T004 [P] Crear perfil/contextos/factories finitas según bloque literal C-T004 y242 instancias del catálogo en `backend/src/matricula-regular/profile.types.ts`, `backend/src/matricula-regular/profiles.ts`, `backend/src/matricula-regular/fixtures.ts`; preservar nueve filas F6/unknown11–12 y fuentes, ninguna factory lee privados; depende T002/T003.
- [x] T005 [P] Crear reloj servidor inyectable y política local de entrada/renew15min en `backend/src/matricula-regular/clock.ts`; fecha UTC real, inicio inclusivo/fin exclusivo, ningún reloj/PP cliente; depende T002/T003.
- [x] T006 [P] Crear validator/types puro compartido own-api según bloque literal C-T006 en `shared/matricula-regular.mjs`, `shared/matricula-regular.d.mts`; propiedad raíz expresamente asignada, sin relajar MC ni import runtime de capas; depende Setup.
- [x] T007 Crear entidades/estado por run y el ÚNICO evaluador real de acceso Context según C-T007 en `backend/src/matricula-regular/store.types.ts`, `backend/src/matricula-regular/windows.ts`; perfil/scope/PP/ventana/prematrícula/oferta y condiciones contextuales known, sin validar elección inexistente ni hardcode eligible; no durabilidad/cluster/reset HTTP, occupied inicial más accepted; depende T004/T005/T006.
- [x] T008 Crear repositorio singleton y módulo/errores solo propios en `backend/src/matricula-regular/matricula-regular.repository.ts`, `backend/src/matricula-regular/matricula-regular.module.ts`, `backend/src/matricula-regular/matricula-regular-error.filter.ts`; run nuevo, clones y cola serial sin I/O dentro check→publish, API de test reset interno; depende T005/T007. Commit funcional se completa T035, no publicar éxito antes.
- [x] T009 Crear transporte local y validación/correlación de respuestas comunes en `client/src/data/matriculaRegular.ts`; solo `/api/local/matricula-regular/v1`, credentials omit, nunca fallo→mock ni api legacy; consume C-T006, depende T006.
- [x] T010 Crear composición/ruta local y CSS acotado en `client/src/screens/RegularEnrollment.tsx`, `client/src/screens/RegularEnrollment.css`, `client/src/routes/local.matricula-regular.tsx`; reutilizar Common/RouteStatus, no Inicio/global redesign; routeTree solo plugin generado; depende T009.
- [x] T011 Crear bootstrap de prueba aislado en `backend/test/matricula-regular-test-app.ts` y proxy de test exclusivo en `client/vite.matricula-test.config.ts`; solo módulo/factories propios, backendloopback5742/client5741, abortar si ocupado sin inspeccionar/usar servidor desconocido; shell auxiliar fixture independiente en harness, own-api real; depende T003/T008/T010.
- [x] T012 Crear/ejecutar tests de frontera/run/procedencia y correlación en `backend/test/matricula-regular-foundation.spec.ts`, `client/src/data/matriculaRegular.test.ts`; cubrir C-T004/C-T006/C-T007 malformados/extras/null/IDs/fechas/clones y evaluador REAL T007: eligible/ineligible/pending, dos días synthetic/PP0/16/17/20, perfil documental unknown11–12, condiciones contextuales y ninguna elección validada por Context; errores sin valores privados; build/lint/test:data/tests pertinentes solo con test-app synthetic; depende T004–T011.

## Phase 3: US1 — Revisar prematrícula (P1)

**Objetivo:** Documento/contexto y habilitación diferenciados de descarga/registro.
**Prueba independiente:** MAT01-V01–V05, MAT02-V03 y MAT10-V09 por ambas escuelas; leer/descargar sin efectos.
Tests de historia antes de su implementación; se planifican aquí, no se ejecutan ahora.
- [x] T013 [P] [US1] Crear pruebas HTTP sintéticas de documento/flag/vacío/completitud/descarga-sin-guarda en `backend/test/matricula-regular-us1.spec.ts`; AC01/02/03/20, ambas escuelas; depende Foundation.
- [x] T014 [P] [US1] Crear pruebas UI/datos de prematrícula y ACC aplicables en `client/src/data/matriculaRegularUs1.test.ts`; sin fallback ni afirmar CSV=PDF SUM; depende Foundation.
- [x] T015 [US1] Implementar proyección Context y MR-CTX y registrar sus providers/controller en `backend/src/matricula-regular/context.service.ts`, `backend/src/matricula-regular/matricula-regular.controller.ts`, `backend/src/matricula-regular/matricula-regular.module.ts`; preEnrollmentComplete/offerKnown explícitos, forma C-T006 íntegra y acceso Context calculado por función T007 ya verificada T012, nunca mock/hardcode eligible ni seed de operador; depende T013/T004/T006/T007/T012.
- [x] T016 [US1] Implementar documento/flag de prematrícula y CSV local en `client/src/components/PreEnrollmentPanel.tsx`; labels/texto de vacío/incompleto/habilitación, ACC01/08/09/10; reutilizar DataTable/DownloadButton; depende T014/T009.
- [x] T017 [US1] Integrar y verificar US1 en `client/src/screens/RegularEnrollment.tsx` y `evidence/local/matricula-regular-fisi/us1.md`; consumo MR-CTX real, fuente/procedencia y resultados por ID; depende T015/T016 y checks locales de capas.

## Phase 4: US2 — Consultar calendario y habilitación por turno (P1)

**Objetivo:** CalendarioF6, PP testimoniado, pending11–12 y ventanas synthetic separados.
**Prueba independiente:** MAT01-V06–V14 y MAT07-V01–V27, origin/aislamiento/caducidad; ningún supuesto de horas.
Tests de historia antes de su implementación; se planifican aquí, no se ejecutan ahora.
- [x] T018 [P] [US2] Crear pruebas de nueve filas/PP17/>19/null/todos umbrales, unknown11–12/bordes y sesión, AC26 synthetic11/12 sin matrícula previa con PP0/16/17/20 en `backend/test/matricula-regular-us2.spec.ts`; AC04/05/06/23/25/26/28/29 e aislamiento, perfil documentary separado de synthetic; depende Foundation.
- [x] T019 [P] [US2] Crear pruebas UI de calendario/source/pending/entrada/renew en `client/src/data/matriculaRegularUs2.test.ts`; no PP=0 por null, no polling; depende Foundation.
- [x] T020 [US2] Integrar/reutilizar evaluador único de acceso y ventanas YA implementado T007/verificado T012 en `backend/src/matricula-regular/context.service.ts`; consumir solo la función de T007, sin una segunda implementación; contrato/modelo exactos, unknown→gap, sin fallback; depende T015/T018/T007/T012, ventana synthetic de ambos días no modifica F6.
- [x] T021 [US2] Implementar calendario/estado de entrada en `client/src/components/EnrollmentCalendarPanel.tsx`; fuentes/origin/gaps visibles, controles teclado/labels/contraste/reflow/foco ACC; depende T019/T009.
- [x] T022 [US2] Implementar MR-SESSION/MR-RENEW y su integración local en `backend/src/matricula-regular/dto/session.dto.ts`, `backend/src/matricula-regular/session.service.ts`, `backend/src/matricula-regular/matricula-regular.controller.ts`, `client/src/screens/RegularEnrollment.tsx`; expiry nueva entrada, no tokens/login, no consulta que renueva, enum Session C-T006; verificar en `evidence/local/matricula-regular-fisi/us2.md`; depende T020/T021/T008.

## Phase 5: US3 — Elegir cursos y secciones (P1)

**Objetivo:** Intersección L-05 completa y revisión, sin matrícula/reserva.
**Prueba independiente:** MAT02-V02–V08, vacío/completo/incompleto/forzado catálogo; efecto0 y scope correcto.
Tests de historia antes de su implementación; se planifican aquí, no se ejecutan ahora.
- [x] T023 [P] [US3] Crear pruebas de L-05/catalog admission/plan en `backend/test/matricula-regular-us3.spec.ts`; course known mismo plan fuera de prematrícula COMPLETA→COURSE_NOT_IN_PRE_ENROLLMENT, IDunknown404, incompleto gap; depende Foundation.
- [x] T024 [P] [US3] Crear pruebas selección/revisión sin reservar y pertenencia en `client/src/data/matriculaRegularUs3.test.ts`; exactamente intersección, sin disabledcruce/polling; depende Foundation.
- [x] T025 [US3] Implementar intersección/causas/gaps de selección en `backend/src/matricula-regular/selection.rules.ts`; Course/section catálogo conocido distinto de elegibilidad, plan ajeno PLAN_MISMATCH sin pertenencia duplicada; depende T023/T004/T006.
- [x] T026 [US3] Implementar elecciones y revisión en `client/src/components/CourseSelectionPanel.tsx`; courseIds únicos/una section porcourse, créditos una vez, labels/estados ACC10 y teclado, modelo no borrador académico; depende T024/T009.
- [x] T027 [US3] Integrar US3 y registrar escenarios en `client/src/screens/RegularEnrollment.tsx`, `evidence/local/matricula-regular-fisi/us3.md`; consumo contexto real de T015/T020, elección visible≠matrícula, gap no abre commit; depende T025/T026/T022.

## Phase 6: US4 — Respetar requisitos académicos aplicables (P1)

**Objetivo:** Normas y excepciones/repitencia conocidas, unknown gap, sin workflows administrativos.
**Prueba independiente:** MAT04-V01–V20 +MAT06-V01–V12; SC00250 known normativos y16 pending separados.
Tests de historia antes de su implementación; se planifican aquí, no se ejecutan ahora.
- [ ] T028 [P] [US4] Crear matriz normativa/synthetic finita por ambas escuelas en `backend/test/matricula-regular-us4.spec.ts`; todas variantes MAT04/MAT06 y planMAT02-V05, 50 known/16 pending, crédito11/12/26/27 y3excepciones; tests no demuestran UI SUM; depende Foundation.
- [x] T029 [P] [US4] Crear pruebas de proyección de conformidad conocida/gap y privacidad en `client/src/data/matriculaRegularUs4.test.ts`; no datos médicos/pagos/resoluciones reales ni estados oficiales inventados; depende Foundation.
- [ ] T030 [US4] Implementar evaluación de reglas conocida/unknown según C-T004 y bloque C-T030 en `backend/src/matricula-regular/rules.ts`; ramas2/3/4, tutoría/autorización/oferta, mínimo especial no contradictorio, todas causas conocidas y gaps; depende T028/T025/T004.
- [x] T031 [US4] Implementar resumen local de condiciones/gaps, sin automatización institucional inferida, en `client/src/components/AcademicRequirementsPanel.tsx`; ACC08/09/10, fuente/ámbito, sin exponer datos sensibles; depende T029/T009.
- [ ] T032 [US4] Integrar reglas preview y UI, ejecutar checks autorizados y registrar SC002 en `backend/src/matricula-regular/context.service.ts`, `client/src/screens/RegularEnrollment.tsx`, `evidence/local/matricula-regular-fisi/us4.md`; unknown no pass normativo, no matrícula condicionada administrativa; depende T030/T031/T027.

## Phase 7: US5 — Reconocer rechazo y sus límites (P1)

**Objetivo:** Todas causas conocidas, todo-o-nada/capacidad y retorno L-06 solo rejected académico.
**Prueba independiente:** MAT03/MAT05 y rejection subsets MAT04/MAT06; exactly1/1 última plaza y ausencia de parcial/reporte.
Tests de historia antes de su implementación; se planifican aquí, no se ejecutan ahora.
- [x] T033 [P] [US5] Crear tests de conjunto de causas/rechazo/pending/atomicidad/capacidad bajo concurrencia en `backend/test/matricula-regular-us5.spec.ts`; MAT03/MAT05 completos y rejecciones MAT04/MAT06, exactly1/1/no ganador predeterminado, occupied/report antes/después; depende Foundation/T030.
- [x] T034 [P] [US5] Crear tests UI de todo rejected académico→registro vacío, cierre/Escape/foco y protocolo/pending separado en `client/src/data/matriculaRegularUs5.test.ts`; AC16/21/24/27 y ACC; depende Foundation.
- [x] T035 [US5] Completar publicación serial por run y commit de solicitud/matrícula/cupos/reporte según C-T007 en `backend/src/matricula-regular/matricula-regular.repository.ts`; construir copia sin I/O/await check→publish, accepted crea reporte del mismo commit; rejected/pending solo Outcome, cero parcial; depende T033/T030/T008.
- [x] T036 [US5] Implementar MR-SUBMIT/DTO/servicio/pipe y registro de módulo en `backend/src/matricula-regular/dto/submission.dto.ts`, `backend/src/matricula-regular/matricula-regular.pipe.ts`, `backend/src/matricula-regular/matricula-regular.service.ts`, `backend/src/matricula-regular/matricula-regular.controller.ts`, `backend/src/matricula-regular/matricula-regular.module.ts`, `backend/src/app.module.ts`; C-T006 exacto, no cambiar readonly/otros errores, test-app aislado; depende T035/T025/T006.
- [x] T037 [US5] Implementar dialog de resultado y CSS scoped en `client/src/components/EnrollmentResultDialog.tsx`, `client/src/screens/RegularEnrollment.css`; ACC/foco C-T037, causas conocidas como conjunto; texto local veraz, M01 solo referencia sin literal/indicador redirect cuando espera acción; depende T034/T010.
- [x] T038 [US5] Integrar envío de elección con UUID estable y estados en `client/src/screens/RegularEnrollment.tsx`, `client/src/data/matriculaRegular.ts`; dobleclic misma identidad, definitivo rejected vacía/retorna, HTTP/protocolo/pending/unknown no equiparados; conservar draft incierto para recuperaciónUS6, no reenvío automático; depende T036/T037/T027.
- [x] T039 [US5] Verificar US5 con client→NestJS→estado propio y registrar conjunto/efectos/capacidad en `evidence/local/matricula-regular-fisi/us5.md`; cero seedfallback/privados, repetir por ambas escuelas; depende T038/T011 y checks de capas, sin certificar N3.

## Phase 8: US6 — Reconocer aceptación y consultar reporte (P1)

**Objetivo:** Aceptación recuperable, replay estable/report real, lifetime explícito por run.
**Prueba independiente:** MAT08/MAT09/MAT10 y MAT02-V01; accepted/rejected/pending/unknown diferentes, cero duplicados.
Tests de historia antes de su implementación; se planifican aquí, no se ejecutan ahora.
- [x] T040 [P] [US6] Crear tests lookup/report/replay accepted+rejected/concurrente/payloadconflict/expiry/runreset en `backend/test/matricula-regular-us6.spec.ts`; MAT08–10 yAC31–33, todos efectos/lifetime, GETsinwrite; depende Foundation/T035.
- [x] T041 [P] [US6] Crear tests cliente de respuesta perdida/unknown/consulta/manualsameID/correlación y foco de ruta en `client/src/data/matriculaRegularUs6.test.ts`; sesión expirada no oculta resultado del run, antiguo run no se reenvía; depende Foundation.
- [x] T042 [US6] Implementar MR-RESULT/MR-REPORT desde estado propio en `backend/src/matricula-regular/result.service.ts`, `backend/src/matricula-regular/report.service.ts`, `backend/src/matricula-regular/matricula-regular.controller.ts`; Outcome/report C-T006/007, GET puro, report ajeno404 sin seedfallback; depende T040/T035/T006.
- [x] T043 [US6] Implementar recuperación/manualreplay y sessionStorage solo identidad+revisión+elección synthetic en `client/src/data/matriculaRegularRecovery.ts`, `client/src/data/matriculaRegular.ts`; unknown≠no recibido ni rechazo, runchanged aviso/limpieza sin newcommit, misma identidad/payload/no TTL dentro run; depende T041/T038/T009.
- [x] T044 [US6] Implementar proyección/reporte local y ruta en `client/src/data/regularEnrollmentReport.ts`, `client/src/screens/RegularEnrollmentReport.tsx`, `client/src/routes/local.matricula-regular.reporte.$enrollmentId.tsx`; Common/DataTable/CSV local, cursos/total del accepted, no visado activador ni mezcla shell; depende T042/T009.
- [x] T045 [US6] Integrar consulta/replay/reentrada y navegación manual «Ver reporte local» en `client/src/screens/RegularEnrollment.tsx`; focus según C-T037, ningún literal M01 de redirect falso/temporizador, lectura invalidate nunca write; depende T043/T044/T037.
- [x] T046 [US6] Verificar6recorridos básicos y recuperación/reporte por ambas escuelas en `evidence/local/matricula-regular-fisi/us6.md`; propios endpoints reales/estado/report, accepted/rejected/pending/unknown y oldrun distinguidos; depende T045/T011 y checks backend/frontend.

## Phase 9: Final — aceptación integrada y condiciones transversales

Depende de las seis historias; no ampliar alcance a Inicio ni declarar AA/N3 por tests propios.
- [ ] T047 Completar harness de242 instancias funcionales en `client/scripts/verify-matricula-regular.mjs`; usar test-app y proxy propietarios de T011, shell auxiliar synthetic identificado, controlar loss antes/después del commit sin producción, IDs de catálogo/resultados por escuela; depende T017/T022/T027/T032/T039/T046.
- [ ] T048 [P] Crear verificación local de170 celdas ACC en `client/scripts/verify-matricula-regular-a11y.mjs`, `evidence/local/matricula-regular-fisi/accessibility.md`; teclado/foco/AT/contraste/zoom200/reflow320/targets24 con medición y excepciones por elemento, automatización complementada con pasos manuales documentados; depende T045/T037 y T047 terminado/liberando browser; T048 es único dueño de la sesión después de T047. Solo puede paralelizar T049 sin browser; no conformidad A/AA integral.
- [ ] T049 [P] Revisar/ejecutar regresión pertinente de5lecturas readonly con procedencia confirmada y registrar `evidence/local/matricula-regular-fisi/regression.md`; modos/rutas/errores/snapshots no privados, no usar AppModule operador por localhost ni suite global desconocida; depende historias; solo data/HTTP sin browser ni sesión compartida, usando procesos sintéticos de procedencia confirmada; no modificar contratos legacy.
- [ ] T050 Ejecutar checks build/lint/data/HTTP/UI aplicables y reconciliar numeradores/denominadores del catálogo en `evidence/local/matricula-regular-fisi/verification.md`; 242 funcionales/170 ACC separados, SC00250 known+16 pending, todos IDs sin omisión/reruncount, max1 reparación por falla antes de diagnóstico; depende T047/T048/T049.
- [ ] T051 Entregar resultados por capa/contrato/integración/N2/N3 y actualizar comandos realmente disponibles en `specs/001-matricula-regular-fisi/quickstart.md`, `evidence/local/matricula-regular-fisi/verification.md`; ninguna casilla pass por plan/mocks/build solo, sin commit/deploy/producción; depende T050.

## Restricciones literales asociadas a tareas exactas

Los bloques siguientes forman parte de la descripción de la tarea identificada, no son implementación.
No elegir enums/nullability/límites durante ejecución. MR-CONTRACT-2 sigue autoridad HTTP única;
las citas congelan constraints para handoff y deben coincidir si raíz revisa el contrato antes de dispatch.

### C-T004 — campos de perfil/actor y fixture (T004)

> Fuente literal: data-model.md / Perfil de reglas y conocimiento.
> | Campo | Tipo / interpretación local |
> | --- | --- |
> | `preEnrollmentEnabled` | boolean o null: true/false conocido, null gap |
> | `preEnrollment` | CourseDocument[]; `preEnrollmentComplete:boolean`; false gap, [] completo es vacío conocido |
> | `planKnown`, `offerKnown`, `equivalencesKnown` | boolean; false requiere gap, jamás datos seed fallback |
> | `approvedCourseIds` | IDs únicos; solo con historial conocido; no cálculo de notas inventado |
> | `historyKnown` | boolean; false bloquea determinación de prerrequisitos/prioridad |
> | `failedCourses` | `{courseId:ID,failures:entero0..4}` únicos; 4 representa rama normativa de separación, no cuarta matrícula |
> | `creditException` | `{kind:'none'/'remaining-for-completion'/'return-after-suspension'/'plan-change-no-offer',applicability:'applicable'/'not-applicable'/'unknown',sourceIds:string[]}`; unknown gap. No procedimiento de autorización inferido |
> | `institutional` | `{debt:'met'/'unmet'/'unknown',health:'met'/'unmet'/'unknown',eligibility:'met'/'unmet'/'unknown'}`; facts synthetic, sin datos monetarios/médicos ni consultas externas |
> | `tutorship` | por course `{courseId,condition:'met'/'unmet'/'unknown'}`; estado de requisito sintético, no tramitación/alta administrativa |
> | `fourthAttemptAuthorization` | por course `{courseId,condition:'met'/'unmet'/'unknown'}`; para rama 3 desaprobaciones sin oferta, conocida permite máximo12; unknown gap |
> | `ponderado` | number finito>=0 o null; sin redondeo local; comparación exacta contra mínimo. Null pendiente, no0 |
>

### C-T006 — tipos/DTO/relaciones wire (T006; consumidores T009/T015/T022/T036/T042/T044)

> Fuente literal: contrato canónico / Tipos comunes y Operaciones HTTP/Resultado.
> Todos los objetos de DTO tienen **solo** las claves enumeradas y todas son obligatorias;
> `null` se admite únicamente donde se indica. Sin coacción/defaults ni strings recortados.
> Números finitos, contadores enteros seguros no negativos; IDs de catálogo regex
> `^SYN-[A-Z0-9-]{1,48}$`; UUIDs v4 canónicos minúsculos; fechas UTC ISO `YYYY-MM-DDTHH:mm:ss.sssZ`.
> Reglas de fechas verifican instante real. Validación de respuesta correlaciona runId
> con contexto/solicitud consultada, actorId/requestId y enrollmentId con la identidad
> esperada; una respuesta de otra identidad es malformada, no se muestra como éxito. Límites técnicos propios: 1–32 selecciones,
> sin cursos repetidos, sin entradas duplicadas. Orden de selección no es prioridad académica.
>
> | Tipo | Campos exactos |
> | --- | --- |
> | `Choice` | `courseId: ID`, `sectionId: ID` |
> | `Scope` | `facultyId: string no vacío`, `schoolId: string no vacío`, `period: string YYYY-I o YYYY-II`, `planId: ID`, `modality: 'regular-virtual'` |
> | `Source` | `id: string no vacío`, `origin: 'evidence'/'local-decision'`, `class: 'normative'/'observed'/'testimony'/'inferred' o null`, `reference: string no vacío`, `date: YYYY-MM-DD real`, `status: 'documented'/'reported'/'unverified'/'local-only'` |
> | `Gap` | `code: GapCode`, `courseIds: ID[] únicos ordenados`, `sourceIds: string[] únicos ordenados` |
> | `Cause` | `code: CauseCode`, `courseIds: ID[] únicos ordenados`, `sectionIds: ID[] únicos ordenados`, `sourceIds: string[] únicos ordenados` |
> | `Session` | `runId: UUID`, `actorId: ID`, `sessionId: UUID`, `startedAt: ISO`, `expiresAt: ISO` |
>
> En Source, origin=evidence exige una de las cuatro clases; origin=local-decision exige
> class:null y status:local-only. La autorización es decisión local con referencia a L-01–L-04,
> no una nueva clase de evidencia ni observación SUM.
>
> Solo perfiles FISI/2026-II/SISTEMAS o SOFTWARE pueden habilitar writes de esta
> funcionalidad. Scope es más amplio para expresar fixtures ajenos con PROFILE_MISSING,
> sin aplicar FISI ni permitir inscripción en otro periodo/facultad.
>
> Los enums aparecen con `/` solo como notación documental de alternativas. El wire lleva
> una cadena. Causes/gaps son conjuntos: sin duplicados por `(code,courseIds,sectionIds)` /
> `(code,courseIds)`. Se serializan por código y IDs lexicales para repetición estable; ese
> orden técnico no representa precedencia SUM ni condición de aceptación AC-27.
>
> ## Operaciones HTTP
>
> Ninguna query excepto las indicadas. Un GET no admite body. POST admite únicamente JSON
> con claves exactas de su DTO. Todas las respuestas 200 contienen exactamente
> `{runId: UUID, data: T}`. No usar envelope MC/codError para estas operaciones.
>
> | ID | Método / ruta bajo prefijo | Entrada exacta | Respuesta 200 / efectos |
> | --- | --- | --- | --- |
> | MR-CTX | GET `/contextos/:actorId` | Sin query/body | `Context`; lectura del perfil, prematrícula/oferta y calendario propios, sin reserva ni sesión nueva |
> | MR-SESSION | POST `/sesiones` | `{runId: UUID, actorId: ID}` | `Session`; crea sesión demo únicamente, ningún registro/cupo/reporte |
> | MR-RENEW | POST `/sesiones/:sessionId/renovar` | `{runId: UUID, actorId: ID}` | Mismo Session con `expiresAt=now+15min`; solo sesión vigente del actor/run. Expirada requiere sesión nueva |
> | MR-SUBMIT | POST `/solicitudes` | `Submission` abajo | `Outcome`; validación, rechazo/pending o commit completo; replay estable |
> | MR-RESULT | GET `/solicitudes/:requestId` | Exactamente `runId=UUID&actorId=ID` | `Lookup`; lectura sin efectos, incluso sesión demo expirada |
> | MR-REPORT | GET `/reportes/:enrollmentId` | Exactamente `runId=UUID&actorId=ID` | `EnrollmentReport`; solo matrícula aceptada de ese actor/run, nunca seed fallback |
>
> Segmentos inválidos/query repetida o extra/body desconocido → 400. GET con run anterior
> → 409 `RUN_CHANGED`, nunca «no registrado». Context devuelve el run actual; el cliente
> compara el run del intento conservado antes de consultar/enviar.
>
> `Submission` exacto: `{runId,actorId,sessionId,requestId,profileRevision,selection}`.
> Cuatro IDs son los tipos de arriba; `profileRevision` string regex `^MR-[A-Z0-9-]{1,48}$`;
> `selection: Choice[1..32]`. Course/section deben existir y relacionarse en catálogo;
> ID bien formado inexistente produce 404 `CHOICE_NOT_FOUND`, sin guardar un intento.
> La admisión protocolaria solo comprueba catálogo completo de oferta y relación course/section;
> no es elegibilidad. Con prematrícula y oferta completas, opciones seleccionables = intersección
> de courses de prematrícula del plan vigente y oferta aplicable de ese mismo plan. Catálogo
> puede contener courses ofertados del mismo plan ausentes de prematrícula para probar admisión
> forzada: course/section válidos admiten evaluación y rechazan COURSE_NOT_IN_PRE_ENROLLMENT,
> no404. Otro plan ofertado produce PLAN_MISMATCH; no cause de pertenencia duplicada para ese
> course. ID desconocido sigue404. Incompletitud conocida produce gap, nunca exclusión por lista
> parcial ni aceptación. Prerrequisitos/cruces siguen evaluados al enviar, no disabled al clic.
>
> `Context` exacto: `{actorId,scope,profileRevision,serverNow,preEnrollmentEnabled,preEnrollmentComplete,preEnrollment,
> offerKnown,offer,calendar,eligibility,sources}`:
>
> - `preEnrollmentEnabled: boolean o null`; null exige gap, nunca se deduce de descarga.
> - `preEnrollmentComplete: boolean`, `offerKnown: boolean`; false produce PLAN_OR_OFFER_UNKNOWN
>   y no permite selección/commit. Datos parciales pueden consultarse como incompletos.
> - `preEnrollment: CourseDocument[]`, documentos de asignaturas pendientes, incluso no ofertadas;
>   `CourseDocument={courseId:ID,planId:ID,name:string no vacío,credits:number >0}`.
> - `offer: OfferedCourse[]`; `OfferedCourse={courseId,planId,name,credits,prerequisiteIds:ID[],
>   sections:Section[]}`. Ninguna asignatura se inventa a partir de documento incompleto.
> - `Section={sectionId:ID,capacity:entero>=0,occupied:entero>=0,schedule:Meeting[] o null}`;
>   `occupied<=capacity`; `Meeting={day:entero1..7,startMinute:entero0..1439,endMinute:entero1..1440}`,
>   inicio<fin. Fuente synthetic o norma explícita; null no equivale a horario vacío conocido.
> - `calendar={publishedRows:PublishedRow[],effectiveWindows:Window[],unknownDates:string[]}`.
>   `PublishedRow={row:entero1..9,groupLabel:string,day:'2026-08-10',startLocal:string HH:mm,
>   endLocal:string HH:mm,ppMin:number,ppMax:number,sourceId:'F6'}`; transcripción F6 sin corrección.
>   `Window={id:ID,startsAt:ISO,endsAt:ISO,minPp:number>=0,origin:'published-derived'/'synthetic',
>   sourceIds:string[]}`. Fin exclusivo, inicio inclusivo y UTC/Lima explícitos como diseño local.
> - `eligibility={state:'eligible'/'ineligible'/'configuration-pending',windowId:ID o null,
>   windowOrigin:'published-derived'/'synthetic' o null,causes:Cause[],gaps:Gap[]}` calculado con reloj
>   servidor inyectable, no con hora/PP enviada por cliente. Context siempre disponible aunque no
>   haya habilitación; ningún requisito académico se considera aprobado por omisión.
> - `sources: Source[]` registra F1/F2/F6, testimony y decisiones/fixtures. No identificadores
>   personales ni materiales originales. Campo `period` propio `2026-II` no modifica `2026-2` legacy.
>
> Semántica de Context.eligibility (aclaración documental, sin cambio wire): `eligible`
> es entrada habilitada por perfil/scope, PP/ventana, prematrícula habilitada/completa,
> oferta conocida y condiciones institucionales/contextuales aplicables conocidas; no
> significa que una selección aún inexistente cumpla créditos, prerrequisitos, cruces o
> cupos. Dato contextual requerido unknown produce gap; unmet conocido causa contextual.
> Outcome evalúa la elección real al procesar y conserva todas sus causas/gaps. Foundation
> T007 implementa ese evaluador único y T012 lo verifica antes de US1; US2 solo lo reutiliza.
> Las ventanas synthetic11/12 son de perfil de prueba seleccionado explícitamente, nunca
> fallback ni sustitución de unknownDates/horas oficiales del perfil documental.
>
> ## Resultado y recuperación
>
> `Outcome` exacto: `{requestId,actorId,profileRevision,state,evaluatedAt,windowOrigin,
> selection,causes,gaps,enrollmentId,reportPath}`:
>
> - `state: 'accepted'/'rejected'/'configuration-pending'`.
> - `selection` es Choice[] canónico ordenado `(courseId,sectionId)`; `evaluatedAt:ISO`.
> - `windowOrigin` enum como Context o null. `causes:Cause[]`, `gaps:Gap[]`.
> - Accepted: causes/gaps vacíos; `enrollmentId:UUID`; `reportPath` exactamente
>   `/local/matricula-regular/v1/reportes/{enrollmentId}`. La query del actor/run se añade en cliente.
> - Rejected: causes no vacío, gaps vacío; `enrollmentId:null,reportPath:null`, cero writes de cursos/cupos/reporte.
> - Configuration-pending: gaps no vacío; causes incluye todas las fallas conocidas evaluables,
>   IDs de matrícula/reporte null; cero writes académicos. No es rechazo académico ni «validado».
>   Este resultado del intento se conserva; nueva configuración/revisión exige nueva solicitud.
>
> `Lookup` exacto: `{state:'known'/'unknown',outcome:Outcome o null}`. `known` requiere outcome;
> `unknown` requiere null. Unknown: no hay resultado publicado aún para esa identidad/run;
> puede ser petición nunca recibida o en cola. No prueba ausencia definitiva de efectos futuros.
> Consultar no crea solicitud ni renueva sesión. Una sesión expirada no oculta el resultado.
>
> Identidad estable: `(runId,actorId,requestId)`. Payload semántico canónico: actorId +
> profileRevision + selection ordenada; excluye sessionId y orden original. Se compara el
> objeto canónico completo, no solo un hash. Repetir misma identidad/payload devuelve exactamente
> el Outcome original, timestamps/enrollment/report incluidos, sin reevaluar cupos, ventana
> o sesión. Tiene prioridad sobre perfil stale/sesión expirada, tras validación estructural,
> run/actor; el replay ocurre antes de validar catálogo/perfil/sesión de una petición nueva. Nunca autoriza un nuevo commit con sesión vencida.
>
> Misma identidad con payload distinto → 409 `REQUEST_CONFLICT`; no cambia original. Otra
> elección genera otro requestId. Un actor ya matriculado en ese scope/run recibe rechazo
> `ALREADY_ENROLLED` para nuevo intento; no se amplía matrícula en esta rebanada. Replay de
> rechazo no se vuelve aceptación al aparecer plazas. Identidad/resultado duran todo el run,
> sin TTL de deduplicación. Sesión nueva permite consultar/repetir misma identidad.
>
> Cliente crea UUID antes del primer envío y conserva **solo** identidad, revisión y elección
> sintéticas pendientes en sessionStorage por run/actor (una solicitud incierta por actor).
> No almacenar registros/reportes allí. Doble clic comparte identidad/payload; botón bloqueado
> durante envío. Tras fallo de transporte/abort/JSON no interpretable muestra «resultado no
> confirmado», sin éxito, rechazo ni selección nueva; ofrece consultar y, si unknown, repetir
> **manualmente** la misma identidad/payload. No reenvío/polling automático. Cambiar actor
> conserva su intento separado. Run cambiado limpia el intento tras aviso explícito de reset,
> sin reenviarlo en el run nuevo. Nunca tratar reinicio como rechazo o persistencia recuperada.
>
>
> `EnrollmentReport` exacto: `{enrollmentId:UUID,requestId:UUID,actorId:ID,scope:Scope,
> profileRevision:string,acceptedAt:ISO,windowOrigin:enum,rows:ReportRow[],totalCredits:number}`;
> `ReportRow={courseId:ID,sectionId:ID,planId:ID,name:string,credits:number,schedule:Meeting[]}`.
> Rows exactamente cursos aceptados ordenados por courseId; total suma de créditos, sin repetir
> por horario. Reporte inmutable durante run, creado al commit, no visado activador. Prematrícula
> es documento distinto, CSV local de rows no afirma PDF oficial.
>

### C-T007 — entidades/lifetime/publicación (T007/T008/T035)

> Fuente literal: data-model.md / Entidades y relaciones.
> | Entidad | Identidad / campos persistidos en memoria | Relaciones / invariantes |
> | --- | --- | --- |
> | Run | `runId` UUID; catálogo, perfiles, actors, sessions, requests, enrollments, reports | Un proceso/una instancia singleton; nuevo run tras arranque/reset; no inputs/datos privados |
> | Perfil | `profileRevision`; scope de contrato, fuentes, calendario publicado y ventanas efectivas, reglas/estado de conocimiento | Una revisión inmutable por actor/run; lookup exacto, no fallback facultad/periodo/plan |
> | Actor sintético | `actorId`; scope/profileRevision, nombre de demostración, PP acumulado number>=0 o null, historial y condiciones abajo | Catálogo exhaustivo; no cuenta/auth SUM. Snapshot wire/flags legacy no alimentan permisos |
> | CourseDocument | `courseId,planId,name,credits` | Pendiente de plan/prematrícula; no equivale a oferta ni matrícula |
> | Oferta | Course con prerequisites/sections; cada section tiene capacity/occupied/schedule | SectionId global único dentro run; pertenencia course exacta; occupied<=capacity; sin reservas |
> | Sesión demo | `sessionId,actorId,runId,startedAt,expiresAt` | 15min, reloj servidor; renovación solo explícita de recarga vigente. No tokens/cookies/security nueva |
> | Elección | Choice[] del cliente, canónica en solicitud | No ocupa plazas ni es borrador persistido académico; ninguna descarga habilita matrícula |
> | Solicitud | clave `(runId,actorId,requestId)`, payload canónico, Outcome | Inmutable tras publicación; accepted/rejected/pending; replay no reevalúa ni consume |
> | Matrícula | enrollmentId, requestId, actor/scope/revisión, acceptedAt y Choice[] | Solo accepted; exactamente una por actor/scope/run en esta rebanada; selección completa |
> | Reporte | EnrollmentReport del contrato | Uno por matrícula; cursos/créditos/horarios copiados al commit; no seed, previos no eliminados por rechazo |
>
>
>
> Nueva solicitud válida entra a cola serial. Repetición existente devuelve mismo Outcome;
> payload distinto rechaza protocolariamente. Nueva petición con sesión/profile vigentes
> evalúa contexto actual completo: gaps→configuration-pending; sin gaps+causas→rejected;
> sin ambos→accepted. DTO/session inválidos no crean Outcome. HTTP/timeouts no son estados
> académicos. Resultado `unknown` es lectura sin resultado publicado, incluso si sigue en cola.
>
> En accepted se publica una copia conjunta requests/enrollments/reports/occupied. Ante
> fallo previo a publicación, estado intacto. Rejected/pending solo añade request Outcome.
> GET siempre lee snapshot completo clonado. No I/O/await dentro del tramo check→publish;
> invariantes capacidad/replay válidos en un proceso, no en un cluster.
>
> Outcome/canonical payload/reporte duran todo el run aunque expire sesión; no TTL de
> dedup. Rejected/pending no mutan posteriormente: revisión/configuración nueva requiere
> requestId nuevo. Reinicio/reset elimina estado y cambia runId; consultas/replays viejos
> RUN_CHANGED, sin aceptación/rechazo inferidos ni reenvío automático. La sesión demo dura15min,
> no limita lifetime del resultado. sessionStorage conserva solo intento synthetic pendiente,
> sin suplir persistencia backend ni recuperar registros de un run destruido.

> Fuente literal adicional para T007/T012: data-model.md / Evaluador de acceso al contexto previo a US1.
>
>
> Foundation T007 crea UN evaluador en `backend/src/matricula-regular/windows.ts`, usando
> perfil/factories T004, reloj T005 y tipos T006; T012 prueba su resultado real. Context.eligibility
> significa acceso a entrada: perfil/scope aplicable, PP/ventana definidos, habilitación y
> completitud de prematrícula/oferta y condiciones institucionales/contextuales aplicables
> known. False/unmet conocido produce causa contextual; dato requerido unknown produce gap;
> met/not-applicable conocidos no equivalen a comprobar una elección aún inexistente.
> No evaluar créditos, cruces, prerrequisitos o cupos de selección desde Context vacío.
> Outcome evalúa selección real/estado actual y conserva todas causas/gaps según contrato.
> US1 T015 consume evaluador terminado; US2 T020 integra/reutiliza esa misma función, no
> la crea tarde ni mantiene otra implementación/hardcode que fuerce eligible.
> Perfil documental11–12 sin ventana efectiva sigue pending. Solo perfil synthetic
> explícitamente seleccionado usa sus ventanas de prueba; unknownDates oficiales no se
> sobrescriben ni se usan como permiso/fallback al perfil documental.
>

### C-T030 — reglas conocidas y desconocidas (T030)

> Fuente literal: data-model.md / Perfil de reglas y conocimiento.
> Reglas de perfil `{ruleId,sourceIds,knowledge:'known'/'unknown'/'not-applicable'}`;
> unknown produce Gap, not-applicable solo si contexto lo documenta explícitamente.
> Cada regla enlaza F1/F2/F6/testimony/decisión synthetic correspondiente. Fuentes common
> normativas separadas de override escuela/periodo. Datos reales de planes/equivalencias,
> deuda/salud/autorizaciones faltantes conservan gap por caso, no aprueban ni inventan rechazo.
>
> Lógica conocida: créditos sumados una vez por course; carga ordinaria12–26; excepciones
> documentadas no rechazan solo por <12. Prerrequisito debe constar en aprobados o equivalencia
> sintética conocida; desaprobado ofertado tiene prioridad y selección obligatoria en caso
> aplicable. Dos desaprobaciones exige tutoría; tres con course ofertado solo esa asignatura
> y tutoría, tres sin oferta máximo12 con autorización conocida. En estas ramas de cuarta
> matrícula el perfil aplica la carga especial en lugar del mínimo ordinario12: curso único
> ofertado o máximo12 autorizado, sin un CREDIT_LOAD_INVALID contradictorio solo por<12.
> Cuatro desaprobaciones requiere condición institucional/resoluciones aplicables conocidas;
> unknown queda pendiente, no se genera separación/resolución automática. Separación/suspensión
> conocidas no elegibles. Casos con varias ramas especiales no resueltas institucionalmente
> quedan pending, no composición universal inventada. Oferta/descripciones totalmente synthetic.
>
> Cruce local: reuniones del mismo día con max(inicios)<min(finales), intervalos [inicio,fin);
> se compara todo par de asignaturas elegidas, sin deshabilitar opción al clic. Horario null
> gap; [] conocido no equivale a null. La UI no reserva ni recalcula disponibilidad por polling.
>

### C-T037 — foco y criterio de interfaz (T037/T045/T048)

> Fuente literal: acceptance-catalog.md / Protocolo local de foco.
> Protocolo local de foco: abrir D1/D2 lleva foco a heading del dialog (programáticamente
> focusable) y nombre/descripción legibles; Tab/ShiftTab permanecen en acciones del modal.
> Escape y botón cerrar salen; D2 vuelve al registro vacío conforme L-06 y enfoca su heading
> si el opener dejó de ser elegible; D1 cerrado sin navegación vuelve a opener disponible o
> heading del resultado accepted. Acción «Ver reporte local» navega y enfoca heading P1;
> no timeout de redirección ni cancelación del commit por cerrar. Resultado pending/uncertain
> no abre dialog de rechazo ni borra identidad por Escape. Carga/envío no usa modal bloqueante
> sin salida: estado AT y controles de envío disabled, lectura/consulta segura sigue posible.
> Avisos no modales conservan foco actual y se anuncian; error de validación con campo dirige
> foco al primer campo identificado después de acción del usuario, manteniendo texto asociado.
> RouteError.invalidate solo lectura, nunca reenvío; reentrada expirada reinicia elección salvo
> identidad incierta consultable. M-01 permanece referencia del manual, no exige navegación
> automática mientras el usuario lee el aviso ni declara persistencia productiva.
>
> Cuando D1 espera «Ver reporte local», su texto es veraz y local-only; no copiar el literal
> M-01 ni el indicador REDIRECCIONANDO como si ya hubiera navegación en curso. M-01 permanece
> referencia documental/visual, no una obligación de texto para ese estado local.

## Dependencias y propiedad

DAG de historias: Setup→Foundation (incluye acceso Context T007 y pruebas reales T012)→US1; US2 puede escribir tests con Foundation pero integra después US1;
US3 usa Context/sesiónUS1/2; US4tests independientes de UIUS3, integración después US3;
US5 depende reglasUS3/4 y sesiónUS2; US6 depende commitUS5, lookup/report independiente de shell; Final depende todas.

Mismo archivo se edita secuencialmente: module T008→T015→T036; repository T008→T035; controller T015→T022→T036→T042;
windows.ts solo T007; T020 consume su función sin reimplementarla. ContextService T015→T020→T032; RegularEnrollment T010→T017→T022→T027→T032→T038→T045;
data adapter T009→T038→T043; CSS T010→T037. Nunca paralelizar esas escrituras.

Backend worker solo backend/ y tests; client worker solo client/; raíz asigna shared/ de T006 y
harness/evidencia/contracts. Contrato fijo, archivos exclusivos y prerequisitos al handoff. Máximo2workers;
sin delegación de workers ni navegador compartido simultáneo. Cambiar ownership requiere principal.

## Ejemplos de paralelismo por historia

| Historia | Pareja de tareas independientes, una vez satisfechos prerequisitos |
| --- | --- |
| US1 | T013 backend test / T014 client test |
| US2 | T018 backend test / T019 client test |
| US3 | T023 backend test / T024 client test |
| US4 | T028 backend test / T029 client test |
| US5 | T033 backend test / T034 client test |
| US6 | T040 backend test / T041 client test |

El marcador [P] solo habilita pareja con archivos disjuntos después de sus dependencias,
no seis historias a la vez ni ejecución sin autorización. No browser en estas parejas. T047 y T048 son secuenciales y transfieren propiedad de
la sesión: no navegación funcional/visual/AT concurrente. T048[P] solo con T049 data/HTTP
sin browser; cualquier necesidad visual de regresión debe esperar al dueño vigente.

## Estrategia incremental

MVP: Setup+Foundation+US1; documento/flag/descarga propios sin registrar matrícula. Verificar
US1 de forma independiente. Luego US2/US3/US4 por dependencias; US5 agrega efectos y rechazo,
US6 aceptación recuperable/reporte; fullstack completo solo tras Final. No deploy ni commit automático.

Setup-tasks realizado por principal; hooks before/after ausentes. Planner docstage real mismo
`sum-planner`, GPT-6.1 Sol High, sin subdelegación; este archivo no ejecuta workers/tests/código.

**Conteo:**51 tareas; Setup3/Foundation9; US1–US4:5cada una; US5/US6:7cada una; Final5.

Aprobación humana 2026-10-13: Q1 Context vacío/rechazo HTTP; Q2 planificación MR-MODEL-3 y posterior implementación de equivalencias sintéticas explícitas sin cambiar wire; Q3 botón de renovación y divergencia de browser reload documentada. T004/T028/T030 requieren reabrir su alcance de equivalencia al adoptar el plan revisado; no se contarán pruebas de aprobación directa como MAT-04-V04. Sonnet terminó SC-002 parcial: 58 ejecutadas,8retenidas, runnerexit3; el análisis identifica además2V04 no acreditadas. T032/T047 continúan pendientes. No242/170/N3.
