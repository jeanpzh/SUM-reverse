# PA-NORMATIVE-1 — verificación integrada

Fecha: 2026-11-08. Fuente observada local; no acredita implementación de SUM ni autorizaciones docentes. Referencia de aceptación: `plans/academic-normative-rag.md`.

## Entorno

React/Vite 5414 → NestJS 3414 → Python 3424, iniciados con entorno limpio y fixtures independientes sintéticos. Corpus limitado a extractos revisados de dos PDFs públicos oficiales de la RR 001380-2026; no documentos individuales ni snapshots privados. Modelo multilingüe preparado explícitamente en `/tmp/pa-normative-model`, consultas con `HF_HUB_OFFLINE=1`. Generación extractiva determinista, sin proveedor LLM real. La URL Tailscale Serve existente en puerto 10007 responde HTTP 200 y apunta a este entorno.

## Criterios y resultados reales

| Criterio | Prueba | Resultado |
| --- | --- | --- |
| Flujo completo y semántica real | Formulario UI pregunta por máximo ordinario TC/DE, FISI 2027-I, fecha 2026-11-08, ordinario | HTTP 200 en 3099 ms; `hybrid`, `not-determined`; artículo 7, final tercera, complementarias primera/segunda y artículo 5 |
| Excepciones relacionadas | Misma respuesta | Incluye referencias al procedimiento y a condiciones especiales; las citas no autorizan cambios |
| Hora académica FISI no inventada | Pregunta por duración, fecha 2027-03-01 | HTTP 200, `hybrid`, artículo 8; `not-determined`, falta acuerdo FISI y advertencia de vigencia futura |
| Contratados separados de ordinarios | Pregunta de carga para contratado | HTTP 200, `hybrid`, artículo 1 únicamente, sin artículo 7; abstención y gap explícito |
| Exclusión temporal | Pregunta histórica al 2025-11-08 | HTTP 200, cero citas; no usa reglamento publicado en 2026 |
| No respuesta obsoleta | Modificar pregunta/filtros tras consultar | Se descarta respuesta previa antes de mostrar la siguiente |
| Consulta obligatoria dentro del consejero | Reanudar borrador sintético y Consultar consejero | HTTP 200, `normativeContext` real `hybrid`, tipo docente `unknown`, abstención, sin perder el impacto CP-SAT |
| Validación de entrada | Fecha inexistente, tipo docente TC en campo equivocado, pregunta vacía, URL extra, otra facultad | Cinco respuestas HTTP 400 |
| Fuentes seguras | Links renderizados | Solo PDF oficial allowlisted, `noopener noreferrer`, `no-referrer`; imágenes/HTML/enlaces de prosa arbitrarios bloqueados por tests |
| Móvil | Viewport 390 × 844 | Diálogo 358 px, límites 16–374; scrollWidth=clientWidth=356 |
| Teclado y foco | Escape desde consulta | Cierra diálogo, foco vuelve a Consultar consejero |
| T3 y acceso remoto | Reanudar mismo borrador en navegador integrado y consultar fuentes | Formulario y resultado dentro del consejero; Serve 10007 accesible en tailnet |

El borrador de horario existente se conserva; las consultas normativas no cambian carga, disponibilidad, política ni asignaciones. Los escenarios sintéticos de ampliación quedan excluidos por defecto tanto en servidor como cliente y requieren autorización externa. El RAG no crea esas autorizaciones ni cambia topes del solver.

## Checks y revisión

- Cliente worker: build/lint aprobados, 295 pruebas de datos y 5 de componentes/seguridad.
- Backend worker: build/lint aprobados (cuatro advertencias previas), 14 checks Node, 3 tests NestJS, 37 tests Python normativos/consejero; 6 tests de solver separados. Modelo real preparado y smoke offline aprobado; respuesta real validada con contrato JS.
- Principal: aceptación real anterior, `git diff --check` aprobado; corrigió un mensaje que afirmaba falta de modelo cuando en realidad no había fragmentos aplicables. Regresión y suite normativa posterior: 20/20 aprobadas. Reconsulta HTTP confirma cero citas y mensaje correcto para 2025.
- Revisión independiente Codex: identificó dos fallos materiales, corregidos por el principal como se detalla abajo.

## Límites explícitos

Corpus parcial, no registro normativo completo. Fechas de entrada en vigor exacta no acreditadas en los extractos; las respuestas permanecen `not-determined` aunque recuperen texto relevante. No se confirma vigencia 2027, duración de hora académica FISI ni condiciones individuales. Conflictos se identifican mediante metadatos documentales revisados, no por el ranking; el escenario de conflicto usa fixtures sintéticos. Se comprobó la recuperación híbrida real; la respuesta sigue siendo extractiva, no una llamada LLM real.

Sin staging, commits, publicación ni acceso a datos privados. La cobertura previa del horario (164/166) no fue alterada ni se atribuye al RAG.

## Correcciones tras revisión independiente

1. La capacidad de ocho citas podía ocultar una referencia contradictoria y producir `supported`. Ahora se detectan conflictos en metadatos aplicables antes de truncar; se incluyen también referencias inversas. Los dos lados del conflicto tienen prioridad sobre artículos meramente relacionados. Si hay más referencias conflictivas que capacidad, se mantiene `conflict` y se indica el recorte. Regresiones sintéticas cubren saturación, referencia inversa, conflicto fuera de vigencia y más de ocho referencias.
2. La prosa general del consejero podía contener enlaces Markdown arbitrarios. `MessageResponse` reutiliza ahora el renderizador normativo restringido: descarta imágenes, HTML y enlaces navegables del texto. Se conservan únicamente los enlaces estructurados validados de las citas con protección de referrer. La regresión reproduce enlaces HTTP y enlaces por referencia.

Checks posteriores: 42/42 pruebas Python de normativa/consejero; 5/5 pruebas de renderizado del consejero y 5/5 de componentes normativos; lint y build cliente aprobados. Motor reiniciado con red de Hugging Face desactivada; reconsulta real NestJS → Python devuelve HTTP 200, modo híbrido, artículo 7 y fuentes oficiales. Serve 10007 sigue respondiendo HTTP 200. No se modificaron el contrato ni NestJS en estas correcciones, por lo que sus checks anteriores permanecen vigentes. No se presenta esta corrección del principal como una segunda auditoría independiente.
