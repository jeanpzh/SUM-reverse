# E1 · demanda potencial sintética v1

2026-11-02. Plan/contrato del principal tras revisar demand-findings y PA-DEMO-1.
Complejidad media, incertidumbre acotada por supuestos local-only, impacto medio.
Conservar fidelidad visual/interacción SUM: solo ampliar compactamente Paso1 del
administrador local. Matrícula, generador, escenarios/oferta, Docker y dependencias
intactos. Sin E2/E3/persistencia/datasets privados. No usar PDFs.

## Decisiones locales

Objeto: necesidad académica potencial, nunca intención/pronóstico. Periodo objetivo
fijo2027-I, corte de resultados2026-1, sin proyectar2026-II. Solo Sistemas/plan
sintético SYN-SIS-PLAN. Fuente existing-regular-v1: copia del escenario regular
integrado (2 alumnos Sistemas); los otros8escenarios son alternativas, no cohortes.
Fuente independent-120-v1:120 identidades internas sin nombres ni datos personales,
historiales construidos independientemente por fórmula sobre el catálogo/plan
existentes, no clonados de los alumnos A/B. Versión/regla reproducible documentada;
concentra casos avanzados para demostrar ERP, no representa distribución real.

Reutilizar tipos AcademicCatalogCourse/AcademicAttempt de profile.types; normalizar
códigos con courseCodes. Nuevo DemandLearner es una proyección mínima, no otro
ActorProfile ni catálogo. Validador académico A/B existente no admite IDs nuevos;
no modificarlo: validar la proyección local de demanda con límites y referencias.
Equivalencias: únicamente IDs de cursos reconocidos explícitamente en fixture de
demanda; vacías y conocidas para fuente regular según fixture, sin inferirlas.
Los grupos/semánticas de prerrequisito no modelados permanecen como limitación;
conjunción prerequisiteIds ya implementada, no regla oficial universal.

Por persona/curso: plan desconocido/mapeo inválido/conflicto de registros =>
insuficiente; curso fuera de plan conocido =>no elegible; curso ya aprobado o
reconocido explícitamente =>no elegible. De otro modo historial desconocido o
equivalencias desconocidas =>insuficiente; prerrequisito conocido no cumplido =>
no elegible; resto elegible. Repitente elegible si tiene al menos un intento failed
del curso y no está ya aprobado; cuenta1, incluido en elegibles. No filtrar por
cupos/horarios/deuda/ventana ni invocar envío de matrícula: no prueban necesidad.
Reconocer solo resultados al corte, no inferir notas futuras. Estados incoherentes
o duplicados contradictorios quedan insuficientes, no fusionar aprobaciones entre
escenarios. Deduplicar identidad estable y ámbito, ignorando sección/intento/runId.

## Contrato aditivo fijo

POST `/local/programacion-academica/v1/demanda/estimar`, mismos controles acceso,
origen, query y JSON de generación. Body exacto AcademicDemandRequest:
`{revision,sourceId,targetPeriod,courses:[{courseId,targetCapacity}]}`.
revision PA-DEMO-1; sourceId existing-regular-v1|independent-120-v1;
targetPeriod2027-I; hasta32 cursos únicos del catálogo E1, vacía permitida,
capacidad entero positivo <=MAX_SAFE_INTEGER. No recibe estudiantes/autoridad.
400 forma/fuente/periodo/curso desconocidos;409 revisión; error envelope existente.
200 AcademicDemandEstimate:

`{revision,source,rows}` con source exacta
`{id,label,revision,kind:'synthetic',targetPeriod:'2027-I',cutoffPeriod:'2026-1',schoolId:'SISTEMAS',planId:'SYN-SIS-PLAN',populationSize,recordCount,duplicateRecords,reference,limitations:string[]}`.
recordCount>=populationSize;duplicateRecords=recordCount-populationSize.
rows exactas `{courseId,eligible,retakeEligible,nonEligible,insufficient,baseDemand,targetCapacity,suggestedSections,reasons}`.
eligible+nonEligible+insufficient=populationSize; retakeEligible<=eligible;
baseDemand=eligible; suggestedSections=ceil(baseDemand/targetCapacity) mediante
calculateRequiredSections existente. reasons:
`[{category:'non-eligible'|'insufficient',code,message,count}]`, únicos por category/code,
count>0, suman por categoría nonEligible/insufficient. No nombres, actorIds, listas
de estudiantes, ledger, oferta o recursos en respuesta. Validación runtime shared.
Fuentes metadata se obtiene de respuesta, selector UI tiene dos IDs del contrato;
no cambiar catálogo ni propuesta ni cuerpo de generación.

## UI y criterios

En Paso1 panel compacto: fuente sintética, periodo2027-I visible, botón Estimar
demanda potencial (solo cursos seleccionados), metadata/tamaño/corte/limitaciones
y detalle expandible de causas agregadas. Por curso seleccionado: base, elegibles,
repitentes incluidos, no elegibles, insuficientes, secciones base sugeridas y
demanda final editable/capacidad con secciones finales sugeridas. No exponer
estudiantes. Base no se aplica automáticamente: acción explícita Usar base para
un curso, habilitada solo si insufficient=0. Cuando insuficiente, mantener entrada
manual; nunca usar insuficiente como cero. Toda estimación conserva demandas finales
ya escritas, incluso al cambiar fuente. Edición final invalida propuesta pero no
base; cambiar selección/capacidad/fuente invalida base obsoleta (capacidad cambia
secciones; exigir reestimar) y respuestas asíncronas antiguas no reaparecen.
Usar base es elección local explícita, no obligación; generador usa solo demanda
final actual. Contar secciones finales por helper de presentación validado, no
importar backend en React, servidor recalcula siempre con lógica existente.
Mantener editor compacto de horarios y recursos. Sin vistas administrativas extra.

## Asignación exclusiva

Principal: shared .mjs/.d.mts/tests, plan/contrato/documentación y browser secuencial.
Worker backend LunaHigh: solo backend/src/programacion-academica/demand-*.ts,
demo.controller.ts, demo-proposal.service.ts (integración pequeña),
backend/test/programacion-academica-demand*.spec.ts. Sin modificar matrícula.
Worker frontend LunaHigh: AcademicScheduling.tsx/.css, nuevo AcademicDemandPanel.tsx
si necesario, client/src/data/academicScheduling.ts/.test.ts y nuevo
client/scripts/verify-academic-demand.mjs. No editar scripts existentes de manual/
Compose, backend/shared/root. Ambos leen AGENTS/skills pertinentes, sin delegar.
CodeGraph no inicializar sin salvaguardas acreditadas de privados/deps/symlinks.
Fallback real gpt-6-luna/high si TOML no disponible.

Pruebas backend: duplicación idéntica/conflictiva, mezcla de escenarios/ámbitos,
aprobado luego/antes de failed, repetición múltiple cuenta1, prerrequisitos AND,
equivalencia de curso/prerrequisito explícita, desconocidos, corte/periodo, plan y
mapeo, fixture120 reproducible sin copiar historiales, ceil0/exacto/redondeo y
capacidad inválida, HTTP noPII/noautoridadcliente/errores/aislamiento. Build/tipos/
lint/Vitest focalizados. Frontend: runtime frontera, cálculo presentación/override,
reestimar no pisa manual, respuestas obsoletas, fallback, fuente/población visible,
generar usa final no base, compacto. Build/lint/test:data. Principal: escenarios
reales React→API→generador y regresión manual/matrícula en Docker propio5280,
sin inspeccionar localhost5180 operador. Verificación con fuentes puramente
sintéticas; no cargas intensivas ni dependencias nuevas. Máximo un ciclo automático
de reparación tras fallo; si persiste principal diagnostica antes de decidir.

## Cierre

Implementación y aceptación completas.319 backend/regresión,198 datos cliente,
10 shared y build/tipos/lint aprobados. Navegador real: demanda, ajuste manual y
matrícula sintética aceptada/idempotente; oferta intacta. Evidencia y límites:
`evidence/local/programacion-academica-demand/fullstack-verification.md`.
Fuente independiente132registros/120personas por12duplicados idénticos; ERP60base
con24repitentes incluidos y24insuficientes, sin pronóstico ni cifras oficiales.
