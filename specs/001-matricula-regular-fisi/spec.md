# Feature Specification: Matrícula regular virtual FISI-UNMSM 2026-II

**Feature Branch**: `jeanpzh/REA` (rama existente; no se creó ni cambió una rama).

**Created**: 2026-10-11

**Status**: Diseño y requisitos locales actualizados — [plan revisión4](plan.md) y
[contrato canónico MR-CONTRACT-2](../../docs/reverse-engineering/contracts/local-api/matricula-regular.md)
vigentes; catálogo finito y tareas documentales. Implementación no iniciada; N2 normativa
y N3 pendiente separados de decisiones `local-only` L-01–L-06.

**Input**: Emular prematrícula, habilitación por turno, selección de cursos, validaciones,
rechazo y confirmación de matrícula regular virtual FISI-UNMSM 2026-II. Distinguir normas,
observaciones, testimonios e incertidumbres. Excluir reserva, retiro, extemporánea y pagos
reales. Definir QUÉ debe hacer el sistema sin inventar mensajes, orden de validaciones,
mecanismos de cupos ni transacciones atribuidos al SUM. La autorización posterior permite
definir resultados locales para errores simultáneos, ventanas sintéticas, concurrencia y
recuperación sin presentarlos como comportamiento confirmado de producción.

## Clarifications

### Session 2026-10-11

Contraste documental solicitado con
[open-questions.md](../../docs/domain/fisi/2026-II/open-questions.md), corte 2026-10-11.
Se identifican las 20 preguntas P0 del dossier y se vinculan a seis bloqueos de fidelidad.
El contraste inicial no formuló preguntas. Posteriormente el usuario respondió cinco preguntas
agrupadas sobre los seis bloqueos y aportó precisiones posteriores sobre seis aspectos.
Los relatos se integran como testimonios del 2026-10-11; los recortes sin identificadores del
aviso de éxito acreditan únicamente su contenido visible en el manual de procedencia declarada.
El usuario identifica su experiencia como FISI 2026-II y periodos anteriores recurrentes;
identifica las capturas como procedentes de un manual de matrícula. No proporciona título,
versión, fecha o alcance institucional verificable de ese manual.

- Q: ¿Qué ponderado usa SUM y cuándo habilita exactamente la matrícula? → A: El usuario
  relata uso del ponderado acumulado de todos los ciclos, reflejado en el ranking y actualizado
  después de cada ciclo. Afirma que no se habilita antes de la hora asignada, que un estudiante
  puede entrar en franjas posteriores a la propia y que PP mayor a 19 accede al primer turno.
  Precisa comparación mayor o igual: PP exactamente 17 y PP mayor a 19 entran en el primer
  turno, y 11–12 abarca todos los ponderados de quienes no se matricularon el día anterior.
  No fija horas operativas de esos días, categorías administrativas completas, redondeo ni
  tolerancia temporal. La procedencia declarada es FISI 2026-II y experiencias anteriores.
- Q: ¿Qué ocurre desde que entras a elegir cursos hasta que una solicitud es rechazada? → A:
  Relata cursos de prematrícula y descarga solo como referencia para preparar horario.
  Créditos y falta de cupo se comprueban al solicitar matrícula; un rechazo muestra aviso/modal
  con la causa y devuelve generalmente a la pantalla inicial de registro sin conservar elección.
  Precisa que los controles de cruces y prerrequisitos se realizan en la pantalla de registro;
  un cruce genera aviso con su causa. No aporta orden entre controles, evento exacto para
  cada prerrequisito, errores simultáneos ni literal de rechazo. Validar cruces inmediatamente
  al elegir y deshabilitar la opción siguen siendo mejoras propuestas. El usuario autoriza
  inferir para la emulación un modal de error de estructura semejante al de éxito, con icono
  de error y descripción de la causa; no autoriza inventar un literal SUM. También exige que la
  prematrícula esté habilitada antes de iniciar matrícula y que el estudiante pueda verificarlo;
  no equipara habilitación con descarga ni define su mecanismo de comprobación.
- Q: ¿Qué queda registrado después de aceptar o rechazar una selección y cómo puedes
  comprobarlo? → A: Relata generación de reporte cuando la operación se acepta y modal con
  causa más retorno al registro cuando se rechaza. Precisa todo-o-nada a nivel funcional:
  si falla un curso, se rechaza toda la selección y no queda ninguno de ese intento matriculado.
  Solo una operación aceptada genera reporte, con los cursos aceptados. Esto no demuestra
  transacciones internas ni su implementación. Instante de persistencia, comprobación
  independiente y relación operativa con impresión/visado siguen sin evidencia equivalente.
- Q: ¿Qué comportamiento comprobado conoces cuando se agota una sección o dos estudiantes
  intentan obtener la última vacante? → A: Relata ausencia de disponibilidad actualizada en
  su segundo turno y rechazo por falta de cupo al solicitar matrícula. Menciona posibles
  ampliaciones por personal interno sin aportar prueba de su mecanismo. No describe los dos
  resultados de una disputa concurrente ni el instante de reserva/descuento. Precisa que
  quien recibe rechazo por falta de cupo vuelve a una selección reiniciada y no recibe reporte
  de esa operación; no identifica el ganador, orden de llegada ni resultados de ambos actores.
- Q: ¿Qué ocurre ante doble clic, repetición de la solicitud, recarga, expiración de sesión
  o pérdida de conexión durante la confirmación? → A: Relata lentitud y espera, una duración
  de sesión de 15 minutos, renovación al recargar la página y cierre al expirar. No precisa
  el evento que inicia el cómputo ni el efecto de otras actividades. Relata que el doble clic
  parece producir un solo registro, que ante falla de conexión no se registra nada y que al
  expirar debe iniciar sesión y repetir el recorrido. La palabra «parece» mantiene el registro
  único como comportamiento aparente; no prueba idempotencia. No especifica reenvío deliberado
  ni pérdidas de respuesta posteriores a un posible registro, y no se generaliza ausencia de
  efectos a toda falla de comunicación.

**Autorización local posterior del 2026-10-11:** el usuario aporta directamente una decisión
con cuatro políticas; no se formulan nuevas preguntas ni se cambia la clase de sus relatos.

- Q: ¿Qué decisiones locales se autorizan para avanzar el diseño sin cerrar la fidelidad N3?
  → A: Mostrar todas las causas aplicables ante errores simultáneos; mantener desconocidas
  las horas del 11–12 y usar ventanas sintéticas identificadas para pruebas; aceptar una sola
  solicitud por última vacante y rechazar completamente la otra; permitir consultar el
  resultado y proteger contra duplicados ante respuesta perdida. Son decisiones propias
  de la réplica, no respuestas sobre cómo actúa el SUM.

| Decisión | Comportamiento autorizado / clase | Criterios y límite |
| --- | --- | --- |
| L-01 | `local-only`: mostrar todas las causas de rechazo aplicables al contexto conocido ante errores simultáneos. | FR-026/AC-27; no se prescribe orden de presentación ni precedencia SUM. No convertir una regla desconocida en aprobada o en causa inventada. |
| L-02 | `local-only`: conservar horas del 11–12 como desconocidas, usar franjas publicadas donde hay respaldo y ventanas sintéticas identificadas en pruebas. | FR-027/AC-28/AC-29; configuración ausente produce un pendiente explícito, sin habilitación por horas supuestas ni fallback. Las ventanas de prueba no completan F6. |
| L-03 | `local-only`: dos solicitudes distintas, válidas en lo demás, para una última vacante producen exactamente una aceptación y un rechazo completo. | FR-028/AC-30; sin sobreasignación, registros parciales ni reporte del intento rechazado. No se identifica un estudiante ganador de antemano ni se elige mecanismo de asignación. |
| L-04 | `local-only`: consultar el resultado de una solicitud y proteger contra duplicados al repetir esa misma solicitud después de perder su respuesta. | FR-029/AC-31–AC-33; consultar no registra. Una respuesta ausente no implica aceptación ni rechazo. No se prescribe clave, endpoint, transacción, reintento automático o duración de persistencia. |

### Autorización de cierre local posterior a la investigación

La [revisión pública suplementaria](../../docs/domain/fisi/2026-II/planning-source-review-2026-10-11.md)
registra investigación aportada por el usuario y cuatro autorizaciones posteriores.
La investigación es entrada documental, no prueba de comportamiento SUM; PUB-02 reconsulta
F1 existente, sin crear una norma nueva. PUB-01/PUB-03 no completan horas11–12 ni filtrado;
PUB-04 no establece aplicabilidad jurídica vigente al prototipo. Testimonios Q/A originales,
F6 y fuentes normativas conservan su clase, ámbito y límites.

| Decisión nueva | Definición local aprobada | Aceptación existente extendida |
| --- | --- | --- |
| L-05 | Solo seleccionables en intersección prematrícula COMPLETA del plan vigente y oferta aplicable del mismo plan; incompleto produce gap. Course ofertado de ese plan ausente de prematrícula completa no es elegible. | FR-006, AC-07/AC-09. Cause propio COURSE_NOT_IN_PRE_ENROLLMENT al forzar solicitud de catálogo conocida; sin datos inventados. Filtrado SUM Q-03/Q-12/Q-29 sigue pendiente. |
| L-06 | Todo rechazo académico DEFINITIVO retorna al registro con elección reiniciada. Transporte incierto conserva identidad recuperable; no aplicar a protocolo o configuration-pending. | FR-023, AC-16/AC-24/AC-27; navegación local, no retorno universal SUM. |

MAT-01–MAT-10 son categorías, no diez casos: el [catálogo finito](acceptance-catalog.md)
conserva 29 FR, 33 AC, 8 SC, excepciones, repitencia, aislamiento, privacidad, concurrencia y
recuperación. ACC-01–ACC-10 son requisitos locales medibles de las pantallas de esta feature,
con fuentes W3C y excepciones precisas allí. No incluyen Inicio general ni certifican A/AA
integral. Gestión de foco/estados/modales forma parte de esa aceptación local. Las pruebas
futuras del catálogo son requeridas explícitamente; esta etapa solo diseña sus tareas.

Las políticas autorizadas están fijadas en la API y persistencia propias documentadas.
Se conserva el requisito testimoniado todo-o-nada, el reporte solo tras aceptación y la
separación entre elección y registro. N3 conserva su gate independiente. La aprobación
de L-01–L-04 no adopta polling, conservación de elección tras rechazo ni validación inmediata
de cruces; las otras preguntas del dossier permanecen abiertas en sus casos afectados.

Las primeras capturas aportadas contienen identificadores personales y muestran un contexto
distinto de FISI 2026-II. El usuario las identifica como capturas de un manual y describe una interfaz
casi igual entre facultades. Se registra esa generalización como testimonio de apariencia,
no como prueba de reglas o efectos comunes a todas las facultades. Los archivos originales
no se abrieron ni copiaron al repositorio y no se utilizan para transcribir mensajes ni cerrar
N3. Su posible uso requiere versiones previamente sanitizadas y metadatos del manual;
una dirección local no demuestra datos sintéticos. La procedencia relatada no sustituye esa revisión.

**M-01 — aviso de éxito del manual:** los nuevos recortes 3 y 4 aportados en la conversación
muestran solo el modal, sin identificadores personales visibles. Permiten registrar el título
«Aviso», el literal «La Matrícula se registró exitosamente. Lo estamos redireccionando a su
reporte de matrícula.» y el indicador «REDIRECCIONANDO...». Son dos recortes del mismo estado,
no pruebas independientes ni una observación FISI 2026-II. Acreditan apariencia/texto del aviso,
no una escritura persistida ni la redirección efectivamente completada. Solo se conserva este
resumen textual mínimo; los originales no se copian. El modal de rechazo semejante con icono
de error y descripción de causa se registra como inferencia local autorizada, sin mensaje literal.

Las mejoras propuestas son actualización visible de disponibilidad, comprobación inmediata de
cruces con opciones no elegibles deshabilitadas y conservación de elección tras rechazo.
No se adoptan como requisitos de reproducción del SUM ni se ejecutan desde clarify. Requerirían
un alcance local separado expresamente definido; tampoco se adopta un mecanismo de actualización.
La petición de generalizar la interfaz se admite como criterio local de reutilización de
estructura común donde corresponda; no amplía este proceso a otras facultades ni elimina
sus perfiles académicos. La ausencia de descarga obligatoria se refiere a prematrícula,
según la respuesta inicial; no suprime las obligaciones documentales normativas.
La habilitación previa de prematrícula y su verificación por el estudiante son un requisito
expreso de la emulación, FR-021/AC-20. Su representación observable, actor que habilita y
comprobación dentro del recorrido SUM siguen pendientes; no se inventa una aceptación manual.

**Bloqueante** significa que no se puede cerrar el requisito conductual ni su aceptación N3
en los casos afectados. No invalida las reglas normativas respaldadas ni bloquea documentación
independiente o el diseño local cubierto por L-01–L-04. Un pendiente de definición local que
no quede cubierto conserva su dependencia específica. El recorrido disponible sigue siendo
testimoniado: no hay en el dossier una
secuencia observada de selección, rechazo o confirmación. F6 es observación documental del
calendario, no prueba de una transición SUM.

| Bloqueo | Preguntas críticas del dossier | Incertidumbre que impide fidelidad | Dependencias afectadas | Evidencia necesaria para cerrar |
| --- | --- | --- | --- | --- |
| B-01 — Validaciones y rechazo | Q-01, Q-02, Q-03, Q-04, Q-11, Q-12, Q-13, Q-14, Q-28; todas P0 | **Precisado por testimonio:** prematrícula habilitada sin descarga obligatoria; créditos/cupo al solicitar; cruces/prerrequisitos en pantalla de registro; rechazo con causa y selección reiniciada. **BLOQUEANTE N3 restante:** evento exacto, precedencia, múltiples errores y literal de rechazo. Modal similar con icono de error es inferencia local autorizada, no captura de error. L-01 define todas las causas aplicables para la réplica; no responde esas preguntas SUM. | G-01/G-02; FR-003/FR-006/FR-008/FR-009/FR-012/FR-017/FR-021/FR-023; AC-02/AC-07/AC-12/AC-14/AC-16/AC-20/AC-24 y SC-003. L-01/FR-026/AC-27 habilitan planificación del rechazo local. | Secuencias sanitizadas de causas y errores simultáneos, con evento y navegación exactos. M-01 solo acredita el aviso de éxito de un manual; no cierra el literal de rechazo. |
| B-02 — Persistencia y efectos parciales | Q-21, P0; relacionada con Q-23 | **Respuesta funcional recibida:** si falla un curso se rechaza toda la selección. Se define ese resultado para la variante testimoniada sin inferir una transacción interna. **BLOQUEANTE N3 restante:** corroborar ausencia de registros de ese intento en una consulta posterior y distinguirla de pérdida de respuesta. | G-03; FR-011/FR-013/FR-018/FR-022; AC-14/AC-17/AC-18/AC-21 y SC-003. Ya no se considera desconocida la respuesta del usuario sobre registro parcial. | Estado previo, intento con fallo y estado posterior por cada curso, sin datos privados. El relato aclara el resultado esperado; reporte de un éxito distinto no demuestra el caso rechazado. |
| B-03 — Concurrencia y cupos | Q-15, Q-17; ambas P0 | **Testimonio recibido:** disponibilidad no actualizada; solicitud sin cupo rechazada, selección reiniciada y sin reporte. **BLOQUEANTE N3 restante:** resultados de ambos participantes, instante de asignación y comportamiento del ganador SUM. L-03 fija una aceptación y un rechazo completo como resultado local; no identifica ganador ni mecanismo SUM. | G-03; FR-010/FR-011/FR-018/FR-023; AC-15/AC-17/AC-24. L-03/FR-028/AC-30 habilitan diseño y aceptación de concurrencia local. | Para N3, resultados visibles y registros de ambos actores en evidencia segura suministrada de referencia. Una prueba de la réplica verifica L-03, no SUM. No provocar competencia en producción ni atribuir una política interna a ampliaciones relatadas. |
| B-04 — Turnos y habilitación | Q-09, Q-25, Q-31, Q-32, Q-35; todas P0 | **Respuesta funcional recibida:** PP acumulado, comparación mayor o igual, PP 17 y mayor a 19 en primer turno, acceso posterior y 11–12 para todos los ponderados rezagados del día previo. **BLOQUEANTE N3 restante:** corroboración, precisión/redondeo, horas operativas de 11–12, categorías administrativas y tolerancia temporal. El testimonio de PP mayor a 19 se conserva frente al tope documental 19.00. L-02 mantiene las horas desconocidas y permite ventanas sintéticas diferenciadas. | G-01; FR-005/FR-006; AC-05/AC-06/AC-07/AC-25/AC-26 y SC-003. FR-004/AC-04 conservan F6. L-02/FR-027/AC-28/AC-29 habilitan diseño del pendiente y pruebas locales sin completar el horario oficial. | Evidencia sanitizada en fronteras, PP mayor a 19 y 11–12; aclaración de horas y precisión. No reescribir F6 ni confundir cobertura de ponderados con todas las categorías de estudiantes. |
| B-05 — Reintentos, recarga e interrupción | Q-20, Q-22; ambas P0 | **Testimonio recibido:** sesión de 15 minutos, renovación al recargar, reingreso y repetición al expirar; fallo de conexión relatado sin registro. Registro único ante doble clic es **aparente**, no idempotencia probada del SUM. **BLOQUEANTE N3 restante:** disparador temporal, reenvío deliberado y respuesta perdida tras posible registro. L-04 autoriza consulta y protección contra duplicados en la réplica. | G-03; FR-011/FR-013/FR-018/FR-025; AC-14/AC-17/AC-18/AC-22/AC-23. L-04/FR-029/AC-31–AC-33 habilitan diseño de recuperación local; mecanismo y lifetime corresponden a plan. | Para N3, evidencia segura de referencia con estado posterior de cada evento. Los ensayos sintéticos de la réplica acreditan L-04, no SUM. Diferenciar fallo previo y respuesta perdida tras registro; no inferir reintento automático o ausencia universal de efectos. |
| B-06 — Confirmación e indicador de éxito | Q-23, P0; relacionadas Q-21/Q-22/Q-28 | **Precisado:** usuario relata reporte solo al aceptar, con cursos aceptados. M-01 acredita literal y apariencia del aviso de éxito en el manual. **BLOQUEANTE N3 restante:** mismo recorrido en FISI 2026-II, redirección completada, correspondencia del reporte y momento verificable del registro. M-01 no acredita persistencia. | G-03; FR-011/FR-013/FR-014/FR-024; AC-17/AC-18/AC-19 y SC-003. | Secuencia sanitizada equivalente de aviso, redirección, reporte y consulta posterior; impresión/visado conservan condición documental. No generalizar manual o relato a todas las facultades. |

Las preguntas P1 Q-05/Q-06/Q-08/Q-10/Q-16/Q-18/Q-19/Q-29/Q-30/Q-33 condicionan los
subcasos de deuda/salud, perfiles, excepciones, repitencia, plan/oferta y lectura del cuadro.
No se dan por resueltas ni se convierten en un bloqueo universal del caso ordinario:
su dependencia específica sigue en G-01/G-02. Q-07/Q-24/Q-26/Q-27 quedan fuera de este
alcance por tratar procesos excluidos; Q-34 corresponde al procedimiento presencial excluido.

**Cierre de un bloqueo:** registrar respuesta concreta, escuela/facultad/periodo y contexto,
fecha, fuente verificable, condiciones y resultado observado, revisión responsable y criterios
afectados. Conservar referencias y clase de fuente. Una norma, entrevista o documento funcional
puede aclarar una regla, pero no se rotula como observación de interfaz; para N3 se necesita la
secuencia observable equivalente. Un testimonio nuevo sigue siendo testimonio. Un escenario
sintético de la propia réplica o una decisión local no cierra una pregunta de comportamiento SUM.

**Preparación:** se autoriza continuar `$speckit-plan` para la emulación funcional local con
los testimonios recibidos y L-01–L-04. B-01–B-06 conservan sus brechas N3; las cuatro preguntas
sobre SUM ya no son un prerequisito del diseño de los resultados locales aquí definidos.
Horas desconocidas, datos académicos ausentes y casos especiales siguen explícitamente
pendientes; un fixture sintético no los completa. Contratos, persistencia, escenarios y dependencias están fijados en plan revisión4 y MR-CONTRACT-2,
sin inventar reglas SUM. No hay implementación ejecutada ni autorizada desde documentación;
las mejoras propuestas siguen fuera.

**Cobertura de la revisión:** Clear indica alcance documental suficientemente definido.
Deferred indica información pendiente de evidencia; en las filas marcadas bloqueantes la
aplazación no se debe a la cuota de preguntas, sino a la falta de respaldo conductual.

| Categoría de la revisión | Estado | Resultado del contraste |
| --- | --- | --- |
| Alcance funcional y comportamiento | Resolved para L-01–L-04; Deferred N3 | Emulación local autorizada, testimonios preservados. Correspondencia SUM pendiente B-01/B-04/B-06. |
| Dominio y datos | Resolved en resultados locales; Deferred datos/N3 | Todo-o-nada testimoniado; una aceptación por última vacante y consulta sin duplicados definidas. Identidad, persistencia y lifetime fijados en plan revisión4/MR-CONTRACT-2; planes/oferta reales Q-29 pendientes. |
| Interacción y experiencia | Resolved errores simultáneos; Deferred N3 | L-01 exige todas las causas aplicables sin orden SUM. M-01 limitado, error inferido, cruce inmediato fuera; eventos/literales de referencia pendientes. |
| Calidad no funcional | Resolved recuperación/capacidad locales; Deferred N3 | L-03/L-04 medibles; mecanismos propios en plan. Sesión testimoniada conserva pendiente de inicio/renovación; sin SLO inventado. |
| Integración y dependencias externas | Deferred subcasos/N3 | Sin conexión productiva. Contratos propios y emisión de reportes locales en plan; salud/deuda y efectos SUM siguen pendientes según caso. |
| Casos límite y fallos | Resolved L-01–L-04; Deferred otros/N3 | AC-27–AC-33 cubren errores simultáneos, configuración ausente, ventanas sintéticas, concurrencia y respuesta perdida; otros límites conservan dependencias. |
| Restricciones y alternativas | Clear | Exclusiones, protección de datos y prohibición de inventar mecanismos o atribuirlos a SUM conservadas. |
| Terminología y consistencia | Clear | Norma, observación documental, testimonio, inferencia, elección y matrícula registrada diferenciados; no se crean estados oficiales. |
| Señales de completitud | Resolved separación local/N3; Deferred completitud | SC-003/SC-008 distinguen aceptación local y corroboración N3; el checklist no certifica todos los subcasos. |
| Pendientes y marcadores | Clear | Preguntas enlazadas a fuente y dependencias; no se ocultan incertidumbres con respuestas de plantilla. |

### Session 2026-10-14

El usuario aportó la captura O-UI-01 de su propia interfaz SUM (matrícula registrada) y los
fotogramas V-01–V-08 de una grabación de otra facultad (2023-1). Están descritos sin datos personales
en [structure.md](../../evidence/sum/matricula-regular/structure.md) y
[behavior.md](../../evidence/sum/matricula-regular/behavior.md). Testimonio T-01:

- Q: ¿Qué ocurre ante un error al ejecutar la matrícula? → A: Aparece una alerta cuyo mensaje es la
  causa (por ejemplo, cruce de horarios o falta de cupos en una sección) y se redirige otra vez a
  matrícula. Precisa FR-012/FR-023 y es compatible con L-06; el literal sigue sin captura.
- Q: ¿Cuándo vuelve el temporizador a 15 minutos? → A: Al cambiar de pestaña o recargar. Precisa
  FR-025. En la réplica sustituye la renovación por botón explícito de LP-A04/LP-A05 mediante L-07.
  V-07→V-08 muestra además el reinicio tras la redirección.

Las decisiones locales L-07–L-13 y el contrato MR-CONTRACT-3 están en
[el plan](../../docs/reverse-engineering/plans/matricula-regular-sum-ui.md). Ninguna convierte
V-01–V-08 en evidencia FISI 2026-II; N3 conserva los bloqueos B-01–B-06.

## User Scenarios & Testing *(mandatory)*

Los actores son estudiantes de pregrado de Ingeniería de Sistemas e Ingeniería de Software,
con contexto académico sintético del periodo 2026-II. Las historias describen resultados
funcionales, no una secuencia obligatoria de controles. Cada prueba es independiente y parte
del contexto sintético indicado; aquí se definen pruebas, no se implementan ni ejecutan.

### User Story 1 - Revisar prematrícula (Priority: P1)

Como estudiante, quiero comprobar que mi prematrícula esté habilitada, revisar las asignaturas
pendientes de mi plan y obtener mi reporte para preparar mi elección antes de iniciar matrícula,
sin confundir prematrícula con la matrícula ya registrada.

**Why this priority**: La norma prevé el documento y el relato lo vincula a los cursos elegibles.

**Independent Test**: Consultar un reporte sintético de cada escuela y distinguir asignaturas
pendientes, plan y periodo, sin realizar matrícula.

**Acceptance Scenarios**:

1. **Given** una prematrícula sintética del plan y periodo del estudiante, **When** consulta
   el reporte, **Then** puede revisar sus asignaturas pendientes y obtener el documento.
   AC-01; normativa F1 arts. 13.r y 25.a, RN-12; formato exacto pendiente Q-12.
2. **Given** el mismo contexto sin haber descargado el reporte, **When** consulta las opciones
   de matrícula, **Then** la emulación no introduce una descarga obligatoria como condición
   técnica sin evidencia que la sustente. AC-02; límite de fidelidad derivado de RN-12,
   P11 y Q-11; la respuesta del usuario confirma esa ausencia de condición como testimonio,
   no como observación instrumentada. No elimina el deber documental de descarga.
3. **Given** información de prematrícula vacía o incompleta, **When** la revisa, **Then**
   el caso queda identificado como vacío o pendiente y no se inventan asignaturas elegibles.
   AC-03; requisito local de integridad; bloqueo, texto y navegación SUM pendientes Q-12.
4. **Given** un estudiante con turno permitido pero prematrícula no habilitada, **When**
   intenta iniciar matrícula, **Then** no inicia el registro hasta que esté habilitada;
   el estudiante debe poder comprobar esa condición antes de matricularse. Con prematrícula
   habilitada, ese requisito se satisface sin descargar el reporte ni garantizar por sí solo
   las demás condiciones. AC-20; requisito expreso del usuario del 2026-10-11, FR-021;
   representación y comprobación observable SUM pendientes Q-11/Q-12. No prescribe una casilla,
   botón de conformidad o aprobación manual por el estudiante.

---

### User Story 2 - Consultar calendario y habilitación por turno (Priority: P1)

Como estudiante, quiero conocer el calendario que me corresponde y acceder a la elección
cuando mi habilitación virtual esté determinada para FISI 2026-II.

**Why this priority**: El calendario publicado delimita la modalidad, pero su aplicación
efectiva condiciona la entrada al recorrido y aún no está observada.

**Independent Test**: Revisar el calendario publicado y representar contextos sintéticos
cuya habilitación o falta de habilitación esté resuelta para el escenario, sin seleccionar cursos.

**Acceptance Scenarios**:

1. **Given** el perfil documental FISI 2026-II, **When** consulta el calendario, **Then**
   distingue prematrícula del 05 y 07 de agosto, periodo regular del 10 al 14, lunes 10 virtual
   por PP, martes 11 y miércoles 12 virtual «libre», y jueves 13/viernes 14 presenciales.
   AC-04; normativa F2/F6, RN-11 y RN-20; no extiende el flujo virtual a los cinco días.
2. **Given** un caso con habilitación virtual resuelta mediante evidencia o decisión local
   explícita aprobada, **When** solicita iniciar la elección, **Then** puede acceder si el
   caso está habilitado y no puede registrar por esta vía si no lo está. AC-05; objetivo
   de emulación basado en P04–P05; predicado completo pendiente G-01.
3. **Given** un PP o instante cuya elegibilidad no se pueda determinar con las fuentes,
   **When** se evalúa el caso, **Then** no se presenta una habilitación inferida como confirmada.
   AC-06; regla de incertidumbre; resolución SUM pendiente G-01. Para configuración
   horaria ausente en la réplica, L-02/AC-28 definen un pendiente explícito.
4. **Given** un caso sintético de la variante testimoniada con PP acumulado exactamente 17
   o mayor a 19, **When** llega la hora de apertura del primer turno, **Then** cumple la
   condición de PP mayor o igual a 17; no obtiene acceso antes de esa hora. AC-25; testimonio
   del usuario, FR-005. El perfil documental F6 conserva su tope 19.00 y su discrepancia.
5. **Given** un estudiante de cualquier ponderado que no se matriculó el día previo y una
   hora operativa de 11–12 previamente determinada, **When** consulta la habilitación de
   la variante testimoniada, **Then** el ponderado no lo excluye por franja. AC-26; testimonio
   del usuario. Horas operativas y categorías administrativas siguen pendientes; no se
   interpreta «todos los ponderados» como «todos los estudiantes, a toda hora».
6. **Given** el perfil FISI 2026-II sin horas operativas documentadas para el 11–12,
   **When** se consulta o intenta usar esa ventana, **Then** se identifica la configuración
   horaria pendiente, no se concede habilitación fundada en horas supuestas ni se registra
   por esa ventana indeterminada. No se presenta ese pendiente como rechazo académico SUM.
   AC-28; L-02/FR-027, decisión `local-only`; no cambia franjas conocidas de otros días.
7. **Given** una ventana de prueba sintética, con ámbito y condiciones temporales explícitos,
   separada de las franjas publicadas, **When** se evalúan instantes habilitados y no habilitados
   del fixture, **Then** el resultado corresponde a esa configuración y se identifica como
   sintético. El calendario publicado sigue mostrando desconocidas las horas del 11–12.
   AC-29; L-02/FR-027, decisión `local-only`; no se agrega un horario oficial ni un fallback.

---

### User Story 3 - Elegir cursos y secciones (Priority: P1)

Como estudiante habilitado, quiero revisar las opciones que corresponden a mi prematrícula,
plan y oferta, elegir cursos y secciones y conocer los créditos y horarios de mi elección.

**Why this priority**: Es la actividad central previa a solicitar el registro.

**Independent Test**: Partir de opciones sintéticas conocidas de cada escuela y comprobar
la elección y su correspondencia con plan, oferta y prematrícula, sin confirmar matrícula.

**Acceptance Scenarios**:

1. **Given** un estudiante habilitado con opciones sintéticas identificadas, **When** entra
   a la elección, **Then** puede consultar las asignaturas y secciones disponibles para ese
   contexto y seleccionarlas. AC-07; testimonio P06–P07 y respuesta del usuario: aparecen cursos
   de prematrícula. Para la variante local L-05 se selecciona solo intersección de prematrícula completa/oferta aplicable del mismo plan; incompleto produce gap. Filtrado SUM/prerrequisitos/equivalencias reales pendiente Q-03/Q-12.
2. **Given** una elección sintética, **When** la revisa, **Then** puede identificar sus cursos,
   secciones, créditos y horarios y relacionarlos con un único plan. AC-08; requisito local
   de revisión apoyado en F1 arts. 16 y 25.b; no prescribe diseño visual ni orden de filas.
3. **Given** una asignatura pendiente pero no ofertada o una equivalencia no documentada,
   **When** se preparan las opciones, **Then** no se inventa oferta ni se considera equivalente
   sin fundamento. AC-09; normativa RN-02/RN-04/RN-18 y L-05: course ofertado del mismo plan fuera de prematrícula COMPLETA no es seleccionable y una solicitud forzada de catálogo conocido rechaza sin efectos; datos incompletos quedan gap. Oferta/planes SUM Q-29 pendientes.

---

### User Story 4 - Respetar requisitos académicos aplicables (Priority: P1)

Como estudiante, quiero que el resultado de mi solicitud respete las condiciones y excepciones
que corresponden a mi situación académica, sin recibir reglas de otra facultad o periodo.

**Why this priority**: La emulación debe distinguir cumplimiento normativo de controles de
pantalla no observados y evitar la aplicación indiscriminada de reglas.

**Independent Test**: Evaluar casos sintéticos con condiciones académicas documentadas;
comparar el resultado esperado sin exigir un momento u orden de comprobación.

**Acceptance Scenarios**:

1. **Given** los casos de carga ordinaria 11, 12, 26 y 27 créditos, sin excepciones aplicables,
   **When** se determina la conformidad normativa de la carga regular, **Then** 12 y 26
   satisfacen ese criterio y 11/27 no lo satisfacen; cumplirlo no garantiza por sí solo el
   registro. AC-10; F1 art. 13.p, RN-01. El usuario relata control de créditos al solicitar
   matrícula; se conserva como testimonio, sin inferir el orden respecto de otros controles.
2. **Given** menos de 12 créditos por una excepción documentada de egreso, retorno de separación
   temporal o cambio de plan sin cursos abiertos, **When** se evalúa la carga, **Then** se
   considera la excepción aplicable y no se rechaza solo por estar debajo de 12.
   AC-11; RN-01; requisitos de autorización concretos pendientes Q-16.
3. **Given** casos con prerrequisitos conocidos, cursos desaprobados que vuelven a dictarse,
   un plan identificado y condiciones institucionales documentadas, **When** se determina su
   conformidad académica, **Then** se respetan prerrequisitos, prioridad de desaprobados,
   unicidad de plan y requisitos aplicables. AC-12; F1, RN-02/RN-04–RN-09/RN-17/RN-18;
   incorporación al recorrido y momento de control pendientes G-02.
4. **Given** dos, tres o cuatro desaprobaciones de una asignatura, **When** se evalúa su
   situación, **Then** se distinguen tercera matrícula con tutoría, cuarta matrícula con
   sus dos ramas según oferta, y separación tras cuarta desaprobación. AC-13; matriz de
   reglas siguiente; no presupone habilitación virtual para los casos presenciales de F6.

---

### User Story 5 - Reconocer rechazo y sus límites (Priority: P1)

Como estudiante, quiero reconocer el rechazo completo de una solicitud en la variante
relatada y distinguirlo de una matrícula aceptada y su reporte. El resultado esperado sin
cursos registrados de ese intento se conserva como testimonio, con corroboración pendiente.

**Why this priority**: El relato describe rechazo por cruce o sección llena; las consecuencias
exactas no están acreditadas.

**Independent Test**: Partir de resultados sintéticos de rechazo identificados y comprobar
que no se presentan como aceptación completa. No requiere elegir un orden de validaciones.

**Acceptance Scenarios**:

1. **Given** un resultado sintético de rechazo por cruce horario o falta de vacante,
   **When** se presenta el resultado, **Then** se informa el rechazo sin afirmar aceptación
   completa de la solicitud. AC-14; testimonio P08A y RN-03/RN-10. La respuesta actual relata
   control de créditos/cupo al solicitar y modal con causa; no acredita el bloqueo de cruces
   al seleccionar. La precisión actual sitúa el aviso de cruce en la pantalla de registro.
   Textos y cardinalidad SUM pendientes G-02; L-01/AC-27 definen todas las causas aplicables
   para el resultado local. Rechazo completo relatado en AC-21.
2. **Given** una asignatura sin vacantes, **When** se evalúa su registro, **Then** no se
   considera admisible registrarla sin cupo. AC-15; objetivo de emulación RN-10/F3;
   no establece cuándo se toma un cupo ni cómo se resuelve la competencia.
3. **Given** un caso de rechazo con navegación solo testimoniada, **When** se documenta
   o acepta el recorrido, **Then** se distingue el retorno a inicio del relato previo P09A
   del retorno generalmente a la pantalla inicial de registro sin elección de la respuesta
   actual. AC-16; Q-14. No se declara una navegación universal; el destino exacto y los
   errores a los que se aplica en SUM permanecen pendientes G-02. En la variante local
   L-06, TODO rechazo académico definitivo vuelve al registro con elección vacía; protocolo,
   pending o respuesta perdida no reciben esa transición. La respuesta posterior precisa
   selección reiniciada para rechazo por falta de cupos; no se extiende a pérdida de respuesta.
4. **Given** una selección sintética de varios cursos y un resultado rechazado porque uno
   no cumple una condición aplicable, **When** se solicita el registro, **Then** ninguno de
   los cursos de ese intento queda matriculado y no se genera reporte de matrícula de ese
   intento. AC-21; resultado funcional testimoniado por el usuario, FR-022/FR-024; no afirma
   una transacción del SUM. La corroboración de estado posterior permanece B-02.
5. **Given** rechazo sintético por falta de cupo, **When** se presenta el resultado,
   **Then** se muestra causa de rechazo y se retorna al registro con selección reiniciada,
   sin reporte de éxito. AC-24; testimonio, FR-023. Apariencia de modal similar a M-01 con
   icono de error y descripción de causa es inferencia local autorizada; su literal no se define.
6. **Given** una solicitud sintética con cruce horario y falta de vacante simultáneos,
   y las demás condiciones conocidas del caso, **When** se presenta su rechazo local,
   **Then** informa todas las causas aplicables conocidas, incluidas ambas, sin causas
   adicionales inventadas; no se registra ningún curso del intento ni se genera su reporte.
   La aceptación compara las causas como conjunto, sin imponer orden de presentación o
   precedencia SUM. AC-27; L-01/FR-026 `local-only`, FR-022/FR-024.
7. **Given** dos estudiantes sintéticos con solicitudes distintas, admisibles en todo lo
   demás, que compiten por la misma sección con exactamente una vacante, **When** se procesan
   concurrentemente, **Then** exactamente una solicitud queda aceptada y la otra se rechaza
   completamente por falta de cupo. La consulta posterior muestra una sola ocupación nueva;
   el rechazado no tiene cursos ni reporte de ese intento y vuelve a elección reiniciada.
   No se exige que gane un estudiante predeterminado ni se prescribe criterio de desempate.
   AC-30; L-03/FR-028 `local-only`, FR-022/FR-023/FR-024; no acredita el caso SUM B-03.

---

### User Story 6 - Reconocer matrícula aceptada y consultar su reporte (Priority: P1)

Como estudiante, quiero distinguir una solicitud aceptada de la selección aún no registrada y
consultar el reporte de la matrícula efectivamente aceptada.

**Why this priority**: Es el resultado que persigue el estudiante; el registro y las formalidades
documentales deben distinguirse.

**Independent Test**: Usar un caso sintético de resultado aceptado y su reporte conocido;
comprobar la correspondencia sin exigir visado para representar la aceptación digital.

**Acceptance Scenarios**:

1. **Given** un resultado sintético de aceptación con cursos aceptados conocidos, **When**
   se consulta el resultado, **Then** se distingue la matrícula aceptada de la elección
   previa y del rechazo. AC-17; testimonio P08B y respuestas del usuario; M-01 aporta el
   literal del aviso de éxito del manual, sin verificar registro ni redirección FISI. Persistencia
   y correspondencia observable SUM siguen sujetas a G-03. La variante local debe verificar
   sus efectos y reporte, incluyendo la consulta recuperable de L-04.
2. **Given** matrícula aceptada y reporte disponible en el escenario, **When** lo consulta,
   **Then** puede revisar y obtener un reporte correspondiente a lo aceptado, sin confundirlo
   con prematrícula. AC-18; F1 arts. 13.s y 25.c, RN-19. El usuario relata generación del
   reporte al aceptar; momento, correspondencia y disponibilidad SUM siguen pendientes Q-23.
   Para la réplica, consultar el resultado aceptado debe permitir obtener su reporte correspondiente.
3. **Given** ese resultado sin impresión ni visado, **When** se consulta la aceptación
   digital, **Then** no se impone el visado como transición que active la matrícula.
   AC-19; RN-19 y P12; se conserva el deber normativo de imprimir/visar para respaldo.
4. **Given** un escenario sintético controlado de doble clic, **When** se observa un único
   registro tras consultar el resultado, **Then** se documenta ese resultado sin atribuirle
   idempotencia o un mecanismo interno no demostrado. AC-22; comportamiento aparente
   relatado, no confirmado como SUM. Para la variante local se exige la protección contra
   duplicados de L-04/AC-32, sin usar esa prueba para corroborar idempotencia SUM.
5. **Given** una sesión sintética que expira antes de completar la matrícula, **When** el
   estudiante vuelve al recorrido, **Then** debe iniciar sesión nuevamente y comenzar la
   elección de nuevo. AC-23; testimonio, FR-025. No define el resultado de un envío en curso.
6. **Given** una solicitud sintética aceptada cuyo registro se completó pero cuya respuesta
   no llegó al estudiante, **When** consulta el resultado de esa misma solicitud,
   **Then** recupera la aceptación y el reporte de sus cursos registrados. La consulta no
   crea un registro nuevo ni consume otra vacante; la ausencia previa de respuesta no se
   presentó como rechazo ni como aceptación confirmada. AC-31; L-04/FR-029 `local-only`.
7. **Given** una solicitud sintética con resultado definitivo aceptado o rechazado,
   **When** se repite la misma solicitud, incluso concurrentemente o tras perder la respuesta,
   **Then** conserva su resultado y no duplica cursos registrados, consumo de vacantes ni
   matrícula/reportes del intento. Una elección distinta constituye otra solicitud, no una
   alteración de la anterior. AC-32; L-04/FR-029 `local-only`; identidad y duración de esa
   garantía están fijadas en MR-CONTRACT-2/plan revisión4, sin asumir mecanismo SUM.
8. **Given** una comunicación interrumpida antes de registrar una solicitud, con estado
   posterior controlado sin cursos de ese intento, **When** se consulta su resultado antes
   de un nuevo procesamiento, **Then** no informa aceptación ni entrega reporte de éxito;
   identifica que no dispone de resultado definitivo y no crea matrícula por consultar.
   Cualquier repetición de esa solicitud conserva la protección contra duplicados de AC-32.
   AC-33; L-04/FR-029 `local-only`; se distingue de la respuesta perdida tras aceptación AC-31.

### Edge Cases

- PP en umbrales 17, 16, 15, 14, 13, 12, 11, 10, 0 o 19; PP mayor a 19; minutos exactos
  de apertura/cierre; acceso en franjas posteriores y cambios de día: G-01, sin respuesta inferida.
- «Libre» el 11–12 no equivale automáticamente a todas las horas, todos los estudiantes
  ni ausencia de requisitos académicos; G-01. Configuración ausente y ventana sintética
  diferenciadas por L-02/AC-28/AC-29, sin completar las horas oficiales.
- Selección iniciada en un intervalo y solicitud posterior a su cierre: Q-25, pendiente.
- Turno permitido sin prematrícula habilitada: FR-021/AC-20; no equivale a falta de descarga.
- Prematrícula vacía, cursos no ofertados, equivalencias o planes sin documentación: AC-03/AC-09.
- Carga menor a 12 con y sin excepción; las excepciones no se sustituyen por una regla única.
- Asignatura desaprobada dos/tres veces, ofertada o no, tutoría y autorizaciones; el caso
  de tres desaprobaciones sin oferta no se confunde con cursar solo esa asignatura.
- Cruce y falta de vacante simultáneos: L-01/AC-27 exige todas las causas aplicables para
  la réplica; cardinalidad y precedencia SUM siguen pendientes G-02.
- Última vacante disputada por dos estudiantes: objetivo local de no admitir más matrículas
  que plazas, derivado de F3, precisado por L-03/AC-30: una aceptación y un rechazo completo.
  Ganador, momento y resultados SUM siguen pendientes Q-15/Q-17.
- Una selección con rechazo de un curso: resultado esperado testimoniado de rechazo completo
  sin cursos de ese intento registrados, AC-21; corroboración posterior pendiente B-02.
- Doble clic: registro único aparente, sin idempotencia demostrada. Expiración: reingreso y
  elección desde inicio relatados. Fallo de conexión sin registro según testimonio, sin extender
  ese resultado a una respuesta perdida después de registrar; B-05. Para la réplica,
  consulta del resultado y repetición sin duplicados se aceptan por L-04/AC-31–AC-33,
  distinguiendo ausencia de respuesta de ausencia efectiva de registro.

## Requirements *(mandatory)*

### Functional Requirements

Los identificadores FR no indican orden de comprobación. La obligación normativa expresa QUÉ
debe respetar la emulación, no que SUM ya aplique un control de pantalla. Los requisitos
condicionados por G-01–G-03 y B-01–B-06 conservan pendientes de aceptación N3 y subcasos
no definidos. L-01–L-04 habilitan diseño de sus resultados locales sin cerrar esos pendientes;
implementar sigue requiriendo plan y contrato completos para el alcance asignado.

| ID | Requisito funcional | Base y criterio de aceptación |
| --- | --- | --- |
| FR-001 | DEBE delimitar el recorrido a matrícula regular virtual FISI 2026-II de las dos escuelas; distinguir las fechas virtuales de las presenciales. | Normativa F2/F6, RN-20; AC-04. |
| FR-002 | DEBE permitir consultar y obtener el reporte de prematrícula de asignaturas pendientes del plan y periodo correspondiente. | Normativa RN-12; AC-01/AC-03. |
| FR-003 | NO DEBE convertir la descarga de prematrícula en condición técnica de habilitación sin evidencia; DEBE conservar la instrucción documental. | Norma y límite de evidencia RN-12/P11; AC-02; Q-11. |
| FR-004 | DEBE mostrar el calendario publicado con sus nueve franjas, bandas de PP y modalidades sin corregir ni reinterpretar datos ambiguos. | Normativa F6; AC-04/AC-06. |
| FR-005 | DEBE permitir entrada y solicitud según habilitación aplicable. La variante testimoniada usa PP acumulado, umbrales mayor o igual, acceso en franjas posteriores y cobertura de todos los ponderados de 11–12; no determina horas desconocidas. | Testimonio P04–P05 y respuestas del usuario; AC-05/AC-06/AC-25/AC-26; discrepancia con tope F6 conservada, B-04. |
| FR-006 | DEBE permitir consultar y elegir cursos y secciones del contexto académico aplicable; en la variante local solo la intersección de prematrícula completa y oferta aplicable del mismo plan es seleccionable; incompleto produce gap y course de catálogo ofertado fuera de esa prematrícula completa no es elegible. El filtrado SUM sigue pendiente. | Testimonio P06–P07, normativa RN-02/RN-12 y L-05 local; AC-07/AC-09; Q-03/Q-12 permanecen N3. |
| FR-007 | DEBE permitir revisar cursos, secciones, créditos, horarios y plan de la elección sin atribuirle estado de matrícula registrada. | Decisión local de revisión, F1 arts. 16/25.b; AC-08/AC-17. |
| FR-008 | DEBE respetar cargas, excepciones, prerrequisitos, prioridad de desaprobados, plan y elegibilidad institucional según la matriz normativa. | Normativa F1; AC-10–AC-13; aplicación al recorrido pendiente G-02. |
| FR-009 | DEBE distinguir los casos de repitencia y sus ramas según oferta; NO DEBE convertirlos automáticamente en permisos virtuales. | Normativa RN-08/RN-09/RN-17 y F6; AC-13. |
| FR-010 | NO DEBE considerar admisible registrar una asignatura sin vacante; el resultado normativo no fija un mecanismo de asignación. L-03 exige una sola aceptación ante última vacante para la réplica. | Objetivo contextual RN-10/F3 y testimonio P08A; AC-15; resultado local FR-028/AC-30; Q-15/Q-17 siguen abiertos para SUM. |
| FR-011 | DEBE permitir solicitar el registro de la elección y distinguir aceptación y rechazo cuando el resultado esté determinado. | Testimonio P07–P08B; AC-14/AC-17; alcance de efectos pendiente G-03. |
| FR-012 | DEBE representar rechazo con sus causas aplicables sin presentarlo como aceptación; el modal similar al de éxito con icono de error es apariencia local inferida por instrucción del usuario, sin literal SUM inventado. L-01 exige todas las causas para la réplica. | Testimonio, inferencia y decisión local separados; AC-14/AC-24/AC-27; cardinalidad, orden y literal SUM pendientes B-01. |
| FR-013 | DEBE distinguir matrícula aceptada, reporte de cursos aceptados, prematrícula y elección pendiente; M-01 aporta el aviso de éxito del manual dentro de su procedencia. | Normativa RN-19, testimonio y observación documental M-01; AC-17/AC-18; correspondencia FISI y momento del registro pendientes B-06. |
| FR-014 | NO DEBE exigir impresión/visado para activar el registro digital sin evidencia; DEBE distinguirlos como formalidades documentales. | Norma y límite de evidencia RN-19/P12; AC-19. |
| FR-015 | DEBE mantener versión, vigencia y ámbito de las reglas por facultad, escuela, plan y periodo; NO DEBE aplicar FISI 2026-II a otros perfiles silenciosamente. | Requisito local de configurabilidad, dossier de fidelidad y constitución; SC-004. |
| FR-016 | DEBE conservar clase de fuente y pendientes para cada regla, recorrido y afirmación de fidelidad; NO DEBE elevar un testimonio o hipótesis a observación confirmada. | Requisito de trazabilidad; SC-005. |
| FR-017 | NO DEBE declarar mensajes literales, orden o momento de validaciones, cardinalidad de errores, navegación universal tras rechazo o conservación de selección como comportamiento SUM sin sustento. DEBE identificar L-01 como política local de todas las causas, sin atribuir precedencia al SUM. | Restricción expresa y autorización local L-01; FR-026/AC-27, SC-006; G-02 conserva incertidumbre SUM. |
| FR-018 | NO DEBE atribuir reserva/descuento de cupos, ganador concurrente, transacciones internas o idempotencia al SUM sin evidencia. Todo-o-nada testimoniado no acredita mecanismo; fallo de conexión no define toda pérdida de respuesta. L-03/L-04 autorizan diseñar concurrencia y protección contra duplicados propias. | Testimonio, incertidumbre y decisiones locales separados; FR-022/FR-025/FR-028/FR-029; AC-21/AC-22/AC-23/AC-30–AC-33; SC-006, B-02/B-03/B-05 siguen abiertos N3. |
| FR-019 | DEBE utilizar exclusivamente datos y escenarios sintéticos para aceptación; NO DEBE incorporar datos privados o pagos reales. | Requisito local de protección de datos; SC-007. |
| FR-020 | DEBE mantener fuera del recorrido reserva, retiro, extemporánea y los demás procesos excluidos; NO DEBE introducirlos como pasos obligatorios. | Alcance expreso del usuario; SC-007. |
| FR-021 | DEBE requerir prematrícula habilitada antes de iniciar matrícula y permitir al estudiante verificar esa condición previamente. La descarga del reporte NO satisface ni reemplaza la habilitación. | Requisito expreso del usuario y testimonio del 2026-10-11; AC-20. Representación y comprobación SUM pendientes Q-11/Q-12, B-01. |
| FR-022 | En la variante testimoniada, DEBE rechazar la selección completa si falla un curso, sin registrar cursos de ese intento. | Testimonio expreso del usuario; AC-21. Corroboración pendiente B-02; no prescribe ni demuestra una transacción interna. |
| FR-023 | En el rechazo por falta de cupo relatado, DEBE mostrar la causa y reiniciar selección. L-06 exige para TODO rechazo académico definitivo local retorno al registro con elección vacía; protocolo/pending/transporte incierto se distinguen. | Testimonio expreso y L-06 local; AC-24/AC-16. No se atribuye navegación universal SUM ni se aplica a todo error de comunicación. |
| FR-024 | DEBE generar el reporte de matrícula del intento solo si se acepta, con sus cursos aceptados; un rechazo no genera reporte de éxito de ese intento. | Testimonio expreso; AC-18/AC-21/AC-24. No afirma eliminación de reportes previos. |
| FR-025 | En la expiración relatada, DEBE exigir reingreso y comenzar nuevamente la elección. NO DEBE tratar registro único aparente como idempotencia SUM confirmada ni asumir resultado de un envío sin respuesta; la réplica debe recuperarlo mediante L-04. | Testimonio e incertidumbre; AC-22/AC-23, B-05; resultado local FR-029/AC-31–AC-33. La duración relatada de 15 minutos no fija por sí sola inicio o renovación del contador. |
| FR-026 | En la variante local, DEBE mostrar todas las causas de rechazo aplicables al contexto conocido de una solicitud, incluidas las simultáneas; NO DEBE imponer una precedencia SUM, inventar causas o dar por satisfecha una regla desconocida. | L-01 `local-only`, autorización expresa del 2026-10-11; AC-27; B-01 sigue abierto N3. |
| FR-027 | DEBE mantener desconocidas las horas del 11–12 y explicitar configuración ausente sin habilitar por horas deducidas ni registrar por una ventana indeterminada. DEBE admitir ventanas sintéticas identificadas para pruebas, separadas de las franjas publicadas y sin alterar F6 ni aplicar fallback. | L-02 `local-only`; AC-28/AC-29 y AC-04/AC-06; B-04 sigue abierto N3. |
| FR-028 | Para dos solicitudes distintas, válidas en lo demás, por la misma última vacante, DEBE producir exactamente una aceptación y un rechazo completo por cupo, sin sobreasignación ni registros o reporte del intento rechazado. | L-03 `local-only`; AC-30, FR-022/FR-023/FR-024. No fija estudiante ganador, desempate o mecanismo; B-03 sigue abierto N3. |
| FR-029 | DEBE permitir consultar el resultado de una solicitud sin efectos de inscripción y proteger contra duplicados al repetir esa misma solicitud tras respuesta perdida. DEBE recuperar resultados definitivos y distinguirlos de un resultado aún desconocido; una elección distinta es otra solicitud. | L-04 `local-only`; AC-31/AC-32/AC-33. Identidad, persistencia/lifetime y consulta fijados en MR-CONTRACT-2/plan revisión4; B-05/B-06 siguen abiertos N3. |

### Fuentes, clasificación y alcance de fidelidad

Las fuentes de esta especificación son el dossier, las respuestas textuales del usuario y
los recortes sin identificadores de M-01, con corte 2026-10-11. La autorización expresa
L-01–L-04 también se registra como decisión de la réplica, sin valor probatorio sobre SUM.
Se distinguen sus procedencias.
Los originales con identificadores no se incorporan como evidencia. M-01 acredita solo un
aviso del manual, no el recorrido FISI. En la etapa inicial se reutilizaron referencias
documentales sin reconsultar documentos oficiales. La revisión pública suplementaria
PUB-01–PUB-05 posterior reconsultó F1/F2 y otras fuentes públicas según
[planning-source-review](../../docs/domain/fisi/2026-II/planning-source-review-2026-10-11.md);
no observó runtime, pantallas ni transacciones SUM. No crea normas nuevas ni cierra N3.
Su vigencia se conserva dentro del ámbito documentado, sin certificar ausencia de modificaciones
posteriores. El repositorio histórico no prueba funcionalidad actual.

| Clase | Fuente reutilizada | Qué acredita y qué no |
| --- | --- | --- |
| Normativa | [Reglas y fuentes F1–F6](../../docs/domain/fisi/2026-II/business-rules.md), [README](../../docs/domain/fisi/2026-II/README.md). | F1: R.R. 002642-2026-R, 26-02-2026; F2: anexo R.R. 014408-2025-R, 16-12-2025; F6: cuadro FISI, firma visible 21-07-2026. Acreditan contenido normativo/documental, no aplicación de bloqueos SUM. |
| Observada | Captura del cuadro F6 aportada al dossier el 11-10-2026, descrita en sus fuentes. | Observación documental del calendario, no una interacción SUM. No hay secuencia observada del recorrido virtual en estas fuentes; no se volvió a inspeccionar la captura en este trabajo. |
| Observada documental del manual | M-01: recortes sin identificadores 3 y 4 de la última aportación del usuario, declarados como parte de un manual; título/edición pendientes. | Acredita título, literal de éxito, icono y estado de redirección anunciado. No verifica registros, redirección completada, FISI 2026-II ni un rechazo. Solo se registra texto técnico mínimo, sin copiar originales. |
| Testimonio | [Proceso AS-IS](../../docs/domain/fisi/2026-II/as-is-process.md), P01 y P03–P09; relatos y precisiones del usuario del 2026-10-11 en Clarifications. | PP acumulado, comparación mayor o igual y acceso posterior; prematrícula previa habilitada sin descarga; controles en registro; rechazo completo con selección reiniciada; reporte solo al aceptar; reingreso al expirar. Registro único ante doble clic es aparente. No acredita mecanismo interno, precedencia ni comportamiento concurrente. |
| Inferencia | [Fidelidad](../../docs/domain/fisi/2026-II/emulation-fidelity.md) y deducciones identificadas. | Objetivos locales de configurabilidad y consistencia; no hechos del SUM. Zona Lima es una inferencia jurisdiccional, no dato literal F6. |
| Decisión de la réplica (`local-only`) | Autorización expresa del usuario del 2026-10-11, L-01–L-04 en Clarifications. | Fija resultados locales de errores simultáneos, configuración horaria pendiente/pruebas sintéticas, última vacante y consulta/repetición sin duplicados. Es una instrucción de alcance y comportamiento propio, no un relato ni una observación del SUM. |
| Incertidumbre | [Preguntas abiertas](../../docs/domain/fisi/2026-II/open-questions.md). | Conserva preguntas por resolver; ninguna pregunta constituye una regla confirmada. |

N2 identifica fidelidad normativa limitada a reglas respaldadas. El recorrido narrado permanece
testimoniado; la variante autorizada con L-01–L-04 se verificará como emulación local N1,
con base normativa N2 para sus reglas respaldadas. No hay escenarios ejecutados en esta etapa.
N3 requiere evidencia comparable para cada transición y resultado y no se declara alcanzado.

### Calendario publicado aplicable

Prematrícula: **2026-08-05 y 2026-08-07**. Matrícula regular general:
**2026-08-10 a 2026-08-14**, sin convertir el rango entero en matrícula virtual.

| Fila documental | Grupo literal F6 | Lunes 2026-08-10 | PP publicado |
| --- | --- | --- | --- |
| 1 | 1 | 06:00–08:00 | 17.00–19.00 |
| 2 | 2 | 08:00–10:00 | 16.00–19.00 |
| 3 | 3 | 10:00–12:00 | 15.00–19.00 |
| 4 | 4 | 12:00–14:00 | 14.00–19.00 |
| 5 | 5 | 14:00–16:00 | 13.00–19.00 |
| 6 | 6 | 16:00–18:00 | 12.00–19.00 |
| 7 | 7 | 18:00–20:00 | 11.00–19.00 |
| 8 | 6 (repetido) | 20:00–22:00 | 10.00–19.00 |
| 9 | 7 (repetido) | 22:00–23:59 | 00.00–19.00 |

Martes **2026-08-11** y miércoles **2026-08-12**: virtual «libre»; sin horas operativas
o elegibilidad completa documentadas. Jueves **2026-08-13**: presencial para observados de
2.ª/3.ª repitencia con resolución de tutoría; viernes **2026-08-14**: presencial para quienes
tuvieron problemas al matricularse. Estas atenciones presenciales no forman parte del recorrido.

Las bandas de PP se solapan. El usuario precisa ponderado acumulado, comparación mayor o igual
con el umbral, PP exactamente 17 en primer turno y acceso posterior a la apertura. Se conservan
como testimonio, no como interpretación confirmada de F6. También relata PP >19.00 admitido en
primer turno frente al tope documental 19.00: se mantiene la discrepancia sin alterar la tabla.
Para 11–12 precisa cobertura de todos los ponderados de quienes no se matricularon el día previo;
no determina horas operativas ni todas las categorías académicas. Precisión/redondeo, reloj,
cambio de día y corroboración observable FISI 2026-II siguen pendientes.
La transcripción no es un predicado de habilitación.

L-02 autoriza diseñar y probar el tratamiento de ventanas mediante configuración sintética
identificada. Ese horario de prueba conserva ámbito y procedencia propios y no completa ni
reinterpreta las horas oficiales desconocidas del 11–12. Sin configuración aplicable se
representa el pendiente AC-28, conservando acceso a los documentos y calendarios conocidos.

### Matriz normativa y límites de aplicación

| Regla del dossier | Obligación o distinción que debe respetarse | Límite conductual y aceptación |
| --- | --- | --- |
| RN-01, F1 art. 13.p | Condición regular 12–26 créditos, con excepciones de créditos restantes para terminar, retorno de separación temporal y cambio de plan sin cursos abiertos. | AC-10/AC-11. No implica que toda carga menor a 12 bloquee inmediatamente la matrícula. F3 trata mínimos en regularización; su autorización VRAP no se extrapola sin revisión a todo caso virtual regular. |
| RN-02/RN-18, F1 arts. 13.a/18 | Respetar prerrequisitos y prioridad de desaprobados cuando se vuelvan a dictar. | AC-12; no decide orden de presentación ni filtrado, Q-03/Q-12/Q-29. |
| RN-03, F1 arts. 13.d(i)/25.b | La prohibición expresa de cruce citada corresponde a rectificación; el registro virtual sigue los horarios publicados. | AC-14 para rechazo regular testimoniado, no observado; no transferir un bloqueo de rectificación al clic de selección. |
| RN-04, F1 art. 16 | Matrícula en un único plan, sin negar equivalencias válidas o modalidades especiales no comprendidas en este alcance. | AC-08/AC-12; equivalencias y planes concretos pendientes Q-29. |
| RN-05/RN-06, F1 art. 24.b–c | No adeudar a la facultad; certificado anual de salud de Clínica Universitaria o centro estatal. | AC-12; no implica consulta automática o control dentro del formulario; Q-05/Q-06. Sin pagos ni información médica real. |
| RN-07/RN-17, F1 arts. 10/13.c/20 | Distinguir suspensión disciplinaria vigente, separación aplicable y cuatro desaprobaciones con resoluciones correspondientes. | AC-12/AC-13; no inventar estados oficiales o controles automáticos, Q-19. |
| RN-08, F1 arts. 12.b/13.c/13.o | Dos desaprobaciones: tercera matrícula con tutoría obligatoria y resolución decanal. | AC-13; no afirma asignación automática de tutor ni habilitación virtual, Q-18/Q-30. |
| RN-09, F1 arts. 12.c/13.c/19 | Tres desaprobaciones: cuarta matrícula con tutoría, solo esa asignatura si se oferta; si no se programa, máximo 12 créditos con autorización del Vicedecanato. | AC-13; no confundir las dos ramas ni la cuarta matrícula con cuarta desaprobación, Q-18. |
| RN-10, F3 | Registro sin vacantes no admisible, documentado en comunicado de regularización de septiembre. | AC-15; objetivo contextual de la emulación, reforzado por testimonio regular. No prueba el mecanismo de cupos del flujo de agosto. |
| RN-11/RN-20, F1 art. 13.u–v y F2/F6 | Calendario, bandas de PP y modalidades publicadas para este perfil. | AC-04; habilitación individual no resuelta, G-01. |
| RN-12/RN-19, F1 arts. 13.r–s/25.a/25.c–d | Documentos de prematrícula y matrícula; descarga y formalidades de respaldo. | AC-01/AC-02/AC-18/AC-19; no añadir guardas digitales de descarga o visado, Q-11/Q-23. |

### Incertidumbres y dependencias de aceptación

Estas preguntas son faltas de evidencia, no decisiones que deban resolverse con un valor por
defecto. L-01–L-04 definen resultados propios sin responder preguntas sobre producción.
No se utilizan marcadores de aclaración para pedir al usuario que invente su respuesta.

| Grupo | Preguntas del dossier | Información requerida y criterio de cierre | Efecto sobre la preparación |
| --- | --- | --- | --- |
| G-01 — habilitación y opciones | Q-08/Q-09/Q-10/Q-12/Q-25/Q-29–Q-33/Q-35 | PP acumulado, comparación mayor o igual y acceso posterior respondidos por testimonio. Siguen precisión/cortes, horas oficiales de «libre», categorías especiales, plan/oferta y filtrado, con ámbito/fecha/evidencia revisable. | Mantiene dependencias N3 y subcasos de FR-005/FR-006. L-02/FR-027/AC-28/AC-29 permiten diseñar pendiente horario y ventanas de prueba; no exigen conocer horas oficiales para el diseño local. |
| G-02 — validaciones y rechazo | Q-01–Q-06/Q-11/Q-13/Q-14/Q-16/Q-18/Q-19/Q-28 | Momento, precedencia, cantidad de avisos SUM, literales, excepciones y navegación por rechazo pendientes. Mantener cada causa diferenciada; L-01 fija todas las causas aplicables para la réplica. | Mantiene N3 de FR-008/FR-009/FR-012/FR-017 y subcasos no definidos. FR-026/AC-27 desbloquean cardinalidad del rechazo local; no se exige resolver precedencia SUM para diseñarlo. |
| G-03 — resultado y efectos | Q-15/Q-17/Q-20–Q-23 | Todo-o-nada y reporte solo al aceptar respondidos por testimonio; M-01 acredita aviso del manual. Corroboración SUM de estado posterior, repetición, respuesta perdida y competencia sigue pendiente. L-03/L-04 fijan resultados propios para concurrencia y recuperación. | Mantiene N3 de FR-010/FR-011/FR-013/FR-018/FR-022–FR-025. FR-028/FR-029 y AC-30–AC-33 habilitan diseño local; contrato MR-CONTRACT-2, persistencia por run y garantía de repetición fijados en plan revisión4, sin mecanismo SUM atribuido. |

La aclaración normativa o funcional puede apoyarse en una descripción institucional verificable;
la aceptación N3 requiere una secuencia observable sanitizada con precondiciones, acción,
resultado y contexto. Los bloqueos B-01–B-06 precisan las dependencias de G-01–G-03. Un nuevo
relato conserva clase testimonio; no basta para N3. Los pendientes solo bloquean sus dependencias,
no los requisitos documentales respaldados ni los resultados locales autorizados. Los MR-U01–MR-U04
del plan anterior conservan preguntas de referencia, pero dejan de ser prerrequisitos de las
políticas propias L-01–L-06. La revisión3 del plan y MR-CONTRACT-2 fijan diseño local
completo; N3 permanece independiente. Las tareas se generan tras cierre documental local,
sin ejecutar implementación desde esta especificación.

### Key Entities *(include if feature involves data)*

- **Estudiante y situación académica**: contexto sintético de escuela, plan, periodo, historial
  y requisitos aplicables; ninguna denominación nueva se declara estado oficial SUM.
- **Prematrícula**: documento de asignaturas pendientes del plan; no equivale a oferta completa
  ni a una inscripción ya realizada.
- **Perfil académico versionado**: facultad, periodo, normativa aplicable, calendario, modalidades,
  bandas publicadas y excepciones; conserva procedencia y pendientes. Distingue franjas publicadas,
  horas operativas desconocidas y ventanas sintéticas de prueba sin sobrescribir unas con otras.
- **Asignatura, oferta y sección**: créditos, prerrequisitos y horarios respaldados; la disponibilidad
  no demuestra una plaza reservada para quien la consulta.
- **Elección de matrícula**: cursos/secciones elegidos antes del resultado; no presupone guardado.
- **Solicitud y resultado**: aceptación o rechazo conocidos del escenario; resultados ambiguos y
  efectos parciales no reciben una interpretación automática. En la réplica, la misma solicitud
  conserva su identidad lógica al consultarse o repetirse; una elección distinta corresponde
  a otra solicitud. Resultado definitivo distinto de resultado aún desconocido para el estudiante;
  identidad concreta, almacenamiento por run y lifetime están fijados en MR-CONTRACT-2/plan revisión4.
- **Matrícula y reporte**: asignaturas aceptadas y documento que las representa; el momento de
  registro y disponibilidad del reporte SUM permanecen pendientes. El resultado local aceptado
  consultable debe corresponder a los cursos registrados y su reporte, sin duplicar efectos.
- **Evidencia y pregunta abierta**: origen, clase, fecha, ámbito, verificación y dependencia afectada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

El universo y denominadores de SC-001–SC-008 se fijan por IDs en
[acceptance-catalog.md](acceptance-catalog.md), expandido en Sistemas y Software. Un caso
pending esperado cuenta como resultado local verificado solo si se demuestra gap/sinwrite;
no cuenta como conformidad normativa del requisito desconocido ni aceptación N3. Todas las
variantes obligatorias deben registrarse; no eliminar casos para mejorar un porcentaje.

Los siguientes son objetivos de aceptación futura, no resultados ya obtenidos. Ningún objetivo
incluye un tiempo de respuesta, aforo o porcentaje de satisfacción inventado.

- **SC-001**: El 100 % de los casos documentales de prematrícula y calendario de ambas escuelas
  permite distinguir plan/periodo, prematrícula, nueve franjas publicadas y modalidades
  virtual/presencial, sin alterar grupos ni atribuir horas no publicadas. El caso de turno
  permitido sin prematrícula habilitada no permite iniciar matrícula y el caso habilitado
  satisface esa precondición sin exigir descarga. FR-001–FR-004/FR-021;
  AC-01–AC-04/AC-06/AC-20.
- **SC-002**: El 100 % de los casos normativos sintéticos acordados distingue cargas ordinarias,
  excepciones, prerrequisitos, plan, prioridad y ramas de repitencia, sin confundirlas con
  controles de pantalla observados. FR-008/FR-009; AC-10–AC-13.
- **SC-003**: Para cada escuela se definen y verifican localmente tres recorridos sintéticos:
  aceptación, rechazo por cruce y rechazo por falta de vacante; seis recorridos en total,
  con contexto conocido, resultado, navegación y correspondencia del reporte trazables a
  los testimonios y decisiones propias autorizadas. Su aceptación local no requiere cerrar
  B-01–B-06; la declaración de fidelidad N3 de esos mismos recorridos sí exige su cierre.
  FR-005–FR-014/FR-026–FR-029; AC-05/AC-07–AC-19 aplicables; ningún resultado ejecutado aquí.
- **SC-004**: En todos los casos sintéticos con otra facultad o periodo, ninguna regla FISI
  2026-II se aplica sin un perfil correspondiente revisado; los límites y excepciones del
  perfil vigente se conservan. FR-015.
- **SC-005**: El 100 % de los requisitos y afirmaciones de fidelidad identifica clase de fuente
  y referencia o decisión local; todos los pendientes incluyen pregunta y dependencia.
  Cero testimonios o inferencias rotulados como observaciones confirmadas. FR-016.
- **SC-006**: Cero mensajes literales inventados, secuencias de validación asumidas o resultados
  de cupos/registro inferidos se utilizan como criterios de paridad SUM. M-01 se limita al
  aviso del manual; el modal de error inferido se identifica como local y el doble clic como
  aparente. Los casos testimoniados de rechazo completo, reinicio y reporte solo tras aceptación
  respetan AC-21/AC-24; recuperación relatada y límites de repetición se revisan en AC-22/AC-23.
  FR-017/FR-018/FR-022–FR-025.
- **SC-007**: Todos los escenarios de aceptación usan exclusivamente datos sintéticos;
  cero pagos reales, accesos a datos privados o pasos de los procesos excluidos.
  FR-019/FR-020.
- **SC-008**: El 100 % de los escenarios locales AC-27–AC-33, por ambas escuelas, satisface
  las cuatro políticas autorizadas: todas las causas aplicables, configuración ausente
  diferenciada de ventanas sintéticas, exactamente una aceptación por última vacante y
  consulta/repetición sin duplicados. Cero horarios sintéticos incorporados como oficiales,
  cero matrículas del intento rechazado y cero registros, consumos o reportes del intento
  duplicados por consulta/repetición. L-01–L-04, FR-026–FR-029; N3 permanece independiente.

## Requisitos locales de accesibilidad aprobados

ACC-01 teclado sin trampa; ACC-02 contraste textual4.5:1/3:1 grande; ACC-03 contraste de
partes relevantes3:1; ACC-04 texto200% sin pérdida; ACC-05 reflow320CSSpx sin bidimensional
injustificado; ACC-06 foco visible/no totalmente oculto y gestión de modal/ruta; ACC-07
target24x24CSSpx o excepción específica; ACC-08 errores identificados en texto; ACC-09
estados comunicables a AT; ACC-10 nombre/rol/estado programáticos. Cada criterio y sus
excepciones W3C precisas, acciones/estados y denominador170celdas se fijan en
[catálogo de aceptación](acceptance-catalog.md), autoridad de comprobación de ACC.
Fuente [PUB-05](../../docs/domain/fisi/2026-II/planning-source-review-2026-10-11.md).
Estos diez criterios son requisitos `local-only` explícitos, no nuevos FR/AC/SC ni una
observación de SUM. Incluyen foco al abrir/cerrar dialog y volver a registro/reporte; no
Inicio general ni conformidad integral WCAG A/AA, aplicabilidad jurídica o accesibilidad
institucional certificada. Las excepciones requieren elementos y evidencia concretos.

## Assumptions

### Alcance y decisiones explícitas

- Se especifica una emulación con base normativa y comportamiento testimoniado, no se promete N3.
  Se acepta por instrucción del usuario la apariencia inferida del modal de error sin inventar
  su literal y las políticas propias L-01–L-04. Orden de controles SUM, horas oficiales
  desconocidas, mecanismos internos y resultados SUM sin evidencia no se completan.
  Las mejoras mencionadas por el usuario quedan separadas de la reproducción actual.
  La estructura de interfaz común puede reutilizarse como criterio local solicitado; la
  semejanza entre facultades sigue testimoniada y no generaliza calendario, oferta o reglas.
- Se parte de un contexto académico sintético de estudiante; crear cuentas, recuperar contraseñas
  o definir autenticación no forma parte de este encargo. P01 acredita solo testimonio.
- La revisión de elección y la representación de vacío de AC-03/AC-08 son necesidades locales
  de integridad y comprensión, no controles o textos observados del SUM.
- El objetivo de consistencia de última vacante procede del dossier como decisión de calidad
  de la emulación, precisado por L-03. L-04 añade recuperación y protección contra duplicados
  propias. Ambas habilitan diseño técnico local en plan, sin certificar mecanismos SUM.
- Esta especificación es documental. No asigna workers de implementación, cambia código, fija
  contratos de ejecución ni ejecuta pruebas de matrícula.

### Exclusiones

- Reserva de matrícula, retiro, matrícula extemporánea y pagos reales.
- Rectificación, anulación, reactualización, trámites de ampliación de vacantes, matrícula
  presencial y autorización administrativa de tutorías; pueden contextualizar requisitos,
  pero no se ejecutan como pasos del flujo virtual.
- Inscripción en otro periodo/facultad, recuperación de internos privados y conexión de la
  emulación a SUM productivo.
- Diseño visual exacto, textos declarados literales SUM sin evidencia y recuperación de
  mecanismos internos del SUM de cupos, transacciones, repetición o recuperación. El diseño
  de mecanismos propios para satisfacer L-03/L-04 corresponde a plan y no está excluido.

### Dependencias y revisión del material existente

- [AGENTS.md](../../AGENTS.md) y [constitución](../../.specify/memory/constitution.md) delimitan
  trazabilidad, privacidad, reutilización y pruebas. La inspección productiva futura requiere
  autorización explícita y solo lectura; este trabajo usa únicamente los documentos locales.
- El plan/oferta FISI de ambas escuelas, las condiciones particulares y los efectos del recorrido
  necesitan la evidencia listada en G-01–G-03; no se reconstruyen a partir de hipótesis.
- [Información de Matrícula existente](../../docs/reverse-engineering/screens/matricula-informacion.md)
  documenta un estado informativo observado y límites históricos. Su revisión muestra que no
  acredita selección, registro o confirmación. Es una referencia de reutilización futura,
  no evidencia adicional que cierre las preguntas del dossier.
- Plan revisión3, MR-CONTRACT-2 y catálogo finito son las entradas vigentes para
  `speckit-tasks`. MR-U01–MR-U04 conservan preguntas N3; otras brechas son dependencias
  específicas con resultado pending. Tareas no ejecutan ni autorizan código desde esta
  etapa documental; N3 no se declara por decisiones o pruebas locales.
- Revalidación del checklist durante esta aclaración: CHK006/CHK009/CHK013 se evalúan para
  el proceso completo y sus subcasos pendientes, no solo L-01–L-04. Sus notas originales
  conservan la revisión histórica; una evaluación parcial aprobada no equivale a completitud
  ni a un impedimento general para planificar los resultados locales autorizados.
