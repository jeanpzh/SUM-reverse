# Análisis de la Problemática del Proceso de Matrícula – UNMSM  
  
  
  
\*\*Rol:\*\* Analista  
  
  
  
\*\*Alcance:\*\* Horarios, Docentes, Cupos, Tópicos semanales, Aulas, Créditos (normativa SUM), Repitencias, Casos excepcionales presenciales, Prioridad por promedio ponderado, Valor legal de reportes, Pre-matrícula e integración con el SUM.  
  
  
  
---  
  
  
  
## 1. Resumen ejecutivo  
  
  
  
El proceso de matrícula de la UNMSM se sustenta en la Ley Universitaria N.° 30220, el Estatuto de la universidad y el Reglamento General de Matrícula para Pregrado, operado tecnológicamente por el Sistema Único de Matrícula (SUM).  
  
  
  
El análisis identifica diez frentes de problemática (horarios, docentes, cupos, tópicos semanales, aulas, créditos, repitencias, casos presenciales excepcionales, priorización por promedio ponderado y valor legal de los reportes) y los traduce en requisitos funcionales para un módulo de pre-matrícula integrado al SUM.  
  
  
  
Se contrastó cada punto contra la normativa vigente (Reglamento General de Matrícula 2026, Ley N.° 30220, cronograma SUM 2026) para separar lo que ya está normado de lo que constituye un vacío operativo que el sistema debe resolver o escalar.  
  
  
  
## 2. Marco normativo aplicable  
  
  
  
| Norma | Contenido relevante | Fuente |  
  
|---|---|---|  
  
| Ley Universitaria N.° 30220, Art. 39 | Define el crédito académico: mínimo 16 horas lectivas de teoría, o el doble de horas de práctica | SUNEDU |  
  
| Ley Universitaria N.° 30220, Art. 102 | Matrícula condicionada por rendimiento: 3.ª desaprobación de una misma materia → separación temporal de 1 año (solo puede matricularse en esa materia al retornar); 4.ª desaprobación → retiro definitivo | SUNEDU |  
  
| Estatuto UNMSM, Art. 189° y 190° | Condiciones de reincorporación tras separación temporal; sanciones por pérdida de la condición de estudiante regular | Reglamento General de Matrícula 2026 |  
  
| Reglamento General de Matrícula para Pregrado (2026) | Norma operativa: créditos, repitencia, pre-matrícula, matrícula presencial/virtual, valor de reportes, actas | SUM UNMSM |  
  
| Cronograma académico anual | Fechas de pre-matrícula, matrícula, rectificación e ingreso de notas | SUM Pregrado |  
  
  
  
\*\*Hallazgo inicial:\*\* Existe una discrepancia entre la Ley (3.ª desaprobación = separación temporal de 1 año; 4.ª = retiro definitivo) y el Reglamento UNMSM 2026, que introduce una "cuarta matrícula" con tutoría obligatoria y matrícula limitada a esa asignatura antes de aplicar la separación.  
  
  
  
Esto debe validarse con la Oficina de Asesoría Jurídica/VRAP antes de codificar la regla de negocio, porque el sistema no puede automatizar una regla que contradiga la Ley.  
  
  
  
## 3. Actores del proceso  
  
  
  
| Actor | Rol |  
  
|---|---|  
  
| Estudiante | Ejecuta la matrícula (vía internet o presencial), recibe reportes |  
  
| Docente | Registra notas según el sílabo; genera pre-actas |  
  
| Consejero de matrícula | Visa el reporte de pre-matrícula en la modalidad presencial |  
  
| Vicedecanato Académico | Autoriza excepciones (créditos, extemporánea, rectificación) |  
  
| Escuela Profesional | Define secciones, sedes y programación académica |  
  
| Unidad de Matrícula / OSUM | Administra el SUM, custodia bases de datos y cronograma |  
  
| VRAP (Vicerrectorado Académico de Pregrado) | Da visto bueno a extemporáneas y autoriza actas adicionales |  
  
| Consejo de Facultad | Resuelve rectificaciones de casos especiales |  
  
| Jurado Ad Hoc | Resuelve exámenes especiales; su acta es inapelable |  
  
  
  
## 4. Diagnóstico por componente  
  
  
  
### 4.1 Horarios  
  
  
  
Los horarios se elaboran y publican por cada facultad en su propia página web, y el estudiante debe seleccionar asignaturas "de acuerdo con los horarios... publicados en la página web de la facultad" (Reglamento 2026).  
  
  
  
Al no existir un repositorio central de horarios versionado dentro del SUM, se generan riesgos de: publicación tardía, choques de horario no detectados al momento de matricular, y desactualización entre lo publicado y lo cargado en el sistema.  
  
  
  
\*\*Requisito derivado:\*\* Repositorio de horarios por sección, con validación automática de cruce horario antes de confirmar la matrícula.  
  
  
  
### 4.2 Docente  
  
  
  
El reglamento exige que la OSUM mantenga una "base de datos de docentes de la UNMSM" como insumo del SUM.  
  
  
  
En la práctica, la asignación docente por sección suele confirmarse después de abierta la pre-matrícula, lo que impide al estudiante decidir con información completa (carga horaria del docente, posibles cambios de última hora).  
  
  
  
\*\*Requisito derivado:\*\* Vínculo obligatorio sección–docente visible desde la pre-matrícula, con trazabilidad de cambios.  
  
  
  
### 4.3 Cupos  
  
  
  
El reglamento no detalla mecanismos de control de cupos en tiempo real; solo indica que el sistema registra "las asignaturas autorizadas hasta el número de créditos permitido".  
  
  
  
Sin un control de concurrencia por sección, hay riesgo de sobre-matrícula o de secciones subutilizadas mientras otras están saturadas.  
  
  
  
\*\*Requisito derivado:\*\* Contador de cupos por sección con bloqueo transaccional y lista de espera.  
  
  
  
### 4.4 Tópicos por semana (contenido silábico)  
  
  
  
El registro de notas se hace "de acuerdo con la fórmula establecida en el sílabo de la asignatura", pero el reglamento no exige que el desglose semanal de temas esté estructurado ni sea consultable desde el SUM; esto es gestionado a nivel de facultad/departamento.  
  
  
  
\*\*Requisito derivado:\*\* Módulo de sílabo semanal estructurado (semana, unidad, tema, evaluación asociada) vinculado a cada sección, útil para el seguimiento de tutoría obligatoria que exige el reglamento en casos de repitencia.  
  
  
  
### 4.5 Aulas  
  
  
  
No hay una regla explícita de validación cruzada aula–cupo–horario en la normativa revisada; el riesgo típico es doble reserva de aula o capacidad de aula menor a los cupos ofertados en la sección.  
  
  
  
\*\*Requisito derivado:\*\* Validación de capacidad de aula vs. cupos de sección y bloqueo de doble asignación de aula en el mismo horario.  
  
  
  
### 4.6 Créditos según normativa SUM/Ley 30220  
  
  
  
| Situación del estudiante | Mínimo | Máximo | Base normativa |  
  
|---|---|---|---|  
  
| Regular, régimen semestral | 12 créditos | 26 créditos | Reglamento 2026 |  
  
| Regular, régimen anual | 24 créditos | 52 créditos | Reglamento 2026 |  
  
| Le faltan menos créditos para egresar (semestral/anual) | — | Sin límite superior fijado | Reglamento 2026 |  
  
| Cursos de verano (autofinanciados) | — | 11 créditos | Reglamento 2026 |  
  
| 3.ª desaprobación de un curso no programado en el semestre | — | 12 créditos, con autorización del Vicedecanato | Reglamento 2026 |  
  
  
  
\*\*Definición base:\*\* 1 crédito académico = mínimo 16 horas lectivas de teoría, o el doble de horas de práctica (Ley 30220, Art. 39).  
  
  
  
\*\*Requisito derivado:\*\* Motor de validación de créditos por perfil de estudiante (regular, próximo a egresar, verano, con desaprobaciones), que bloquee matrícula fuera de rango salvo autorización registrada del Vicedecanato.  
  
  
  
### 4.7 Repitencias  
  
  
  
| Situación | Regla | Consecuencia |  
  
|---|---|---|  
  
| 1.ª desaprobación | Segunda matrícula en el curso | Prioridad sobre cursos de primera matrícula |  
  
| 2.ª desaprobación | Tercera matrícula | Tutoría obligatoria (resolución decanal) |  
  
| 3.ª desaprobación | Cuarta matrícula | Tutoría obligatoria; solo puede matricularse en esa asignatura (Reglamento 2026, Art. 102 Ley) |  
  
| 4.ª desaprobación | Separación | Formalizada por resolución decanal ratificada por resolución rectoral |  
  
  
  
Las asignaturas desaprobadas tienen prioridad sobre las de primera matrícula y deben respetar el sistema de prerrequisitos.  
  
  
  
Además, no procede matrícula ni reingreso de estudiantes separados por bajo rendimiento o por sanción disciplinaria vigente (Reglamento 2026).  
  
  
  
\*\*Requisito derivado:\*\* Motor de reglas de repitencia con:  
  
  
  
- (a) Bloqueo de matrícula libre cuando hay cursos desaprobados pendientes.  
  
- (b) Disparo automático de flag de tutoría obligatoria al llegar a la 2.ª desaprobación.  
  
- (c) Alerta a Vicedecanato al llegar a la 4.ª desaprobación, conciliando la contradicción Ley/Reglamento antes mencionada.  
  
  
  
### 4.8 Casos excepcionales que requieren presencia física a solicitud del alumno  
  
  
  
El reglamento identifica explícitamente:  
  
  
  
- \*\*Matrícula presencial regular:\*\* El estudiante entrega su relación de asignaturas y firma el reporte junto al responsable de matrícula.  
  
- \*\*Matrícula extemporánea:\*\* Puede ser presencial o virtual, pero requiere autorización del Vicedecano Académico y visto bueno del VRAP.  
  
- \*\*Rectificación de matrícula – casos especiales con acuerdo del Consejo de Facultad:\*\* Con ventanas específicas en el cronograma (p. ej., 19–23 de octubre en régimen anual/semestre II 2026, 1–5 de junio en semestre I 2026).  
  
- \*\*Jurado Ad Hoc:\*\* El estudiante firma una declaración jurada; el resultado es inapelable.  
  
  
  
El reglamento no establece expresamente que rectificación, anulación, reserva o reactualización de matrícula requieran presencia física — es un vacío que conviene resolver con una directiva interna antes de automatizar el flujo.  
  
  
  
\*\*Requisito derivado:\*\* Catálogo de trámites con bandera "requiere presencia física / puede ser virtual", enlazado a un flujo de solicitud, autorización (Vicedecanato/Consejo/VRAP) y agendamiento presencial cuando aplique.  
  
  
  
### 4.9 Matrícula de acuerdo al promedio ponderado (PP)  
  
  
  
\*\*Fórmula oficial:\*\*  
  
  
  
El promedio ponderado se calcula a partir de los créditos y la última nota obtenida en cada asignatura (no se consideran notas desaprobatorias previas a la aprobación).  
  
  
  
El SUM publica rankings por Escuela Profesional, año de ingreso, periodo de egreso y ciclo vigente, identificando tercio superior (P66.7), quinto superior (P80) y décimo superior (P90) — como se observa en el ranking ponderado 2025-2 de FISI.  
  
  
  
\*\*Hallazgo clave:\*\* El texto del reglamento no fija una regla explícita que use el PP o el ranking para ordenar la prioridad de atención en la matrícula (solo confirma que los cursos desaprobados tienen prioridad sobre los de primera matrícula).  
  
  
  
Antes de programar una lógica de "quien tiene mejor promedio matricula primero", el analista debe confirmar con OSUM/VRAP si existe una directiva complementaria no publicada en la web que sustente esa práctica.  
  
  
  
\*\*Requisito derivado (condicionado a validación normativa):\*\* Ventanas de matrícula escalonadas por tercio/quinto/décimo superior, configurables por la Escuela Profesional, con trazabilidad de la resolución que las autorice.  
  
  
  
### 4.10 Valor legal de los reportes de notas  
  
  
  
| Documento | Valor legal / tratamiento |  
  
|---|---|  
  
| Reporte de matrícula (vía internet, visado por Vicedecanato) | "Único documento válido ante cualquier reclamo" |  
  
| Reporte de matrícula presencial | Válido cuando lleva firma conjunta del estudiante y del responsable de matrícula; se archiva copia firmada |  
  
| Reporte de pre-matrícula | Documento oficial, refleja cursos pendientes y necesarios para egresar |  
  
| Historial académico | Documento oficial de rendimiento por semestre, disponible en SUM |  
  
| Acta promocional | Una vez cerrada, es inmodificable; solo se corrige mediante "actas adicionales" en 4 causales taxativas (error del docente, matrícula/rectificación extemporánea autorizada, Jurado Ad Hoc, u otro caso autorizado por el VRAP) |  
  
| Acta de Jurado Ad Hoc | Firmada por el presidente del jurado; su resultado es inapelable y no admite recurso impugnatorio |  
  
  
  
\*\*Implicancia de gobierno de datos:\*\* Al ser el reporte visado el único documento con valor probatorio, cualquier módulo de pre-matrícula que se construya como capa complementaria al SUM debe:  
  
  
  
- (a) No generar documentos paralelos que puedan confundirse con el reporte oficial.  
  
- (b) Preservar integridad y trazabilidad (firma digital o hash, bitácora de cambios) equivalente al control de "dato inmodificable" que ya exige el reglamento para los registros del SUM.  
  
- (c) Documentar claramente que solo tiene función de simulación/consulta, no de constancia legal.  
  
  
  
### 4.11 Pre-matrícula e integración con el SUM  
  
  
  
\*\*Proceso vigente según el reglamento:\*\*  
  
  
  
1. El estudiante descarga el reporte de pre-matrícula (Unidad de Matrícula o portal SUM), el cual lista cursos pendientes y necesarios para egresar según su plan de estudios.  
  
2. Ejecuta la matrícula (internet o presencial) seleccionando cursos dentro del límite de créditos, respetando horarios y secciones/sedes publicadas por la facultad.  
  
3. Descarga, imprime y obtiene el visado del Vicedecanato (modalidad internet) o firma conjunta (modalidad presencial).  
  
4. Los datos quedan registrados en el SUM como inmodificables; cualquier corrección exige autorización expresa y fundamentada del Vicedecano Académico, generando un nuevo registro (no una edición del original).  
  
  
  
\*\*Cronograma de pre-matrícula 2026 (fuente: SUM Pregrado):\*\*  
  
  
  
| Régimen | Actividad | Fecha |  
  
|---|---|---|  
  
| Verano 2026-0 | Pre-matrícula | Lunes 5 de enero |  
  
| Anual 2026 | Pre-matrícula | 11–12 de marzo |  
  
| Semestre 2026-I | Pre-matrícula | 11–12 de marzo |  
  
| Semestre 2026-II | Pre-matrícula | 5–7 de agosto |  
  
  
  
\*\*Diseño propuesto de integración:\*\* Un módulo de pre-matrícula construido como capa de consulta/simulación que consuma en modo lectura los datos que la OSUM ya está obligada a mantener (plan de estudios vigente, programación académica, horarios, cupos, base de docentes, ranking ponderado) para ofrecer al estudiante una simulación de horario sin cruces, validación anticipada de créditos y alertas de repitencia/tutoría, antes de que el estudiante ejecute la matrícula real en el SUM.  
  
  
  
La escritura definitiva de la matrícula permanece en el SUM como fuente única de verdad, respetando la regla de inmodificabilidad y el requisito de autorización del Vicedecanato para cualquier ajuste posterior.  
  
  
  
## 5. Matriz de requisitos funcionales  
  
  
  
| ID | Módulo | Requisito | Base normativa / regla de negocio | Prioridad |  
  
|---|---|---|---|---|  
  
| RF-01 | Horarios | Repositorio único de horarios por sección con validación de cruce | Reglamento 2026 | Alta |  
  
| RF-02 | Docentes | Vínculo sección–docente visible desde pre-matrícula, con historial de cambios | Reglamento 2026 (base de datos de docentes) | Media |  
  
| RF-03 | Cupos | Control transaccional de cupos por sección + lista de espera | Vacío normativo (buena práctica) | Alta |  
  
| RF-04 | Tópicos semanales | Sílabo estructurado por semana vinculado a sección y a seguimiento de tutoría | Reglamento 2026 (registro de notas según sílabo) | Media |  
  
| RF-05 | Aulas | Validación cruzada aula–horario–capacidad de cupos | Vacío normativo (buena práctica) | Alta |  
  
| RF-06 | Créditos | Motor de validación de rango de créditos por perfil de estudiante | Reglamento 2026 / Ley 30220 Art. 39 | Alta |  
  
| RF-07 | Repitencias | Motor de reglas: prioridad de desaprobados, flag de tutoría en 2.ª desaprobación, alerta en 4.ª | Reglamento 2026 / Ley 30220 Art. 102 (conciliar contradicción) | Alta |  
  
| RF-08 | Casos excepcionales | Catálogo de trámites con bandera presencial/virtual y flujo de autorización | Reglamento 2026 (parcial; requiere directiva complementaria) | Media |  
  
| RF-09 | Promedio ponderado | Cálculo automático de PP y ranking (tercio/quinto/décimo superior) | Reglamento 2026 (fórmula confirmada) | Alta |  
  
| RF-10 | Prioridad por PP | Ventanas escalonadas de matrícula por ranking | Pendiente de confirmación normativa con OSUM/VRAP | Media |  
  
| RF-11 | Valor legal | Firma/visado digital y bitácora de inmutabilidad para reportes con valor probatorio | Reglamento 2026 | Alta |  
  
| RF-12 | Actas | Bloqueo de edición tras cierre de acta promocional; flujo tasado de actas adicionales (4 causales) | Reglamento 2026 | Alta |  
  
| RF-13 | Pre-matrícula | Simulación de horario, créditos y repitencia en modo lectura antes de matricular en el SUM | Reglamento 2026 | Alta |  
  
| RF-14 | Integración SUM | Interfaz de datos en modo lectura (planes de estudio, programación, ranking) sin escritura directa salvo autorización del Vicedecanato | Reglamento 2026 (dato inmodificable) | Alta |  
  
  
  
## 6. Modelo de entidades sugerido (alto nivel)  
  
  
  
- Estudiante — Matrícula — Sección (de una Asignatura del PlanDeEstudios) — Docente — Aula — Horario — Cupo  
  
- Asignatura — SíllaboSemanal (Tópico por semana)  
  
- Estudiante — HistorialAcadémico — PromedioPonderado / RankingPonderado  
  
- Matrícula — ReportePreMatrícula / ReporteMatrícula — ActaPromocional (con ActaAdicional como excepción tasada)  
  
- Trámite (rectificación, extemporánea, reserva, reactualización, Jurado Ad Hoc) — Autorización (Vicedecanato / Consejo de Facultad / VRAP)  
  
  
  
## 7. Hallazgos y riesgos clave  
  
  
  
1. \*\*Contradicción normativa Ley vs. Reglamento en repitencia:\*\* La Ley 30220 (Art. 102) fija separación temporal de 1 año a la 3.ª desaprobación y retiro definitivo a la 4.ª; el Reglamento 2026 de la UNMSM introduce una "cuarta matrícula" antes de separar. Debe resolverse con Asesoría Jurídica/VRAP antes de codificar la regla — no automatizar sin esa validación.  
  
  
  
2. \*\*Ausencia de regla explícita de prioridad de matrícula por promedio ponderado.\*\* Solo existe el ranking informativo; no hay norma publicada que lo convierta en criterio de orden de atención.  
  
  
  
3. \*\*Vacío sobre qué trámites requieren presencia física.\*\* El reglamento solo lo precisa para matrícula presencial, extemporánea y Jurado Ad Hoc; rectificación, anulación, reserva y reactualización quedan sin precisión expresa.  
  
  
  
4. \*\*Riesgo de integridad de datos\*\* si el futuro módulo de pre-matrícula no respeta el carácter de "dato inmodificable" y el requisito de autorización expresa del Vicedecano para cualquier corrección en el SUM.  
  
  
  
5. \*\*Fragmentación de horarios, cupos y aulas\*\* por depender de páginas web independientes de cada facultad, sin una fuente central versionada.  
  
  
  
## 8. Recomendaciones  
  
  
  
- Elevar consulta formal a OSUM/VRAP para confirmar si existe una directiva no publicada que use el promedio ponderado como criterio de prioridad de matrícula (RF-10), antes de implementarlo.  
  
  
  
- Solicitar opinión de Asesoría Jurídica sobre la conciliación entre el Art. 102 de la Ley 30220 y el esquema de "cuarta matrícula" del Reglamento 2026, para fijar la regla de negocio definitiva de repitencia (RF-07).  
  
  
  
- Diseñar el módulo de pre-matrícula como capa de simulación de solo lectura, nunca como fuente de escritura paralela al SUM, preservando la trazabilidad y el valor legal exclusivo del reporte visado.  
  
  
  
- Definir y publicar un catálogo único de trámites (presencial/virtual) con sus autorizantes, cerrando el vacío identificado en el punto 4.8.  
  
  
  
- Centralizar horarios, cupos y aulas en un repositorio único por sección, con validaciones cruzadas automáticas, antes de abrir cada ventana de pre-matrícula.  
  
  
  
## 9. Fuentes consultadas  
  
  
  
- \*\*Reglamento General de Matrícula para Pregrado (2026) – SUM UNMSM:\*\*    
  
  https://sum.unmsm.edu.pe/assets/ReglamentoCompleto/reglamento2026.pdf  
  
  
  
- \*\*Sistema Único de Matrícula (SUM) – Cronograma Pregrado:\*\*    
  
  https://sum.unmsm.edu.pe/pregrado.htm  
  
  
  
- \*\*Ley Universitaria N.° 30220 – SUNEDU:\*\*    
  
  https://www.sunedu.gob.pe/wp-content/uploads/2017/04/Ley-universitaria-30220.pdf  
  
  
  
- \*\*Ranking ponderado actualizado 2025-2 (FISI) – UNMSM:\*\*    
  
  https://sistemas.unmsm.edu.pe/site/noticias/35-importante/1483-matricula-2025-2-ranking-ponderado-actualizado  
  
  
  
- \*\*Reglamento General de Matrícula – Vicerrectorado Académico de Pregrado:\*\*    
  
  https://viceacademico.unmsm.edu.pe/wp-content/uploads/2025/03/Reglamento-General-de-Matrícula\_UNMSM.pdf