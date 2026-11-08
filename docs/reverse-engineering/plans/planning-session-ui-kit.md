# Entrega 1.5: Sesión de programación, kit de interfaz y tema oscuro

Estado: aprobada por el usuario (2026-11-07) tras la revisión de arquitectura y la sesión de preguntas. Es la base de las entregas 2–5 de [planning-assisted-workflow.md](planning-assisted-workflow.md); no reabre sus cuatro etapas ni su alcance. Términos en [GLOSSARY.md](../../../GLOSSARY.md).

Alcance: solo el producto interno (`/local/programacion-academica`), que sigue [docs/design-direction.md](../../design-direction.md). Pantallas del alumno, tokens `--sum-*`, el reset global y los componentes del alumno no cambian. `/` y `/local/modulos` no cambian.

## Decisiones

| # | Decisión | Clase |
| --- | --- | --- |
| D1 | La Sesión de programación es una función de transición pura (`useReducer`) más un ejecutor de órdenes asíncronas. Sin dependencias de estado nuevas. | local-only |
| D2 | La Sesión llama al servidor mediante un cliente inyectado: en la app, las funciones existentes de `client/src/data/academicScheduling.ts`; en tests, un cliente en memoria. | local-only |
| D3 | Dentro de la Sesión: catálogo, periodo, política, entradas del workspace (cursos, demanda, capacidad, patrones, modo de dictado, recursos, política de asignación, fuente de demanda), Propuesta, Borrador (id, versión, estado, revisión), cambios sin guardar, operación en curso y error por orden. Fuera (estado de vista): búsqueda, filtro de ciclo, Tabla/Semana, sección seleccionada y superposición abierta. | local-only |
| D4 | shadcn/ui estándar (`components.json`, `cn()`, componentes copiados en `client/src/components/ui/`) sobre Radix, estilizado solo con tokens `--planning-*`. No se activa el preflight de Tailwind. Dependencias nuevas justificadas por accesibilidad de diálogos y pedido del usuario: `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `class-variance-authority`, `clsx`, `tailwind-merge`. | local-only |
| D5 | Tema: por defecto sigue `prefers-color-scheme`; conmutador Claro/Oscuro/Sistema en el shell interno, persistido en `localStorage` (con try/catch). Se aplica como `data-theme` sobre `.planning-root`, nunca sobre `<html>`. Los valores oscuros de `--planning-*` se derivan de los claros y cumplen contraste AA. | local-only |
| D6 | Regla de desborde: lo que desborda su panel o requiere scroll propio pasa a una superposición. Sheet derecho: inspector de sección (Horario) y detalle/edición de docente o ambiente (Recursos). Dialog: cambios masivos de cursos, incorporar/retirar recursos, confirmaciones de aprobar/publicar/nuevo borrador, ajuste de bloque y lista de borradores. La demanda pasa a columnas de la tabla de cursos más un resumen en Dialog. | local-only |
| D7 | Una Acción principal por etapa, calculada por la Sesión (tabla abajo). Las demás acciones son secundarias. | local-only |
| D8 | URL: se mantiene `?etapa=` y se añade `&vista=resumen|cursos|recursos` en Preparación. Las superposiciones no cambian la URL. | local-only |

### Acción principal (D7)

| Etapa | Condición | Acción principal |
| --- | --- | --- |
| Preparación | oferta incompleta o con errores | Revisar oferta (n) |
| Preparación | oferta válida | Generar propuesta |
| Horario | sin Propuesta | Volver a Preparación |
| Horario | Pendientes > 0 | Resolver pendientes (n) |
| Horario | cambios sin guardar | Guardar borrador |
| Horario | resto | Enviar a revisión docente |
| Revisión docente | falta respuesta | Registrar respuesta |
| Revisión docente | revisión completa | Ir a aprobación |
| Aprobación | guardado y sin cambios | Aprobar versión |
| Aprobación | aprobada | Publicar |

Las condiciones exactas se derivan de los estados y contratos existentes (`shared/programacion-academica-api.mjs`); si un estado no está en el contrato, se registra como brecha en vez de inventarse.

## Tickets

| Ticket | Archivos exclusivos | Depende de | Rol |
| --- | --- | --- | --- |
| T1 Sesión de programación | nuevos `client/src/data/planningSession.ts`, `client/src/data/planningSession.test.ts` | — | UI worker |
| T2 Kit de interfaz y tema | `client/components.json`, nuevos `client/src/components/ui/*`, `client/src/lib/utils.ts`, `client/src/components/PlanningShell.tsx`, `client/src/components/PlanningShell.css`, `client/package.json`, `client/pnpm-lock.yaml` | — | UI worker |
| T3 Migración a Sesión y superposiciones | `client/src/screens/AcademicScheduling.tsx` y los paneles `Academic*`/`Planning*` con sus CSS | T1, T2 | UI worker |
| T4 Resumen y Acción principal en Preparación (D7, D8) | `client/src/routes/local.programacion-academica.tsx`, nuevas vistas de Preparación, `PlanningStageNav`/`PlanningStatusBar` | T3 | UI worker |
| TT Verificación | `client/scripts/verify-academic-*.mjs`, nuevo script de tema/superposiciones | junto a T3/T4, ejecuta sobre lo integrado | Test worker |

T1 y T2 corren en paralelo (archivos disjuntos). Integración ticket a ticket por el orquestador; Auditor fresco al final.

### Notas técnicas obligatorias

- Los portales de Radix se montan por defecto en `document.body`, fuera de `.planning-root`, y perderían los tokens y el tema. Las superposiciones deben usar un contenedor de portal dentro de `.planning-root` (prop `container`) o un ámbito de tema equivalente.
- Sin preflight, los componentes shadcn copiados no deben depender del reset global (bordes, `box-sizing`, botones); cualquier base necesaria se declara dentro de `.planning-root`.
- T1 no cambia contratos ni el backend. La Sesión usa los validadores existentes de `shared/` y las funciones de datos existentes; no duplica tipos.

## Criterios de aceptación

| Criterio | Comprobación | Esperado |
| --- | --- | --- |
| A1 Transiciones de la Sesión | `pnpm --dir client test:data` con tests de T1: generar, ajustar, guardar, retomar, conflicto de versión (409), cambios sin guardar, aprobar/publicar, error por orden | Todos pasan sin navegador |
| A2 Acción principal | Tests de T1 por cada fila de la tabla D7 | Acción esperada por estado |
| A3 Build y lint | `pnpm --dir client build`, `pnpm --dir client lint` | Sin errores |
| A4 Recorrido existente | `verify-academic-manual.mjs` actualizado, stack sintético aislado | exit 0 |
| A5 Superposiciones accesibles | Playwright: foco atrapado y devuelto en un Dialog y un Sheet; Escape cierra; nombre accesible | Pasa |
| A6 Sin desborde | Playwright a 1280 y 390 px en cada etapa | `scrollWidth <= clientWidth` en la página |
| A7 Tema | Contraste AA calculado sobre pares de tokens claros y oscuros; capturas de ambos temas; conmutador persiste | Pasa; capturas en `evidence/local/` |
| A8 Alumno intacto | `--sum-*` sin cambios en diff; sin preflight; `pnpm --dir client verify` de escenarios del alumno aplicables | Sin regresión |

Solo datos sintéticos. No se accede a `datos-reales/` ni a servidores con snapshots privados.

## Avance (2026-11-08)

- T2 integrado (`df0519b`), con correcciones del orquestador: el script de contraste ahora comprueba ambos temas (`6ced04d`) y el contexto del portal sale del shell para cumplir lint (`0b1cb8c`).
- T1: dos intentos delegados quedaron incompletos (`3436e57`, `a5a3d66`, no integrados); el orquestador lo implementó (`f11df89`). Desviaciones registradas:
  - D1: se mantiene el reductor puro; un store mínimo (`createPlanningSession`) envuelve el reductor para que las órdenes asíncronas lean el estado actual, y React lo consume con `useSyncExternalStore`. Sin dependencias nuevas.
  - D7: pendientes en Horario = secciones parciales + pendientes; Revisión docente sin revisión, con cambios pedidos o desactualizada → «Volver a Horario»; Aprobación exige estado guardado `ready-for-approval` (regla existente del servidor) y antes de eso → «Volver a Revisión docente»; publicada → sin acción.
  - La invalidación de demanda no aborta la solicitud en curso; su resultado se descarta por token.
- T3 se divide: T3a migra el estado de `AcademicScheduling` a la Sesión sin cambio visual; T3b aplica las superposiciones de D6 y los colores fijos.
- T3a integrado: el Codex delegado no produjo cambios; el orquestador migró `AcademicScheduling` a `usePlanningSession()` (969 → 409 líneas) sin cambiar JSX, textos, clases ni ARIA. La Sesión añade `setDraftBusy`/`setDraftError`/`setDraftMessage` (los escribe `AcademicPublicationPanel`), `cancelBlockReview` limpia el error de ajuste, y `resume`/`fork` devuelven si reemplazaron el workspace (la vista cierra la lista de borradores solo entonces). Comprobado: build, lint, `test:data` 265/265 y `verify-academic-manual.mjs` exit 0 en un stack sintético aislado (backend 3317 sin `MATRICULA_SNAPSHOT_DIR`, borradores en directorio temporal); las capturas regeneradas no se versionaron.
- T3b (orquestador), slices 1–5 integrados (`c853adf`, `2b4b367`, `21d08f4`, `1f918a2`, `e753b2f`). Desviaciones registradas:
  - D4: los componentes de `components/ui/` siguen la estructura del registro oficial de shadcn (estilo «default»), sin `lucide-react` ni `tailwindcss-animate` (icono de cierre SVG propio, sin animaciones). Los colores semánticos de Tailwind se mapean a `--planning-*` con `@theme inline` y solo resuelven dentro de `.planning-root`. Las sobrescrituras de pantalla usan selector de clase duplicado porque las utilidades viven en `@layer utilities`.
  - Radix solo devuelve el foco a un `Trigger`; `useReturnFocus` registra el elemento activo en `onOpenAutoFocus` y lo restaura al cerrar.
  - D6: la ficha de docente o ambiente (Recursos) es un Sheet **modal**. El inspector de sección (Horario) es un Sheet **no modal** (sin overlay, sin robar foco, no se cierra al interactuar fuera) y el ajuste de bloque queda dentro de él, no en un Dialog: el operador necesita ver la tabla o la grilla mientras ajusta. Desde 1024 px el área de trabajo reserva el ancho del panel. El panel de cursos de Preparación conserva su inspector en línea (320 px; cajón fijo bajo 1024 px), sin cambios.
  - La confirmación de activación de oferta sigue con `window.confirm` (fuera de D6).
  - Se eliminó `setDraftBusy`: el envoltorio de ocupado del panel de publicación bloqueaba `fork` (regresión de T3a, cubierta por test).
  - Scripts desactualizados antes de T3b (fallan igual sin estos cambios): `verify-academic-persistence`, `-erp`, `-demand`, `-compose` y `-week` (asume scroll de ventana). Quedan para TT.
- E2E con Playwright MCP (2026-11-08, stack sintético propio; informe en `evidence/local/planning-e2e-2026-11-08/`): recorrido completo correcto. Hallazgos y destino:
  - E2E-1 desborde a 390 px por el panel de demanda → slice 6.
  - E2E-2 «Publicar» deshabilitado sin motivo hasta actualizar publicaciones → ticket UI.
  - E2E-3 mensaje «no es JSON válido» ante un 502 → ticket UI.
  - Escuela completa (56 cursos, 166 secciones): 1 sección programada por límite de tiempo. Causas medidas: 13 cursos imposibles incluso solos por capacidad de docentes habilitados (17 con capacidad menor a las secciones requeridas); la búsqueda en profundidad no puede dejar pendiente una unidad imposible y retrocede hasta el límite; 4,1 M rechazos por docente no habilitado en el bucle interno → ticket de backend G (verificación previa por curso con diagnóstico, unidades más restringidas primero, unidades imposibles quedan pendientes, índice de docentes habilitados). El reequilibrio del catálogo sintético queda como decisión del usuario.
- Por límite de cómputo del servidor, los workers (Codex `gpt-6-luna` high) ejecutan solo comprobaciones livianas (lint, specs puntuales, `test:data`, un build); la verificación en navegador la hace el orquestador tras integrar.
- Integración tickets E2E (2026-11-08):
  - UI (`2459ed4`, `f0b169c`, `d607141`): la demanda pasa a columnas «Demanda base» y «Sec. sugeridas» con resumen en Dialog (D6, slice 6); historial de publicaciones al abrir el panel y tras aprobar; vista previa de la versión aprobada automática; motivo visible (`aria-describedby`) cuando Aprobar o Publicar están deshabilitados; mensaje de servicio no disponible ante errores HTTP sin JSON; selector de tema legible.
  - Desbordes corregidos por el orquestador: el select «Criterio de asignación» a 390 px y la tabla de vista previa en Aprobación a 1280 px (scroll interno de la tarjeta).
  - Generador G (`71d2e68`, Codex gpt-6.1-sol): verificación previa por curso (`TEACHER_CAPACITY_SHORTFALL`, `NO_SCHEDULING_WINDOW`, `INSUFFICIENT_COURSE_TEACHER_LOAD`), índice de docentes habilitados, colocación de unidades más restringidas primero y continuar ante unidades sin candidato, con reparación acotada en dominios pequeños (≤16 unidades). Escuela completa sintética: 107/166 secciones en ~0,5–0,65 s, todas válidas. 170 tests en 8 specs.
  - Brecha de semántica (local-only, sin cambio de contrato): con más de 16 unidades la construcción parcial no hace retroceso completo; si quedan pendientes no probados, el estado es `impossible` con diagnóstico `PARTIAL_PROPOSAL` que declara que no se demostró imposibilidad. `search-limit` exige `limitReason` en el contrato. Decidir si se añade un estado o motivo «parcial» en una revisión de contrato.
  - Pendiente de decisión del usuario: reequilibrar habilitaciones y capacidad docente del catálogo sintético; mostrar los ~32 diagnósticos agrupados y desplegables en `PlanningStatusBar`.
  - Comprobación integrada liviana (stack sintético aislado): Dialog de demanda con nombre, Escape y retorno de foco; 390 px sin desborde en Preparación; Publicar se habilita solo tras aprobar; 1280 px sin desborde en Aprobación; sin errores de página.
- Slice 7 y avisos (2026-11-08): colores fijos de los cuatro CSS internos pasan a tokens (`6c5f589`, nuevo `--planning-focus-ring`); la barra de estado agrupa los avisos en el Dialog «Avisos de la generación» (`461ee4c`) y, con `PARTIAL_PROPOSAL`, rotula «Propuesta parcial» sin afirmar imposibilidad (`8dd9185`).
- T4 integrado (`bac1cd2`, `dc25c7c`, `056347d`; Codex gpt-6.1-sol tras dos intentos fallidos de gpt-6-luna): `&vista=resumen|cursos|recursos` en Preparación con `parsePlanningView` (inválido → resumen; otras etapas sin `vista`), vistas ocultas sin desmontar, `PlanningPreparationSummary` con conteos y la Acción principal; un único botón primario por etapa según `derivePlanningPrimaryAction`. Desviación: `record-response` solo tiene control primario («Dar conformidad») en el modo simulado Docente; en modo Escuela no hay control primario para ese estado. Comprobado: test:data 270/270, lint, build; recorrido liviano a 390 y 1280 px (cambio de vista y URL, atrás, `vista` inválida → Resumen, un solo primario, sin desborde, sin errores de página).
