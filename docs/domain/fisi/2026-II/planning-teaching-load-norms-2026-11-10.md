# Normas de carga docente para la programación académica

**Verificación:** 2026-11-10, por el orquestador, contra los textos oficiales. **Etapa:** fuentes normativas del módulo `shared/academic-normative-profile.mjs` (Perfil normativo, revisión `UNMSM-AAD-2026-04`).
**Ámbito de interés:** carga lectiva de docentes ordinarios en la programación de FISI desde 2026-II; cada fuente conserva su propio ámbito.
**Resultado:** hay sustento normativo para mínimos, máximos y excepciones de carga lectiva y para el orden de prelación por categoría y régimen. No lo hay para la duración de la hora lectiva de FISI, el máximo de tiempo parcial, los docentes contratados ni la evaluación del desempeño.

## Procedencia y límites

Este documento amplía el catálogo de [phase3-planning-sources-2026-11-05.md](phase3-planning-sources-2026-11-05.md) (OF-01 a OF-06) con la fuente OF-07 y detalla los hallazgos de OF-02 que el Perfil normativo codifica. No edita ese documento. No se inspeccionó SUM ni datos privados.

Clasificación, como en el documento de fase 3: `normative` es norma publicada; `inferred` es una deducción del orquestador, no una norma; `testimony` es lo reportado sin corroboración; `unverified` marca un extremo pendiente. Una norma exige algo dentro de su alcance; no prueba que SUM lo aplique, ni acredita paridad de comportamiento SUM (N3).

## Catálogo de fuentes

| ID | Fuente | Fecha y ámbito | Clase | Límites |
| --- | --- | --- | --- | --- |
| OF-02 | R.R. N.° 001380-2026-R/UNMSM, Reglamento General para la Actividad Académica Docente ([anexo](https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R-ANEXO.pdf)); ya catalogada en el documento de fase 3 | 06-02-2026; docentes ordinarios UNMSM (art. 1) | `normative` | Su art. 9 fue modificado por OF-07; las demás partes siguen vigentes. No es resolución de carga FISI 2026-II. |
| OF-07 | R.R. N.° 005348-2026-R/UNMSM, modifica el art. 9 del reglamento anterior | 17-04-2026; docentes ordinarios UNMSM | `normative` | PDF aportado por el operador el 2026-11-10 y publicado en la Plataforma del Estado Peruano (gob.pe, normas legales de la UNMSM). **La URL exacta no se registró** (brecha de procedencia); no se inventa un enlace. |

OF-07 es el siguiente identificador libre del catálogo (OF-01 a OF-06 en el documento de fase 3).

## Hallazgos de OF-02 codificados en el perfil

| Artículo | Contenido | Clase y límites |
| --- | --- | --- |
| Art. 1 | Alcance: docentes ordinarios. | `normative`. La carga de docentes contratados no está regulada aquí: brecha explícita. |
| Art. 5.1 | Dedicación Exclusiva (DE): 40 h semanales de servicio, mínimo 10 horas lectivas. | `normative`. |
| Art. 5.2 | Tiempo Completo (TC): 40 h semanales de servicio, mínimo 10 horas lectivas. | `normative`. |
| Art. 5.3 | Tiempo Parcial (TP): menos de 40 h semanales, al menos 40 % de horas lectivas. | `normative`. El texto no precisa si el 40 % se mide sobre las horas de servicio; el perfil aplica el 40 % de las horas semanales de servicio como horas lectivas (`inferred`). |
| Art. 7 | Docente ordinario TC o DE: máximo 12 horas lectivas semanales. Si requiere más, puede pedirlo a su departamento académico con declaración jurada de carácter voluntario y sin compensación adicional: máximo 20 horas lectivas. | `normative`. No indica máximo para TP: brecha explícita, no se inventa. |
| Art. 8 | Una hora lectiva dura 45, 50 o 60 minutos cronológicos; cada Consejo de Facultad la define. | `normative` para las tres opciones; el valor de FISI es `unverified`. El perfil no tiene valor por defecto: el llamador debe indicarlo. |
| Disp. compl. 1.ª | Ordinarios inscritos en RENACYT, con registro vigente y constancia vigente de Docente Investigador de la VRIP: un curso por año académico o mínimo de 6 horas lectivas semanales. | `normative`. El perfil aplica el mínimo de 6 horas en lugar de 10 para DE y TC. Su efecto sobre el 40 % de TP no está regulado: brecha, no se aplica. |
| Disp. compl. 2.ª | Ordinarios que estudian maestría o doctorado sin licencia: máximo 10 horas lectivas semanales. | `normative`. El perfil aplica el tope de 10 horas también con declaración voluntaria registrada. |
| Disp. compl. 5.ª | SUM registra a docentes con licencia (con o sin goce) o año sabático. | `normative` solo para el registro. Tratarlos como no disponibles para carga (autorizado 0) es `inferred`. |
| Disp. final 3.ª | Casos especiales que excedan la carga lectiva máxima pueden ser autorizados por la VRAP, a pedido del docente e informe del director del departamento al decano. | `normative`. El perfil registra la autorización con su tope explícito en horas (`maxLectiveHours`). Aplicar la autorización de la VRAP también sobre el tope de posgrado sigue el texto literal; no se corroboró aparte. |
| Art. 9 (resto) | Prelación: (1) especialidad; (2) categoría y régimen de dedicación; (3) evaluación del desempeño del semestre o año anterior. Carga entre el primer y el décimo ciclo. «Se debe asignar carga lectiva primero a los docentes nombrados de la facultad, luego se solicita docentes interfacultativos. Únicamente si no hubiera se solicitará el contrato de docentes.» | `normative`, salvo las interpretaciones de la sección siguiente. |

## Orden vigente por categoría y régimen (art. 9, según OF-07)

| Orden | Categoría y régimen | Orden | Categoría y régimen | Orden | Categoría y régimen |
| --- | --- | --- | --- | --- | --- |
| 1 | Principal DE | 4 | Asociado DE | 7 | Auxiliar DE |
| 2 | Principal TC | 5 | Asociado TC | 8 | Auxiliar TC |
| 3 | Principal TP | 6 | Asociado TP | 9 | Auxiliar TP |

OF-07 reemplaza el orden de febrero de 2026 (dentro de cada categoría: TP, TC, DE), que queda superado y no se usa. Clase `normative`.

## Interpretaciones pendientes de confirmación del usuario

Ambas son `inferred` y `unverified`; el perfil las codifica con esa etiqueta y sus identificadores de fuente.

1. **`INF-APPOINTMENT-PRELATION`**: el nombramiento (nombrado de la facultad → ordinario interfacultativo → contrato) precede a la categoría y al régimen. Se funda en el último párrafo del art. 9, que OF-07 no modificó; el texto no dice expresamente que esa regla ordene antes que la categoría. El módulo expone el escalón 0, 1 o 2.
2. **`INF-PERFORMANCE-INACTIVE`**: la evaluación del desempeño docente (criterio 3 del art. 9) forma parte del perfil, pero está inactiva: no existe fuente de datos local. Es una brecha explícita.

Además, el Backend worker introdujo dos inferencias propias, también `inferred`/`unverified` y pendientes de confirmación:

- `INF-LEAVE-UNAVAILABLE` (disp. compl. 5.ª): licencia o sabático implican autorizado 0 y mínimo 0.
- `INF-VRAP-OVER-POSTGRADUATE` (disp. final 3.ª): una autorización de la VRAP puede exceder el tope de 10 horas de posgrado.

## Lista de brechas

| Código | Brecha | Estado |
| --- | --- | --- |
| `FISI_LECTIVE_HOUR_UNVERIFIED` | Duración de la hora lectiva de FISI (45, 50 o 60 minutos, art. 8); el llamador la indica explícitamente. | `unverified` |
| `TP_MAXIMUM_NOT_REGULATED` | Máximo de carga lectiva de tiempo parcial; el art. 7 no lo fija. | `unverified` |
| `TP_MINIMUM_BASIS_UNSPECIFIED` | Base de medición del 40 % de tiempo parcial. | `inferred` |
| `CONTRACT_LOAD_NOT_REGULATED` | Límites de carga de docentes contratados: fuera del alcance del reglamento. | `unverified` |
| `PERFORMANCE_EVALUATION_NO_SOURCE` | Datos de evaluación del desempeño docente. | `unverified` |
| `SOURCE_OF07_URL_NOT_RECORDED` | URL exacta de OF-07 en gob.pe. | brecha de procedencia |
| `RENACYT_TIEMPO_PARCIAL_UNRESOLVED` | Efecto del régimen RENACYT sobre el mínimo de TP. | `unverified` |

## Criterios de FISI que no forman parte del perfil

Los criterios FISI reportados (preferencia de ciclos superiores por turno, docentes de los cursos de tesis, 180/90 alumnos, 45 por sección) siguen siendo `testimony` según [phase3-planning-sources-2026-11-05.md](phase3-planning-sources-2026-11-05.md) y no se codifican en el Perfil normativo.

## Aceptación documental

| Criterio | Comprobación | Resultado |
| --- | --- | --- |
| Cada hallazgo tiene artículo, clase y límites | Tablas de OF-02 y OF-07 | Cumple. |
| Ninguna interpretación se presenta como norma | Clases `inferred` y sección de interpretaciones | Cumple. |
| No se inventa una URL ni un valor sin fuente | Brechas `SOURCE_OF07_URL_NOT_RECORDED`, `FISI_LECTIVE_HOUR_UNVERIFIED`, `TP_MAXIMUM_NOT_REGULATED` | Cumple. |
