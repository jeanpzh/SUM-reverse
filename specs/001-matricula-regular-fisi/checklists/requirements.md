# Specification Quality Checklist: Matrícula regular virtual FISI-UNMSM 2026-II

**Purpose**: Revisar completitud, trazabilidad y preparación de la especificación antes de planificar.

**Created**: 2026-10-11

**Feature**: [spec.md](../spec.md)

**Note**: Checklist de calidad generado y revisado durante `$speckit-specify` sobre la
plantilla activa resuelta. No certifica implementación ni pruebas de matrícula.

**Review Ownership**: La revisión de requisitos pertenece al revisor; los workers de
implementación no deben completar casillas por su cuenta.

**Marker Semantics**: `[x]` significa criterio de calidad documental satisfecho;
`[ ]` significa pendiente de aclaración/evidencia, no una prueba de aplicación fallida.

## Content Quality

- [x] CHK001 No implementation details (languages, frameworks, APIs).
- [x] CHK002 Focused on user value and business needs.
- [x] CHK003 Written for non-technical stakeholders.
- [x] CHK004 All mandatory sections completed.

## Requirement Completeness

- [x] CHK005 No unresolved NEEDS CLARIFICATION markers remain.
- [ ] CHK006 Requirements are testable and unambiguous for the complete requested process.
- [x] CHK007 Success criteria are measurable.
- [x] CHK008 Success criteria are technology-agnostic.
- [ ] CHK009 All acceptance scenarios are defined for the complete requested process.
- [x] CHK010 Edge cases are identified.
- [x] CHK011 Scope is clearly bounded.
- [x] CHK012 Dependencies and assumptions identified.

## Feature Readiness

- [ ] CHK013 All functional requirements have complete acceptance criteria.
- [x] CHK014 User scenarios cover primary flows.
- [x] CHK015 Feature has measurable outcomes defined in Success Criteria.
- [x] CHK016 No implementation details leak into specification.

## Notes

Revisión documental inicial: **13/16 criterios satisfechos, 3 pendientes**.
Los resultados indican calidad de especificación; ningún escenario fue ejecutado.

- CHK005: no hay marcadores que pidan elegir un comportamiento inventado. Las faltas de
  evidencia están registradas como G-01–G-03 con preguntas Q del dossier; esta casilla no
  afirma que todas las incertidumbres hayan sido resueltas.
- CHK006: FR-005 dice «según la habilitación aplicable al estudiante» y FR-006 conserva
  «la relación exacta entre prematrícula, oferta y filtrado queda pendiente».
  G-01 requiere PP usado, fronteras, continuidad y significado de «libre». G-02/G-03
  condicionan validaciones y resultado. No convertir estas brechas en valores por defecto.
- CHK009: AC-05 requiere «habilitación virtual resuelta» y AC-17 parte de «un resultado
  sintético de aceptación con cursos aceptados conocidos». Sirven para describir resultados,
  pero no resuelven entrada, eventos intermedios, navegación y efectos completos.
  Faltan casos cerrados de límites, múltiples errores, interrupción y registro parcial.
- CHK013: FR-005/FR-006, aplicación conductual de FR-008/FR-009, y resultados completos de
  FR-010–FR-013 tienen aceptación condicionada por G-01–G-03. Sus criterios definitivos
  requieren evidencia revisable o decisiones locales expresas sin alegar paridad SUM.
- CHK015 evalúa que los objetivos SC-001–SC-007 estén definidos y sean medibles;
  no afirma que la funcionalidad ya los cumpla.
- No se añadieron mensajes, orden de validación, reserva/descuento de cupos ni transacciones.
  Se revisaron fuentes normativas, testimonio y preguntas del dossier, sin nueva inspección.
- Los tres pendientes reflejan límites de evidencia solicitados por el usuario; una edición
  adicional sin nuevas fuentes no los resolvería. Se conservaron en vez de inventar respuestas.
- Siguiente etapa: `$speckit-clarify`. El alcance documental/normativo puede alimentar
  planificación acotada; la planificación completa y la implementación de dependencias
  pendientes no están habilitadas por esta revisión.
- Las preguntas de reserva, retiro, extemporánea y otras modalidades excluidas no se
  incorporan como requisitos del recorrido virtual regular.
