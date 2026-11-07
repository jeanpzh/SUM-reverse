# Clasificación, planes y despacho SUM

Roles, modelos, flujo y paralelismo están definidos únicamente en el §5 de
[AGENTS.md](../../../../AGENTS.md). Esta referencia solo añade cómo clasificar una
solicitud y cómo registrar el plan; no repite ni modifica la tabla de roles.

## Clasificación

Complejidad: baja (cambio aislado), media (pantalla/varios criterios), alta
(interfaces o dependencias múltiples). Incertidumbre: baja (especificación suficiente),
media (brecha delimitable), alta (requisitos o diseño ambiguos). Impacto: bajo
(estilo reversible), medio (comportamiento local), alto (arquitectura, integridad,
concurrencia, seguridad). Registrar los tres con la evidencia de la clasificación.

| Clasificación | Disposición (§5) |
| --- | --- |
| Baja / trivial | Orquestador directo, sin workers |
| Media, especificación suficiente | Orquestador planifica en línea; un worker; orquestador integra |
| Alta o multicapa | Planner → workers en worktrees → Integrator → checks → Auditor |
| Incertidumbre alta | Antes de planificar, pedir al usuario `grill-with-docs` / `to-spec` |
| Investigación con REA/Playwright | Orquestador; navegador secuencial; nunca dos agentes en la misma sesión |

## Selección efectiva

Al iniciar un hilo, comprobar `orchestrator_capabilities`. Pasar proveedor, modelo y
opciones explícitamente en cada `delegate_task`; un nombre de modelo en el texto del
prompt no lo selecciona. Si el modelo preferido no está disponible, usar la alternativa
del §5 y registrar la sustitución. Registrar el modelo real del hilo creado, no el
que se pidió.

## Plan persistente y reutilización

Para trabajo complejo, usar `docs/reverse-engineering/plans/<id>.md` o el plan vigente
en otra ruta; conservar IDs y tareas concluidas. Registrar revisión/huellas de entradas,
objetivo, restricciones y por tarea:

| Campo | Contenido |
| --- | --- |
| ID / descripción | Identificador estable y resultado concreto |
| Dependencias | IDs y artefactos de entrada |
| Complejidad / incertidumbre / impacto | Nivel y razón |
| Rol / proveedor / modelo / esfuerzo | Valores efectivos |
| Archivos exclusivos | Escrituras asignadas, sin intersección concurrente |
| Aceptación | Criterios observables y límites |
| Estado | pendiente, lista, en-curso, verificada, fallida, bloqueada o simulada |
| Verificación | Comando/criterio, resultado real, archivo de evidencia |
| Reparaciones / escalamiento | 0 o 1; motivo, origen/destino y decisión |

Consultar registros previos antes de volver a planificar o repetir checks.

## Escalamiento y verificación

El orquestador replantea ante arquitectura, decisiones de alto impacto, requisitos
ambiguos o fallos persistentes. Registrar disparador, evidencia, checks/reparación ya
realizados, pregunta concreta y responsable. Un fallo de infraestructura o permiso se
registra como bloqueo. No cambiar de modelo dentro de un hilo existente para fingir
continuidad.

Build/lint y checks locales pertinentes preceden la revisión del Auditor. Para
concurrencia de matrícula, fijar primero el contrato de la réplica NestJS
independiente: el proyecto autoriza backend propio, no inspección/reconstrucción de
internos privados SUM. Planner y Auditor cubren invariantes como exclusión,
capacidad, idempotencia, atomicidad, recuperación y consistencia, con escenarios
deterministas antes de la revisión crítica. La simulación propone esos checks y no
los ejecuta ni declara aprobados.
