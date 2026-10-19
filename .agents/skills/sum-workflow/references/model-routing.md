# Modelos, planes y despacho SUM

Leer al clasificar una solicitud. Configuración real en `.codex/config.toml` y
`.codex/agents/*.toml`; los nombres del modelo en un prompt no lo seleccionan.

## Clasificación y matriz

Complejidad: baja (cambio aislado), media (pantalla/varios criterios), alta
(interfaces o dependencias múltiples). Incertidumbre: baja (especificación suficiente),
media (brecha delimitable), alta (requisitos o diseño ambiguos). Impacto: bajo
(estilo reversible), medio (comportamiento local), alto (arquitectura, integridad,
concurrencia, seguridad). Registrar los tres e indicar evidencia de la clasificación.

| Condición / etapa | Agente | Modelo / esfuerzo | Plan |
| --- | --- | --- | --- |
| Exploración/extracción simple | `sum-explorer` si aporta valor; si trivial, principal | GPT-6 Luna Low | No nuevo |
| Investigación de comportamientos/interfaz con REA + Playwright | Principal coordina navegador secuencial; `sum-explorer` solo para extracción local independiente | GPT-6 Luna Medium en el principal; Low para extracción local | Reutilizar preguntas/evidencia; plan persistente si el alcance es complejo |
| Corrección trivial de estilo | Principal; sin subagente ni planner | GPT-6 Luna Medium | No |
| Implementación React o NestJS especificada, tarea repetible | `sum-implementer` | GPT-6 Luna High | Reutilizar especificación/plan |
| Ejecución compleja con decisiones ya fijadas | `sum-executor` | GPT-6 Luna High | Reutilizar/actualizar estado |
| Verificación rutinaria | Checks directos; `sum-verifier` solo si aporta valor | GPT-6 Luna Low | Registrar resultados |
| Planificación de funcionalidades solicitada; arquitectura/incertidumbre/impacto altos | Principal (sin delegar) | Modelo activo del principal | Reutilizar si suficiente; crear/completar solo brechas |
| Revisión crítica de decisiones/invariantes de alto impacto | Principal | Modelo activo del principal | Después de checks deterministas pertinentes |
| Investigación bloqueada | Principal registra bloqueo | Sin despacho | No replanificar para evadir |

Por preferencia explícita del usuario (2026-10-19), el principal realiza toda planificación, incluida la arquitectónica, sin agentes planificadores. Define plan persistente, contratos precisos, archivos exclusivos, dependencias y aceptación. No delegar planificación a un rol con otro nombre. La revisión de decisiones del plan corresponde también al principal.

Despachar implementación únicamente con handoff listo: `sum-implementer` o `sum-executor`, ambos GPT-6 Luna High. Backend carga `backend/AGENTS.md` y `backend/.agents/skills/sum-nestjs-implement/SKILL.md`; frontend carga `client/AGENTS.md` y `client/.agents/skills/sum-react-implement/SKILL.md`; el principal coordina integración con `sum-fullstack-verify`. Registrar selección efectiva sin fingir cambios del modelo principal.

Implementadores `sum-implementer` y `sum-executor`: ambos `gpt-6-luna` con `model_reasoning_effort = "high"`, por instrucción del solicitante del 2026-10-08. No despachar implementación en Medium. Si el rol expuesto por un harness conserva Medium de una configuración cargada previamente, usar el fallback autorizado con `agent_type="default"`, `model="gpt-6-luna"`, `reasoning_effort="high"`, `fork_turns="none"` y las instrucciones TOML/locales, o iniciar sesión nueva; no afirmar que un rol ya cargado cambió.

## Selección efectiva

Antes de configurar o usar una combinación nueva, verificar `model/list` del app-server
local y `supportedReasoningEfforts`; no sustituir modelos silenciosamente. Para
revalidar configuración y catálogo ejecutar `python3 .agents/skills/sum-workflow/scripts/validate_routing.py`.
El principal de nuevas sesiones del proyecto usa Luna Medium. Una sesión ya abierta
o con selección explícita puede seguir usando otro modelo: registrar el modelo real
y arrancar una sesión nueva para aplicar el valor del proyecto; no afirmar un cambio
del principal a partir de un prompt.

En Codex con agentes nativos, seleccionar el nombre de rol TOML con `agent_type`.
Si el harness solo expone `model` y `reasoning_effort`, pasar los valores del TOML
explícitamente y `fork_turns="none"`, junto con instrucciones del rol y handoff mínimo.
Un fork de historial completo hereda el modelo/esfuerzo del padre: no usarlo para
seleccionar otro modelo. Si el harness no permite ni roles ni overrides, registrar
limitación y usar una sesión compatible; no simular aplicación mediante texto.
Comprobar metadata real del hilo/configuración o `session_meta`/`turn_context`,
no pedir al agente que adivine qué modelo es. Distinguir catálogo, configuración
cargada, hilo creado y una inferencia real; son niveles de validación distintos.

## Plan persistente y reutilización

Para trabajo complejo, usar `docs/reverse-engineering/plans/<id>.md` o el plan vigente
en otra ruta; conservar IDs y tareas concluidas. Registrar revisión/huellas de entradas,
objetivo, restricciones y por tarea:

| Campo | Contenido |
| --- | --- |
| ID / descripción | Identificador estable y resultado concreto |
| Dependencias | IDs y artefactos de entrada |
| Complejidad / incertidumbre / impacto | Nivel y razón |
| Agente / modelo / esfuerzo | Rol y valores efectivos |
| Archivos exclusivos | Escrituras asignadas, sin intersección concurrente |
| Aceptación | Criterios observables y límites |
| Estado | pendiente, lista, en-curso, verificada, fallida, bloqueada o simulada |
| Verificación | Comando/criterio, resultado real, archivo de evidencia |
| Reparaciones / escalamiento | 0 o 1; motivo, origen/destino y decisión |

No delegar planificación. Un plan existente puede bastar para Tutoría: reutilizar su especificación y ejecutar, sin generar otro diseño.
Consultar registros previos antes de volver a planificar o repetir checks.

## Escalamiento y verificación

El principal replantea ante arquitectura, decisiones de alto impacto, requisitos ambiguos o fallos persistentes. Registrar disparador,
evidencia, checks/reparación ya realizados, pregunta concreta y responsable.
Un fallo de infraestructura o permiso se registra como bloqueo, sin delegar planificación.
Tras resolver la decisión, devolver las tareas definidas a Luna y registrar la razón;
no cambiar de modelo dentro de un hilo existente para fingir continuidad.

Build/lint y checks locales pertinentes preceden revisión de otro modelo. La revisión corresponde al principal. Para concurrencia de matrícula, fijar
primero el contrato de la réplica NestJS independiente: el proyecto autoriza backend propio, no inspección/reconstrucción de internos privados SUM. El principal
planifica y revisa invariantes como exclusión, capacidad, idempotencia, atomicidad,
recuperación y consistencia, con escenarios deterministas antes de revisión crítica.
La simulación propone esos checks y no los ejecuta ni declara aprobados.
