# E1: bloques continuos y ambientes de referencia

2026-10-29, schedule-pt1. Principal: diagnóstico, contrato, integración. Fuente:
testimonio/regla funcional explícita del usuario para esta demo FISI, sin PDF ni
confirmación normativa. Preservar matrícula y fidelidad visual/interacción SUM;
solo pantalla administrativa autorizada, reutilizar componentes y contratos.

Diagnóstico: DFS actual enumera sesiones individuales con docentes independientes.
Validador existente cubre capacidad/cruces/carga/disponibilidad, no continuidad ni
responsable único. Reutilizarlo y añadir política de sección, jamás reimplementar
matrícula. Cambio acotado al módulo, autorizado tras diagnóstico.

Contrato: GeneratorCourse.deliveryMode?:continuous|split, defaultcontinuous.
AcademicRequest.demands misma opción, defaultcontinuous API/UI; split es excepción
explícita y mantiene docente único. WeeklySession.type? conserva código T/P/L u otro
tipo textual del patrón original. RequiredSession.type?; resultados assignment
sessionType? y sections.deliveryMode? aditivos. Mantener orden original de componentes,
no ordenar por identificador para decidir secuencia.

Búsqueda continua: una decisión de docente/día/inicio por sección; componentes
consecutivos, duraciones completas, un único docente que cubra bloque entero.
Ambiente puede variar por componente, sin huecos. No inventar tiempos de traslado,
equipamiento ni reglas de tipo ambiente por sesión. En split buscar sesiones con
docente único, permitiendo distintos días. Validador base se reutiliza y política
de sección se comprueba también en autoridad de cobertura, usando entrada original.
Ninguna propuesta completa si omite/reordena/separa indebidamente requisitos.
Parciales deben satisfacer política, sin declarar completas por lista recortada.
Preservar determinismo, retroceso, límites de exploración/trabajo/tiempo cooperativo.
Diagnósticos específicos solo según pruebas: falta de cualificación, carga menor
que sección, ausencia de franjas continuas o ambientes factibles; agotamiento de
búsqueda nunca equivale a impossibilidad. Dominio finito declarado, no global.

Catálogo referenceRooms?49 [{id,name,kind,capacity:45,pavilion:AP|NP}], proveniencia
usuario/demo/no disponibilidad confirmada. AP101..108,201..212,LAB01..08;
NP101..108,201..205,LAB01..08. Selección de ambientes activos mantiene límite32,
no se duplica oferta. Inicializar4 activos del catálogo incluyendo aula/laboratorio,
disponibilidades sintéticas explícitas lunes-viernes08:00-22:00 para ejemplos de noche.
Editor permite agregar referencia una vez, editar capacidad/disponibilidad; roster
completo49 visible/listable, no presupone todos disponibles. Sin nuevas dependencias.

Propiedad disjunta: core worker backend/src/programacion-academica/{generator.types,
generator-input,schedule-generator,session-coverage}.ts y nuevo section-delivery.ts,
tests propios de bloque/cases de generador (ajustar expectativas anteriores si la
nueva regla invalida fragmentación). No tocar API/seed/otros tipos sin avisar.
UI worker AcademicScheduling/AcademicResourceEditor yCSS, data tests y scripts de
navegador. Principal shared, demo-proposal.service, synthetic-catalog-adapter,
reference-rooms.ts y APItests. Workers LunaHigh sin subdelegar, AGENTS/skills locales,
CodeGraph solo con exclusiones verificadas (siCLI ausente reportar, no instalar).

Aceptación: bloques4h18-22 y6h08-14 conservando componentes/tipos; único docente aun
en split; varias secciones comparten docente sincruces/carga; capacidad45 y rechazo
de46 según ambientes;49 IDs únicos exactos; sin bloque continuo, split factible,
backtracking, limits y rechazo de cobertura manipulada. Ejecutar Node/Vitest,
build/tipos/lint y navegador real propio Docker5280 si5180ocupado; configuración
principal sigue5180. Oferta/matrícula inmutables y prueba de matrícula sintética.
Sin commits/push, persistencia, E2/E3, aprobación o publicación.
