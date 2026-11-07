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
