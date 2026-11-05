# E1: configuración administrativa de recursos

Fecha 2026-10-29. Principal: plan/contrato/aceptación. Rama schedule-pt1.
Complejidad media, incertidumbre media, impacto medio. Se preserva todo trabajo
previo. Fuente: seed explícitamente sintético scenario-reference.seed.ts, nombres
de referencia ahora autorizados expresamente por el usuario. Sin PDF ni snapshots.

Compatibilidad revisada: AcademicTeacher ya admite courseIds múltiples, availability
y maxWeeklyMinutes. AcademicRoom admite capacity/availability. Validador/generador
ya impiden cruces de docentes/aulas/secciones y exceder carga. No cambiar algoritmo.
Tipo classroom/laboratory es clasificación descriptiva: no inventar equipamiento o
restricción de laboratorio por sesión. Explicar este límite en pantalla/aceptación.

Extensión aditiva PA-DEMO-1: catalog.referenceTeachers?: [{id,name,courseIds}]. IDs
de referencia locales estables dentro del catálogo, identidad compartida entre
cursos cuando la fuente tiene mismo código docente conocido; placeholders no se
fusionan como personas confirmadas. history.sessions conserva teacherId y admite
teacherName opcional resuelto solo de fuente sintética autorizada. No copiar
identidades desde documentos privados. Historial no confirma asignación futura.

Tipos compartidos AcademicTeacherResource {id,name,courseIds,maxWeeklyMinutes,
availability}; AcademicRoomResource {id,name,capacity,availability,kind?:classroom|
laboratory}. Solicitud resources?: {teachers,rooms}, máximo32 por lista, IDs únicos,
referencias a cursos conocidos; disponibilidad máximo32 intervalos válidos por
recurso, nombres/IDs y capacidades/carga validados. Configuración vacía no sustituida
por defaults. resources ausente conserva compatibilidad de clientes anteriores.
Servidor valida/clona configuración al crear propuesta, construye autoridad propia
y retiene nombres de esos recursos para asignaciones/GET. Nunca permite reemplazar
autoridad en revisión. No acepta windows ni requisitos nuevos del cliente.

Catálogo inicial de planificación: hasta8 docentes de referencia con nombre
autorizado, habilitación inicial basada en referencia etiquetada como supuesto de
demo, disponibilidad/carga sintéticas. Se pueden añadir de referencia o con nombre
de demostración, editar/eliminar hasta32; ningún nombre es habilitación oficial.
Rooms actuales se conservan como recursos sintéticos con kind explícito; incluir
al menos un laboratorio de demo. Franjas generales del catálogo permanecen visibles;
disponibilidad configurada se intersecta con ellas, no se deduce del historial.

UI solo administrativa: filtro ciclo Todos/1..10 sin perder selección oculta,
selección → recursos → generar → resultados. Editores identificables por aria-label,
docentes/asignaturas habilitadas múltiples, nombre/identificación, carga en minutos,
disponibilidad editable día/inicio/fin (añadir/quitar), aulas/laboratorios con nombre,
capacidad/disponibilidad. Reiniciar desde catálogo explícito si se ofrece. Cambios
invalidadan propuesta visible/en vuelo. Nombres de referencia en curso/sección y
tabla/calendario de docentes asignados, con etiquetas distintas y aviso no confirmación.
Preservar fidelidad visual/interacción SUM: no editar estudiante, menú, servicios,
fixtures ni reglas de matrícula; reutilizar estilos/componentes del módulo existente.

Propiedad: principal shared/plan/contrato/aceptación; backend worker adaptador,
demo-proposal.service y sus tests; frontend worker AcademicScheduling, nuevo
AcademicResourceEditor/CSS, data tests y scripts browser propios. Trabajadores
Luna High, sin subdelegar, leer AGENTS/skills locales y comprobar exclusiones
CodeGraph/CLI antes de init. No instalaciones ni cambios Docker necesarios.

Aceptación: referencia con nombres sin confirmación futura; mismo docente habilitado
para dos cursos compite sin cruces, capacidad/disponibilidad/carga limitan resultados;
invalid configs/IDs duplicados/cursos ajenos rechazados, resources vacíos generan
diagnóstico, cambios posteriores no afectan propuesta retenida ni oferta de matrícula.
Filtro no altera catálogo ni selección. Builds/tipos/lint, regresiones existentes,
tests API/shared/cliente y navegador React→API real con Docker propio sintético en5280
si5180 ocupado; default habitual5180 intacto. Sin E2/E3/persistencia/aprobación/commits.
