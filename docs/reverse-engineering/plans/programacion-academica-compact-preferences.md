# E1: edición compacta, preferencias y resultados coherentes

2026-10-29 schedule-pt1. Principal plan/contrato/API/aceptación; workers core/UI
LunaHigh disjuntos sin subdelegar. Leer AGENTS/skills locales/CodeGraph seguro si
disponible, no instalar. Preservar fidelidad visual/interacción SUM y matrícula:
solo cambiar interfaz administrativa; reutilizar componentes/contratos/datos.
Sin PDF, snapshots, datos-reales, dependencias nuevas, Dockerconfig, commits/push.

Diagnóstico comprobado: AcademicResourceEditor renderiza todos los formularios y
56casillas por docente. assignmentRows está en orden distinto de sus headers.
toAcademicScheduleEvents genera un evento por componente. DFS devuelve primera
solución por orden de ID, sin preferencias/cupos por docente-curso. DTO valida
scheduledSessions===assignments.length: no se reproduce0/8 con calendario no vacío
en una sola respuesta actual. Configuración original del usuario desconocida;
no atribuir ese síntoma a recursos ni a versión/caché sin evidencia.

Contrato aditivo: AcademicTeacherResource/AcademicTeacher.preferences?: intervalos
semanales (máximo32), preferencias blandas; sectionLimits?:[{courseId,maxSections}]
máximo128 límites únicos, maxSections entero0..128, ausente=sin límite adicional.
GeneratorInput/AcademicRequest.allocationPolicy?:preferences|balanced|first-feasible,
defaultpreferences. Filtrar límites a cursos seleccionados/cualificados como courseIds.
Conservar fuente original de cobertura con preferencias/límites/política; revisión
no puede cambiar autoridad. Nombres se mantienen de catálogo sintético autorizado.

Política sencilla/explicable: preferencias ordena bloques completamente preferidos,
luego docentes sin preferencias, luego fuera de preferencias; permite fallback
válido. balanced aplica lo mismo, desempatando por menor número de secciones/carga
actual; no obliga equidad. first-feasible conserva orden determinista sin priorizar
preferencias. Primera solución factible con esa heurística, sin optimalidad global.
Nunca transformar preferencia incumplida en imposible. Mantener docente único,
bloque continuo predeterminado, split explícito y todas las restricciones previas.
Poda temprana necesaria de habilitación/carga restante/límite de secciones evita
enumerar ambientes para un docente inviable; siempre conservar límites cooperativos.
Diagnósticos de incompatibilidad solo con prueba necesaria o dominio agotado;
search-limit nunca prueba inexistencia. Conservar parciales válidas ya encontradas.

AcademicProposal.preferenceReport? {policy,evaluatedSections,withinPreferenceSections,
outsidePreferenceSections,withoutPreferenceSections,optimality:'not-proven'}: solo
secciones completas evaluadas, suma coherente. Añadir diagnóstico blando cuando hay
asignaciones fuera de preferencias sin afirmar que satisfacerlas sea imposible.
Validar coherencia status/counters/diagnostic SEARCH_LIMIT; no aceptar imposible con
SEARCH_LIMIT ni complete con componentes pendientes. Datos de estado/tabla/calendario
derivados de una misma propuesta; no usar diagnóstico para sobrescribir status.

UX: un formulario docente activo, selector referencia permite añadir o seleccionar
ya incorporado sin duplicar, lista compacta incorporados editar/quitar. Buscar
asignaturas por código/nombre, selección múltiple con chips y límites por curso.
Disponibilidad, preferencias y carga diferenciadas. Ambientes idéntico patrón, roster
AP/NP único49 y capacidad referencia45 conservados. Mantener estado de todos al cambiar
selección (no persistencia de disco). Una sección puede tener varias secciones por
docente si habilitación/disponibilidad/carga/límite lo permiten.

Resultados: separar razón de terminación (complete/impossible/search-limit/invalid)
de cobertura (completa/parcial/sin asignaciones). Contar secciones calculadas,
secciones completas/parciales/pendientes y componentes x/y. Mostrar pendientes como
tales; no tratarlos como profesores ausentes comprobados. Agrupar componentes
contiguos de sección/docente/día para un solo evento de bloque y fila con inicio/fin,
duración total, ambiente(s) y componentes internos; split agrupa solo tramos contiguos
y no une días ni huecos. Calendar usa mismo agregador probado que tabla/resumen.

Propiedad: coreworker schedule.types/validator, generator.types/input/generator,
section-delivery/session-coverage si necesario, nuevo teacher-preferences.ts,
tests core/cases propios. UIworker AcademicResourceEditor, AcademicScheduling/CSS,
academicScheduling.ts/tests y scripts browser. Principal shared, demo-proposal.service,
APItests ERP180/cap45 (4secciones/8componentes), contratos/documentación/verificación.

Aceptación: selector único y conservación estado/cero duplicados, búsqueda múltiple,
docente varias secciones permitido; carga/límites por curso obligatorios, preferencias
blandas y políticas config reproducibles. ERP20118104 demanda180/cap45 patrón120+120:
recursos suficientes completo4bloques/8componentes; insuficientes sin falsa solución;
límite computacional conserva parciales válidos coherentes. Bloques4h/6h sin cruces,
caps aulas/labs, snapshot retenido, oferta matrícula intacta y matrícula sintética.
Build/tipos/lint/Vitest/Node/browser Docker propio5280 sin tocar servicio5180 existente.
No E2/E3/aprobación/publicación/IAexterna. Informe distinguir probado/no reproducido.
