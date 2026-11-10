# Reparación de calidad documental

Ámbito autorizado: chat y respuestas normativas del consejero de `/local/programacion-academica`; preservar `docs/design-direction.md`, pantallas del alumno, selector, guardado, aprobación y publicación. Reutilizar componentes AI Elements y contrato PA-NORMATIVE-1. Diagnóstico observado: `evidence/local/planning-answer-quality-2026-11-10/quality-review.md`, corpus público revisado, no vigencia individual confirmada.

Hipótesis verificables: (1) ranking léxico/semántico sin control temático pierde paráfrasis y admite fuentes salariales irrelevantes; (2) renderizar solo status=supported oculta contenido documental recuperado; (3) omitir antecedentes hace indistinguibles dos seguimientos distintos. Pruebas previas: 12/12 respuestas Bedrock anteriores fallan los nuevos criterios; SSR oculta la explicación; contrato rechaza un antecedente acotado.

Extensión compatible: request optional `previousQuestion` (pregunta de usuario anterior, 1–1000 caracteres tras trim). No es memoria del modelo ni filtro de aplicabilidad; no se devuelve dentro de context. El motor solo la usa en seguimientos anafóricos explícitos. Los clientes anteriores siguen válidos. Cambiar filtros borra el antecedente; reintentar conserva el original. Respuesta optional `nextStep` (1–500 caracteres), validada en las fronteras existentes. Desplegar motor y backend/cliente juntos para habilitar los campos nuevos. Sin sustitución de DTOs ni contratos paralelos.

| Criterio | Prueba | Resultado esperado |
| --- | --- | --- |
| Paráfrasis de exceso de carga | caso catorce horas y variantes | fuente de límite pertinente; no asignación automática |
| Contenido accesible | siete preguntas documentales en UI real | hecho específico inicialmente visible; fuentes completas desplegables |
| Incertidumbre específica | hora, contratado, régimen desconocido | pedir acuerdo/régimen/norma pertinente sin límite universal |
| Fuera de corpus | sueldo con búsqueda léxica y semántica | abstención, cero citas de asignación como respuesta salarial |
| Seguimiento | misma pregunta tras dos antecedentes | fuentes distintas y correspondientes; sin relato inventado |
| Límites preservados | fecha, régimen, conflicto, generación | no promover estado supported por un resumen ni modificar vigencias |
| Regresión funcional | E2E asistente y tests de datos/componentes | retry/cancelación/validación preservados |

Los hechos resumidos deben proceder de extractos canónicos, no de respuestas precargadas por pregunta. La generación normativa permanece restringida a evidencia supported. Esta reparación no intenta atribuir al LLM la utilidad del diagnóstico determinista/CP-SAT ni aumentar sus llamadas sin evidencia de beneficio. Validación final y límites en evidencia posterior; no confundir criterios de una muestra con exactitud general.
