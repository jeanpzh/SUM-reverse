# Programación académica: validador de horarios, etapa 2

Fecha: 2026-10-29. Principal: planificación e implementación aislada, sin workers.
Fuente: requisitos del usuario; todas las decisiones siguientes son `local-only`,
no normativa ni observación SUM. Rama `schedule-pt1`. Se conservan intactos los
cinco archivos de etapa 1. No se modifica matrícula ni su utilidad privada overlap.

## Contrato y decisiones

Función pura `validateAcademicSchedule(unknown)` devuelve `{ valid, issues }`.
Los problemas contienen code, resourceType, resourceId, assignmentIds, field y
message. Formato incorrecto se informa como INVALID_INPUT sin ejecutar reglas.
No endpoints, configuración, interfaz, persistencia ni generación de horarios.
Ninguna pantalla tiene cambios autorizados: preservar fidelidad visual e interacción.

Se reutiliza el concepto de Meeting (día 1–7 y minutos) del modelo existente;
sus tipos solo aceptan number y no validan runtime. El nuevo intervalo restringe
minutos enteros, 0 <= startMinute < endMinute <= 1440. Intervalos [inicio, fin):
clases consecutivas no se cruzan. La función pública de superposición rechaza
intervalos mal formados con TypeError. Semanas recurrentes, una única zona horaria
local; sin fechas, feriados, traslados ni clases multisemana.

Entrada: courses (IDs); sections (id global único, courseId, capacity > 0);
teachers (id, courseIds habilitados, availability, maxWeeklyMinutes >= 0);
rooms (id, capacity > 0, availability); assignments (id, sectionId, teacherId,
roomId, interval); compatibleGroups (id, courseIds). IDs no vacíos y sin espacios
en extremos; referencias válidas y sin IDs repetidos por catálogo. Cantidades
enteras seguras. Disponibilidad vacía significa no disponible. Ventanas contiguas
o solapadas del mismo día se unen para comprobar cobertura completa de una sesión.

Cada asignación es una sesión de una sección; distintas sesiones de una sección
pueden tener distintos docentes/aulas. Cupo se define en la sección, no se deduce
de demanda ni ocupación. Se suman minutos asignados por docente por semana.
No se asume equivalencia entre créditos, horas académicas y minutos cronológicos.
Cursos diferentes de un grupo explícito no pueden coincidir; secciones paralelas
del mismo curso sí pueden hacerlo si no comparten recursos. No inferir grupos
por ciclo. Todo conflicto por pares informa ambas asignaciones y recurso.
Referencias inválidas se reportan; no se inventan recursos ni se aprueba por omisión.
Catálogos y asignaciones vacíos constituyen un horario vacío válido.

## Archivos y aceptación

Solo crear archivos en `backend/src/programacion-academica/` (schedule.types.ts,
schedule-validator.ts, schedule.fixtures.ts), pruebas nuevas bajo backend/test y
este registro. Los modelos existentes no representan disponibilidades ni
habilitaciones: los nuevos amplían el dominio de planificación sin reemplazarlos.
Sin migración de consumidores ni contrato HTTP. Mantener sin cambios etapa 1.

Orden: tipos/contrato → validación runtime → conflictos y disponibilidad → fixtures
independientes → casos compartidos Node/Vitest → comprobaciones focalizadas.

| Criterio | Escenario/resultado esperado |
| --- | --- |
| Intervalos | Solapamiento, contención y coincidencia detectados; días distintos y adyacentes permitidos |
| Recursos | Cruces de docente, aula y sección identifican ambos IDs |
| Disponibilidad | Docente/aula fuera de ventana rechazados; cobertura unida aceptada |
| Capacidad/habilitación/carga | Igualdad permitida; insuficiencia, no habilitado y exceso rechazados |
| Grupos | Solo cursos distintos de grupos declarados se restringen |
| Entrada | Tipos, intervalos, duplicados y referencias inválidas devuelven problemas estructurados |
| Aislamiento | Entradas y fixtures no mutadas; cinco huellas etapa 1 conservadas; sus 46 pruebas pasan |
| Pruebas habituales | Wrapper .spec.ts usa mismos casos que Node sin modificar configuración |

No existen dependencias instaladas. Usar Node 24 sin instalar paquetes; Vitest,
build, lint y comprobación TypeScript permanecen pendientes si el entorno no cambia.

## Resultado real

Código y fixtures aislados, sin imports runtime desde matrícula. Los imports de
Meeting son exclusivamente de tipos, no ejecutan su módulo. Se comprobó que
Vitest busca `**/*.spec.ts`; la entrada nueva `.spec.ts` registra los mismos casos
que `.test.mjs` mediante `.cases.mjs`, con declaración `.d.mts`. No se cambia
configuración ni se duplica la lógica de pruebas. Ejecución Vitest pendiente por
ausencia de dependencias; compatibilidad de ejecución no se declara comprobada.

Comando focalizado (Node v24.22.1 del runtime de Codex):

```sh
node --experimental-strip-types --test --test-reporter=tap backend/test/programacion-academica-schedule.test.mjs backend/test/programacion-academica-section-sizing.test.mjs
```

Resultado: código 0, 113 pruebas aprobadas (67 horarios + 46 etapa 1), cero fallos
u omisiones. Los criterios anteriores están cubiertos por estos casos, incluyendo
IDs de recurso/asignaciones y campos inválidos. No se ejecutaron NestJS, Docker,
bases de datos ni suites globales. Compilación, lint y tipos continúan pendientes.
No hay aceptación HTTP, integración matrícula ni fidelidad SUM nueva que acreditar.
