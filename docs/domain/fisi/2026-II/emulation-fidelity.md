# emulation-fidelity.md — contrato de fidelidad conductual

**Objetivo:** emular *comportamiento observable* del módulo de matrícula regular pregrado FISI del SUM, tomando como referencia el semestre 2026-II. **Esto no autoriza a inferir, inspeccionar o reproducir backend interno del SUM**. No es especificación de diseño técnico.

**Evidencia vigente:** `business-rules.md` identifica F1–F6 y artículos; `as-is-process.md` separa normativa y testimonio. Una fecha en un calendario no demuestra que el sistema implemente determinado bloqueo. Un relato de usuario sin captura se clasifica **[Observado-testimonio]**, no una prueba reproducible.

## Matriz de fidelidad y decisiones permitidas

| Comportamiento | Base disponible | Objetivo emulador | Grado de fidelidad permitido **hoy** | Preguntas pendientes |
|---|---|---|---|---|
| Ventana regular 2026-II | [Verificado-norma] F2, 10–14 agosto; [Verificado-FISI] F6, distribución local | Mostrar periodo general y **distinguir** 10-08 virtual por PP, 11–12 virtual «libre», 13–14 presencial especial | **Calendario publicado confirmado** para FISI 2026-II; bloqueo real de UI [Por confirmar] | Q-09, Q-25, Q-31, Q-32 |
| Turno individual según ponderado | [Verificado-FISI] F6 aporta bandas y franjas **del lunes 10-08-2026**; [Observado-testimonio] sobre habilitación en SUM | Reproducir reglas publicadas en perfil FISI/2026-II y distinguirlas de la conducta aún no observada de SUM | **N2 para calendario publicado**; **N1–N2** para interacción del SUM hasta tener evidencia; no asumir permanencia de acceso ni hora de «libre» | Q-08, Q-09, Q-25, Q-31, Q-32 |
| Reporte de prematrícula visible/cargado | [Verificado-norma] F1 arts. 13.r, 25.a; [Observado-testimonio] | Visualizar cursos del plan pendientes; mostrar cursos en «Realizar matrícula» | **Parcial**: existencia normativa; estructura, filtrado y sincronización [Por confirmar] | Q-11, Q-12 |
| Descarga prematrícula | [Verificado-norma] F1 art. 25.a | Permitir descargar documento si aplica | **No debe ser guardia técnica obligatoria** sin evidencia de SUM | Q-11 |
| Mínimo y máximo de créditos | [Verificado-norma] F1 art. 13.p; F3 excepción autorizada | Aplicar parámetros normativos con casos particulares documentados | **Regla conocida, momento de bloqueo desconocido** | Q-02, Q-16 |
| Prerrequisitos / prioridad de desaprobados | [Verificado-norma] F1 art. 18 | Respetar cursos habilitados conforme plan | **Regla conocida; presentación y secuencia por confirmar** | Q-03, Q-12 |
| Cruce de horarios | [Verificado-norma] F1 art. 13.d para rectificación; [Observado-testimonio] rechazo regular | Bloquear confirmación inválida si se demuestra en recorridos | **Parcial**, no imponer bloqueo durante cada clic | Q-04, Q-13, Q-14 |
| Sección sin vacantes | [Verificado-FISI] F3; [Observado-testimonio] warning final | Rechazar registro sin cupo | **Regla conocida**; no asumir momento de reserva ni qué pasa con solicitudes concurrentes | Q-01, Q-15, Q-17 |
| Deudas | [Verificado-norma] F1 art. 24.b | Respetar requisito institucional | **Por confirmar** si el SUM realiza comprobación o solo refleja habilitación | Q-05 |
| Salud anual | [Verificado-norma] F1 art. 24.c | Respetar requisito institucional | **Por confirmar** si interviene el SUM; no inventar flag ni dependencia externa | Q-06 |
| Repitencia | [Verificado-norma] F1 arts. 12, 13.c, 19 | Diferenciar 2, 3 y 4 desaprobaciones; curso programado o no | **Normativa exacta**, automatización/estado de autorizaciones pendiente | Q-18 |
| Sanciones académicas/disciplinarias | [Verificado-norma] F1 art. 10 | Representar inelegibilidad cuando aplique | **Normativa conocida**, control UI no observado | Q-19 |
| Mensajes de error / de éxito | Relato de advertencia; **sin literal** | Reproducir literal **solo cuando esté capturado** | **No exacto**; placeholders claramente etiquetados | Q-01–Q-07, Q-13–Q-14 |
| Retorno a inicio tras error | [Observado-testimonio] | Replicar el patrón de navegación descrito | **Provisional**; validar para cada tipo de error | Q-14, Q-20 |
| Guardado/confirmación | [Observado-testimonio] éxito sin visado; F1 reporte | Lograr registro observable sin requerir visado dentro de UI | **Persistencia, atomicidad y estados desconocidos**. No afirmar semántica transaccional equivalente a producción | Q-21, Q-22 |
| Reporte final y visado | [Verificado-norma] F1 arts. 13.s, 25.c–d | Distinguir documento formal de estado de matrícula SUM | **Exactitud documental normativa**; el visado **no** modelado como confirmación del aplicativo | Q-23 |
| Sesión y reintento | Sin evidencia | Comportarse de forma definida ante expiración/duplicación | **Simulación por diseño** hasta que haya observaciones; no afirmar equivalencia | Q-20, Q-22 |
| Extemporánea / rectificación | [Verificado-norma] F1; [Verificado-FISI] F3/F5 | Futuras rebanadas | **Listado de alcance**, no implementar como si se hubiera observado un flujo | Q-07, Q-26 |
| Reserva/anulación/reactualización | [Verificado-norma] F1/F2; evidencia FISI F3 | Futuras rebanadas | **Listado de alcance**, procedimiento y efectos SUM por confirmar | Q-24, Q-27 |

## Niveles de fidelidad (propuesta explícita, no comportamiento descubierto)

- **N0 — No modelado:** comportamiento pendiente. Se registran datos faltantes sin inferir decisiones.
- **N1 — Simulación identificada:** para demo aislada con datos sintéticos, reglas plausibles y textos **no literales**, anunciada como simulación. **Nunca rotularla como paridad del SUM**.
- **N2 — Fidelidad normativa:** se respetan condiciones publicadas (incluidas excepciones); la interfaz todavía puede diferir.
- **N3 — Fidelidad observable:** además de norma, existe una secuencia de interacción repetible que acredita gatillo, resultado, navegación, mensaje y estado.

**Regla de aceptación:** ninguna celda con `[Por confirmar]` debe convertirse automáticamente en un criterio de aceptación de **paridad** N3. Los criterios pueden ser N1/N2 explícitos y separados. Si un nuevo hallazgo contradice F1, conservar ambas afirmaciones y abrir incidencia de discrepancia; no sustituir silenciosamente normativa por comportamiento ni viceversa.

## Variación por facultad y periodo: perfil FISI 2026-II

**Fuente publicada F6:** [cuadro oficial FISI](https://sistemas.unmsm.edu.pe/site/images/2.-_Cuadro_Intervalo_de_horario_con_Promedios_Ponderados_para_Semestre_2026-II_F_.pdf), firmado el 21-07-2026 según captura y documento indexado en dominio institucional. El motor funcional de elegibilidad del emulador **debe recibir reglas versionadas** por facultad y periodo; los siguientes datos **no son defaults de toda la UNMSM**:

- **Ámbito**: FISI, pregrado, periodo 2026-II; distingue ventana rectoral **F2** de calendario local **F6**.
- **Fase A, lunes 10-08**: virtual con bandas superpuestas. Inicios de ventana `06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00`; mínimos PP asociados `17, 16, 15, 14, 13, 12, 11, 10, 0`; final publicado `23:59`; máximo declarado de PP `19.00`. Son **valores de evidencia F6**, no un algoritmo de ranking inventado.
- **Fase B, martes 11 y miércoles 12-08**: virtual **«libre»**; **significado de elegibilidad y horas sin determinar**. No convertir «libre» en «todas las horas» ni «todas las categorías» sin validación.
- **Fase C, jueves 13-08**: atención **presencial** de alumnos observados de 2.ª y 3.ª repitencia **con resolución de tutoría**, en dos sesiones 08:00–13:00 y 14:00–16:00.
- **Fase D, viernes 14-08**: atención **presencial** de estudiantes con problemas al matricularse, mismas sesiones de oficina.
- **Ambigüedades de fuente**: los dos últimos rótulos de grupo aparecen como `6` y `7` repetidos en F6; no corregirlos en un campo `grupo_oficial`. El cuadro no explica el tratamiento de PP **mayores que 19.00** ni si la disponibilidad virtual **se mantiene tras el comienzo del turno del alumno**.

**Contrato de configurabilidad funcional**: para cada versión, administrar vigencia, fuente, autoridad facultad/escuela, días, modalidad (virtual/presencial), criterio PP o `libre`, intervalos, categorías con requisitos administrativos, zona horaria y reglas excepcionales. Un nuevo semestre/facultad puede cambiar horas, umbrales, fases y requisitos sin alterar las reglas comunes del reglamento. **No se presupone que el SUM real emplee esta misma arquitectura**. Conservar resolución de fuente y estado de verificación en cada configuración y no inferir reglas faltantes.

## Catálogo configurable de mensajes — esquema funcional, no textos inventados

Cada entrada debe guardar: `id de escenario`, `versión`, `facultad`, `programa`, `periodo`, `ubicación/acción disparadora`, `condición`, `texto`, `literalidad`, `origen (captura o testimonio)`, `fecha de captura`, `resultado de navegación`, `resultado de estado` y `revisión`. 

| Escenario | Identificador funcional sugerido | Mensaje que puede mostrarse en demo N1 | Estado de evidencia |
|---|---|---|---|
| Créditos inválidos | `CREDIT_LOAD_INVALID` | `PLACEHOLDER — No se pudo completar la matrícula: carga de créditos no admitida para este caso.` | **No literal**; pendiente captura |
| Prerrequisitos | `PREREQUISITE_UNMET` | `PLACEHOLDER — Una asignatura no cumple los requisitos académicos.` | **No literal** |
| Cruce horario | `SCHEDULE_CONFLICT` | `PLACEHOLDER — La selección presenta incompatibilidad horaria.` | **No literal** |
| Sección llena | `SECTION_FULL` | `PLACEHOLDER — La sección seleccionada ya no tiene vacantes.` | **No literal** |
| Fuera de turno | `OUTSIDE_ENROLLMENT_SLOT` | `PLACEHOLDER — La opción no está habilitada en este horario.` | **No literal**, elegibilidad por franja pendiente |
| Inscripción exitosa | `ENROLLMENT_RECORDED` | `PLACEHOLDER — Matrícula registrada.` | **No literal**, indicador real pendiente |
| Sesión caducada | `SESSION_EXPIRED` | `PLACEHOLDER — Vuelve a iniciar sesión.` | **No literal**, evento real no observado |
| Error no clasificado | `ENROLLMENT_REJECTED_UNKNOWN` | `PLACEHOLDER — No se pudo completar la operación.` | **No literal** |

Los identificadores y mensajes `PLACEHOLDER` **son una propuesta de instrumentación del emulador** y nunca se deben citar como salidas del SUM real. Al capturar un literal, archivarlo con **evidencia visual anonimizada**, versión de pantalla, contexto/turno, clasificación de facultad y resultado. Registrar si aparece una advertencia, un modal o una notificación. El emulador puede resolver mensajes específicos por **versión de facultad y semestre**; no generalizar textos de otra facultad.

## Concurrencia y fallos — lo que se puede demostrar sin inventar el backend

La fuente F3 acredita que **sin vacante no se registra**. **No acredita** bloqueo temporal de cupo, algoritmo FIFO, transacción de todo-o-nada, consumo parcial, sesión exclusiva, tiempo máximo de respuesta, idempotencia ni política de reintentos. Por tanto:

| Caso de prueba con datos sintéticos | Expectativa respaldada | Desconocido a investigar |
|---|---|---|
| Dos estudiantes compiten por última vacante | **No debe terminar habiendo más matrículas exitosas que plazas**, como regla objetivo de consistencia derivada de F3, sin afirmar que el SUM actual lo garantice correctamente | Cuál obtiene cupo y en qué momento se descuenta |
| Vacante disponible durante selección, agotada antes de confirmar | F3 impide **registro final** sin cupo; testimonio señala un warning de rechazo | Persistencia de selección, mensaje, retorno a inicio |
| Se seleccionan tres asignaturas y falla una sección | No hay evidencia de si las otras dos quedan matriculadas | Atomicidad, compensación, reintento |
| Doble clic o reenvío por latencia | **Ninguna semántica de producción confirmada** | Duplicaciones, espera, idempotencia |
| Sesión expira en elección o durante confirmación | **Ninguna semántica de producción confirmada** | Recuperación, edición conservada, redirección |

**No etiquetar estos comportamientos como réplicas exactas**. Se pueden diseñar y probar de manera segura en un emulador aislado por razones de calidad, siempre distinguiendo **requisito de diseño del emulador** de **observación del SUM**.

## Límites por institución / facultad

La **norma universitaria común** proviene de F1 y el **cronograma rectoral** de F2. F1 permite facultades con restricciones y trámites particulares; por eso NO copiar sin revisión cronogramas internos, permisos, modalidades, horarios, condiciones o mensajes de Ciencias Sociales, Administración, Medicina u otra facultad. La aplicación futura a otras facultades exige fuente específica, edición y fecha de vigencia por variante.

**Dimensiones configurables:** facultad/escuela, periodo y tipo, plan en vigor, oferta y secciones, cupos, calendario rectoral, calendario local, turnos, excepciones autorizadas, validadores activos, plantillas de mensajes, rutas tras error, procesos administrativos y versiones de reglas. **Valores concretos descubiertos:** F6 aporta los de FISI 2026-II. El resto sigue sujeto a investigación.

Esta lista expresa **dimensiones a investigar y eventualmente configurar**. No atribuir todavía a producción del SUM un motor de reglas, flags, APIs o persistencia concreta.

## Umbral para declarar lista la rebanada 1 para `specify`

1. Reglamento y cronograma con identificador, artículo, enlace y fecha: **cubierto** en F1/F2.
2. Exclusiones, excepciones y definiciones de FISI donde existan fuentes: **parcial**; **turnos publicados FISI 2026-II cubiertos por F6**, faltan habilitación real del SUM, límites y clasificación de situaciones especiales.
3. Disparador, momento, precedencia y cantidad de errores: **no cubierto**, Q-13/Q-14.
4. Literalidad y consecuencias de error de cruce, cupo y crédito: **no cubierto**, Q-01/Q-02/Q-04.
5. Guardado, atomicidad, carrera por cupos, doble clic y expiración: **no cubierto**, Q-15/Q-17/Q-20–Q-22.
6. Éxito y distinción entre registro SUM, reporte y visado: **parcial**, requiere registro visual y confirmación institucional de diferencias.

**Conclusión:** el dossier sustenta **una especificación N2 de reglas normativas con pendientes explícitos**, pero aún **no** una especificación N3 de paridad de todos los comportamientos de matrícula regular. Mantener los pendientes como bloqueantes de fidelidad, no completarlos mediante generación de código.
