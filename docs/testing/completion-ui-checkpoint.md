# Completion UI & Synthetic E2E Checkpoint (`1a38557`)

## Alcance
- **Rama / checkpoint base**: `1a38557` (`t3/planning-session-assignment`), entorno sintético local FISI / Sistemas `2027-I` (56 cursos en catálogo, meta de completitud `332` sesiones).
- **Modo sin LLM ni credenciales**: la verificación E2E preparada corre con `SUM_REDESIGN_LIVE_LLM=0` (sin API keys ni llamadas externas).

## Cambios en archivos bajo ownership
1. **`client/src/data/academicScheduling.ts`**
   - Reexporta `resolvePlanningTimeProfile`.
   - Exporta `clonePlanningPolicy` y lo usa en `buildAcademicPlanningRequest` para clonar `facultyId`, `source` y `exceptions` sin mutar el estado del llamador.
2. **`client/src/data/planningSession.ts`**
   - `hydrate`: clona `planningPolicy` con `clonePlanningPolicy` y restablece `deliveryModes` y `teacherAssignmentModes` desde `draft.configuration.request.demands`, evitando fugas de ediciones en memoria al reanudar o bifurcar borradores.
   - `updatePlanningException`: conserva `facultyId`, `source` y `exceptions`; elimina `exceptions` si `allowSaturday` pasa a `false` para mantener válido `validatePlanningPolicy`.
   - `applyAdvisorPatches` y `applyPeriodDefaults`: clonan `planningPolicy` conservando `facultyId`, `source` y `exceptions`.
   - Confirmado: `createProposal` envía `teacherAssignmentMode` para `tp-grouped-l-independent` y `per-session` (omitiendo `single-teacher-section` heredado); `updateTeacherAssignmentMode` invalida `proposal`, `advisorOutcome` y `ready-for-review` → `draft`, mantiene `demandEstimate` y marca `dirty: true`.
3. **`client/src/screens/AcademicPreparationCourses.tsx`**
   - Conserva el selector `Asignación docente` en `Configuración del curso` con el diseño existente del inspector, etiqueta `<Label>` asociada y `aria-label="Asignación docente <courseId>"`.
4. **`client/src/screens/AcademicScheduling.tsx`**
   - Calcula las etiquetas de franja de tarde y sábado dinámicamente con `resolvePlanningTimeProfile` y `formatAcademicMinute` según `state.policy` (sin fijar `08:00 a 13:00` si `exceptions` define otra franja).
5. **`client/src/components/ai-elements/SuggestionCard.tsx`**
   - En `change_delivery_mode` deja de afirmar siempre un docente único por sección (`componentes en franjas independientes (respeta la asignación docente del curso)`).
   - Acepta `planningPolicy?: PlanningPolicy | null` opcional para mostrar el rango exacto de `enable_planning_window` cuando está disponible, o un texto consciente del perfil (`según el perfil vigente (08:00 a 13:00 salvo excepción)`) cuando se omite.
6. **Tests unitarios y SSR**
   - `client/src/data/academicScheduling.test.ts`: clonado profundo de `PlanningPolicy` con `facultyId`, `source` y `exceptions`.
   - `client/src/data/planningSession.test.ts`: envío de `teacherAssignmentMode`, invalidación de propuesta/estado de revisión, limpieza de modos obsoletos al reanudar/bifurcar, preservación de `facultyId`/`source`/`exceptions` y limpieza segura de excepción de sábado al desmarcar `allowSaturday`.
   - `client/src/components/ai-elements/advisor.test.mjs` y `client/scripts/test-normative-components.mjs`: render SSR de `SuggestionCard` (`change_delivery_mode` con `teacherAssignmentMode`, `change_delivery_mode`, `enable_planning_window` con y sin `exceptions`) y humo SSR de `AcademicPreparationCourses`.
7. **Runner E2E sintético sin LLM**
   - `client/scripts/verify-planning-completion.mjs` + allowlist mínima en `client/scripts/verify-planning-redesign-stack.mjs`.

## Ejecución integrada en root (puertos reservados `3866`/`3867`/`5866`)
No ejecutar contra servidores del operador (`3636`/`3637`/`5636`). Root ejecuta secuencialmente tras integrar el backend:

```bash
SUM_REDESIGN_API_PORT=3866 \
SUM_REDESIGN_ENGINE_PORT=3867 \
SUM_REDESIGN_WEB_PORT=5866 \
SUM_REDESIGN_TEST_SCRIPT=verify-planning-completion.mjs \
node client/scripts/verify-planning-redesign-stack.mjs
```

### Contrato de reporte en `acceptance.json`
- **`targetMet` (separado de `passed`)**: `true` únicamente si `status === 'complete'`, `requiredSessions === 332`, `scheduledSessions === 332`, `pendingSessions === 0` y `completeSections === totalSections`. Un resultado parcial nunca se marca como completo.
- **`passed` (seguridad e integración)**: valida generación inicial de 56 cursos, consulta sin simulación ni LLM, selección de recomendaciones sin aumento silencioso de carga (`increase_teacher_load` excluida y deltas verificados contra la generación inicial), simulación exacta de `selectedRecommendationIds`, aplicación con exactamente una regeneración real sin guardado implícito (`borradores` vacío), misma demanda exacta, `0` cruces de recursos/secciones y ausencia de excepciones en navegador.

## Brechas / defectos registrados fuera de ownership (no modificados)
1. **`shared/academic-planning-policy.d.mts`**: `FACULTY_PLANNING_PROFILES` se exporta en `shared/academic-planning-policy.mjs`, pero falta su declaración TypeScript en `.d.mts`. Se evitó importarlo usando `resolvePlanningTimeProfile`.
2. **`client/src/screens/PlanningWeekAdjustment.tsx` (líneas 305–307)**: el texto en modo `split` sigue indicando *"Cambiar docente modifica la responsabilidad de toda la sección; los demás bloques mantienen sus horarios"* sin distinguir `tp-grouped-l-independent` ni `per-session`.
3. **`client/src/screens/PlanningAssistAdvisor.tsx` y `client/src/screens/PlanningStatusBar.tsx`**: no pasan `planningPolicy` a `SuggestionCard`, por lo que las tarjetas de `enable_planning_window` muestran el texto genérico consciente del perfil hasta que se cablee la prop desde esos componentes.
4. **Edición de perfil/excepciones de política en UI**: no existen controles en `AcademicScheduling.tsx` ni `AcademicPreparationCourses.tsx` para editar `PlanningPolicy.facultyId`, `source` ni `exceptions` (`saturdayStartMinute` / `saturdayEndMinute`). Conforme a las instrucciones, no se inventaron controles ni ventanas por defecto.
5. **Validación directa en navegador**: omitida en este worker por dependencia del fix backend (ticket A); queda lista para corrida integrada en root con puertos `3866/3867/5866`.
