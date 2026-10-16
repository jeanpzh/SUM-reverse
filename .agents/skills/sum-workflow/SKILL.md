---
name: sum-workflow
description: Orquestar solicitudes SUM con investigación REA y Playwright, reutilización de evidencia y planes, selección dinámica de agentes y modelos, especificación de comportamientos y contratos, implementación React y backend propio NestJS y verificación integrada. Usar para el flujo completo o su simulación.
---

# SUM: flujo por funcionalidad

## Responsabilidad y límites

Actuar como orquestador económico: identificar intención y alcance, consultar artefactos pertinentes, clasificar complejidad/incertidumbre/impacto, elegir etapa y modelo y registrar decisiones. Aplicar [enrutamiento dinámico](references/model-routing.md) antes de delegar. Resolver tareas triviales directamente; para nuevas funcionalidades, un planificador Sol High define primero el plan, contrato y aceptación y después Luna High implementa. Reutilizar un plan suficiente de esa etapa cuando exista. Las etapas dependientes son secuenciales.

## Entradas y salidas

- Entrada requerida: nombre de funcionalidad. Entradas opcionales: alcance/estado, etapa final y modo `ejecutar` o `simular`. Con solo el nombre, evaluar el alcance observado y avanzar hasta aceptación local si está autorizado; no ampliar a estados desconocidos.
- Salidas: registro de decisiones y estado final en `docs/reverse-engineering/workflows/<slug>.md`, con referencias a artefactos reutilizados y a resultados de cada etapa. En simulación, solo registrar gates y acciones propuestas; no modificar especificaciones, frontend o capturas ni ejecutar pruebas/nueva inspección.

## Enrutamiento secuencial

1. Leer [AGENTS.md](../../../AGENTS.md) y restricciones vigentes. Localizar la funcionalidad en [cobertura](../../../docs/reverse-engineering/coverage-matrix.md) y [rutas](../../../docs/frontend/routes.md); resolver su especificación y carpeta de evidencia. Usar el nombre de archivo de la especificación sin extensión como slug del registro; conservar por separado el slug de evidencia si difiere (por ejemplo, `inicio` → `home`). Si no existe especificación, resolver un slug único desde la ruta documentada. Leer solo sus entradas en [inventario](../../../docs/reverse-engineering/existing-evidence.md), [incertidumbres](../../../docs/reverse-engineering/unknowns.md), notas y registros locales pertinentes. No cargar las 16 especificaciones.
2. Fijar objetivo de aceptación a partir del encargo y los criterios obligatorios de la especificación; antes del handoff deben estar explícitos los criterios frontend, comportamiento, API propia, persistencia e integración aplicables y si incluye fidelidad visual. No exigir backend para un cambio exclusivamente visual. Una petición de fidelidad visual la hace obligatoria. Si «aceptación local» deja esa decisión ambigua y cambia el gate, aclararla antes de avanzar etapas dependientes; se puede completar documentación independiente. Evaluar suficiencia para el alcance pedido: fuentes verificadas, sanitizadas y correspondientes a estado/viewport. Separar evidencia SUM, decisiones de la réplica y resultados locales. La confianza de cobertura orienta, pero los archivos y límites reales deciden. Si hay un requisito de fidelidad obligatorio sin respaldo y nueva evidencia está bloqueada, registrar `bloqueado` y detener solo sus dependencias. Para la API propia, una decisión local explícita permite implementar su contrato sin certificar SUM. No sustituir evidencia de referencia con un candidato local.
3. Inventariar especificación, implementación y verificación existentes. Comprobar su correspondencia con criterios actuales y entradas/revisión/huellas; un artefacto no se vuelve inválido por carecer de un formato nuevo equivalente. Reutilizar lo vigente, completar brechas puntuales y omitir etapas ya satisfechas. Un diagnóstico estático puede evitar cambios de código, pero no acredita aceptación funcional/visual ni sustituye el gate de verificación. No regenerar resultados solo por ejecutar el flujo.
4. Para una nueva funcionalidad/ampliación, despachar primero `sum-planner` Sol High para completar plan persistente, contrato preciso, tareas disjuntas y criterios; reutilizar el plan ya listo de esa etapa. Registrar el rol real y referencias antes de despachar Luna High. Elegir la primera etapa necesaria de la tabla y cargar únicamente su `SKILL.md`. En ejecución, aplicar el gate de salida antes de avanzar. En simulación, describir la transición condicional; no presentar un gate previsto como aprobado.

| Etapa | Entrada necesaria | Skill | Salida que habilita continuar |
| --- | --- | --- | --- |
| Investigar comportamiento | Investigación solicitada o gap funcional; fuente y acciones delimitadas | [sum-behavior-discovery](../sum-behavior-discovery/SKILL.md), con REA instalado y Playwright | Escenarios, transiciones, trazas de acción/resultado y red en alcance, límites e incertidumbres |
| Investigar apariencia | Gap visual y fuente autorizada | `sum-frontend-discovery` para Playwright | Evidencia visual sanitizada y condiciones comparables |
| Especificar | Evidencia suficiente para fidelidad solicitada o requisitos/decisiones locales explícitos para la réplica; documento ausente o incompleto | [sum-evidence-to-spec](../sum-evidence-to-spec/SKILL.md) | Escenarios y contrato local cuando corresponda; criterios trazables e incertidumbres delimitadas |
| Implementar frontend | Especificación lista y contrato API propio cuando corresponda | [sum-react-implement](../../../client/.agents/skills/sum-react-implement/SKILL.md) | React y adaptadores vinculados a criterios |
| Implementar backend | Contrato local listo, reglas/efectos explícitos y autorización de código | [sum-nestjs-implement](../../../backend/.agents/skills/sum-nestjs-implement/SKILL.md) | NestJS independiente en `backend/`, DTOs, servicios y persistencia definida |
| Verificar integración | Implementación frontend/backend identificable, contrato y escenarios locales | [sum-fullstack-verify](../sum-fullstack-verify/SKILL.md) | Resultados por criterio HTTP, comportamiento, efectos e integración |
| Verificar frontend/visual | Especificación e implementación identificables; entorno local seguro y referencias para criterios visuales | [sum-react-verify](../../../client/.agents/skills/sum-react-verify/SKILL.md) | Resultados por criterio y dictamen funcional/visual con límites |

5. Ejecutar comprobaciones deterministas antes de solicitar revisión por otro modelo. Ante discrepancias verificadas, permitir como máximo un ciclo automático de reparación por tarea y registrar el contador; volver a especificación solo ante evidencia nueva o brecha documental. Si persiste, diagnosticar y decidir entre completar información, bloquear una dependencia o escalar a Sol por replanteamiento justificado. No reintentar otra vez automáticamente ni reiniciar el contador cambiando de agente o modelo. Repetir solo comprobaciones afectadas y las requeridas por cambios nuevos.
6. Registrar etapas ejecutadas, omitidas y propuestas, razones de reutilización, gates y estado final usando el [contrato de registro](references/run-record.md). La aceptación exige todos los criterios obligatorios del alcance; una simulación termina `simulado`, con disposición prevista separada.

## Investigación, seguridad y delegación

REA y Playwright son las herramientas previstas para el reverse engineering solicitado. Reutilizar evidencia y sesiones vigentes; ante una investigación explícita, fijar qué preguntas quedan por observar o corroborar sin repetir llamadas idénticas. Si solo se pide implementar y la evidencia es suficiente, omitir nueva inspección. Ante una brecha, identificar la mínima observación necesaria y comprobar el entorno y la autorización antes de contactar el objetivo.

Usar [sum-behavior-discovery](../sum-behavior-discovery/SKILL.md) y la Skill instalada `reverse-engineer-anything` para analizar handlers, semántica JavaScript, ejecución y red observable, o un artefacto suministrado; usar `sum-frontend-discovery` para navegación, DOM, medidas y capturas mediante Playwright. Localizar ambas instalaciones existentes; no copiarlas ni reinstalarlas. REA no habilita inspección de internos del backend SUM. El backend propio NestJS implementa contratos observables suficientes o decisiones locales explícitas. No recuperar esquemas privados ni atribuir reglas inferidas al SUM. No hacer pruebas de carga ni ejecutar acciones que cambien SUM.

El principal coordina la sesión de navegador y la adquisición de evidencia secuencialmente; no permitir que dos agentes naveguen o cambien simultáneamente el estado de una misma sesión/target, incluso con archivos de salida diferentes. Separar observaciones, inferencias y desconocidos. Sanitizar antes de guardar o compartir y registrar ruta, viewport, scroll, estado y referencias de evidencia. Playwright verifica después la réplica local con la referencia comparable. Aplicar los modelos ya configurados automáticamente; el usuario no necesita repetirlos en su encargo.

Usar los agentes TOML instalados, sin crear un framework adicional. Máximo dos subagentes concurrentes en todo el flujo; los trabajadores no delegan. Solo paralelizar tareas con dependencias satisfechas y archivos disjuntos; asignar propiedad de archivos antes del lanzamiento, incluyendo documentos y registros. Liberar/cerrar agentes terminados antes de ocupar nuevas plazas. Entregar ID, rutas y secciones pertinentes, criterios, archivos exclusivos y resultados previos; no reenviar documentación completa. Las etapas que consumen la salida anterior permanecen secuenciales.

REA y Playwright pueden inspeccionar producción cuando el solicitante declara explícitamente que el entorno/cuenta está autorizado y delimita pantallas y acciones. Según `AGENTS.md`, esa declaración basta en este repositorio; no exigir un documento institucional adicional. Si no se afirma que el objetivo está autorizado o el alcance es ambiguo, pausar la inspección y pedir el dato faltante. Mantener las restricciones contra inspección del backend privado, acceso ajeno y mutaciones SUM incluso con autorización de lectura.

## Skills por carpeta

La raíz usa `sum-workflow`, `sum-behavior-discovery`, `sum-evidence-to-spec` y `sum-fullstack-verify` para coordinar. `client/AGENTS.md` selecciona `sum-react-implement`/`sum-react-verify` de `client/.agents/skills/`; `backend/AGENTS.md` selecciona `sum-nestjs-implement`/`sum-nestjs-verify` de `backend/.agents/skills/`. Entregar esas rutas en cada handoff. Las skills raíz de implementación anteriores son adaptadores de compatibilidad, no políticas distintas. Verificar backend HTTP con su skill local antes de integración completa.

## Dependencias frontend/backend

Para alcance integrado, completar primero escenarios y contrato local en `contracts/local-api/<slug>.md` mediante `sum-evidence-to-spec`. Asignar `client/` y `backend/` a trabajadores distintos solo si el contrato compartido está fijado y nadie lo edita en paralelo. Ambos usan `sum-implementer` o `sum-executor` con Luna High según complejidad; cargar primero el AGENTS.md y la skill propia de la carpeta asignada; el principal verifica integración una vez disponibles ambos. Un mock puede desbloquear desarrollo, pero no acredita la integración contra NestJS.

## Éxito y parada

Éxito del orquestador: decisiones trazables, reutilización justificada y estado final honesto, aunque sea bloqueado. Éxito de la funcionalidad: aceptación de los criterios obligatorios del alcance solicitado.

Parar etapas dependientes ante restricciones de seguridad, evidencia obligatoria insuficiente, autorización incompatible, conflicto de trabajo ajeno o infraestructura local imprescindible no disponible. Registrar la condición de desbloqueo sin intentar evadirla. No reducir el alcance solicitado silenciosamente; una alternativa parcial queda como propuesta hasta que sea aceptada.
