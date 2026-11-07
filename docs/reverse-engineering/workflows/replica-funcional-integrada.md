# Réplica funcional integrada — registro

Fecha: 2026-10-19. Etapa solicitada: planificación detallada por el principal. Estado: plan propuesto; sin implementación ni verificaciones de aplicación nuevas.

## Decisiones

- Se incorpora la aclaración del usuario: `SITUACION-SUM.md` es guía referencial, no evidencia del SUM real. No se modificó el documento original ni se promovieron sus afirmaciones a hechos.
- Se conserva el alcance necesario en cuatro entregas: recorrido del alumno, operación/carga, gestión académica ampliada y portabilidad/integración autorizada.
- Se crea [RFI-1](../plans/replica-funcional-integrada.md), reutilizando contratos MR, dashboard, SIM-PUBLIC y SIM-LOAD y los planes existentes. Los porcentajes informales anteriores no se emplean como avance medido.
- Complejidad alta por integración de identidad, datos, reglas y persistencia; incertidumbre media en E1/E2 y alta en gestión/integración institucional; impacto alto por atomicidad/permisos y preservación de interfaces.
- Skills aplicadas: `sum-workflow`, `writing-plans`; criterios de diseño de `brainstorming` limitados al encargo de producir un plan. El plan no inicia código ni exige un ciclo de aprobación intermedio para terminar la documentación solicitada.
- Roles reales: principal autor/revisor; ningún agente planificador o implementador lanzado. Implementación futura prevista con Luna High y skills de cada carpeta; máximo dos workers disjuntos.

## Evidencia reutilizada

- Lectura estática de motor, tipos, fixtures, seed de carga, contratos, proyectores/proveedores y package.json de ambas capas. Ninguna lectura de datasets privados ni de runtimes del operador.
- Resultados históricos de `evidence/local/simulador-produccion/scenarios-400/verification.md`: integridad aprobada en doce casos, seis incumplimientos de latencia, soak completo pendiente. No se volvieron a ejecutar ni se presentan como aceptación de RFI-1.
- Los contratos existentes delimitan inmutabilidad de campaña abierta y las interfaces de sesión/almacenamiento. El plan conserva esas garantías y exige revisar versiones para ampliarlas.

## Etapas

| Etapa | Disposición | Resultado |
| --- | --- | --- |
| Revisión y planificación | Ejecutada | Plan RFI-1 con F0–F9, AC-01–AC-12, ownership, dependencias y límites. |
| Contratos nuevos de cada fase | Propuesta | F0 antes de código; gestión ampliada requiere contratos y diseño local propios. |
| Implementación | No iniciada | No se cambiaron backend, frontend, configuración ni fixtures. |
| Aceptación integrada / visual | No ejecutada | Escenarios previstos; sin nuevas afirmaciones de paridad o rendimiento. |
| Inspección SUM / Oracle | No realizada | No necesaria para planificar E1/E2; ramas externas condicionadas a contrato/entorno autorizado. |

## Validación documental

Pendiente de registrar el check de enlaces y diff al cerrar este turno. Reparaciones automáticas de implementación: 0; no aplican en esta etapa.

Siguiente etapa admisible: F0 del plan, seguida de handoff F1 cuando su contrato esté congelado. No reiniciar la planificación general.
