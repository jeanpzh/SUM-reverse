# Catálogo finito de aceptación local

**Revisión:** `MR-ACCEPTANCE-1`, 2026-10-11; entrada aprobada por usuario, no resultados ejecutados.
Autoridad técnica: [MR-CONTRACT-2](../../docs/reverse-engineering/contracts/local-api/matricula-regular.md).
[Spec](spec.md) conserva29FR/33AC/8SC. MAT son categorías del estudio aprobado, no diez pruebas.

## Convención y alcance

Cada fila `MAT-XX-VYY` se expande exactamente en `-SIS` y `-SOFT`: dos instancias escolares.
Caso concurrente contiene actores A/B de una misma escuela y cuenta como UNA instancia con
ambos resultados/estados, no dos éxitos. Replay concurrente cuenta una instancia por escuela.
Repetición técnica del mismo test no suma casos al denominador. Ninguna fila se omite para
mejorar porcentajes. Fixtures/factories y reloj son los del modelo; variantes solo cambian
la condición nombrada y sus datos necesarios, manteniendo conocidas/válidas las demás.
Ningún escenario sintetiza un plan/oferta real o una regla oficial faltante.
Pending esperado demuestra gap/cero efectos, nunca conformidad normativa de lo desconocido.
Cada instancia registra requisito→fixture→acción→HTTP/UI/estado/report→esperado→real.

## Categorías y variantes obligatorias

### MAT-01 — Estudiante habilitado en su turno

Requisitos: FR-001/FR-002/FR-003/FR-004/FR-005/FR-015/FR-021/FR-027. 14 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-01-V01 | Habilitada y turno permitido | eligible, inicio permitido; sin registro por consultar | AC-01/AC-20 |
| MAT-01-V02 | No habilitada | PRE_ENROLLMENT_NOT_ENABLED, no inicio/write | AC-20 |
| MAT-01-V03 | Habilitación desconocida | PRE_ENROLLMENT_UNKNOWN, pending | AC-03/AC-20 |
| MAT-01-V04 | Prematrícula vacía COMPLETA | Documento vacío conocido, cero opciones; sin curso inventado | AC-03 |
| MAT-01-V05 | Prematrícula incompleta | PLAN_OR_OFFER_UNKNOWN; cero selección/commit | AC-03/AC-07 |
| MAT-01-V06 | Calendario F6 nueve filas | Transcripción idéntica; grupos6/7 repetidos; modalidades separadas | AC-04/AC-06 |
| MAT-01-V07 | 11 agosto sin horas | WINDOW_UNSPECIFIED, sin commit; documentos disponibles | AC-28 |
| MAT-01-V08 | 12 agosto sin horas | WINDOW_UNSPECIFIED, sin commit; documentos disponibles | AC-28 |
| MAT-01-V09 | Ventana synthetic identificada | origin synthetic en contexto/resultado/UI; no modifica F6 | AC-29 |
| MAT-01-V10 | Otra facultad | PROFILE_MISSING, sin reglas FISI/fallback/write | AC-06/AC-28 |
| MAT-01-V11 | Otro periodo | PROFILE_MISSING, sin reglas FISI/fallback/write | AC-06/AC-28 |
| MAT-01-V12 | Perfil ausente | PROFILE_MISSING; documentos conocidos conservados | AC-06/AC-28 |
| MAT-01-V13 | Otra escuela sin perfil | PROFILE_MISSING, sin heredar reglas de la otra escuela | AC-06/AC-28 |
| MAT-01-V14 | Otro plan sin perfil | PROFILE_MISSING, sin heredar plan | AC-06/AC-28 |

### MAT-02 — Selección y confirmación válidas

Requisitos: FR-002/FR-003/FR-006/FR-007/FR-011/FR-013/FR-014/FR-024. 8 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-02-V01 | Tres cursos válidos12 créditos | accepted; cursos/cupos/reporte conjunto; no descarga/visado activadores | AC-02/AC-07/AC-17/AC-18/AC-19 |
| MAT-02-V02 | Revisión sin envío | Cursos/secciones/horarios/plan/créditos visibles, ninguna matrícula | AC-08 |
| MAT-02-V03 | Prematrícula conocida no ofertada | Documento no ofertado, no seleccionable; sin sección ficticia | AC-09 |
| MAT-02-V04 | Oferta mismo plan fuera prematrícula COMPLETA | No seleccionable; envío forzado conocido rejected COURSE_NOT_IN_PRE_ENROLLMENT | AC-07/AC-09 |
| MAT-02-V05 | Oferta de otro plan | No seleccionable; envío forzado conocido rejected PLAN_MISMATCH; pertenencia solo se evalúa para course del mismo plan, no causa duplicada para otro plan | AC-08/AC-12 |
| MAT-02-V06 | Oferta incompleta | PLAN_OR_OFFER_UNKNOWN, pending; no inventar intersección | AC-07/AC-09 |
| MAT-02-V07 | Equivalencia faltante | PREREQUISITE_OR_EQUIVALENCE_UNKNOWN, pending | AC-09/AC-12 |
| MAT-02-V08 | Intersección exacta | Opciones exactamente prematrícula completa ∩ oferta aplicable del plan; no filtrar por cruce inmediato | AC-07/AC-09 |

### MAT-03 — Rechazo por cruce horarios

Requisitos: FR-012/FR-017/FR-022/FR-023/FR-026. 6 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-03-V01 | Cruce sin sección llena | rejected SCHEDULE_CONFLICT; cero writes; retorno registro/elección vacía | AC-14/AC-16/AC-21 |
| MAT-03-V02 | Reuniones adyacentes | No conflicto al coincidir fin/inicio; aceptación si demás válidas | AC-14 |
| MAT-03-V03 | Horario desconocido | SCHEDULE_UNKNOWN, pending; causa no inventada | AC-14 |
| MAT-03-V04 | Cruce y sección llena | Causes exactamente SCHEDULE_CONFLICT+SECTION_FULL; cero parcial/reporte; reset | AC-21/AC-24/AC-27 |
| MAT-03-V05 | Cruce y prerrequisito incumplido | Ambas causas conocidas como conjunto; reset y ningún registro | AC-12/AC-16/AC-27 |
| MAT-03-V06 | Cierre/Escape del rechazo | Todos rejected académicos de este escenario vuelven registro con elección vacía; protocolo/pending no | AC-16/AC-24 |

### MAT-04 — Rechazo prerrequisito incumplido

Requisitos: FR-006/FR-008/FR-009/FR-012/FR-023. 20 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-04-V01 | Prerrequisito known unmet | rejected PREREQUISITE_UNMET, reset | AC-12 |
| MAT-04-V02 | Prerrequisito conocido cumplido | Sin esa causa; conformidad de esa regla no garantiza matrícula | AC-12 |
| MAT-04-V03 | Historial desconocido | PREREQUISITE_OR_EQUIVALENCE_UNKNOWN, pending | AC-12 |
| MAT-04-V04 | Equivalencia synthetic conocida | Respeta equivalencia del perfil sin inventar tabla real | AC-09/AC-12 |
| MAT-04-V05 | Equivalencia unknown | PREREQUISITE_OR_EQUIVALENCE_UNKNOWN, pending | AC-09/AC-12 |
| MAT-04-V06 | Prioridad de desaprobado ofertado atendida | Regla normativa satisfecha con selección conocida | AC-12 |
| MAT-04-V07 | Prioridad incumplida | rejected RETAKE_PRIORITY, reset | AC-12 |
| MAT-04-V08 | Dos desaprobaciones, tutoría met | Tercera matrícula, tutoría satisfecha; carga ordinaria/excepción separada | AC-13 |
| MAT-04-V09 | Dos desaprobaciones, tutoría unmet | rejected TUTORSHIP_REQUIREMENT_UNMET | AC-13 |
| MAT-04-V10 | Dos desaprobaciones, tutoría unknown | REPETITION_OR_AUTHORIZATION_UNKNOWN, pending | AC-13 |
| MAT-04-V11 | Tres desaprobaciones, ofertada única con tutoría | Cuarta matrícula solo ese curso; mínimo ordinario no causa contradictoria | AC-13 |
| MAT-04-V12 | Tres desaprobaciones, ofertada más cursos | rejected FOURTH_ENROLLMENT_RULE_UNMET | AC-13 |
| MAT-04-V13 | Tres desaprobaciones, tutoría unmet | rejected TUTORSHIP_REQUIREMENT_UNMET | AC-13 |
| MAT-04-V14 | Tres desaprobaciones no ofertada, autorización met12 | Carga especial máximo12 satisfecha | AC-13 |
| MAT-04-V15 | Tres desaprobaciones no ofertada, autorización met13 | rejected FOURTH_ENROLLMENT_RULE_UNMET | AC-13 |
| MAT-04-V16 | Tres desaprobaciones no ofertada, autorización unknown | REPETITION_OR_AUTHORIZATION_UNKNOWN, pending | AC-13 |
| MAT-04-V17 | Tres desaprobaciones no ofertada, autorización unmet | rejected FOURTH_ENROLLMENT_RULE_UNMET | AC-13 |
| MAT-04-V18 | Cuatro desaprobaciones, separación aplicable conocida | ACADEMIC_INELIGIBILITY; no cuarta matrícula ni creación de resolución | AC-12/AC-13 |
| MAT-04-V19 | Cuatro desaprobaciones, resolución/condición unknown | REPETITION_OR_AUTHORIZATION_UNKNOWN, pending; sin separar automáticamente | AC-13 |
| MAT-04-V20 | Combinación especial no resuelta | REPETITION_OR_AUTHORIZATION_UNKNOWN, pending, no composición universal | AC-13 |

### MAT-05 — Sección sin vacantes

Requisitos: FR-010/FR-018/FR-022/FR-023/FR-024/FR-028. 6 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-05-V01 | Llena al procesar | rejected SECTION_FULL; reset, cero cursos/reporte | AC-15/AC-24 |
| MAT-05-V02 | Dos actores por última plaza | Exactamente1 accepted/1 rejected; cupos y reporte solo ganador no predeterminado | AC-30 |
| MAT-05-V03 | Multicurso uno lleno | Todo-o-nada; demás secciones sin ocupación extra | AC-21 |
| MAT-05-V04 | Capacidad cero | SECTION_FULL sin registrar; ninguna cantidad negativa | AC-15 |
| MAT-05-V05 | Lectura anterior con plaza y agotada al commit | Decisión final usa estado al procesar, no reserva/lectura previa | AC-15/AC-24 |
| MAT-05-V06 | Rechazo con reporte previo | Reporte previo intacto; ningún reporte del nuevo intento | AC-18/AC-21 |

### MAT-06 — Exceso límite créditos aplicable

Requisitos: FR-008/FR-009/FR-012/FR-023. 12 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-06-V01 | Ordinaria11 | CREDIT_LOAD_INVALID para conformidad ordinaria, reset | AC-10 |
| MAT-06-V02 | Ordinaria12 | Conformidad ordinaria satisfecha | AC-10 |
| MAT-06-V03 | Ordinaria26 | Conformidad ordinaria satisfecha | AC-10 |
| MAT-06-V04 | Ordinaria27 | CREDIT_LOAD_INVALID, reset | AC-10 |
| MAT-06-V05 | Egreso11 con excepción aplicable | No rechazar solo por<12, excepción identificada | AC-11 |
| MAT-06-V06 | Retorno de separación11 con excepción aplicable | No rechazar solo por<12, excepción identificada | AC-11 |
| MAT-06-V07 | Cambio plan sin cursos abiertos11, excepción aplicable | No rechazar solo por<12, excepción identificada | AC-11 |
| MAT-06-V08 | Excepción unknown11 | EXCEPTION_UNKNOWN, pending; no aprobar ni rechazar por mínimo supuesto | AC-11 |
| MAT-06-V09 | Deuda requisito unmet | DEBT_REQUIREMENT_UNMET conocido synthetic; reset; sin pagos | AC-12 |
| MAT-06-V10 | Salud requisito unmet | HEALTH_REQUIREMENT_UNMET conocido synthetic; reset; sin información médica | AC-12 |
| MAT-06-V11 | Suspensión vigente conocida | ACADEMIC_INELIGIBILITY, no inscripción | AC-12 |
| MAT-06-V12 | Condición institucional unknown | INSTITUTIONAL_REQUIREMENT_UNKNOWN, pending | AC-12 |

### MAT-07 — Intento fuera turno asignado

Requisitos: FR-004/FR-005/FR-025/FR-027. 27 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-07-V01 | Antes apertura propia | OUTSIDE_WINDOW conocido, no inscripción | AC-05 |
| MAT-07-V02 | Instante apertura inclusivo | Elegible según diseño local sin redondeo | AC-05 |
| MAT-07-V03 | Franja posterior a apertura propia | Acceso conserva habilitación testimoniada en variante local, FR-005 | AC-05 |
| MAT-07-V04 | PP17 | Primera apertura, comparación>=, testimonio | AC-25 |
| MAT-07-V05 | PP>19 | Primera apertura local sin reescribir máximo documental19 | AC-25 |
| MAT-07-V06 | PP0 | Última apertura del lunes, sin convertir unknown en0 | AC-05 |
| MAT-07-V07 | Fin exclusivo local de día | OUTSIDE_WINDOW; diferencia borde23:59 marcada local | AC-05/AC-06 |
| MAT-07-V08 | 13 agosto presencial | Sin ventana virtual local, documentos consultables | AC-04/AC-06 |
| MAT-07-V09 | 14 agosto presencial | Sin ventana virtual local, documentos consultables | AC-04/AC-06 |
| MAT-07-V10 | Caducidad en expiresAt | SESSION_EXPIRED para nuevo intento; reentrada y elección vacía | AC-23 |
| MAT-07-V11 | Recarga vigente renew explícito | Renovación15min propia; consultas ordinarias no renuevan | AC-23 |
| MAT-07-V12 | PP16 | Apertura08:00 local derivada, comparación exacta | AC-05 |
| MAT-07-V13 | PP15 | Apertura10:00 local derivada | AC-05 |
| MAT-07-V14 | PP14 | Apertura12:00 local derivada | AC-05 |
| MAT-07-V15 | PP13 | Apertura14:00 local derivada | AC-05 |
| MAT-07-V16 | PP12 | Apertura16:00 local derivada | AC-05 |
| MAT-07-V17 | PP11 | Apertura18:00 local derivada | AC-05 |
| MAT-07-V18 | PP10 | Apertura20:00 local derivada | AC-05 |
| MAT-07-V19 | PP desconocido/null | PROFILE_MISSING para predicado incompleto, configuration-pending; nunca PP=0 ni permiso supuesto | AC-06 |
| MAT-07-V20 | 11 agosto, PP0, sin matrícula del día previo | Ventana EXPLÍCITAMENTE synthetic14–16Z, reloj15Z del mismo día; PP no excluye, contexto known elegible. Horas OFICIALES siguen unknown | AC-26 |
| MAT-07-V21 | 11 agosto, PP16, sin matrícula del día previo | Ventana EXPLÍCITAMENTE synthetic14–16Z, reloj15Z del mismo día; PP no excluye, contexto known elegible. Horas OFICIALES siguen unknown | AC-26 |
| MAT-07-V22 | 11 agosto, PP17, sin matrícula del día previo | Ventana EXPLÍCITAMENTE synthetic14–16Z, reloj15Z del mismo día; PP no excluye, contexto known elegible. Horas OFICIALES siguen unknown | AC-26 |
| MAT-07-V23 | 11 agosto, PP20, sin matrícula del día previo | Ventana EXPLÍCITAMENTE synthetic14–16Z, reloj15Z del mismo día; PP no excluye, contexto known elegible. Horas OFICIALES siguen unknown | AC-26 |
| MAT-07-V24 | 12 agosto, PP0, sin matrícula del día previo | Ventana EXPLÍCITAMENTE synthetic14–16Z, reloj15Z del mismo día; PP no excluye, contexto known elegible. Horas OFICIALES siguen unknown | AC-26 |
| MAT-07-V25 | 12 agosto, PP16, sin matrícula del día previo | Ventana EXPLÍCITAMENTE synthetic14–16Z, reloj15Z del mismo día; PP no excluye, contexto known elegible. Horas OFICIALES siguen unknown | AC-26 |
| MAT-07-V26 | 12 agosto, PP17, sin matrícula del día previo | Ventana EXPLÍCITAMENTE synthetic14–16Z, reloj15Z del mismo día; PP no excluye, contexto known elegible. Horas OFICIALES siguen unknown | AC-26 |
| MAT-07-V27 | 12 agosto, PP20, sin matrícula del día previo | Ventana EXPLÍCITAMENTE synthetic14–16Z, reloj15Z del mismo día; PP no excluye, contexto known elegible. Horas OFICIALES siguen unknown | AC-26 |

### MAT-08 — Intento duplicar matrícula

Requisitos: FR-018/FR-022/FR-024/FR-029. 7 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-08-V01 | Replay accepted | Mismo Outcome/report; cero nuevos cupos/cursos | AC-22/AC-32 |
| MAT-08-V02 | Replay rejected | Mismo rechazo, no aceptar por capacidad nueva | AC-32 |
| MAT-08-V03 | Dos envíos misma identidad concurrentes | Un solo registro/consumo/reporte, mismo Outcome | AC-22/AC-32 |
| MAT-08-V04 | Misma identidad elección distinta | 409 REQUEST_CONFLICT, original intacto | AC-32 |
| MAT-08-V05 | Nueva identidad con matrícula previa | ALREADY_ENROLLED académico, reset; no ampliación | AC-32 |
| MAT-08-V06 | Misma elección orden distinto | Canonical payload equivalente, mismo resultado | AC-32 |
| MAT-08-V07 | Elección distinta después rechazo | Nueva identidad, nueva evaluación; no altera solicitud original | AC-32 |

### MAT-09 — Error técnico durante confirmación

Requisitos: FR-018/FR-025/FR-029. 11 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-09-V01 | Respuesta perdida postaccepted | UI incierta→lookup accepted+reporte; sin reenvío automático | AC-31 |
| MAT-09-V02 | Respuesta perdida postrejected | UI incierta→lookup mismo rejected→reset, no aceptación | AC-32 |
| MAT-09-V03 | Corte antes de entregar petición | Lookup unknown antes nuevo procesamiento, cero efectos | AC-33 |
| MAT-09-V04 | Petición en cola sin resultado publicado | Unknown no demuestra no recepción ni cancela solicitud | AC-33 |
| MAT-09-V05 | Replay resultado después expiry sesión | Resultado conservado dentro run; nuevo intento exige sesión nueva | AC-23/AC-31/AC-32 |
| MAT-09-V06 | Run anterior después restart/reset | RUN_CHANGED, no falso rechazo/éxito/reenvío silencioso | AC-31/AC-32 |
| MAT-09-V07 | DTO clave extra conocida | 400 INVALID_REQUEST, sin Outcome; elección no se reinicia como rechazo académico | AC-33 |
| MAT-09-V08 | Choice catálogo inexistente | 404 CHOICE_NOT_FOUND, sin Outcome | AC-09/AC-33 |
| MAT-09-V09 | Revisión antigua en solicitud nueva | 409 PROFILE_CHANGED, sin Outcome | AC-33 |
| MAT-09-V10 | Sesión de otro actor | 409 SESSION_CONTEXT_MISMATCH, sin efectos | AC-33 |
| MAT-09-V11 | Fallo antes de publicación | 500 sin publicación parcial; consultar identidad, no presumir resultado | AC-21/AC-33 |

### MAT-10 — Consulta resultado y reporte

Requisitos: FR-013/FR-014/FR-016/FR-019/FR-020/FR-024/FR-029. 10 variantes ×2 escuelas.

| ID | Condición independiente | Resultado esperado | AC |
| --- | --- | --- | --- |
| MAT-10-V01 | Lookup known accepted | Recupera mismo registro/report sin writes | AC-17/AC-18/AC-31 |
| MAT-10-V02 | Lookup known rejected | Recupera causas/reset sin writes ni reporte | AC-16/AC-24/AC-32 |
| MAT-10-V03 | Lookup known pending | Gaps informados, no rechazo; cero registro | AC-28 |
| MAT-10-V04 | Report correspondencia | Courses exactos,total sumado una vez, metadata scope/revisión | AC-18 |
| MAT-10-V05 | Report del intento rejected ausente | 404 REPORT_NOT_FOUND, no seed fallback | AC-21/AC-24 |
| MAT-10-V06 | Report otro actor | 404 REPORT_NOT_FOUND, no mezclar contextos | AC-18 |
| MAT-10-V07 | Reporte previo conservado | Rechazo posterior no borra reporte anterior | AC-18/AC-21 |
| MAT-10-V08 | Sin impresión/visado | Registro aceptado no cambia por formalidad documental | AC-19 |
| MAT-10-V09 | Descarga CSV propia | Headers/rows del reporte propio, no PDF oficial | AC-01/AC-18 |
| MAT-10-V10 | Procedencia/privacidad/exclusiones | Solo fixture independiente, cero reales/pagos/SUM/workflows excluidos; evidencias mínimas | AC-01/AC-18 |

## Denominadores cerrados y trazabilidad SC

Total: 121 variantes funcionales ×2 = **242 instancias obligatorias**.
Las ocho variantes MAT-07-V20–V27 expanden AC-26 en ambos días/PP representativos:
16instancias escolares, sin matrícula previa y con perfil synthetic seleccionado explícitamente.
No prueban todos los PP reales ni completan horas oficiales o categorías administrativas SUM.

Numerador de cada SC = instancias de su conjunto con esperado observado, evidencia y resultado registrado;
denominador = conjunto fijo abajo. Pendiente de ejecución no es pass. Los porcentajes son locales, no N3.

| SC | Universo fijo / denominador | Evaluación |
| --- | --- | --- | --- |
| SC-001 | MAT-01-V01, MAT-01-V02, MAT-01-V03, MAT-01-V04, MAT-01-V05, MAT-01-V06, MAT-01-V07, MAT-01-V08, MAT-01-V09, MAT-02-V01, MAT-10-V09 ×2 = 22 | Prematrícula/documental/calendario/precondición; gap esperado explícito |
| SC-002 | MAT-04-V01, MAT-04-V02, MAT-04-V04, MAT-04-V06, MAT-04-V07, MAT-04-V08, MAT-04-V09, MAT-04-V11, MAT-04-V12, MAT-04-V13, MAT-04-V14, MAT-04-V15, MAT-04-V17, MAT-04-V18, MAT-06-V01, MAT-06-V02, MAT-06-V03, MAT-06-V04, MAT-06-V05, MAT-06-V06, MAT-06-V07, MAT-06-V09, MAT-06-V10, MAT-06-V11, MAT-02-V05 ×2 = 50 known; MAT-04-V03, MAT-04-V05, MAT-04-V10, MAT-04-V16, MAT-04-V19, MAT-04-V20, MAT-06-V08, MAT-06-V12 ×2 = 16 pending aparte | Porcentaje normativo solo known; expected-gap separado, no promover unknown a conformidad |
| SC-003 | MAT-02-V01, MAT-03-V01, MAT-05-V01 ×2 =6 | Éxito/cruce/cupo con navegación y reporte/ausencia; no cubre toda normativa |
| SC-004 | MAT-01-V10, MAT-01-V11, MAT-01-V12, MAT-01-V13, MAT-01-V14, MAT-02-V05 ×2 = 12 | Scope/facultad/periodo/escuela/plan/revisión; cero fallback |
| SC-005 | 29FR +33AC +8SC +10ACC =80 entradas documentales | Cada ID tiene fuente/decisión y variantes o check correspondiente; cero promoción indebida |
| SC-006 | Todas 242 instancias +80 entradas documentales | Cero literal/mecanismo inventado como SUM; M01 y flags limitados |
| SC-007 | 242 instancias funcionales y, separadamente,170 celdas ACC bajo mismos fixtures; no sumarlas como una sola métrica | Cero privado/pagos/productivo/workflows excluidos; procedencia de proceso entero |
| SC-008 | MAT-03-V04, MAT-01-V07, MAT-01-V08, MAT-01-V09, MAT-05-V02, MAT-09-V01, MAT-08-V01, MAT-08-V02, MAT-08-V03, MAT-08-V04, MAT-09-V03 ×2 = 22 | AC27–33 y conflicto de identidad; sin efectos extra, horarios synthetic separados |

Todas las AC01–33 aparecen en las filas; FR001–029 se enlazan por categoría y restricciones
transversales. FR015/016/017/018/019/020 aplican además a todas las instancias; no basta el
estado de un solo escenario de privacidad. La matriz normativa F1/F6 de spec permanece fuente
de SC002, no se sustituye por la clasificación del estudio ni se elimina repitencia por
excluir un trámite administrativo de matrícula condicionada.

## ACC-01–ACC-10: requisitos locales medibles

Fuente primaria y revisión: [PUB-05/W3C](../../docs/domain/fisi/2026-II/planning-source-review-2026-10-11.md).
Estos IDs son requisitos locales aprobados y complementan FR/AC, sin cambiar sus conteos.
Alcance exclusivo registro/revisión/resultado/reporte de esta feature; no Inicio general,
paridad visual SUM ni conformidad integral A/AA. Pruebas automatizadas no sustituyen teclado,
zoom/reflow/foco y lectura AT reales planificados. Excepción exige caso/elemento/justificación;
no es permiso genérico para omitir criterio ni casilla pass sin medición.

| ID | Resultado local medible | Referencia técnica / excepciones concretas |
| --- | --- | --- |
| ACC-01 | Todas las acciones por teclado, sin trampa; tabulación, activar, cambiar selección, cerrar y consultar funcionan. | W3C2.1.1/2.1.2; no hay acción dependiente de trayectoria en esta feature que habilite excepción. |
| ACC-02 | Contraste texto normal>=4.5:1; grande>=3:1. Grande>=18pt o14pt negrita. | W3C1.4.3; excepción texto incidental/decorativo, control inactivo y logotipo, nunca causa/estado/título significativo. |
| ACC-03 | Partes visuales necesarias de controles/gráficos>=3:1 contra color adyacente. | W3C1.4.11; controles inactivos, presentación UA sin modificación o representación gráfica esencial justificadas por elemento. |
| ACC-04 | Texto ampliado200% sin pérdida de contenido ni función. | W3C1.4.4; imágenes de texto y subtítulos exceptuados; esta feature no requiere introducir ninguno. |
| ACC-05 | Lectura horizontal a320CSSpx sin scroll bidimensional injustificado; formularios/avisos/actions sin pérdida. | W3C1.4.10; tabla/rejilla cuyo significado exige2D puede documentar excepción de esa región, no de página ni controles. |
| ACC-06 | Foco visible y nunca totalmente oculto por contenido del autor; foco correcto en apertura/cierre/ruta. | W3C2.4.7/2.4.11; esta feature no usa zonas arrastrables ni permite overlays que oculten foco: no se adopta esa excepción. |
| ACC-07 | Targets>=24x24CSSpx o excepción medida y justificada. | W3C2.5.8; target pequeño con círculo24px centrado sin intersección con targets/círculos pequeños vecinos; target equivalente; enlace inline; UA sin modificar; tamaño esencial. |
| ACC-08 | Error de campo/situación identificado en texto con causa y contexto; no solo color/icono ni falso rechazo por timeout. | W3C3.3.1; asociar a campo si existe; errores globales al resumen. No presentar texto inventado como literal SUM. |
| ACC-09 | Carga, pendiente, incertidumbre y resultado comunicables a AT sin exigir encontrar visualmente aviso. | W3C4.1.3; regiones status/alert y semántica de dialog según estado, sin mover foco para avisos ordinarios ni duplicar anuncios. |
| ACC-10 | Cada campo/control tiene nombre, rol y estado programáticos coherentes (checked/disabled/expanded según aplica). | W3C4.1.2; labels/roles nativos preferidos; cambios de estado disponibles a AT. |

Las referencias W3C completas y anchors están en PUB-05; valores anteriores describen el
subconjunto técnico adoptado, no una obligación jurídica atribuida al prototipo. Resolución
PCM publicada no implica que se auditó su anexo/vigencia/aplicación. No son hallazgos del SUM.

### Universo finito de accesibilidad y foco

Estados escolares obligatorios: `R1`registro con prematrícula/calendario; `R2`elección/revisión;
`R3`enviando; `R4`configuration-pending; `R5`resultado no confirmado; `P1`reporte accepted;
`P2`error de lectura/protocolo de reporte; `D1`modal accepted; `D2`modal rejected académico.
Instancia `ACC-XX-{R1..D2}-{SIS|SOFT}`. ACC01–07/09/10:9estados×2=18 por criterio (162total).
ACC08: R4/R5/P2/D2×2=8 aplicables; R1/R2/R3/P1/D1 no presentan error en estado base,
se registran N/A predefinidos, no pass ficticios. Denominador accesibilidad: **170 celdas**.
Numerador: celdas aplicables con medición/interacción y resultado esperado;0 ejecutadas hoy.
Excepciones W3C justificadas por elemento forman parte de la medición de celda, no reducen
este denominador ni autorizan ocultar fallas. No sumar reruns o dividir controles para inflarlo.

Protocolo local de foco: abrir D1/D2 lleva foco a heading del dialog (programáticamente
focusable) y nombre/descripción legibles; Tab/ShiftTab permanecen en acciones del modal.
Escape y botón cerrar salen; D2 vuelve al registro vacío conforme L-06 y enfoca su heading
si el opener dejó de ser elegible; D1 cerrado sin navegación vuelve a opener disponible o
heading del resultado accepted. Acción «Ver reporte local» navega y enfoca heading P1;
no timeout de redirección ni cancelación del commit por cerrar. Resultado pending/uncertain
no abre dialog de rechazo ni borra identidad por Escape. Carga/envío no usa modal bloqueante
sin salida: estado AT y controles de envío disabled, lectura/consulta segura sigue posible.
Avisos no modales conservan foco actual y se anuncian; error de validación con campo dirige
foco al primer campo identificado después de acción del usuario, manteniendo texto asociado.
RouteError.invalidate solo lectura, nunca reenvío; reentrada expirada reinicia elección salvo
identidad incierta consultable. M-01 permanece referencia del manual, no exige navegación
automática mientras el usuario lee el aviso ni declara persistencia productiva.

Cuando D1 espera «Ver reporte local», su texto es veraz y local-only; no copiar el literal
M-01 ni el indicador REDIRECCIONANDO como si ya hubiera navegación en curso. M-01 permanece
referencia documental/visual, no una obligación de texto para ese estado local.
