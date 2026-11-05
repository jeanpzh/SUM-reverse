# SUM-reverse — informe de avance de E1, E2 y E3

**Rama:** `schedule-pt1`  
**Corte del informe:** 5 de noviembre de 2026, Lima  
**Ámbito:** prototipo local de Sistemas con datos sintéticos.

E1 permite construir, revisar, aprobar y publicar una programación académica simulada. E2 permite que cada estudiante elegible consulte esa publicación, prepare su horario y registre una intención versionada. La primera integración con E3 permite recuperar esa intención desde la pantalla de matrícula y trasladar las elecciones que tengan una correspondencia comprobada en la oferta operativa. La activación de una oferta E3 de 2027-I y su confirmación quedan pendientes.

| Etapa | Entrada principal | Resultado | Efecto sobre cupos |
|---|---|---|---|
| E1 · Programación académica | Catálogo, demanda, docentes, ambientes y restricciones | Publicación académica de solo lectura | Expone capacidad planificada |
| E2 · Prematrícula | Publicación exacta y selección del estudiante | Borrador e intención registrada, con historial | Registrar una intención no reserva vacantes |
| E3 · Matrícula definitiva | Oferta operativa, perfil académico y selección revisada | Matrícula y reporte confirmado cuando el motor acepta | La confirmación aceptada incrementa ocupaciones |

## 1. Arquitectura y separación de responsabilidades

- **React y Vite** presentan la pantalla de Escuela, el reporte estudiantil de prematrícula y la pantalla de matrícula regular existente. Las llamadas pasan por el proxy local de mismo origen.
- **NestJS** valida los contratos, ejecuta el generador, conserva propuestas e intenciones y aplica las reglas de matrícula. Los contratos compartidos están en [shared](../../shared/).
- **Docker Compose local** habilita Escuela y los escenarios sintéticos. Nginx sirve la interfaz y enruta `/api` hacia el backend. El puerto por defecto es `5180`, publicado en loopback. El volumen `academic-drafts` conserva E1 y E2 en espacios separados. [Configuración Compose](../../compose.local.yaml)
- **Matrícula local** usa un repositorio en memoria por ejecución. Cambiar de escenario o reiniciar el backend puede reiniciar esa oferta, las sesiones y las matrículas simuladas. Los documentos E1 y E2 del volumen sobreviven. El simulador público tiene su propia configuración y persistencia PostgreSQL, y excluye E1 y E2.

Los identificadores de publicación, intención y matrícula tienen finalidades distintas. El **periodo objetivo** de E1 y E2 es 2027-I. El corte `2026-1` describe el historial que usa el estimador. La oferta operativa de matrícula que viene con la demo sigue siendo 2026-II.

## 2. E1 — de calcular secciones a publicar horarios

### 2.1. Cálculo, validación y búsqueda

1. **Dimensionamiento.** La cantidad propuesta de secciones es el techo de `demanda / capacidad objetivo`. Una demanda cero produce cero secciones. El contrato valida los tipos y rangos antes de calcular. Con 180 estudiantes y una capacidad objetivo de 45 se obtienen cuatro secciones.
2. **Sesiones requeridas.** Se construyen desde un patrón semanal explícito por curso. Cada componente conserva su tipo y duración. Los créditos se muestran como información académica, mientras que el patrón determina los minutos de clase.
3. **Validación.** Se comprueban cruces de sección, docente y ambiente, disponibilidad, habilitación docente, carga semanal, límites por asignatura y capacidad y tipo de ambiente. Los grupos de compatibilidad permiten exigir que determinados cursos no se crucen sin aplicar esa condición a todo un ciclo.
4. **Generación.** Se prueban combinaciones de docentes, ambientes y horas mediante búsqueda con retroceso, con un orden estable y un presupuesto acotado. Las restricciones duras descartan combinaciones. Las preferencias ayudan a ordenar candidatos. La política puede priorizar preferencias, buscar una distribución más equilibrada o tomar la primera solución factible. El presupuesto acota la exploración y no garantiza un óptimo global.
5. **Cobertura.** El conjunto autorizado de sesiones se deriva de la entrada original. Una propuesta completa debe cubrir todos los componentes de todas las secciones. El resultado distingue solución completa, imposibilidad en el espacio explorado, límite de búsqueda y entrada inválida. Un resultado parcial conserva sus bloques válidos e identifica los pendientes. Alcanzar `SEARCH_LIMIT` deja abierta la posibilidad de una solución.

[Dimensionamiento](../../backend/src/programacion-academica/section-sizing.ts) · [Validador](../../backend/src/programacion-academica/schedule-validator.ts) · [Generador](../../backend/src/programacion-academica/schedule-generator.ts) · [Cobertura](../../backend/src/programacion-academica/session-coverage.ts) · [Límites locales](../../backend/src/programacion-academica/generator-limits.ts)

### 2.2. Catálogo, recursos y presentación

Se reutilizó el catálogo académico sintético autorizado de la réplica. El adaptador agrupa 165 registros de programación en 56 asignaturas y conserva códigos, nombres, ciclos, créditos y patrones de referencia. La interfaz permite filtrar por ciclo y seleccionar solo las asignaturas que se van a programar. La programación anterior se muestra como referencia. Las disponibilidades, la demanda y los recursos del nuevo periodo se configuran por separado.

El editor muestra un docente o ambiente a la vez y conserva su configuración al cambiar de selección. Los docentes pueden estar habilitados para varios cursos. Cada sección tiene un responsable y el mismo docente puede cubrir varias secciones si su carga, disponibilidad y máximo por curso lo permiten. El catálogo de referencia contiene 49 ambientes AP y NP, con aulas y laboratorios y una capacidad inicial de referencia de 45. Las capacidades y disponibilidades se pueden editar para la prueba.

El **bloque continuo** es la modalidad predeterminada. Todos los componentes de una sección se ubican consecutivamente el mismo día con el mismo docente. Las sesiones divididas se solicitan de forma explícita. La tabla y el calendario agrupan los componentes contiguos para que una clase de cuatro horas aparezca como un bloque completo.

[Adaptador del catálogo](../../backend/src/programacion-academica/synthetic-catalog-adapter.ts) · [Ambientes de referencia](../../backend/src/programacion-academica/reference-rooms.ts) · [Pantalla de Escuela](../../client/src/screens/AcademicScheduling.tsx) · [Editor de recursos](../../client/src/screens/AcademicResourceEditor.tsx)

### 2.3. Ajustes y estimación de demanda

La acción **Editar horario** está en la tabla de secciones y abre únicamente la sección seleccionada. El servidor conserva la duración y la estructura del bloque, vuelve a validar el horario completo y aplica el ajuste solo si es compatible. Un cambio rechazado conserva la asignación anterior. Los cambios en la configuración que invalidan el resultado exigen regenerar.

Se distinguen tres cifras:

| Cifra | Procedencia | Uso |
|---|---|---|
| Demanda potencial | Historial y plan sintéticos. Deduplica estudiantes, evalúa aprobaciones, equivalencias y prerrequisitos, y separa la información insuficiente | Sugerir secciones a la escuela |
| Intención registrada | Última revisión E2 válida por estudiante, para una publicación exacta | Consultar demanda declarada por curso y sección |
| Demanda final | Valor editable que decide Escuela | Dimensionar la propuesta E1 |

El estimador distingue a los repitentes elegibles como subconjunto de los elegibles. Los cuenta una vez. La muestra independiente de 120 perfiles sirve para demostrar el estimador y está separada de las dos cuentas estudiantiles de E2. La demanda potencial mide elegibilidad y necesidad posible, mientras que la intención expresa una selección registrada.

[Estimador](../../backend/src/programacion-academica/demand-estimator.ts) · [Demanda sintética y procedencia](programacion-academica-demand-demo.md) · [Ajuste manual verificado](../../evidence/local/programacion-academica-manual/fullstack-verification.md)

### 2.4. Guardado, revisión docente y publicación

1. **Guardar propuesta** conserva la configuración y el resultado aplicable. Se puede continuar desde **Mis propuestas** tras cerrar el navegador o reiniciar el backend. El servidor valida el formato y verifica la versión esperada para evitar que una pestaña antigua sobrescriba otra edición.
2. **Revisión docente simulada.** Escuela envía una propuesta guardada con horario completo. Cada docente revisa sus bloques y puede dar conformidad o solicitar cambios con una observación. Una huella de sus asignaciones permite conservar las conformidades vigentes e invalidar las afectadas por una edición. El historial conserva las rondas y decisiones.
3. **Aprobación simulada.** La propuesta debe tener un horario completo y conformidades vigentes. Aprobar congela la revisión correspondiente. La pantalla muestra una vista previa.
4. **Publicación simulada.** El servidor verifica la aprobación y la versión vigente esperada. La publicación usa el contrato `PA-PUBLICATION-1` y tiene ID y versión explícitos. La versión anterior sigue consultable. Para editar, se crea otro borrador a partir de la publicación. El nuevo borrador sigue su propio proceso de revisión y aprobación.

El almacenamiento de la demo usa archivos JSON con suma de verificación y escritura mediante reemplazo atómico, con un backend escritor. La suma de verificación detecta daños accidentales. Las acciones y roles de Escuela y Docente son simulados.

[Guardado y recuperación](programacion-academica-persistence.md) · [Revisión docente](programacion-academica-teacher-review.md) · [Aprobación y publicación](programacion-academica-publication.md) · [Contrato E1](contracts/local-api/programacion-academica-demo.md)

## 3. E2 — borrador, intención y agregados

La pantalla habitual de **Reportes → Prematrícula** conserva su reporte. En el panel **Mi propuesta de prematrícula**, el estudiante consulta una publicación, elige una sección por asignatura y revisa créditos, calendario y diagnósticos. Se reutilizan el selector de secciones y el calendario semanal. La validación considera los datos académicos conocidos, los cursos ya aprobados o reconocidos, los prerrequisitos y los cruces.

- **Guardar borrador** conserva una selección editable, incluso vacía o con verificaciones pendientes.
- **Registrar intención** exige una selección guardada y válida, una publicación recuperable y la versión esperada. Los incumplimientos y la información insuficiente impiden el registro en esta demo.
- **Actualizar intención** agrega otra revisión registrada al historial. Guardar un borrador posterior conserva la intención registrada anterior. El estudiante puede cambiar de publicación mediante una nueva decisión explícita.
- **Intenciones de prematrícula**, en Escuela, muestra conteos por publicación, asignatura y sección. Solo la última revisión registrada aplicable de cada estudiante entra en el conteo. Si cambia la publicación de su registro, el estudiante pasa al conteo de la nueva. Los borradores, las revisiones anteriores y los casos que necesitan nueva verificación quedan fuera del conteo válido. Escuela recibe agregados sin identidades individuales.

El servidor exige sesión activa y pertenencia al escenario Regular. Las dos cuentas de prueba son `SYN-SIS-A` y `SYN-SIS-B`. Las intenciones conservan publicación, versión, selección y versión de borrador. La escritura comprueba la versión y la propiedad del documento. El historial de la demo admite hasta 100 revisiones por intención. La publicación E1 sigue siendo una fuente de lectura y E2 no reserva vacantes ni confirma matrícula.

[Guía de borradores](prematricula-e2-draft.md) · [Guía de intenciones](prematricula-e2-intention.md) · [Contrato de intención](contracts/local-api/prematricula-intention.md) · [Servicio E2](../../backend/src/prematricula/prematricula.service.ts)

## 4. E3 — reutilización del motor y traslado de intención

### 4.1. Qué se reutilizó

La pantalla `RegularEnrollment` mantiene la selección manual, el diálogo de confirmación y la recuperación de solicitudes con resultado incierto. El motor actual vuelve a validar el contexto en el servidor al confirmar. Cuando acepta, registra la matrícula y el reporte e incrementa las ocupaciones en la misma operación. La clave de solicitud permite devolver el resultado original ante un reenvío idéntico. La confirmación, la recuperación y la protección contra duplicados se comprobaron con el escenario sintético 2026-II.

La adaptación entre periodos permite que un perfil compatible use el evaluador existente. Conserva el rango de **12 a 26 créditos** con sus excepciones y la lógica de prerrequisitos, repitencia, tutoría, cuarta matrícula, cruces y cupos. Los umbrales de ponderado y el orden de apertura del turno se reutilizan con fechas configuradas para el periodo. Una condición obligatoria desconocida deja la evaluación en configuración pendiente. Las fechas y los perfiles históricos de 2026-II conservan su función.

[Pantalla E3](../../client/src/screens/RegularEnrollment.tsx) · [Reglas](../../backend/src/matricula-regular/rules.ts) · [Turnos](../../backend/src/matricula-regular/windows.ts) · [Confirmación](../../backend/src/matricula-regular/matricula-regular.service.ts)

### 4.2. Qué hace «Cargar mi intención»

El servicio recupera la última intención registrada y comprueba su publicación exacta y el ámbito de la oferta activa. El código académico de E1 y E2 se resuelve mediante la correspondencia existente de cursos hacia los identificadores `SYN-*` de E3. Para una sección se exige un enlace explícito con su publicación, versión y sección de destino.

| Situación | Respuesta |
|---|---|
| Curso y sección admitidos con correspondencia única, horario coincidente y cupo aparente | Se propone la sección como selección editable |
| Sección ausente o correspondencia ambigua | Queda pendiente, con su motivo |
| Sección llena o con horario distinto | Queda pendiente de elección manual |
| Periodo, escuela o plan distinto | Se explica la incompatibilidad y se conserva la selección actual |
| Selección previa | Se pide confirmación antes de reemplazarla |
| Solicitud de matrícula con resultado incierto | Se bloquea la carga mientras se recupera el resultado |

La carga prepara la selección. Si el estudiante cambia de contexto, edita sus elecciones o abre la confirmación durante la consulta, la respuesta tardía se descarta. La última intención E2 conserva su historial. La comprobación definitiva de vacantes pertenece al momento de confirmar.

[Plan de integración](plans/e2-e3-intention-import.md) · [Contrato de traslado](../../shared/matricula-intention-import.d.mts) · [Verificador en Chrome](../../client/scripts/verify-e3-intention-import.mjs)

## 5. Evidencia y límites del avance

| Entrega | Evidencia |
|---|---|
| E1 | Cálculo, cobertura, casos parciales, edición ERP con 180 estudiantes, demanda, recuperación, revisión docente y publicación. [Caso ERP](../../evidence/local/programacion-academica-erp/verification.md) · [Publicación](../../evidence/local/programacion-academica-publication/fullstack-verification.md) |
| E2 | Guardado independiente, aislamiento, control de versiones, deduplicación, cambio de publicación y recuperación tras reinicio. [Borradores](../../evidence/local/prematricula-e2-draft/fullstack-verification.md) · [Intenciones](../../evidence/local/prematricula-e2-intention/fullstack-verification.md) |
| Primer traslado E3 | La API real en Compose rechazó 2027-I → 2026-II. El caso positivo 2027-I se verificó en el servicio con un contexto aislado. La edición y protección de la selección compatible se verificaron en Chrome con una respuesta controlada. [Verificación E3](../../evidence/local/e2-e3-intention-import/fullstack-verification.md) |

En la última regresión del traslado, el backend obtuvo 595 de 596 pruebas en la primera ejecución. El único caso que agotó el tiempo pasó al repetir su archivo aislado. Pasaron 211 pruebas de frontend y 32 de contratos y configuración, además de compilación en Docker y lint. Las suites antiguas que requieren el Chromium instalado por Playwright quedaron fuera de ese conteo. El análisis previo de tipos reprodujo 104 diagnósticos en archivos de prueba del backend y la comprobación de tipos de fuente pasó. Estas cifras corresponden a verificaciones registradas en las etapas anteriores. Este informe se preparó con revisión documental.

Para la siguiente etapa queda por **activar explícitamente una oferta E3 versionada de 2027-I**, con su calendario, antecedentes académicos aplicables, correspondencias de sección, cupos y ocupaciones propios. Después corresponde probar confirmación y disputa por la última vacante en ese ámbito. El uso institucional también requiere identidad, autorización y decisiones sobre vigencia de intenciones, prioridades y revisión.

## 6. Guion de demostración para el equipo

### A. Preparar la instancia

1. Abrir el repositorio en la rama `schedule-pt1`. Comprobar que el entorno que se va a mostrar sea local y sintético.
2. Iniciar Docker Desktop y, desde la raíz, ejecutar:

   ```sh
   docker compose -f compose.local.yaml up --build
   ```

3. Abrir [SUM-reverse local](http://localhost:5180). El selector ofrece **Escuela** y **Estudiante**. Para una sesión independiente, elegir otro nombre de proyecto y un puerto libre antes de levantar Compose. El volumen del proyecto conserva borradores, publicaciones e intenciones entre reinicios.

### B. Mostrar E1 desde Escuela

1. Abrir [Programación académica](http://localhost:5180/local/programacion-academica). Mostrar el filtro por ciclo, el catálogo y la separación entre referencia histórica y configuración.
2. Para una publicación que se usará en E2, seleccionar **20118091** y, opcionalmente, **20118094**. Usar el primer patrón disponible y modalidad continua. El caso sintético verificado usa demanda **46** y capacidad **45** para 20118091, y demanda **1** y capacidad **45** para 20118094. Se esperan **dos secciones** del primer curso y **una** del segundo.
3. Habilitar un docente para cada curso, con disponibilidad de lunes a viernes de **08:00 a 18:00** y carga semanal de **2400 minutos**. Habilitar dos aulas de capacidad **45** en la misma franja. Si se agrega otro curso con un requisito de ambiente distinto, configurar ese ambiente y su disponibilidad.
4. Pulsar **Generar horarios**. Revisar que el resultado esté completo. Mostrar una sección en la tabla y el mismo bloque en el calendario. Si se edita un horario, elegir una franja válida y comprobar que el cambio aparezca en ambas vistas.
5. Pulsar **Guardar propuesta**. En **Revisión docente simulada**, seleccionar el rol Escuela y **Enviar a revisión**. Cambiar al rol Docente y **Dar conformidad** por cada docente asignado.
6. En **Aprobación y publicación simuladas**, consultar la vista previa de la revisión guardada, aprobar, volver a consultar la revisión aprobada y publicar. Anotar el número de publicación y comprobar **Sistemas · 2027-I**.

Si el equipo ya tiene una publicación sintética con secciones utilizables por E2, puede comenzar el recorrido estudiantil desde esa versión. Para explicar el dimensionamiento por separado, mostrar el caso 20118104 con demanda 180 y capacidad 45, que produce cuatro secciones.

### C. Mostrar E2 y comprobar los conteos

1. Entrar como **Estudiante**, escenario **Regular**, perfil **SYN-SIS-A**. Ir a [Reportes → Prematrícula](http://localhost:5180/alumnoWebSum/v2/reportes/prematricula) y abrir **Mi propuesta de prematrícula**.
2. Consultar la publicación anotada y elegir una sección de **20118091**. Mostrar el horario y la validación. Si se eligen dos cursos cuyos horarios se cruzan, conservar el borrador o corregir la elección antes del registro.
3. Pulsar **Guardar borrador** y, después, **Registrar intención**. Explicar que son dos acciones distintas. Cambiar a la otra sección del curso, guardar y mostrar que la intención anterior se mantiene hasta pulsar **Actualizar intención**. Abrir el historial para comparar versiones.
4. Cerrar sesión y repetir con **SYN-SIS-B** para la misma publicación. Cada perfil debe recuperar su propia selección. En una publicación de prueba con un único curso elegido por ambos, Escuela debe ver dos estudiantes para ese curso. Al cambiar la sección de uno, cambia la distribución por sección y el total del curso sigue siendo dos.
5. Volver a Escuela, desplegar **Intenciones de prematrícula**, seleccionar la publicación y consultar. Comparar las columnas de potencial, intención y demanda final. Si se pulsa **Crear borrador E1 de esta publicación**, mostrar que la demanda de origen queda disponible para ajustar y los conteos sirven de referencia.
6. Si se quiere demostrar recuperación, reiniciar únicamente el backend del **proyecto de demo**. Volver a entrar en Regular con el mismo perfil y recuperar la intención. El reinicio comprueba la persistencia de E1 y E2 en el volumen.

### D. Mostrar el límite actual de E3

1. Con un perfil de Sistemas que tenga una intención 2027-I registrada, abrir [Matrícula regular local](http://localhost:5180/local/matricula-regular).
2. Elegir manualmente una sección de la oferta 2026-II y pulsar **Cargar mi intención**. El resultado esperado es el aviso de incompatibilidad de ámbito y la conservación de la selección manual. Esto demuestra la protección entre periodos en la API real.
3. Para enseñar una precarga compatible, usar la evidencia o el verificador E3 en el proyecto sintético preparado en `5280`, con una intención registrada. El verificador comprueba el caso real incompatible y usa una respuesta controlada solo para mostrar el reemplazo y la edición compatible. El caso positivo del servicio está cubierto por el contexto aislado de pruebas. La demo estándar queda en 2026-II para matrícula.
4. Terminar explicando que la confirmación definitiva seguirá usando el motor de matrícula y su control de cupos una vez que exista una oferta E3 habilitada para 2027-I. El traslado de intención, por sí mismo, deja las ocupaciones y la matrícula confirmada intactas.
