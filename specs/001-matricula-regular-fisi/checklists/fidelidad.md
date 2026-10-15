# Checklist de fidelidad: calidad de requisitos de matrícula regular FISI 2026-II

**Propósito**: evaluar completitud, claridad, consistencia, trazabilidad y verificabilidad de los requisitos escritos, priorizando fidelidad conductual e integridad y protección de datos.
**Creado**: 2026-10-11
**Feature**: [Matrícula regular virtual FISI-UNMSM 2026-II](../spec.md)
**Audiencia**: revisor y coordinador Orca.
**Momento**: antes de generar tareas; contexto de planificación local disponible.
**Profundidad**: rigurosa; alcance de emulación local autorizado y fidelidad N3 evaluados por separado.
**Evaluación inicial**: 2026-10-11, por el agente principal a petición expresa del revisor; 34 criterios satisfechos y 6 abiertos.
**Reevaluación vigente**: 2026-10-11, después de las autorizaciones locales y de la corrección del diseño r4; 40/40 criterios documentales satisfechos. No acredita implementación ni N3.

**Nota**: checklist personalizado generado mediante `$speckit-checklist`. Sus preguntas evalúan lo documentado; no constituyen procedimientos de prueba, resultados de aplicación ni nuevas decisiones funcionales.
**Responsabilidad de revisión**: el revisor decide cuándo un criterio de calidad de requisitos está satisfecho. Todos los ítems se generan sin marcar.
**Semántica de marcas**: `[x]` significa aprobación del criterio documental por el revisor; no significa implementación terminada, pruebas aprobadas o fidelidad SUM alcanzada.

## Referencias y lectura del estado de conocimiento

Las referencias de los ítems corresponden a estos documentos; los IDs FR, AC, SC, B y G pertenecen a la especificación. Los Q pertenecen al dossier y los MR al diseño local.

- [Spec y clarificaciones, 29 FR / 33 AC / 8 SC](../spec.md).
- [Plan MR-PLAN-1, revisión 4](../plan.md), [research MR-RESEARCH-1, revisión 4](../research.md), [modelo MR-MODEL-2](../data-model.md), [referencia del contrato e interfaz local](../contracts/README.md) y [quickstart de validación futura](../quickstart.md).
- [Contrato canónico MR-CONTRACT-2](../../../docs/reverse-engineering/contracts/local-api/matricula-regular.md).
- [Constitución 1.0.0](../../../.specify/memory/constitution.md) y [AGENTS.md](../../../AGENTS.md).
- [Preguntas del dossier Q-01–Q-35](../../../docs/domain/fisi/2026-II/open-questions.md).

`open-questions.md` conserva preguntas de descubrimiento y sus criterios de corroboración. Que una pregunta siga allí no elimina una respuesta posteriormente registrada como testimonio en `spec.md`. La siguiente tabla organiza esa procedencia; no aprueba ítems ni cierra N3.

| Tema / referencias | Respuesta registrada como testimonio | Definición o corroboración que permanece pendiente |
| --- | --- | --- |
| Prematrícula; Q-11/Q-12, FR-003/FR-021, AC-02/AC-20 | Debe estar habilitada antes de matrícula y ser verificable por el estudiante; la descarga no es una condición técnica. | Forma de comprobación, actor habilitante y secuencia SUM equivalente; oferta y filtrado concretos no completamente documentados. B-01/G-01. |
| Turnos; Q-09/Q-25/Q-31/Q-32/Q-35, FR-005 | PP acumulado; umbrales inclusivos, PP 17 y mayor a 19 en primer turno; acceso posterior y cobertura de ponderados en 11–12. | Horas oficiales del 11–12 sin definición; precisión, bordes temporales, categorías y corroboración SUM pendientes. B-04/G-01. |
| Validaciones y rechazo; Q-01–Q-04/Q-13/Q-14/Q-28 | Créditos y cupos al solicitar; controles de cruces/prerrequisitos en la pantalla de registro; causa de rechazo y selección reiniciada por falta de cupo. | Evento exacto, precedencia y cardinalidad SUM, literales de error y retorno para cada otra causa. El modal de error semejante es inferencia local autorizada. B-01/G-02. |
| Resultado y reporte; Q-21/Q-23 | Si falla un curso, falla toda la selección; solo aceptación genera reporte con los cursos aceptados. | Estado posterior independiente, momento de registro y recorrido completo FISI equivalente. M-01 acredita solo el aviso de éxito de un manual. B-02/B-06/G-03. |
| Cupos concurrentes; Q-15/Q-17 | Disponibilidad no actualizada, rechazo por falta de cupo y posibles ampliaciones relatadas. | No hay respuesta testimonial sobre ambos contendientes de la última vacante, ganador o instante de asignación SUM. B-03/G-03. |
| Reintentos y sesión; Q-20/Q-22/Q-23 | Sesión de 15 minutos y renovación al recargar; reingreso al expirar; registro único aparente ante doble clic; fallo de conexión relatado sin registro. | Inicio exacto del contador, efectos de otras actividades, repetición deliberada y pérdida de respuesta después de posible registro SUM. El registro único aparente no prueba idempotencia. B-05/G-03. |

L-01–L-04 son decisiones locales explícitas: todas las causas conocidas, ventanas sintéticas diferenciadas de horarios oficiales ausentes, una aceptación por última vacante y consulta/repetición sin duplicados. El plan vigente define su alcance y límites. L-05/L-06 y ACC amplían únicamente requisitos de la réplica mediante autorización posterior. No son testimonios sobre el SUM ni corroboración de MR-U01–MR-U04. Las demás condiciones desconocidas siguen siendo dependencias de sus casos, sin valores supuestos.

## Completitud de requisitos

- [x] CHK001 ¿Está documentada la habilitación previa de prematrícula como precondición independiente del turno, junto con la información que permite al estudiante reconocerla, sin confundirla con descarga o aceptación manual? [Completitud, Spec §FR-021, AC-20, FR-003, B-01, Q-11/Q-12]
- [x] CHK002 ¿Se distinguen documentalmente prematrícula vacía conocida, prematrícula incompleta y habilitación desconocida, con un resultado definido para cada condición y sin cursos supuestos? [Completitud, Spec §AC-03, FR-002/FR-006, G-01; Modelo §Perfil de reglas y conocimiento]
- [x] CHK003 ¿Están definidos el ámbito de cursos y secciones elegibles y los límites entre prematrícula, oferta, plan, equivalencias y filtrado, separando catálogos sintéticos de información oficial aún faltante? [Completitud, Spec §FR-006, AC-07/AC-09, G-01, Q-03/Q-12/Q-29]
  - **Evaluación inicial**: no satisfecho; H-FID-01. **Reevaluación vigente**: satisfecho documentalmente, con sustento en el cierre posterior al final de este archivo.
- [x] CHK004 ¿La documentación cubre las causas académicas aplicables y las condiciones desconocidas para créditos, prerrequisitos, cruces, plan, prioridad, cupos y requisitos institucionales, sin equiparar una obligación normativa con un control SUM observado? [Completitud, Spec §FR-008/FR-010/FR-026, AC-10–AC-15/AC-27, G-02; Contrato §Evaluación de reglas y ventanas]
- [x] CHK005 ¿Están documentadas las excepciones de carga y las ramas de tercera/cuarta matrícula y cuarta desaprobación, incluyendo oferta, tutoría y autorización conocida o pendiente, sin añadir trámites administrativos al recorrido virtual? [Completitud, Spec §FR-008/FR-009, AC-11/AC-13, Matriz normativa, Q-16/Q-18/Q-19/Q-30]
- [x] CHK006 ¿Están definidos el contenido y la correspondencia del reporte con la selección aceptada, su distinción de prematrícula y elección pendiente y el tratamiento de reportes previos ante rechazo? [Completitud, Spec §FR-013/FR-024, AC-17/AC-18/AC-21/AC-24; Contrato §Reporte y aceptación]

## Claridad de requisitos

- [x] CHK007 ¿Se define qué ponderado se utiliza y cómo se interpretan umbrales inclusivos y acceso posterior, identificando PP acumulado, PP exactamente 17 y PP mayor a 19 como testimonios y conservando el límite documental 19.00 de F6? [Claridad, Spec §FR-004/FR-005, AC-25/AC-26, B-04, Q-32/Q-35]
- [x] CHK008 ¿Se distingue con precisión una franja publicada, una hora oficial desconocida y una ventana sintética identificada, y se define qué información permanece disponible ante configuración horaria ausente? [Claridad, Spec §FR-027, AC-04/AC-06/AC-28/AC-29, L-02, Q-31]
- [x] CHK009 ¿La expresión «todas las causas aplicables» delimita causas conocidas y evaluables, condiciones no aplicables y datos faltantes, sin convertir un pendiente en aprobación o causa de rechazo inventada? [Claridad, Spec §FR-026, AC-27, L-01; Contrato §Resultado y recuperación / Evaluación de reglas y ventanas]
- [x] CHK010 ¿Está delimitado a qué rechazo corresponde el reinicio de selección y cómo se diferencia de una respuesta no recibida o un resultado aún desconocido, sin atribuir un retorno universal al SUM? [Claridad, Spec §FR-017/FR-023/FR-029, AC-16/AC-24/AC-31/AC-33, B-01/B-05]
  - **Evaluación inicial**: no satisfecho; H-FID-02. **Reevaluación vigente**: satisfecho documentalmente, con sustento en el cierre posterior al final de este archivo.
- [x] CHK011 ¿La documentación distingue duración testimoniada de 15 minutos de las definiciones locales de inicio, renovación y vencimiento, sin presentar sus disparadores como mecanismos SUM corroborados? [Claridad, Spec §FR-025, AC-23, B-05, Q-20; Modelo §Estados, atomicidad y lifetime]

## Consistencia entre artefactos

- [x] CHK012 ¿Son consistentes los requisitos de habilitación y registro digital con las obligaciones documentales de descarga, impresión y visado, sin añadir estas formalidades como guardas de persistencia? [Consistencia, Spec §FR-003/FR-014/FR-021, AC-02/AC-19/AC-20, RN-12/RN-19, Q-11/Q-23]
- [x] CHK013 ¿Son consistentes spec, plan, modelo y contrato respecto de todo-o-nada, reporte solo tras aceptación y L-01–L-04, manteniendo la diferencia entre resultado testimoniado y mecanismos propios? [Consistencia, Spec §FR-018/FR-022/FR-024/FR-026–FR-029, AC-21/AC-27–AC-33; Plan §Decisiones, invariantes y migración; Constitución §I/III]
- [x] CHK014 ¿Las reglas documentadas de carga especial en cuarta matrícula evitan contradicciones con el mínimo ordinario de 12 créditos y conservan un pendiente cuando la combinación de ramas especiales no está resuelta? [Consistencia, Spec §AC-10/AC-11/AC-13, RN-01/RN-09; Modelo §Perfil de reglas y conocimiento]
- [x] CHK015 ¿Las referencias al estado del plan, contrato y siguiente etapa distinguen los pendientes históricos de la aclaración del diseño local completado en revisión 2, evitando instrucciones contradictorias para Orca antes de tareas? [Consistencia, Conflict, Spec §Status / Incertidumbres y dependencias de aceptación / Dependencias y revisión del material existente; Plan §Resumen y cambio de entrada / Artefactos y ownership]
  - **Evaluación inicial**: no satisfecho; H-FID-03. **Reevaluación vigente**: satisfecho documentalmente, con sustento en el cierre posterior al final de este archivo.

## Calidad de criterios de aceptación

- [x] CHK016 ¿Cada FR tiene criterios identificables y resultados documentales medibles o una dependencia específica declarada, incluyendo restricciones de fidelidad y privacidad, sin usar un escenario genérico como sustituto de subcasos? [Trazabilidad, Verificabilidad, Spec §FR-001–FR-029, AC-01–AC-33, SC-001–SC-008; Constitución §VII]
- [x] CHK017 ¿Los criterios con «100 %» definen su universo de casos, perfiles y excepciones y la cobertura de Sistemas y Software, sin que seis recorridos base se interpreten como cobertura de toda la normativa o N3? [Verificabilidad, Spec §SC-001–SC-005/SC-008, AC-10–AC-13/AC-27–AC-33; Quickstart §Escenarios y resultados esperados]
  - **Evaluación inicial**: no satisfecho; H-FID-04. **Reevaluación vigente**: satisfecho documentalmente, con sustento en el cierre posterior al final de este archivo.
- [x] CHK018 ¿Los criterios permiten distinguir aceptación, rechazo académico, configuración pendiente y resultado no confirmado, indicando para cada uno qué efectos y documentos pueden o no atribuirse al intento? [Verificabilidad, Spec §AC-14/AC-17/AC-21/AC-28/AC-31/AC-33; Contrato §Resultado y recuperación]
- [x] CHK019 ¿Los criterios de integridad expresan resultados observables y cantidades inequívocas —cero cursos del intento rechazado, reporte correspondiente y una aceptación por última vacante— sin depender de un mecanismo interno SUM supuesto? [Verificabilidad, Spec §AC-18/AC-21/AC-24/AC-30, SC-003/SC-008, FR-018]

## Cobertura de escenarios

- [x] CHK020 ¿Está descrito el recorrido principal de ambas escuelas desde prematrícula y turno hasta elección, rechazo o aceptación y reporte, con precondiciones, resultados y procedencia separados de estados no observados? [Cobertura, Spec §User Stories 1–6, SC-003, B-01–B-06; Constitución §I]
  - **Evaluación inicial**: no satisfecho; H-FID-02. **Reevaluación vigente**: satisfecho documentalmente, con sustento en el cierre posterior al final de este archivo.
- [x] CHK021 ¿Los requisitos cubren la alternativa de turno permitido con prematrícula no habilitada y la de prematrícula habilitada con turno aún no permitido, sin que una precondición satisfaga automáticamente la otra? [Cobertura, Spec §FR-005/FR-021, AC-05/AC-20, Edge Cases]
- [x] CHK022 ¿Los requisitos de excepción distinguen falta de cupo, cruce y errores simultáneos de las mejoras propuestas de disponibilidad actualizada, deshabilitación inmediata y conservación de selección, manteniendo estas mejoras fuera del alcance aprobado? [Cobertura, Spec §Clarifications / Exclusiones, AC-14/AC-24/AC-27, L-01; Contrato de la funcionalidad §Interfaz de usuario local]
- [x] CHK023 ¿Están diferenciados los requisitos de recuperación para fallo previo al registro, pérdida de respuesta tras posible aceptación y resultado todavía desconocido, sin concluir ausencia de efectos únicamente por un fallo de comunicación? [Cobertura, Spec §FR-018/FR-029, AC-31–AC-33, B-05, Q-22/Q-23]
- [x] CHK024 ¿Los requisitos explican la relación entre expiración, nueva elección e identidad de un intento incierto consultable, sin borrar un resultado previo ni permitir una nueva aceptación por el solo hecho de renovar la sesión? [Cobertura, Spec §FR-025/FR-029, AC-23/AC-31/AC-32; Contrato §Resultado y recuperación / Evaluación de reglas y ventanas]

## Casos límite

- [x] CHK025 ¿Se especifican o se declaran pendientes precisión del PP, igualdad en los umbrales, inicio/fin de ventana, cambio de día y acceso posterior, distinguiendo bordes locales de horas y tolerancias oficiales desconocidas? [Cobertura, Claridad, Spec §AC-05/AC-06/AC-25/AC-26/AC-28, B-04, Q-25/Q-31/Q-35; Modelo §Calendario y fixture de tiempo]
- [x] CHK026 ¿El requisito de última vacante delimita dos solicitudes distintas válidas en lo demás, el rechazo completo de la otra y la ausencia de ganador predeterminado, sin atribuir prioridad, reserva o sobrecupo al SUM? [Cobertura, Spec §FR-028, AC-30, L-03, B-03, Q-15/Q-17]
- [x] CHK027 ¿Está definido qué significa «misma solicitud» frente a elección distinta, doble envío, repetición de aceptación o rechazo y cambio de contexto, con resultados documentados sin nuevas inscripciones implícitas? [Claridad, Cobertura, Spec §FR-029, AC-22/AC-32/AC-33; Contrato §Resultado y recuperación]
- [x] CHK028 ¿Está explícito el límite temporal de conservación local y el resultado tras reinicio o pérdida del estado, sin prometer recuperación entre ejecuciones ni interpretar un resultado destruido como rechazo? [Cobertura, Spec §FR-029, AC-31/AC-32, SC-008; Plan §Contexto técnico; Modelo §Estados, atomicidad y lifetime]

## Requisitos no funcionales y protección de datos

- [x] CHK029 ¿Los requisitos de protección excluyen datos privados tanto por acceso directo como por aplicaciones, respuestas, capturas, cachés o registros, e incluyen servicios locales alimentados con snapshots privados? [Completitud, Spec §FR-019, SC-007; AGENTS §Private operator JSON / Referencias A–B; Constitución §V]
- [x] CHK030 ¿Está exigida la procedencia independiente y exclusivamente sintética de todos los contextos y fixtures de aceptación, incluidos datos auxiliares, sin considerar suficiente cambiar identificadores o usar una dirección local? [Completitud, Spec §FR-019, SC-007; Research §MR-D11; Quickstart §Prerrequisitos de toda ejecución; Constitución §VII]
- [x] CHK031 ¿La documentación delimita la evidencia sanitizada admisible y prohíbe incorporar identificadores personales, material de sesión y originales privados, sin convertir la eliminación posterior de datos en permiso para acceder a ellos? [Completitud, Spec §Fuentes, clasificación y alcance de fidelidad / M-01, FR-016/FR-019; AGENTS §4; Constitución §V]
- [x] CHK032 ¿Las restricciones distinguen inspección productiva autorizada y de solo lectura de pruebas, mutaciones y uso de datos privados, manteniendo la emulación y sus escenarios sintéticos independientes del SUM? [Consistencia, Spec §FR-019/FR-020 / Exclusiones / Dependencias, SC-007; AGENTS §2.C; Constitución §V/VI]
- [x] CHK033 ¿Está documentado que el contexto y la sesión demostrativos no equivalen a autenticación o autorización productiva y que las garantías de concurrencia y conservación tienen un alcance local limitado? [Claridad, Spec §Assumptions, FR-018/FR-029; Plan §Contexto técnico; Modelo §Entidades y relaciones / Estados, atomicidad y lifetime]
- [x] CHK034 ¿Los requisitos de comprensión de estados y accesibilidad local son explícitos y evaluables, y la ausencia de objetivos de rendimiento o paridad visual exacta se distingue de una promesa implícita o un umbral inventado? [Completitud, Gap, Spec §FR-007/FR-012 / Exclusiones, SC-006; Plan §Contexto técnico / Decisiones, invariantes y migración; Constitución §I/VII]
  - **Evaluación inicial**: no satisfecho; H-FID-05. **Reevaluación vigente**: satisfecho documentalmente, con sustento en el cierre posterior al final de este archivo.

## Dependencias y supuestos

- [x] CHK035 ¿Está identificada una autoridad contractual única y documentada la reutilización o incompatibilidad de contratos y componentes existentes, con límites de migración que eviten confundir consultas históricas o reportes iniciales con nueva matrícula aceptada? [Trazabilidad, Consistencia, Spec §FR-013/FR-024 / Dependencias; Plan §Decisiones, invariantes y migración; Research §Auditoría de reutilización; Constitución §VI]
- [x] CHK036 ¿Cada perfil académico conserva facultad, escuela, plan, periodo, modalidad, versión, vigencia y fuentes, y define explícitamente el tratamiento de perfil o regla ausente sin herencia silenciosa de FISI 2026-II? [Completitud, Spec §FR-015/FR-027, SC-004, AC-28; Modelo §Perfil de reglas y conocimiento; Constitución §IV]
- [x] CHK037 ¿Las dependencias de futura generación de tareas identifican contrato y criterios vigentes, propiedad de artefactos y restricciones de los workers Orca, sin confundir completar el diseño con autorización de implementación? [Claridad, Spec §Assumptions / Dependencias, SC-005; Plan §Unidades futuras para Luna High; AGENTS §Root orchestration and folder ownership]

## Ambigüedades, conflictos y trazabilidad de fidelidad

- [x] CHK038 ¿El registro de preguntas distingue respuestas ya recibidas como testimonios, respuestas parciales, definiciones locales autorizadas y faltas de corroboración, conservando Q/B/G sin volver a presentar todo el dossier como preguntas sin responder? [Trazabilidad, Spec §Clarifications / B-01–B-06 / G-01–G-03, FR-016, SC-005; Research §MR-D02 / MR-U01–MR-U04; Dossier §Tabla operativa de preguntas]
- [x] CHK039 ¿Cada pendiente indica si afecta una definición local de un caso, una afirmación N3 o un proceso excluido, con su dependencia y evidencia de cierre, evitando tanto bloqueo general del diseño autorizado como cierre N3 por decisiones o pruebas locales? [Claridad, Trazabilidad, Spec §B-01–B-06 / G-01–G-03, SC-003/SC-008, FR-020; Research §MR-U01–MR-U04; Dossier §Prioridades de resolución]
- [x] CHK040 ¿Cada afirmación conserva clase de fuente, fecha, ámbito y límites, incluidas discrepancias F6/testimonio y uso contextual de F3, sin convertir normativa, documentación antigua, M-01 o modal de error inferido en comportamiento actual confirmado del SUM? [Trazabilidad, Consistencia, Spec §FR-004/FR-016–FR-018, SC-005/SC-006, M-01 / Matriz normativa / Calendario publicado; Constitución §II/III]

## Notas

- Los 40 ítems se generaron inicialmente sin marcar. La evaluación inicial autorizada marcó 34 criterios y conservó 6 abiertos; la reevaluación tras cierre local marca 40/40, conservando el historial de hallazgos. No representa ejecución o aprobación de pruebas de aplicación.
- El revisor puede anotar hallazgos y referencias junto a cada ítem. Una carencia requiere aclaración o corrección documental; una marca no acredita funcionamiento ni cierra una brecha N3.
- Las referencias a criterios y a `quickstart.md` permiten revisar su calidad y cobertura; no incorporan sus procedimientos ni resultados como parte de este checklist.
- `$speckit-implement` lee el estado de los checklists como gate y no debe modificar estas marcas. Distinguir los hallazgos que afectan tareas locales de las dependencias de fidelidad N3 aún abiertas.
- `checklists/requirements.md` conserva su ciclo propio de `$speckit-specify`/`$speckit-clarify`. Este archivo no lo sustituye ni altera ningún checklist existente.
- Esta generación no modifica requisitos, decisiones locales, contratos o políticas; no añade implementación ni alcance de despliegue productivo.


## Evaluación documental inicial del 2026-10-11

**Autorización**: evaluación solicitada expresamente por el usuario. Se revisaron únicamente los documentos referenciados; no se inspeccionó código ni se ejecutó la aplicación. Las marcas corresponden a suficiencia de lo escrito para el alcance de cada pregunta, incluso cuando el documento define correctamente un pendiente N3.

**Resultado**: 34/40 satisfechos; CHK003, CHK010, CHK015, CHK017, CHK020 y CHK034 permanecen sin marcar. Los seis criterios abiertos corresponden a cinco hallazgos locales. Las respuestas del usuario se conservan como testimonios, con las mismas limitaciones y sin nuevas preguntas de corroboración.

### Sustento de los criterios satisfechos

Las referencias de cada ítem permanecen vigentes. Esta tabla registra por qué se considera satisfecho cada criterio documental; no registra resultados funcionales.

| Ítem | Sustento escrito de la aprobación |
| --- | --- |
| CHK001 | FR-021/AC-20 separan habilitación, turno y descarga; el contrato, «Operaciones HTTP», expone habilitación true/false/null en el contexto consultable antes de matrícula. La apariencia SUM permanece pendiente B-01. |
| CHK002 | AC-03 y modelo, «Perfil de reglas y conocimiento», diferencian lista vacía completa, documento incompleto y habilitación null; las condiciones desconocidas producen gap, sin inventar oferta ni habilitación. |
| CHK004 | FR-008/FR-026, matriz normativa y contrato, «Evaluación de reglas y ventanas», identifican condiciones y causas conocidas y datos faltantes; no atribuyen los controles locales a una observación SUM. |
| CHK005 | AC-11/AC-13, RN-08/RN-09/RN-17 y modelo separan carga excepcional, tutoría, oferta y autorización; cuatro desaprobaciones no se confunden con cuarta matrícula ni crean trámites administrativos. |
| CHK006 | FR-024/AC-18/AC-21 y contrato, «Reporte y aceptación», definen cursos, secciones, plan, créditos y correspondencia del reporte aceptado; el rechazo no crea reporte del intento ni elimina uno previo. |
| CHK007 | Clarifications, FR-005/AC-25/AC-26 y calendario preservan PP acumulado, >=17, >19 y acceso posterior como testimonio; F6 conserva su máximo documental 19.00. |
| CHK008 | L-02/FR-027/AC-28/AC-29, modelo, «Calendario y fixture de tiempo», y contrato distinguen publicado, unknown y synthetic, sin fallback; los documentos/calendario siguen consultables. |
| CHK009 | FR-026/AC-27 y contrato delimitan causas conocidas independientes, reglas no aplicables y gaps. Configuration-pending no significa aprobación ni rechazo académico inventado. |
| CHK011 | FR-025/B-05 conservan duración y renovación relatadas; contrato/modelo identifican inicio, renovación explícita y frontera de vencimiento como simulación local. |
| CHK012 | FR-003/FR-014/FR-021, AC-02/AC-19/AC-20 y contrato mantienen descarga/visado como formalidades distintas de habilitación y registro digital. |
| CHK013 | L-01–L-04, FR-022/FR-024/FR-026–FR-029, modelo y contrato concuerdan en resultados propios, cero efectos académicos del rechazo y garantía limitada al run; no recuperan mecanismos SUM. Esta aprobación no cubre la navegación no definida de H-FID-02. |
| CHK014 | Modelo, «Perfil de reglas y conocimiento», sustituye el mínimo ordinario en las ramas especiales de cuarta matrícula y mantiene pending para combinaciones no resueltas; no exige simultáneamente curso único y mínimo 12. |
| CHK016 | La tabla FR y SC relaciona los 29 requisitos con AC/SC o dependencias B/G identificadas; quickstart conserva esa correspondencia. Se aprueba la trazabilidad, sin aprobar el denominador de cobertura de CHK017. |
| CHK018 | Contrato, «Resultado y recuperación», diferencia accepted/rejected/configuration-pending y lookup unknown; distingue efectos académicos, resultado conservado y falta de confirmación del cliente. |
| CHK019 | AC-21/AC-24/AC-30 y contrato expresan cero cursos/reporte del intento rechazado, selección completa aceptada y una sola ocupación nueva por última vacante. |
| CHK021 | AC-05 y AC-20 definen precondiciones independientes; el modelo conserva habilitación y ventana separadas y el contrato incluye ambas condiciones, sin que una apruebe la otra. |
| CHK022 | Clarifications, research MR-D06 y referencia de interfaz local separan causas de rechazo de polling, bloqueo inmediato y conservación de selección propuestos como mejoras; no adoptan esas mejoras. |
| CHK023 | AC-31–AC-33 y contrato distinguen respuesta perdida tras aceptación, resultado unknown y fallo previo; consultar no registra y un fallo de transporte no demuestra ausencia de efectos. |
| CHK024 | Contrato/modelo mantienen resultados del run después de caducar sesión, exigen nueva entrada para nuevos registros y conservan el intento incierto para recuperación. |
| CHK025 | Calendario/AC-25/AC-26/B-04 conservan bordes SUM pendientes; el contrato explicita precisión y límites temporales locales, diferenciándolos de las horas oficiales ausentes. |
| CHK026 | FR-028/AC-30 delimitan dos solicitudes distintas válidas en lo demás, exactamente una aceptación y un rechazo completo; no exigen ganador ni política SUM de asignación. |
| CHK027 | Contrato, «Resultado y recuperación», define identidad, equivalencia de solicitud, elección diferente, repetición aceptada/rechazada y separación de actores; ninguna consulta/repetición añade efectos. |
| CHK028 | Plan, «Contexto técnico», y modelo, «Estados, atomicidad y lifetime», limitan conservación al run; reinicio cambia identidad de ejecución y no promete recuperar el registro perdido. |
| CHK029 | AGENTS, «Private operator JSON» y fuentes A/B, constitución V y FR-019 prohíben acceso privado directo/indirecto y servicios locales con snapshots privados. |
| CHK030 | Constitución VII, research MR-D11 y prerrequisitos del quickstart exigen factories sintéticas independientes para todo el proceso, incluido contexto auxiliar; localhost o datos renombrados no prueban procedencia. |
| CHK031 | Spec, «Fuentes, clasificación y alcance de fidelidad» y M-01, AGENTS y constitución V excluyen originales privados, identificadores y material de sesión; el operador debe sanitizar antes de suministrar. |
| CHK032 | AGENTS 2.C y constitución V distinguen autorización explícita de inspección en solo lectura de mutaciones/pruebas/datos privados; spec excluye conexión del emulador a SUM. |
| CHK033 | Contrato, «Alcance, contexto y aislamiento», y plan/modelo delimitan actor demostrativo, loopback, un proceso y memoria por run; no prometen autenticación pública, cluster o durabilidad. |
| CHK035 | Research, «Auditoría de reutilización», plan y contracts/README identifican contrato canónico y compatibilidad de lecturas existentes; el reporte propio nunca procede del seed histórico. |
| CHK036 | FR-015/SC-004, perfiles del modelo y Scope/Source del contrato conservan ámbito, revisión, fuentes y aplicación al periodo; perfil/regla ausente produce pendiente sin herencia FISI. |
| CHK037 | Plan, «Unidades futuras para Luna High», fija archivos, dependencias, revisión contractual y criterios; AGENTS establece límites de workers Orca y separa diseño de autorización de implementación. La actualización del estado general sigue abierta en CHK015. |
| CHK038 | Clarifications/B/G y research MR-D02/MR-U distinguen respuestas testimoniales de faltas de definición o corroboración. Las Q del dossier no se reinterpretan como ausencia de todas las respuestas. |
| CHK039 | B/G y research MR-U ubican dependencias N3; L-01–L-04 permiten trabajo local, otras condiciones unknown quedan pendientes por caso y los procesos P2 excluidos no se incorporan. Los vacíos locales encontrados en esta revisión se detallan abajo. |
| CHK040 | Spec y research conservan clase, fecha y ámbito, discrepancia F6/>19, uso contextual de F3 y límites de M-01; modal de error y mecanismos propios no se presentan como SUM confirmado. |

### Hallazgos documentales abiertos en la evaluación inicial

Estos hallazgos no cambian reglas ni adoptan decisiones. Su resolución requiere editar los documentos afectados y reevaluar únicamente los criterios correspondientes. No se necesita información privada ni experimentos productivos para completar las definiciones locales.

| ID / criterio | Hallazgo y evidencia escrita | Impacto en tareas locales | Condición de cierre documental |
| --- | --- | --- | --- |
| H-FID-01 — CHK003 | Spec FR-006 declara pendiente la relación exacta entre prematrícula, oferta y filtrado; AC-07 dice que aparecen cursos de prematrícula. Modelo y contrato separan documentos/oferta, pero no fijan la pertenencia a prematrícula como condición de elegibilidad local. «Operaciones HTTP» exige que curso/sección existan y se relacionen en catálogo y define otro plan como rechazo; no precisa el caso de curso ofertado del mismo plan ausente de una prematrícula completa. | **Bloquea las tareas afectadas de selección y admisión de solicitudes** MR-B01/MR-B03/MR-C02: el worker tendría que decidir qué conjunto es elegible y si ese caso se admite, rechaza o queda fuera. Los fixtures base coincidentes no resuelven el requisito general. | Definir en spec/modelo/contrato la relación local entre prematrícula y oferta y el tratamiento del caso conocido descrito, o delimitar explícitamente su exclusión con un resultado definido. Mantener filtrado SUM como pendiente Q-03/Q-12/Q-29; no exigir corroboración para una decisión propia. |
| H-FID-02 — CHK010/CHK020 | FR-023/AC-24 y referencia de interfaz local fijan retorno al registro con reinicio para falta de cupo. AC-16 conserva destino de otras causas pendiente y SC-003 exige navegación en el recorrido de rechazo por cruce. Plan MR-C02 dice «ningún ... selección conservada por rechazo» de forma general; no define el destino y estado local tras un cruce sin falta de cupo, ni delimita esa generalización. | **Bloquea la tarea de recorrido local de rechazo por cruce** MR-C02 y su aceptación MR-V01. No impide definir detección del cruce o todo-o-nada. No hay permiso para atribuir retorno universal al SUM. | Especificar como política local el destino y estado de elección para cruce sin cupo agotado y otras causas incluidas, y precisar el alcance de la restricción genérica del plan. Conservar FR-023 y recuperación de L-04; no introducir como hecho SUM una navegación supuesta ni adoptar silenciosamente la mejora de conservación. |
| H-FID-03 — CHK015 | Spec Status dice «el plan previo requiere actualización»; G-03 dice «contrato, persistencia y garantía ... pendientes de plan»; la explicación de dependencias afirma «un contrato que aún no existe» y la siguiente etapa sigue siendo retomar plan. Plan r2, modelo y MR-CONTRACT-1 ya existen y el plan declara diseño local completo. | **Obstáculo documental para un handoff inequívoco de tareas**: Orca recibe dos estados de etapa incompatibles. No invalida por sí mismo los resultados locales ya diseñados ni obliga a repetir la auditoría. | Actualizar referencias de estado y siguiente etapa en spec, preservando la aclaración histórica, L-01–L-04 y los pendientes N3. Identificar plan r2 y contrato canónico existentes; no alterar los testimonios. |
| H-FID-04 — CHK017 | SC-002 habla de «100 % de los casos normativos sintéticos acordados» sin inventario cerrado. Quickstart MR-RULES enumera familias de casos y el modelo enumera variantes, pero no fija cuáles constituyen ese universo ni el desglose de excepciones, condiciones y ramas. SC-001/SC-004 también usan cuantificación universal sin un catálogo de contextos; SC-003 y SC-008 sí delimitan recorridos y criterios por escuela. | **Bloquea el cierre de las tareas de cobertura de SC-001/SC-002/SC-004**, especialmente MR-B01/MR-V01, como compromisos completos y medibles. Se pueden identificar unidades técnicas y requisitos ya concretos, pero no asignar un «100 %» indefinido como aceptación. | Añadir un inventario documental de casos y variantes requeridos, con IDs, ámbito escolar, requisito/criterio y resultado esperado o pendiente explícito. Definir el denominador de cada porcentaje afectado; no agregar procedimientos de ejecución ni extrapolar a toda FISI/N3. |
| H-FID-05 — CHK034 | Comprensión de estados está definida en contrato/interfaz; el plan menciona patrón «dialog accesible» y aceptación «y teclado», sin criterios concretos para los controles y avisos del flujo nuevo. No se documentan requisitos verificables de foco, identificación de controles o comunicación accesible de resultados. Exclusión de paridad visual exacta y ausencia de SLO sí están explícitas. | **Bloquea una aceptación completa de accesibilidad local en MR-C02/MR-V01**, no las garantías académicas/backend. El worker no debe convertir una referencia genérica a un patrón en aprobación del flujo nuevo. | Precisar el mínimo de accesibilidad local y los resultados documentales esperados de interacción y reconocimiento de estados. No inventar atributos visuales SUM, objetivos de rendimiento ni una certificación normativa no solicitada. |

### Corroboraciones N3 pendientes, separadas de los hallazgos locales

Ninguna marca de este checklist cierra estas brechas. Las respuestas ya registradas no se eliminan ni vuelven a preguntarse por falta de evidencia independiente.

| Dependencia | Pendiente de referencia | Efecto sobre avance local |
| --- | --- | --- |
| B-01 / G-02 / MR-U01 | Literales de rechazo, evento y precedencia/cardinalidad SUM y navegación comparable; Q-01–Q-04/Q-13/Q-14/Q-28. Modal semejante es inferencia local, M-01 solo éxito de manual. | No impide causas locales L-01. Navegación local incompleta se atiende en H-FID-02, sin resolver la pregunta SUM. |
| B-02 / G-03 | Corroboración independiente del rechazo todo-o-nada relatado y ausencia de registros parciales de ese intento; Q-21/Q-23. | No impide todo-o-nada local ya definido; no demuestra transacciones internas SUM. |
| B-03 / G-03 / MR-U03 | Resultados de ambos contendientes, ganador y momento real de asignación de última vacante; Q-15/Q-17. | L-03 define una aceptación/otro rechazo completo para la réplica, sin ganador predeterminado. |
| B-04 / G-01 / MR-U02 | Horas oficiales 11–12 sin definición; bordes, precisión, categorías y corroboración de PP/acceso posterior; Q-09/Q-25/Q-31/Q-32/Q-35. | L-02 conserva unknown o ventana synthetic identificada. Horas desconocidas no bloquean tareas locales que respeten ese resultado. |
| B-05 / G-03 / MR-U04 | Inicio/renovación reales de sesión, reenvío deliberado y recuperación SUM de respuesta perdida tras posible registro; Q-20/Q-22/Q-23. | Sesión simulada y L-04 están definidos con garantía durante run; no prueban idempotencia o recuperación SUM. |
| B-06 / G-03 | Recorrido completo FISI: aviso, redirección terminada, reporte correspondiente y momento verificable del registro; Q-23/Q-28. | Reporte propio solo aceptado está definido. El aviso del manual no prueba persistencia FISI. |
| Otros G-01/G-02 | Planes/oferta/equivalencias reales, habilitación observable y condiciones institucionales/administrativas específicas; Q-05/Q-06/Q-10/Q-12/Q-16/Q-18/Q-19/Q-29/Q-30/Q-33/Q-34. | Datos conocidos sintéticos o gaps por caso; no generar reglas reales faltantes. Q-07/Q-24/Q-26/Q-27 siguen fuera del proceso. |

### Disposición inicial para Orca antes de tareas

- **No aprobar todavía un conjunto completo de tareas funcionales con aceptación cerrada**: quedan las definiciones de H-FID-01/H-FID-02, la sincronización de etapa H-FID-03 y la precisión de cobertura/accesibilidad H-FID-04/H-FID-05.
- **Avance permitido**: preparar correcciones documentales y desgloses de requisitos ya definidos, reutilizando el plan r2; las bases de atomicidad, última vacante, identidad/recuperación, perfil y protección de datos no requieren replanteamiento general. Un desglose parcial debe mantener explícitas las dependencias afectadas, sin declararlas listas.
- **N3 no es un bloqueo general**: B-01–B-06/MR-U01–MR-U04 siguen abiertas para afirmaciones de fidelidad. Su falta de corroboración no impide las políticas locales autorizadas cuando sus propios requisitos están definidos.
- Esta evaluación modifica únicamente este checklist. `requirements.md`, spec, plan, contrato, dossier, constitución e instrucciones se conservan; no se generan tareas ni se autoriza implementación desde la revisión.


## Reevaluación tras autorizaciones locales y diseño r3, 2026-10-11

El usuario autorizó expresamente las políticas locales de selección y retorno y adoptó
MAT/ACC para esta feature. Se revisaron spec, plan r3, modelo, MR-CONTRACT-2, catálogo finito,
research y quickstart actualizados, junto con la [revisión de fuentes públicas](../../../docs/domain/fisi/2026-II/planning-source-review-2026-10-11.md).
Los hallazgos y la disposición inicial anteriores son historia de revisión, no el gate vigente.
No se modifica la clase de los testimonios ni se alcanza N3 con esta reevaluación.

| Hallazgo / criterio reevaluado | Sustento de cierre documental local |
| --- | --- |
| H-FID-01 / CHK003 | L-05 y FR-006/AC-07/AC-09 definen intersección de prematrícula completa y oferta aplicable del mismo plan. Modelo y MR-CONTRACT-2 distinguen datos incompletos, vacío conocido y curso ofertado del mismo plan fuera de prematrícula, con causa local COURSE_NOT_IN_PRE_ENROLLMENT. Otro plan tiene su condición PLAN_MISMATCH separada. MAT-02-V03–V08 fijan variantes y resultados. |
| H-FID-02 / CHK010 | L-06 y FR-023/AC-16 extienden retorno al registro y elección vacía a todo rechazo académico definitivo local. Contrato/UI/modelo excluyen explícitamente protocolo, configuración pendiente y transporte incierto de esa transición; el intento incierto sigue recuperable. No se generaliza navegación SUM. |
| H-FID-02 / CHK020 | Los recorridos de ambas escuelas ya incluyen destino y elección para rechazo por cruce sin falta de cupo en MAT-03-V01 y retorno por cierre/Escape en V06; SC-003 conserva los seis recorridos, con aceptación/rechazo y reporte/ausencia diferenciados. |
| H-FID-03 / CHK015 | Spec identifica plan revisión 3 y MR-CONTRACT-2 existentes y deja generación de tareas como etapa documental. Plan/research/modelo/contrato/UI/guía referencian la misma revisión contractual. La aclaración histórica conserva su origen; los pendientes SUM no se presentan como contrato local inexistente. |
| H-FID-04 / CHK017 | acceptance-catalog.md fija 113 variantes funcionales ×2 escuelas =226 instancias, sin sumar reejecuciones. SC-001=22; SC-002=50 known normativos y16 pending separados; SC-003=6; SC-004=12; SC-005=80 entradas documentales; SC-006=226 más revisión documental; SC-007 aplica a226 funcionales y170 celdas ACC por separado; SC-008=22. Cada universo tiene IDs; unknown esperado no se cuenta como conformidad normativa. |
| H-FID-05 / CHK034 | Spec adopta ACC-01–ACC-10 como requisitos locales con umbrales y excepciones W3C específicas; catálogo define170 celdas aplicables y N/A predeterminados, además de foco al abrir/cerrar modal y navegar a reporte. Alcance solo feature; no Inicio general, SLO nuevo, paridad visual exacta, certificación integral AA o aplicabilidad jurídica declarada. |

**Gate documental vigente:** 40/40 criterios satisfechos para el alcance local autorizado;
H-FID-01–H-FID-05 cerrados documentalmente. Se habilita generar tareas basadas en estos
requisitos y contratos, sin ejecutar implementación desde esta revisión. `requirements.md`
conserva su propio estado e historial; no se modifica ni se sustituye por estas marcas.

**Gate N3:** B-01–B-06 y MR-U01–MR-U04 permanecen pendientes, como describe la tabla previa.
Normativa pública, testimonios, políticas locales y catálogo de pruebas futuras no prueban
comportamientos actuales SUM. La ausencia de corroboración bloquea sus afirmaciones N3,
no estas tareas locales ya definidas. Ningún escenario de aplicación se ha ejecutado.


## Comprobación posterior a C1/U1/I1, 2026-10-11

La autorización posterior a `speckit-analyze` permite corregir tres puntos documentales.
La revisión r3 y sus denominadores anteriores se conservan como historia, no como cifras
actuales del catálogo. El universo vigente tras C1 es121 variantes ×2 escuelas=242
instancias funcionales, manteniendo170 celdas ACC separadas y51 tareas pendientes.

- **C1 / CHK016–CHK017:** PP>19 se vincula a AC-25; AC-26 recibe ocho variantes
  propias de los días11/12 y PP0/16/17/20 en ventanas exclusivamente sintéticas.
  No se deducen horarios oficiales ni categorías SUM pendientes.
- **U1 / CHK020/CHK037:** Foundation/T007 entrega el evaluador único de acceso
  antes de Context/US1; T012 lo comprueba y T015 lo consume. T020 lo reutiliza
  para US2, sin una segunda implementación ni hardcode de permisos. Elegibilidad
  de entrada no certifica una elección ni sustituye las validaciones al solicitar.
- **I1 / CHK015/CHK040:** se diferencian la consulta inicial y la revisión pública
  posterior, y se sincroniza la evaluación constitucional vigente con plan r4.

Las40 marcas siguen indicando calidad documental local; no se modifica el estado de
`requirements.md` ni se declara N3 o aceptación funcional. Las comprobaciones finales
de estas correcciones se registran en el workflow, no como pruebas de la aplicación.
