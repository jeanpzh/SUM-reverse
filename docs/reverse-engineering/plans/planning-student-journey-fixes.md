# Correcciones del recorrido planificación → alumno

Estado: implementación autorizada por el usuario, 2026-11-17. Base funcional: `6899e268efa3353447553240d544afb9663a4024` (árbol equivalente a main ba08183). Evidencia observada local: `evidence/local/planning-student-journey-2026-11-17/behavior.md`. No certifica comportamiento de producción ni autorización normativa.

## Límites compartidos

Preservar fidelidad visual y de interacción SUM en alumno; en `/local/programacion-academica` seguir `docs/design-direction.md` y su DESIGN-v2 vigente. Reutilizar interfaces y contratos existentes; sin rediseño, nueva navegación, autenticación, reglas académicas ni dependencias. Mantener exactitud de selección/simulación, guardar explícito, CAS, aprobación y publicación separadas, instantáneas aceptadas inmutables y aislamiento entre ofertas/alumnos. Solo fuentes sintéticas. Prohibido `datos-reales/`, snapshots, diagnóstico del operador, producción y secretos. Browser exclusivo del principal, T3 Browser.

## Tickets atómicos y dependencias

| ID | Resultado único / aceptación | Ownership inicial | Dependencia |
| --- | --- | --- | --- |
| A | Programación de alumno desde oferta operativa actual: secciones reducidas/ampliadas/subconjunto no causan LOCAL_FAILURE; horarios y cupos corresponden a oferta, legacy intacto | backend/src/local-profile-dashboard/scenario-reference-projection.ts, backend/test/operational-programming-projection.spec.ts | ninguna |
| B | Horas por T/P/L y patrón seleccionado correctas; dato ausente distinto de cero | client/src/screens/AcademicPreparationCourses.tsx, helper/test específico de horas en client/src/data/ | ninguna |
| C | Rechazo recuperable conserva selección para corregir/reintentar, sin reservar cupos; cambio de contexto invalida elecciones obsoletas | client/src/screens/RegularEnrollment.tsx, helper/test de rechazo en client/src/data/, scripts de aceptación de matrícula afectados | ninguna |
| D | Publicación → oferta → matrícula aceptada → programación/calendario conserva docente, ambiente y tipo por sesión; legacy sin metadatos sigue válido, runtime valida nuevos campos | contratos shared de matrícula, backend de oferta/reporte/proyección, adaptadores y detalle de sección/calendario cliente, pruebas de ese flujo; archivos exactos fijados antes del despacho | A integrado; contrato aditivo fijado por principal antes de despachar |
| E | Encabezado distingue versión guardada y ronda real; 82 respuestas no crean ronda 84 | client/src/data/planningSession.ts y .test.ts, PlanningScopeHeader si necesario | ninguna; reservar archivos fuera de B/C/D |
| F | Siguiente acción explícita al enviar/revisar/aprobar/publicar/activar, carga automática necesaria sin quitar CAS ni confirmaciones | AcademicPublicationPanel y selección de acción principal del planner, pruebas específicas | E si comparten planningSession.ts |
| G | Horario sintético usa reloj de contexto consistente y conserva fallback real para legacy | WeeklySchedule.tsx, LocalAcademicView.tsx, adaptador local y pruebas | D si comparten adaptadores |
| H | Detalle de revisión legible con nombres largos, foco y scroll accesibles en ancho estrecho; ajustes mínimos de composición existentes | panel de revisión y CSS/tests específicos | fijar archivos disjuntos de F |

No despachar tickets que compartan archivos o contrato sin resolver. Máximo tres workers simultáneos; un commit por ticket. El principal puede corregir problemas aislados de integración, registrándolos. Workers no delegan ni usan browser ni push/PR/merge.

## Validación y auditoría

Cada worker reproduce el síntoma con una prueba de regresión antes de corregir; comunica rojo/verde reales. Ejecuta build/lint de sus capas y suite relevante exclusivamente sintética. Una prueba que pasa por sí sola no acredita integración.

Principal integra secuencialmente y ejecuta checks afectados. Luego auditoría independiente de estándares y requisitos sobre base fija, seguida de E2E T3 Browser en stack propio: 56 cursos → consejero LLM real → simular/aplicar → guardar → revisión → aprobar/publicar/activar → SYN-SIS-A/B → programación consultable → rechazo recuperable → matrícula válida → horario con aulas y docentes por sesión. Repetir 390 px, teclado/foco y recuperación sin alterar publicación anterior. Si el solver no completa una corrida, registrar resultado y diagnosticar sin reducir demanda ni inventar autorizaciones.

Entrega: commits, pruebas reales, capturas comparables, aceptación por criterio y límites pendientes. Sin push o publicación externa nuevos salvo instrucción vigente explícita.

## Checkpoint de integración

- A integrado en `9fd285e`: programación desde oferta operativa. Principal ejecutó 21 tests (nuevo spec, local-profile-academic, enrollment-offer.integration), todos verdes.
- B integrado en `e38cd60`: principal ejecutó 5 regresiones de horas (incluye SSR real), todas verdes; las 5 pruebas normative compartidas también pasan con backend compilado.
- C integrado en `669dcf7`: principal ejecutó 6 regresiones de recuperación, todas verdes. Ajuste aislado del principal: textos de EnrollmentResultDialog, contrato histórico L-06 y expectativa browser AC-SUM-08 alineados con conservación autorizada; scripts browser solo comprobados por sintaxis hasta E2E final. Check SSR preexistente T044 esperaba h2/dl/local-only del reporte anterior: se actualizó a heading enfocable, totales y aviso local del reporte SUM actual; 10/10 SSR pasan sin cambiar UI del reporte.
- D se descompone en D1 (shared + backend, contrato aditivo MR-SESSION-DETAILS-1 fijado en `9d95d37`) y D2 (consumo frontend, pendiente de D1). Así no se despachan capas con contrato indefinido. E y H son independientes de D1; F espera E por ownership de planningSession, G espera D2 por ownership de adaptadores.
- Auditoría final e integración con navegador todavía pendientes. No considerar los checks de cada ticket aceptación global.
