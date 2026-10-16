# Simulación A–E — 2026-10-08

Modo `simular`: se seleccionan etapas y roles, sin ejecutar implementaciones,
pruebas/build/lint del cliente, capturas, REA o inspecciones Playwright. Estado final
de cada caso: `simulado`; la disposición prevista se indica por separado.
Reparaciones: 0; ninguna tarea asigna escrituras concurrentes.

| Caso | Complejidad / incertidumbre / impacto | Enrutamiento previsto | Plan | Verificación propuesta | Resultado |
| --- | --- | --- | --- | --- | --- |
| A: «Corrige el padding del sidebar» | baja/baja/bajo, si la medida objetivo está respaldada | Principal Luna Medium; sin delegación trivial | Sin planner | Comparar medida con evidencia y viewport; build/lint tras edición | Cumple ruta Luna sin planner; pendiente fijar valor si no consta |
| B: «Implementa Tutoría desde su especificación» | media/media/medio para estado vacío: faltan criterios identificables | Luna completa brecha documental delimitada; Luna Medium `sum-implementer`, después checks; Luna Low `sum-verifier` si aporta valor | Reutilizar especificación y registro; sin planner nuevo | Criterios del estado vacío, build/lint y comparación sanitizada al mismo viewport | Cumple implementer + verificación tras gate documental; fidelidad integral condicionada a metadatos comparables |
| C: «Rediseña la arquitectura de estado del frontend» | alta/alta/alto | Sol High `sum-planner`; tareas derivadas definidas a Luna Medium/High | Buscar plan suficiente primero; crear/completar por nueva decisión arquitectónica | Interfaces/invariantes, escenarios deterministas y después build/lint de tareas futuras; revisión Sol solo de decisiones críticas | Cumple Sol para diseño y Luna para ejecución |
| D: «Diseña el control de concurrencia de matrícula» | alta/alta/alto | Sol High `sum-planner`; escenarios deterministas antes de Sol High `sum-reviewer` de invariantes | Plan conceptual persistente; aclarar entorno/supuestos, no backend SUM autorizado | Exclusión mutua, capacidad, idempotencia, atomicidad, recuperación, consistencia y escenarios de intercalado | Cumple Sol High y revisión de invariantes; sin implementar matrícula ni afirmar garantías de producción |
| E: «Investiga Inicio con REA» | baja/alta/alto por fuente faltante y seguridad | Principal registra bloqueo; ningún agente/herramienta de producción | Reutilizar bloqueo vigente; sin replanteamiento evasivo | Comprobar restricciones y fuentes locales existentes | Bloqueado: falta autorización institucional específica y referencia segura; cero acceso a producción |

## Artefactos y gates reutilizados

A: `evidence/sum/home/measurements.md`, `docs/frontend/components.md` y referencias
del shell pertinentes. El pedido no fija una medida: resolver con evidencia existente
o aclarar la diferencia antes de editar, sin escalar automáticamente a Sol.

B: `docs/reverse-engineering/screens/tutoria.md`,
`docs/reverse-engineering/workflows/tutoria.md`,
`evidence/sum/tutoria/{structure,interactions,measurements}.md` y
`evidence/local/tutoria/verification.md`. La especificación declara estado vacío y
no respalda filas, acciones pobladas ni contratos backend. Los resultados previos son
históricos hasta comprobar su correspondencia con las entradas actuales. El implementer
puede devolver diagnóstico de cumplimiento si no quedan diferencias; no se fuerza edición.
El registro vigente identifica una brecha de criterios verificables, así que primero
proponer `sum-evidence-to-spec` incremental con Luna Medium, sin nuevo planner Sol.
La referencia es un recorte sanitizado; regiones enmascaradas y scroll no documentado
limitan la aceptación visual. No declarar la especificación lista ni la fidelidad
aprobada mientras esos gates sigan pendientes. No se completa esa ficha en esta simulación.

C/D: no existe aquí un plan suficiente de arquitectura de estado o concurrencia.
El plan `docs/superpowers/plans/2026-10-07-raw-types-api.md` trata otro alcance y no
se considera reutilizable para esas decisiones. Las tareas futuras deben conservar ID,
dependencias, clasificación, modelo/esfuerzo, archivos exclusivos, aceptación, estado,
resultado de checks y razón de escalamiento. En C, dividir por interfaces y dependencias;
no paralelizar dos tareas sobre el almacén o su configuración compartida. En D, no
inferir transacciones o garantías de backend a partir de frontend observable.

E: `docs/reverse-engineering/workflows/inicio.md`,
`docs/reverse-engineering/screens/inicio.md` y `evidence/sum/home/`. La referencia
histórica no comparable ni sanitizada no se recupera; el diseño local no la sustituye.
Desbloqueo: evidencia sanitizada preparada por el operador o entorno aprobado, y
autorización institucional específica antes de cualquier inspección de producción,
respetando además las prohibiciones existentes. Cambiar de herramienta/modelo no levanta el gate.

## Fallos y recursos

Un fallo rutinario permite una reparación automática y nueva comprobación afectada.
Si persiste, diagnosticar: arquitectura/requisitos/invariantes → Sol con razón registrada;
infraestructura/evidencia/permiso → bloqueo o información faltante. Sol no sustituye
checks deterministas ni revisa universalmente A/B. Máximo dos subagentes en ejecución,
propiedad de archivos disjunta y handoff por rutas/secciones, no documentación completa.
