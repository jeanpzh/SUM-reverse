# Dossier corregido — descubrimiento de matrícula FISI/UNMSM 2026-II

**Corte de investigación:** 11-10-2026. **Objeto:** fuente de descubrimiento para una futura especificación conductual (`specify/clarify`) con GitHub Spec Kit. **No garantiza fidelidad exacta del sistema actual**.

## Contenido

- `business-rules.md`: RN-01–RN-20, vigencia, artículos, URLs oficiales y **F6, cuadro FISI 2026-II de turnos/PP**, matriz de evidencia normativa versus comportamiento, mensajes literales pendientes.
- `as-is-process.md`: actores, fechas y **turnos FISI 2026-II documentados**, proceso regular virtual P01–P12, Mermaid de flujo **testimoniado**, límites del conocimiento, procesos posteriores.
- `emulation-fidelity.md`: niveles N0–N3, qué replicar, qué **no** afirmar, catálogo configurable de mensajes placeholder, concurrencia y criterios para pasar a especificación de paridad.
- `open-questions.md`: Q-01–Q-35 priorizadas, responsables sugeridos y método de validación que no exige tocar datos ni matrículas reales.

## Cambios críticos respecto al borrador

1. Se encontró el **Reglamento General de Matrícula para Pregrado aprobado el 26-02-2026**; permite documentar con precisión el rango 12–26 (con excepciones), los requisitos de salud/deuda, las sanciones, los estados por desaprobaciones, el máximo de reserva de tres años y las prohibiciones para ingresantes.
2. Se encontró el **cronograma rectoral 2026-II** y se anclaron fechas de agosto, septiembre y octubre.
3. Se encontró un **comunicado FISI** que respalda la condición de vacantes disponibles; no se usa un comunicado de otra facultad como fundamento FISI.
4. Se eliminó la nota que equiparaba todas las RN con comportamientos observados y se eliminaron todos los **mensajes presentados falsamente como literales**.
5. Se separó el **reporte de prematrícula y el visado previstos en el reglamento** de las precondiciones técnicas de matrícula, que **no están demostradas**. El visado tampoco se trata como transición del aplicativo a «matriculado».
6. Se corrigieron las reglas de **tercera/cuarta matrícula** para no confundirlas con «tres/cuatro desaprobaciones»; F1 arts. 12, 13.c y 19.
7. Se incluyeron incertidumbres conductuales críticas: orden y momento de validaciones, múltiples errores, consumo de cupos, fallos concurrentes, atomicidad, expiración y reintentos.
8. Se eliminó la afirmación sin fuente de «anulación masiva por caídas en 2025».
9. Se separó **matrícula extemporánea** de **evaluaciones de rezagados** (no consta en cronograma rectoral una etapa distinta llamada «matrícula de rezagados»).
10. Se identificó un posible conflicto: 29-10-2026 figura como fecha de anulación en calendario, pero cae 44 días antes del fin de clases del 12-12-2026 frente al límite normativo de 45 días (Q-24). **No se afirma que alguno de los textos esté derogado o que prevalezca otro.**

## Incorporación de evidencia FISI recibida el 11-10-2026

La captura aportada muestra un documento FISI titulado **«Intervalo de horario con promedios ponderados semestre 2026-II»**. Se localizó el [PDF correspondiente en el dominio oficial](https://sistemas.unmsm.edu.pe/site/images/2.-_Cuadro_Intervalo_de_horario_con_Promedios_Ponderados_para_Semestre_2026-II_F_.pdf); en la captura aparece sello de firma de **21-07-2026**. **[Verificado-FISI] para contenido del cronograma, no [Observado] de interfaz SUM**.

- **Lunes 10-08:** virtual según ponderado, nueve franjas de 06:00 a 23:59 con PP mínimo descendente 17 a 0 y tope indicado de 19.00; los últimos grupos figuran como `6` y `7` repetidos en el original.
- **Martes 11 y miércoles 12-08:** virtual **«libre»**, sin descripción de horario operativo en el cuadro.
- **Jueves 13-08:** presencial para observados de 2.ª/3.ª repitencia con resolución de tutoría.
- **Viernes 14-08:** presencial para quienes tuvieron problemas al matricularse. Ambos días de oficina, 08:00–13:00 y 14:00–16:00.

**Vigencia específica:** FISI, semestre **2026-II**. Los turnos pueden cambiar: no usarlos como valor por defecto de la UNMSM, de FISI 2027 ni de otra facultad. La publicación permite documentar una **regla local versionada**; no confirma por sí sola el mecanismo de habilitación del SUM, los límites inclusivos o la continuidad del acceso.

## Fuentes oficiales principales

- **F1 — Reglamento 2026**, R.R. N.° 002642-2026-R/UNMSM del **26-02-2026**: https://sum.unmsm.edu.pe/assets/ReglamentoCompleto/reglamento2026.pdf
- **F1-RR — Resolución aprobatoria (portal oficial)**: https://www.gob.pe/institucion/unmsm/normas-legales/7786960-002642-2026-r-unmsm
- **F2 — Anexo cronograma 2026**, R.R. N.° 014408-2025-R/UNMSM del **16-12-2025**: https://sum2.unmsm.edu.pe/assets/cronograma/ANEXO_RR-014408-2025-R.pdf
- **F3 — FISI, regularización 2026-II, mínimos y vacantes**, publicación web sin fecha explícita: https://sistemas.unmsm.edu.pe/site/slider/1854-comunicado-urgente-regularizacion-de-matricula-y-casos-pendientes-para-el-periodo-academico-2026-2
- **F4 — FISI, ranking académico 2026-I**, publicación web sin fecha explícita: https://sistemas.unmsm.edu.pe/site/slider/1882-ranking-academico-correspondiente-al-semestre-2026-i
- **F5 — FISI, primera rectificación/extemporánea 2026-II**, publicación web sin fecha explícita: https://sistemas.unmsm.edu.pe/site/noticias/35-importante/1841-1er-proceso-de-rectificacion-de-matricula-y-matricula-extemporanea-2026-ii
- **F6 — FISI, cuadro de turnos por PP y modalidades 2026-II**, documento firmado el **21-07-2026** según captura, PDF institucional: https://sistemas.unmsm.edu.pe/site/images/2.-_Cuadro_Intervalo_de_horario_con_Promedios_Ponderados_para_Semestre_2026-II_F_.pdf

## Advertencia de uso en Spec Kit

Se puede hacer `specify` para **hechos normativos confirmados** o como **especificación parcial con interrogantes bloqueantes**. No se debe instruir al agente a completar comportamiento desconocido del SUM: las observaciones de UI (y en particular el relato del usuario) **todavía carecen de capturas de interacción en SUM aportadas en este intercambio**; la captura nueva es de un PDF de cronograma FISI, no de una transacción. El documento `emulation-fidelity.md` establece los umbrales N0–N3.
