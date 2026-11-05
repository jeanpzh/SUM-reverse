# E1: reutilización del catálogo sintético

Principal: plan, contrato compartido y aceptación integrada. Fecha 2026-10-29.
Rama schedule-pt1; preservar cambios existentes. Complejidad media, incertidumbre
media (patrones variables), impacto medio. Sin PDF, snapshots ni datos-reales.
Fuente permitida: scenario-reference.seed.ts, declarado explícitamente sintético.
No copiar identidades docentes al nuevo módulo: pseudónimos estables de referencia.

Contrato aditivo PA-DEMO-1: catálogo permite hasta 256 cursos; solicitud hasta 32
cursos únicos seleccionados (vacía válida). Demanda puede incluir targetCapacity
entero positivo y patternId. Ausentes usan defaults del servidor por compatibilidad.
Cursos conservan campos actuales y añaden cycle, credits, history.sections
{sectionId,capacity,sessions:[{day,startMinute,endMinute,room,teacherId,type}]} y
planningPatterns [{id,label,weeklySessions}]. Patrones únicos por secuencia de
duración/tipo, jamás derivada de créditos. Selección explícita en UI; patrón por
defecto identificado. weeklySessions corresponde al primer patrón disponible.
Catálogo source {kind,reference,sourcePeriod,planningPeriod,assumptions}; periodo
de origen desconocido se declara, no se inventa vigencia institucional.
Tipos nuevos opcionales para consumidores PA-DEMO-1 anteriores; validar en runtime.

Backend: adaptador puro read-only agrupa 165 filas/56 cursos; conserva orden,
sesiones completas, valida tiempos HH:mm (los campos Min pueden ser cero),
rechaza incoherencias y no infiere disponibilidades, demanda ni capacidad física.
Recursos de planificación independientes: docente sintético por curso seleccionado,
aulas sintéticas, franjas sintéticas y capacidad objetivo inicial 30, demanda 0.
Filtrar recursos a selección para respetar límites del generador. Retener autoridad
original en servidor como antes. Solo adaptar entradas, no cambiar generador.

Frontend: catálogo completo, checkbox por curso, ciclo/créditos, referencia histórica
plegable, selector de patrón semanal y capacidad editable. Estado inicial nada
seleccionado; petición incluye solo selección, capacidad y patrón. Cambio invalida
resultado previo. Identificar claramente referencia frente a nuevo periodo sintético.
Preservar fidelidad visual/interacción SUM: solo pantalla administrativa autorizada;
pantallas, menú, reglas, fixtures y oferta estudiantiles intactos. Reutilizar UI existente.

Propiedad disjunta: principal shared/plan/aceptación; backend worker solo
backend/src/programacion-academica/{demo-catalog,synthetic-catalog-adapter,demo-proposal.service}.ts
y backend/test/programacion-academica-{catalog,demo}.spec.ts; frontend worker
solo AcademicScheduling.tsx/css, academicScheduling.test.ts y scripts propios de
verificación administrativa. Leer AGENTS y skills locales, validar exclusiones
CodeGraph antes de cualquier init; no delegar trabajadores adicionales.

Aceptación: agrupación sin duplicados, conservación de sesiones y aislamiento por
copias, patrones variables/ambiguos visibles, selección/capacidad inválidas
rechazadas, generación y cobertura completas con selección pequeña, antigua
propuesta inmutable, oferta de matrícula sin cambios. Builds/tipos/lint, 193 casos
anteriores, Vitest API/adaptador y pruebas cliente. Navegador Docker propio sintético
5280 si 5180 ocupado; configuración principal sigue 5180. No instalar dependencias,
persistencia, aprobación, E2/E3, commits ni push.

Aceptación realizada: evidence/local/programacion-academica-docker/catalog-reuse-verification.md.
Principal calibró el presupuesto sintético a 10.000 exploraciones tras reproducir
un límite con tres cursos (1.149 necesarias); no modificó el algoritmo. Corrección
aislada de prueba de navegador para contar el tercer curso y provocar imposibilidad
mediante capacidad de aula, sin asumir que una búsqueda acotada demuestra imposibilidad.
