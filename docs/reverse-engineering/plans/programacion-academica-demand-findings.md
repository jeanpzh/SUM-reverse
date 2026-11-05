# E1 · base técnica para estimación de demanda

Evolución posterior: se implementó una demo aislada con decisiones sintéticas
explícitas, documentada en `programacion-academica-demand-demo.md` y en
`../programacion-academica-demand-demo.md`. Este análisis conserva sus hallazgos
previos; las necesidades de información institucional siguen pendientes.

Análisis del principal, 2026-11-02, rama schedule-pt1. **No se implementó ni ejecutó
un estimador de demanda.** Fuente: código y fixtures expresamente sintéticos del
repositorio; decisiones propuestas `local-only`, pendientes de aprobación del
equipo. No se leyeron PDFs privados, datos-reales ni servicios del operador.
El PDF privado no respalda ninguna conclusión de este documento.

## Diagnóstico breve

Ya existen antecedentes suficientes para demostrar **habilitación académica
potencial** en una muestra sintética pequeña. No existe una población representativa
ni intención de inscripción para pronosticar cuántos estudiantes realmente llevarán
un curso el próximo semestre. Tampoco hay un servicio E1 que estime demanda.
No es válido obtener180 estudiantes de los dos perfiles de Sistemas mediante una
extrapolación implícita.

La alternativa sencilla es un futuro adaptador de solo lectura de los perfiles
sintéticos y del plan ya existentes, con una única población/escenario explícitos,
correspondencia de códigos y conteo de personas únicas por curso. El resultado se
llamaría «habilitados académicos potenciales — muestra sintética»; la escuela
conservaría una demanda de planificación editable y separada. Esta entrega solo
documenta esa alternativa, no crea modelos, endpoints ni cálculos de demanda.

## Inventario verificable

| Archivo / función o tipo | Información disponible | Límite y uso posible |
| --- | --- | --- |
| backend/src/matricula-regular/profile.types.ts · ActorProfile, ProfileScope | actorId, facultad, escuela, plan, periodo, modalidad; aprobadas; failedCourses; historyKnown, equivalencesKnown, planKnown; tutoría, autorizaciones y requisitos institucionales | Identidad y ámbito para filtrar/deduplicar. Son perfiles sintéticos, no padrón institucional. Flags de conocimiento no equivalen a equivalencias resueltas. |
| Mismo archivo · AcademicAttempt, SyntheticAcademicRecord, AcademicCatalogCourse | Intentos por curso/periodo, nota, resultado approved/failed, sección, recordId; catálogo con créditos, ciclo, obligatorio/electivo y prerequisiteIds | Usar resultado explícito y requisitos del plan, no inferir aprobaciones desde la tabla HTML. Varios intentos no son varios estudiantes. |
| backend/src/matricula-regular/academic-demo.fixtures.ts · createSyntheticAcademicDemoFixture, createCatalog, createAttempts | Semillas pequeñas de16 cursos y antecedentes construidos por programa | Fixture base para pruebas. La ejecución principal con escenarios usa después la expansión; no sumar ambos catálogos/poblaciones. |
| backend/src/matricula-regular/scenario-reference.seed.ts · scenarioPlanRows, scenarioProgrammingRows | Plan sintético:97 filas/85 asignaturas únicas. Programación:165 filas/56 asignaturas únicas con secciones y sesiones | Primera línea confirma fuente enteramente sintética. Filas de prerrequisitos o secciones no representan estudiantes. No leer archivos originales/exportaciones mencionados por referencias históricas. |
| backend/src/matricula-regular/expanded-scenarios.ts · catalogFor, enrichHistory, expandScenarioBundle | Catálogo ampliado85 cursos por perfil, prerequisiteIds, historial con desaprobaciones y aprobaciones posteriores; scenarioData.courseCodes mapea SYN-* a código del catálogo | Puente ya construido hacia20118104 y demás códigos. Filtra NR y reúne prerrequisitos como lista; no modela toda posible semántica de grupos/equivalencias/créditos previos. Software reutiliza la referencia como simulación; no acredita un plan oficial equivalente. |
| backend/src/matricula-regular/enrollment-scenarios.ts · buildBuiltInEnrollmentScenarioBundles, withAcademicHistory | Nueve escenarios de pruebas, cuatro perfiles A/B de dos escuelas, resúmenes de aprobadas/repitencia | Son alternativas sobre los mismos actores:36 apariciones, solo4 actorId distintos; dos estudiantes por escuela. Nunca sumar los nueve como cohortes independientes ni mezclar sus estados. |
| backend/src/local-profile-dashboard/local-scenarios.service.ts · configure, activate, select, describe | Selecciona un escenario, clona fixtures y reinicia la ejecución; muestra resúmenes y recomendaciones | currentScenarioId/runId identifica escenario/ejecución, no un nuevo estudiante. Cambiarlo para estimar demanda alteraría el simulador: no usar select/activate/reset en un adaptador de lectura. |
| backend/src/matricula-regular/academic-demo.validation.ts · validateSyntheticAcademicRecord | Valida códigos del catálogo, prerrequisitos existentes/sin ciclos, recordId únicos, curso-periodo único y periodos anteriores al ámbito actual | Reutilizar para controlar integridad del ledger antes de estimar. Un dato ausente o contradictorio requiere revisión, no demanda cero. |
| backend/src/matricula-regular/selection.rules.ts · evaluateSelectionAdmission | Admisión a oferta/plan basada en preEnrollment y conocimiento de plan/oferta | Resuelve selección de matrícula actual, no demanda para cursos nuevos. |
| backend/src/matricula-regular/rules.ts · evaluateSubmissionRules | Prerrequisitos, repitencia, tutoría, autorización, restricciones institucionales, créditos, horarios y vacantes de una selección | Referencia reutilizable para causas/gaps, pero no invocar por curso como estimador: una selección individual puede incumplir mínimo12 créditos; ventanas/cupos/cruces actuales no deben eliminar necesidad futura. No modificar estas reglas. |
| backend/src/matricula-regular/context.service.ts · projectContext, retakeCourseIdsFor | prematrícula/oferta y repitencias de la oferta actual; elegibilidad contextual | El contexto HTTP no expone todos los antecedentes necesarios para una población completa. retakeCourseIds está restringido a cursos ofertados. |
| backend/src/local-profile-dashboard/profile-projection.ts · projectHistorial | Presenta historial, periodos y resumen desde academic; normaliza código mediante courseCodes | El payload final elimina result y expone nota: no raspar la pantalla ni reconstruir reglas de aprobación; leer el modelo fuente validado en backend. |
| backend/src/matricula-regular/store.types.ts · Enrollment, RunState; matricula-regular.repository.ts · readSnapshot | Solicitudes, inscripciones aceptadas y reportes de la ejecución actual en memoria; snapshot clonado | Son efectos de la simulación actual, no serie histórica de demanda ni matrícula definitiva de otro semestre. Fuente para futuras lecturas solo con procedencia sintética acreditada; no conectar E1 a snapshots privados. |
| backend/src/programacion-academica/synthetic-catalog-adapter.ts · adaptSyntheticCatalog | Agrupa56 cursos, conserva historia/patrones, demanda inicial0 | No expone ledger, población o prerrequisitos; no usa matriculados históricos como demanda. Reutilizar códigos/catálogo, no crear uno nuevo. |
| backend/src/programacion-academica/demo-proposal.service.ts · toGeneratorInput; section-sizing.ts · calculateRequiredSections | estimatedDemand enviada por la escuela; ceil(demanda/capacidad) | El generador recibe cantidades ya decididas, no estudiantes; mantener esta separación. |

Los conteos estructurales anteriores se comprobaron con imports locales de los
builders/seed compilados existentes, sin servidor, sin lectura de exports y sin
producir una estimación de demanda o un nuevo conteo de habilitados. No se guardaron identidades, nombres ni historias
individuales como evidencia. Son dimensiones de fixtures, no cifras institucionales.

## Qué significa «habilitado» aquí

Separar tres preguntas:

1. **Necesita y puede avanzar académicamente:** pertenece al plan, aún no aprobó
   el curso y cumple prerrequisitos conocidos al corte. Es una base potencial E1.
2. **Puede matricularse hoy:** añade ventana, deuda, tutoría/autorizaciones,
   selección de créditos, cupos y horarios actuales. Es el problema del motor de
   matrícula; no reemplaza la primera pregunta.
3. **Quiere llevarlo el próximo periodo:** necesita intención, continuidad del
   estudiante, decisiones de electivos y carga. No está en los fixtures actuales.
   Una futura prematrícula E2 puede aportar intención, pero no se implementa aquí.

En expandScenarioBundle la preEnrollment se deriva de **fixture.offer**, aprobadas
y prerrequisitos. Es una lista sintética elegible para la oferta existente, no una
declaración real del alumno ni la población completa que necesita cada curso.
Usarla como única fuente para planificar un nuevo semestre excluiría circularmente
los cursos que aún no se ofrecen. El nombre de la pantalla no prueba que E2 exista.

## Metodología candidata, todavía no implementada

Definir primero escuela/plan, periodo objetivo, fecha de corte y **una población
identificada**. Para cada persona única i y curso c seleccionado del catálogo E1:

`e(i,c) = conocido y del plan y no aprobado(c) y todos los prerrequisitos satisfechos`

`H(c) = número de personas únicas con e(i,c)=verdadero`

`R(c) = personas de H(c) con desaprobaciones previas de c y sin aprobación posterior`

`N(c) = H(c) menos R(c)`

R y N son grupos disjuntos, así que H=R+N. No sumar otra vez históricos, repitencias
o listas de prematrícula. Un curso desaprobado dos veces cuenta como una persona;
si ya fue aprobado, no entra en H aunque existan intentos fallidos antiguos. Priorizar
el estado académico validado, revisar discrepancias entre ledger y resúmenes, sin
resolverlas silenciosamente. No calcular aprobaciones nuevas ni predecir notas.

Estado por pareja persona/curso: habilitado, no habilitado con causa conocida o
pendiente de revisión. La tercera categoría se informa aparte y nunca se convierte
en cero o en elegibilidad confirmada. H es una base conocida de la muestra, no un
pronóstico de matrícula. Sin tasas históricas confiables no introducir porcentajes
de aprobación, abandono o intención ni un factor para escalar la muestra.

La clave de deduplicación propuesta incluye **población fuente, identidad estable,
escuela/plan, periodo objetivo y código canónico de curso**. No incluye sección,
número de intento ni requestId. runId es control de consistencia, no identidad
demográfica. Elegir un único escenario de origen antes de deduplicar; no fusionar
versiones contradictorias de los mismos actores. La unión entre antecedentes y E1
usa scenarioData.courseCodes y ámbito, nunca solo nombre de asignatura. Cursos sin
correspondencia/equivalencia quedan pendientes, sin contarlos en otra escuela.

La escuela conservaría dos cantidades diferenciadas: **base potencial H** de una
fuente/corte declarados y **demanda final de planificación**, editable. Si existe
un ajuste manual válido, el generador usa ese valor; en caso contrario solo usaría
H tras reconocer sus límites y los pendientes. No sobrescribir ajustes al
reestimar. Mostrar de forma compacta origen, diferencia y motivo del ajuste; no
convertir la pantalla en un historial de estudiantes ni exponer datos personales.
El contrato actual estimatedDemand puede continuar transportando el valor final;
la procedencia/base/override requerirían una futura extensión explícita, no se
añaden en esta entrega.

## Datos y decisiones que faltan

- Población sintética suficientemente amplia y estable para una demo de demanda
  realista; los4 actores actuales son pruebas, no padrón ni muestra representativa.
  Si se amplía, debe construirse independientemente, sin datos personales ni copias
  de snapshots, y sin multiplicar automáticamente historias de estos actores.
- Periodo objetivo/corte y condición de continuidad: activos, egresados, reserva,
  reingreso, nuevos ingresantes y cursos en progreso. Activo en un perfil sintético
  actual no confirma que vaya a estudiar el siguiente semestre.
- Política del equipo: H como potencial académico o subconjunto con requisitos
  administrativos resueltos; cómo presentar deudas, tutoría/autorizaciones y gaps.
  Propuesta: no perder necesidad potencial por un bloqueo administrativo temporal;
  informar condiciones por separado, sin cambiar las reglas de matrícula.
- Semántica/versionado de grupos de prerrequisitos, créditos previos, equivalencias,
  convalidaciones, planes y electivos. prerequisiteIds actual es una conjunción
  sencilla; no afirmar que cubre todas las reglas de la facultad.
- Reconocer aprobaciones al corte y conciliación ledger/resúmenes, equivalencias y
  periodos 2026-1/2026-II; no mezclar periodos con formatos diferentes sin normalizar.
- Prioridad y elección entre todos los cursos habilitados: una persona puede
  habilitarse para más cursos de los que podría/quisiera llevar. H por curso no
  garantiza una selección conjunta viable de créditos/horarios ni intención real.
- Si se desea un pronóstico más allá de H, harían falta cohortes, resultados e
  inscripciones históricas por persona/curso/periodo y tasas verificables. Los
  matriculados/topes por sección son agregados anónimos que no permiten deduplicar.
- Acordar si el futuro adaptador toma una copia inmutable de un único escenario
  sintético integrado o un proveedor sintético explícito; jamás modificar la
  ejecución actual con select/reset ni leer datasets privados. Cache por revisión
  de fuente/corte y no por un runId asumido como nueva población.

## Siguiente implementación recomendada, sujeta a autorización

Comenzar con el único escenario sintético elegido, una escuela/plan y los códigos
ya seleccionables en E1. Crear un adaptador de lectura mínimo que reutilice tipos,
validador académico y courseCodes, entregue solo agregados y causas de revisión,
y preserve demanda manual. No duplicar catálogos ni invocar el envío de matrícula
para estimar. No hacen falta bibliotecas, IA ni un optimizador adicional.

Antes de codificar, decidir población/corte, definición de habilitación y reglas de
ajuste. Pruebas futuras: persona repetida por sección/intento/escenario; desaprobado
luego aprobado; varios prerrequisitos; código/plan/escuela diferentes; datos
desconocidos; curso fuera de oferta actual; electivos; ajuste conservado al
reestimar; lectura sin mutación de oferta, cupos ni estado del simulador.
