# Revisión de fuentes para el cierre documental de matrícula regular

**Fecha de consulta:** 2026-10-11.
**Ámbito:** planificación de la réplica local FISI 2026-II, Sistemas y Software.
**Entrada:** investigación aportada por el usuario después de evaluar H-FID-01–H-FID-05.
**Límite:** consulta de documentos públicos, sin sesión autenticada, pantallas de matrícula,
solicitudes productivas, datos privados ni experimentos sobre SUM. Esta revisión no cierra N3.

## Fuentes contrastadas y límites

| ID de esta revisión | Fuente / clase | Contenido corroborado | Límites de uso |
| --- | --- | --- | --- |
| PUB-01 | [Portal público de pregrado SUM](https://sum.unmsm.edu.pe/pregrado.htm), documentación institucional de procedimiento, edición del texto general no identificada | Vincula elección con plan, habilitación y oferta. | El texto general no documenta la navegación posterior a rechazos ni demuestra identidad entre listas o filtrado efectivo. No es una observación de matrícula FISI. |
| PUB-02 / F1 existente | [Reglamento de matrícula 2026](https://sum.unmsm.edu.pe/assets/ReglamentoCompleto/reglamento2026.pdf), evidencia normativa | Arts. 13.r y 15 distinguen pendientes del plan y programación; art. 25 contempla descarga y respaldo documental. | Reconsulta de F1 ya registrada, no norma nueva. No demuestra que descarga/visado sean guardas técnicas ni fija secuencia de controles SUM. |
| PUB-03 / F2 existente | [Cronograma 2026 del portal](https://sum.unmsm.edu.pe/pregrado.htm), sección semestre 2026-II, evidencia documental de calendario | Programación 30 julio–7 agosto; prematrícula 5/7 agosto; matrícula 10–14 agosto; rectificación/extemporánea 7–11 septiembre. | Corrobora fechas generales de F2; no aporta las horas operativas del 11–12 ni amplía el alcance virtual fijado por F6. Procesos excluidos siguen excluidos. |
| PUB-04 | [Publicación oficial de la resolución 001-2025-PCM/SGTD](https://busquedas.elperuano.pe/dispositivo/NL/2412980-1), evidencia normativa de publicación | Resolución fechada 24 junio 2025, publicada 26 junio 2025, aprueba un lineamiento de accesibilidad de servicios públicos digitales. | El enlace [PCM/gob.pe aportado](https://www.gob.pe/institucion/pcm/normas-legales/6905744-001-2025-pcm-sgtd) produjo error de lectura directa; su ficha apareció en búsqueda. No se revisó íntegramente el anexo ni modificaciones posteriores. No se afirma aplicabilidad jurídica ni vigencia consolidada del lineamiento para este prototipo. |
| PUB-05 | [WCAG 2.2, W3C](https://www.w3.org/TR/WCAG22/), estándar técnico primario | Se contrastaron los criterios identificados por ACC-01–ACC-10 y sus excepciones. | Referencia para requisitos locales autorizados; el subconjunto no certifica conformidad integral A/AA ni describe accesibilidad del SUM. |

F1 se contrastó mediante extracción textual y capturas de las páginas PDF 7, 9 y 12
(índices 6, 8 y 11), donde figuran los artículos relevantes. No se almacenaron originales.
Se preservan las diferencias entre descripción histórica del portal y definiciones F1;
su contenido no permite tratar pendientes, oferta y cursos seleccionables como listas idénticas.

La guía de Ciencias Sociales mencionada no incluyó una URL específica verificable.
No se adopta como evidencia FISI. El repositorio público citado tampoco sustituye los
artefactos de este workspace: plan, contrato y revisión de fidelidad se revisan localmente.

## Referencias técnicas de ACC

La autorización del usuario adopta las propuestas como requisitos del flujo local, no como
conclusiones de esta investigación sobre SUM. La definición completa se mantiene en la
especificación y el catálogo de aceptación de la feature; esta nota solo identifica fuentes.

| ACC | Criterio W3C primario |
| --- | --- |
| ACC-01 | [2.1.1 Keyboard](https://www.w3.org/TR/WCAG22/#keyboard), [2.1.2 No Keyboard Trap](https://www.w3.org/TR/WCAG22/#no-keyboard-trap) |
| ACC-02 | [1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum) |
| ACC-03 | [1.4.11 Non-text Contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast) |
| ACC-04 | [1.4.4 Resize Text](https://www.w3.org/TR/WCAG22/#resize-text) |
| ACC-05 | [1.4.10 Reflow](https://www.w3.org/TR/WCAG22/#reflow) |
| ACC-06 | [2.4.7 Focus Visible](https://www.w3.org/TR/WCAG22/#focus-visible), [2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum) |
| ACC-07 | [2.5.8 Target Size (Minimum)](https://www.w3.org/TR/WCAG22/#target-size-minimum) |
| ACC-08 | [3.3.1 Error Identification](https://www.w3.org/TR/WCAG22/#error-identification) |
| ACC-09 | [4.1.3 Status Messages](https://www.w3.org/TR/WCAG22/#status-messages) |
| ACC-10 | [4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG22/#name-role-value) |

Las excepciones se documentan por caso; no basta invocar «salvo WCAG» genéricamente.
La aceptación local se limita a las pantallas/estados de esta feature. No incluye Inicio
general, todas las pantallas históricas ni certificación del servicio institucional.

## Autorizaciones locales posteriores a la investigación

El usuario respondió explícitamente en esta sesión:

1. Autoriza selección solo de cursos presentes en prematrícula completa y oferta aplicable;
   información incompleta produce pendiente, no habilitación supuesta.
2. Autoriza retorno al registro y reinicio de selección ante todo rechazo académico definitivo;
   respuesta perdida conserva el intento recuperable. No se generaliza a error de protocolo.
3. Adopta MAT-01–MAT-10 como categorías de un catálogo finito que conserve todos los FR/AC
   vigentes, incluidas excepciones, concurrencia, recuperación y aislamiento.
4. Adopta ACC-01–ACC-10 para las pantallas locales de esta feature; no Inicio general ni
   afirmación de conformidad integral WCAG AA.

Estas autorizaciones son decisiones de la réplica, con procedencia y estado `local-only`.
No cambian la clase de los testimonios existentes ni resuelven Q/B/G de referencia.
La cobertura normativa de ramas académicas se conserva; no se introduce un trámite de
matrícula condicionada ni se elimina esa cobertura por la exclusión propuesta en la investigación.
