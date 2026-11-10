# Generación de escuela completa — 2026-11-08

Fuente: observación local con Playwright MCP y navegador integrado T3. Entorno exclusivamente sintético: NestJS independiente en 3412 y Vite en 5412, iniciados con entorno limpio. No se utilizaron snapshots privados. No acredita comportamiento de SUM.

## Alcance y resultados

- Periodo 2027-I, escuela Sistemas; título «Escuela completa · Sistemas 2027-I · sintético».
- Se seleccionaron los 56 cursos del catálogo; se verificó que todos figuran en la petición real POST `/propuestas`.
- Petición: 91 docentes, 49 ambientes, demanda agregada 7470; 166 secciones previstas.
- Se conservaron las demandas, capacidades y restricciones iniciales. Las excepciones de tarde y sábado permanecieron desactivadas.
- POST respondió HTTP 200 en 2448 ms: `status=search-limit`, `coverageComplete=false`.
- Resultado: 3 de 332 componentes programados, 1 de 166 secciones completa, 0 parciales, 165 sin asignar; 1 docente y 2 ambientes utilizados. Los recursos incluidos en la solicitud no equivalen a recursos efectivamente asignados.
- Diagnóstico `SEARCH_LIMIT`, `limitReason=time`: búsqueda inconclusa por límite temporal cooperativo. No demuestra imposibilidad.
- Se guardó mediante «Guardar propuesta»: HTTP 200, borrador `fc53d4a7-8edf-4b87-b251-f344eea5c2fd`, versión 1. Propuesta `7ddc9dc0-c59c-41c1-962e-49dbe6c54256`.
- En T3 se abrió «Mis propuestas», se reanudó ese borrador y se mostró la etapa Horario. La interfaz informa «Búsqueda inconclusa» y permite revisar las 166 secciones.

## Aceptación

| Criterio | Comprobación | Resultado |
| --- | --- | --- |
| Solicitar la escuela completa | Petición real incluye todos los cursos y los recursos del periodo | Cumplido |
| Conservar las restricciones | Política enviada sin excepciones adicionales | Cumplido |
| Obtener horario completo | Respuesta y pantalla Horario | No cumplido: límite temporal, 165 secciones sin asignar |
| Conservar y visualizar el intento | Guardado HTTP 200 y reanudación en T3 | Cumplido |

No se aprobaron ni publicaron resultados. No se modificó código de aplicación. El bloqueo observado para completar la escuela es el límite de búsqueda del generador; este escenario requiere diagnóstico de escalabilidad antes de afirmar generación completa.
