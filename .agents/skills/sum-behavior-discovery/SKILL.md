---
name: sum-behavior-discovery
description: Investigar comportamientos SUM mediante evidencia existente, REA y Playwright; registrar transiciones, ejecución JavaScript y contratos HTTP observables para una réplica React y NestJS. Usar ante gaps funcionales, no para implementar ni inspeccionar internos privados.
---

# SUM: investigar comportamiento

Leer `AGENTS.md` y la skill instalada `reverse-engineer-anything`. Clasificar primero la fuente: local/sintética, artefactos proporcionados o producción explícitamente autorizada. La solicitud de desarrollar NestJS autoriza el backend propio; no amplía acceso a SUM.

## Preguntas y herramientas

Reutilizar notas, especificaciones y `docs/reverse-engineering/contracts/observed-api.md`. Para cada control relevante preguntar qué estado requiere, qué cambia, qué solicitud genera, cómo procesa su resultado y qué conserva al recargar. Investigar solo eslabones ausentes. Una captura visual o un tipo TypeScript no responde estas preguntas por sí solo.

Consultar [selección de herramientas REA](references/rea-behavior.md) antes de una investigación runtime o de artefactos. Usar los esquemas reales del servidor; no copiar flags de documentación de otra versión. No ejecutar REA para analizar la arquitectura de un repositorio fuente completo.

El principal es el único dueño del navegador. REA y Playwright actúan secuencialmente sobre una sesión; no automatizar clicks mientras una observación REA está en curso. Para ventanas pasivas, esperar la señal de observación armada y delimitar la acción externa del operador. Para una reproducción automatizada local, preferir un escenario REA autocontenido o Playwright con captura propia.

En producción, observar solo lecturas autorizadas. No enviar formularios, matricular, alterar perfiles ni provocar errores mediante solicitudes fabricadas. Si una transición escribe estado, solicitar observación sanitizada al operador o reproducirla con fixtures locales, etiquetada `local-only`. Cuerpos de red solo en fixtures sintéticos o artefactos proporcionados ya sanitizados; para producción limitarse a metadatos/formas que el alcance permita y que no expongan datos sensibles.

## Salida por flujo

Completar `evidence/sum/<slug>/behavior.md` para referencias o `evidence/local/<slug>/behavior.md` para experimentos propios. No mezclar la autoridad de ambas fuentes. Registrar:

- Identidad del objetivo, fuente, fecha, ruta, viewport/scroll cuando afecten al resultado, estado inicial y límites de autorización.
- Escenarios con ID, precondiciones, entrada sintética o sanitizada, acción, secuencia de estados, condición de espera, resultado visible y efecto persistente comprobado o desconocido.
- Relación acción → handler/módulo → solicitud/transacción → respuesta → transformación → estado final. Citar Evidence IDs, archivo/rango/hash o paso/transacción cuando existan; dejar eslabones desconocidos explícitos.
- Separación `observed`, `inferred`, `unverified`, `local-only` por afirmación. Un módulo alcanzable estáticamente no prueba ejecución; un endpoint visible no revela reglas ni tablas privadas.
- Matriz de cobertura: éxito, vacío, entrada inválida, fallo, recarga, permisos, repetición y concurrencia solo cuando pertinentes. Marcar `no observado` o `no aplica` con razón; no fabricar escenarios SUM para llenar la tabla.

Conservar solo material sanitizado mínimo. La redacción automática de REA no garantiza anonimización de nombres, URLs, cuerpos, scripts ni capturas. No exportar bundles completos con material sensible.

Actualizar el inventario y los contratos solo con evidencia nueva suficiente. Entregar a `sum-evidence-to-spec` los escenarios, contratos observables, decisiones locales propuestas y gaps. No declarar fidelidad funcional sin una comparación válida ni detener trabajo local independiente por falta de acceso a producción.
