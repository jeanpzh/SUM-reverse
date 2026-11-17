# Diseño arquitectónico: asignación docente por sesión, franjas por facultad/periodo y completitud de programación académica

Fecha: 2026-11-17
Estado: En implementación (`t3/complete-academic-sessions`, base `6c1d30f`)

## 1. Diagnóstico de incompatibilidades y causas raíz actuales

Al auditar en modo lectura los contratos compartidos (`shared/`), el motor Python OR-Tools CP-SAT (`planning-engine/`), el backend NestJS (`backend/src/programacion-academica/`) y el flujo cliente (`client/src/data/`, `client/src/screens/`), se identificaron cinco restricciones acopladas que impedían completar la programación o degradaban el diagnóstico:

1. **Unicidad docente rígida por sección en todos los modos:**
   - `shared/programacion-academica-api.mjs`, `backend/.../section-delivery.ts`, `backend/.../demo-proposal.service.ts` y `planning-engine/solver.py` exigen `new Set(assignments.map(a => a.teacherId)).size <= 1` por sección.
   - Incluso cuando un curso separa teoría/práctica (`T`/`P`) del laboratorio (`L`), `teacher_sec` ata toda la carga de la sección (`360 min` en cursos como `20118041` o `T+P+L`) a un solo docente. En la demanda sintética `2027-I` (`332` sesiones / `166` secciones / `56` cursos), cursos con docentes compartidos agotan sus `600 min` de forma fragmentada (p. ej. `240 + 120 + 120` libres) y quedan pendientes en `330/332`.
   - Asimismo no existe distinción entre `responsibleTeacherId` (docente titular/responsable de la sección cuando hay múltiples dictantes) y el `teacherId` por sesión ya presente en `assignments[]`.

2. **Reglas de franja horaria duplicadas sin perfil de facultad/periodo:**
   - La franja de sábado `08:00–13:00` (`13:00` universal) y la restricción de ciclos `>= 7` (`18:00–22:00` con excepción `14:00–22:00`) están duplicadas en `planning-engine/solver.py` (`planning_time_rank`), `backend/.../schedule-generator.ts` (`planningTimeRank`), y `backend/.../demo-proposal.service.ts` (`isAllowedPlanningInterval`, `toGeneratorInput`, `buildProposalView`).
   - El modelo actual no conserva `facultyId`, `period`, `source` ni `exceptions` explícitas (p. ej. extensión de sábado hasta `14:00` o `14:00–18:00`), ni rechaza una facultad desconocida de forma explícita.

3. **Desalineación entre simulación (`run_cpsat_dry_run`) y regeneración (`DemoProposalService.toGeneratorInput`):**
   - `advisor_agent.py` activa `copy.planningPolicy.allowSaturday = True` al simular `enable_planning_window`, pero no añade el intervalo del sábado a `copy.windows` (a diferencia de `DemoProposalService.toGeneratorInput`), ni reenvía `allocationPolicy`, y usa `0.8s` frente a `2.5s` en `/v1/propuestas`.
   - Además, `solver.py` muestrea una sola habitación por combinación `(sec_idx + ...)` y marca `candidates_truncated = True` cuando `len(compatible) > 1`, mientras `allocationPolicy` (`balanced` vs `first-feasible` vs `preferences`) no altera la función objetivo de CP-SAT.

4. **Verificación de huella e integridad en borradores y revisión docente:**
   - `DemoProposalService.validateRetainedView`, `matchesProposalConfiguration`, `captureDraftRetention` y `teacherFingerprints` (`teacher-review.ts`) comparan configuraciones canonizadas exactas y atributos de sección (`deliveryMode`). Cualquier extensión de contrato debe ser **aditiva y opcional con valores legacy por omisión**, de modo que solicitudes existentes mantengan exactamente su forma canonizada y compatibilidad con borradores guardados previos.

## 2. Migración aditiva de contratos (compatibilidad legacy 100 %)

Todos los cambios de esquema son **aditivos con propiedades opcionales**; omitir los campos nuevos preserva idénticamente el comportamiento previo:

| Contrato | Campos nuevos (opcionales) | Default legacy si se omite | Regla de validación / incompatibilidad |
| --- | --- | --- | --- |
| `PlanningPolicy` (`shared/academic-planning-policy.mjs`) | `facultyId?: string`, `source?: string`, `exceptions?: { saturdayEndMinute?: number }` | `facultyId: 'FISI'`, `source: 'synthetic-local-default'`, `saturdayEndMinute: 780` (13:00) | Si `facultyId` está presente y `!== 'FISI'`, rechaza explícitamente con `TypeError` (sin respaldo silencioso a otra facultad). `exceptions.saturdayEndMinute` entero `780..1440` exige `allowSaturday: true`. |
| `AcademicRequest.demands[]` & `GeneratorCourse` | `teacherAssignmentMode?: 'single-teacher-section' \| 'tp-grouped-l-independent' \| 'per-session'` | `'single-teacher-section'` | Preserva unicidad de docente por sección cuando se omite o es `'single-teacher-section'`. |
| `AcademicProposal.sections[]` & `AcademicSection` | `teacherAssignmentMode?: ...`, `responsibleTeacherId?: string` | `teacherAssignmentMode: 'single-teacher-section'` | `responsibleTeacherId` identifica al responsable de sección (grupo `T`/`T+P` o primer dictante asignado) sin crear una entidad nueva ni duplicar catálogos. |
| `AcademicAdvisorPatch` | `kind: 'change_teacher_assignment_mode'`, `courseIds: string[]`, `teacherAssignmentMode: 'tp-grouped-l-independent' \| 'per-session'` | — | Permite al consejero determinista proponer separación docente `T+P` / `L` cuando la capacidad fragmentada o duración bloquea pendientes. |
| `AdvisorAnalyzeRequest` (`planning-engine/models.py`) | `allocationPolicy?: 'preferences' \| 'balanced' \| 'first-feasible'` | `'preferences'` | Asegura paridad entre `run_cpsat_dry_run` y `/v1/propuestas`. |

## 3. Reglas de agrupamiento docente y continuidad (`getSectionComponentGroups`)

Se define una función pura compartida en `shared/programacion-academica-api.mjs` (con par en `planning-engine/solver.py`):

1. **`'single-teacher-section'` (predeterminado legacy):**
   - Toda la sección forma un único grupo `[...orderedSessions]`.
   - Comparte exactamente 1 `teacherId`. Si `deliveryMode === 'continuous'`, todas las sesiones deben ser contiguas en su orden declarado el mismo día.
2. **`'tp-grouped-l-independent'`:**
   - Agrupa las sesiones no laboratorio (`type !== 'L'`, p. ej. `T` + `P`) en orden declarado en un grupo principal `[...tpSessions]`, y crea un grupo independiente `[lSession]` por cada sesión con `type === 'L'`.
   - Cada grupo comparte un único `teacherId` (p. ej. `docenteA` dicta `T+P` juntos y `docenteB` dicta `L` independiente; en cursos `T+P` sin `L`, equivale a un solo grupo).
   - Cuando `deliveryMode === 'continuous'`, la continuidad el mismo día se exige **dentro de cada grupo** (de modo que `T` y `P` se dicten continuos con `docenteA`, mientras `L` puede ubicarse en otro día/franja con `docenteB` sin romper la continuidad pedagógica de `T+P`).
   - En todo caso, las sesiones de una misma sección **nunca pueden solaparse en el tiempo** (`SECTION_CONFLICT`), ni violar el cruce de cohorte (`COHORT_CONFLICT`), límites de minutos semanales o `sectionLimits` (contando secciones únicas asignadas por docente).
3. **`'per-session'`:**
   - Cada sesión requerida forma un grupo independiente `[session]`, pudiendo recibir su propio `teacherId` y su propio horario sin solapamiento interno de sección.

En el ajuste manual (`POST .../ajustes`):
- Cambiar `teacherId` actualiza las sesiones pertenecientes al grupo o grupos afectados: toda la sección en `'single-teacher-section'`, el grupo `T+P` o la sesión `L` en `'tp-grouped-l-independent'`, y solo `sessionIds` en `'per-session'`. Recalcula `responsibleTeacherId` y `preferenceReport` evaluando cada sesión contra las preferencias de su docente asignado.

## 4. Perfil unificado de franjas por facultad/periodo

`shared/academic-planning-policy.mjs` expone `resolvePlanningTimeProfile(policy)`, `getEffectivePlanningWindows(baseWindows, policy)`, `isAllowedPlanningInterval(cycle, interval, policy)` y `planningIntervalRank(cycle, start, day, duration, policy)` (con par exacto en `planning-engine/solver.py`):
- Facultad declarada explícitamente (`'FISI'`; cualquier facultad desconocida lanza `TypeError`), conservando `facultyId`, `period`, `source` y `exceptions`.
- Lunes–viernes `08:00–22:00`; ciclos `>= 7` restringidos a `18:00–22:00` salvo `allowAfternoon: true` (`14:00–22:00`).
- Sábado cerrado salvo `allowSaturday: true`, con fin configurable por excepción explícita `exceptions.saturdayEndMinute` (por defecto `780` = `13:00`; admite excepciones verificadas p. ej. `840` = `14:00` o `1080` = `18:00` dentro de `windows` declaradas).
- Se eliminan las constantes duplicadas ad-hoc en `demo-proposal.service.ts`, `schedule-generator.ts`, `solver.py` y `advisor_agent.py`.

## 5. Motor CP-SAT, `allocationPolicy`, simulación y criterios de aceptación

- **Búsqueda por grupos de componentes en `solver.py` y `schedule-generator.ts`:**
  - El precheck, construcción heurística e incumpent, variables CP-SAT (`group_options[(sec.id, g_idx)]`), `section_slot_vars`, `cohort_slot_vars` y `teacher_options` operan por grupo de componentes.
  - Cuando un curso tiene `teacherAssignmentMode !== 'single-teacher-section'`, docentes con menos de `sum(section)` minutos pero suficientes para un componente (`T+P` o `L`) pueden cubrirlo legalmente.
  - Se conserva el conteo único de secciones por `(teacherId, courseId)` mediante variables binarias auxiliares en `sectionLimits` cuando múltiples grupos de una sección pueden recaer en el mismo docente.
  - Se diversifica la exploración de aulas compatibles (múltiples aulas por franja cuando el dominio lo permite sin provocar producto cartesiano explosivo ni ocultar `candidates_truncated` cuando haya omisión real).
- **`allocationPolicy` con comportamiento real y verificable:**
  - `'preferences'` (default): bonifica preferencias docentes (`+20`) y preferencia de turno (`rank == 0 -> +5`, else `+1`).
  - `'balanced'`: combina calidad de preferencias/franja y penalización lineal acotada sobre la carga máxima/acumulada por docente (`max_teacher_minutes` y exceso sobre umbral promedio) para reducir concentración sin sacrificar sesiones programadas.
  - `'first-feasible'`: elimina el sesgo de preferencias (`pref_bonus = 1` uniforme) priorizando únicamente cobertura máxima y factibilidad determinista.
- **Paridad de simulación (`run_cpsat_dry_run`):**
  - Propaga `allocationPolicy`, extiende `copy.windows` con la ventana de sábado resuelta del perfil cuando `allowSaturday` está activo, soporta `change_teacher_assignment_mode` y homologa `maxTimeSeconds=2.5` con `/v1/propuestas`.
- **Orden determinista del consejero (ADR-0001 / ADR-0002):**
  - El catálogo determinista mantiene su autoridad total (el LLM nunca cambia cargas ni autoriza excepciones); se añade recomendación tipada `change_teacher_assignment_mode` cuando existen cursos multi-componente pendientes en `'single-teacher-section'`.

## 6. Criterios de verificación

1. Pruebas unitarias en `shared`, `planning-engine` (`pytest`) y `backend` (`vitest`) cubriendo:
   - Casos anónimos equivalentes a `T/P` con docente A + `L` con docente B (viernes/jueves, sábado hasta `14:00` y sábado `14:00–18:00` por excepción explícita), ciclos VII+ con tarde `14:00–17:00`, y rechazo explícito de facultad desconocida.
   - Compatibilidad estricta legacy cuando se omiten `teacherAssignmentMode`, `facultyId`, `source` y `exceptions`.
   - Diferencia medible y determinista entre `allocationPolicy = 'preferences' | 'balanced' | 'first-feasible'` sobre una misma entrada factible.
   - Ajuste manual diferenciando `'single-teacher-section'` vs `'tp-grouped-l-independent'`.
2. Pruebas cliente (`pnpm --dir client test:data`) + E2E Playwright en stack temporal aislado con `SUM_LLM_PROVIDER=disabled`.
3. Medición honesta y reproducible del escenario sintético completo (`56 cursos`, `166 secciones`, `332 sesiones`, `2027-I`) antes, en simulación y tras regenerar, sin incrementar silenciosamente cargas docentes ni reducir demanda; si algún subconjunto permanece bloqueado bajo `600 min/semana`, documentar con exactitud los bloqueadores y los ajustes tipados que requieren autorización externa.
