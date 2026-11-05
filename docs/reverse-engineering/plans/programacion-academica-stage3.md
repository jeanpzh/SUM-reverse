# Programación académica: generador acotado, etapa 3

Fecha: 2026-10-29. Rama: `schedule-pt1`. Autor principal: contrato, implementación
y aceptación. Fuente: requisitos explícitos del usuario; diseño `local-only`.
No representa un algoritmo o reglas observados en SUM. No hay interfaz, endpoints,
aprobación, persistencia ni publicación. Preservar pantallas y fidelidad de
interacción existentes: ninguna pantalla ni regla de matrícula puede cambiar.

Se conservarán las huellas iniciales de los 13 archivos de etapas 1 y 2. Revisión
previa: modelos CourseDemand/Meeting/AcademicSchedule y validadores existentes.
No se necesita cambiar esos modelos: el ID de asignación identifica una sesión
requerida, cuya relación con sección, curso y duración se guarda por separado.
Los imports runtime reutilizan calculateRequiredSections y validateAcademicSchedule.
La cobertura es responsabilidad adicional del generador, no una nueva regla de
matrícula ni un reemplazo del validador anterior. Sin migración de consumidores.

## Contrato GENERATOR-LOCAL-1

`generateAcademicSchedule(unknown)` recibe exactamente:

- courses: entradas `{ courseId, estimatedDemand, targetCapacity, weeklySessions }`.
  weeklySessions es una lista no vacía de `{ id, durationMinutes }`, IDs únicos
  dentro de cada curso; una copia de cada sesión se requiere por cada sección.
  Duración explícita entera de 1–1440 minutos, nunca deducida de créditos.
- teachers, rooms, compatibleGroups: los catálogos de etapa 2. No se incluyen
  asignaciones existentes/fijas en esta primera versión.
- windows: intervalos válidos de día/minutos dentro de los que debe caber una
  sesión completa. No son sesiones obligatorias; son dominio de búsqueda.
- startStepMinutes: entero 1–1440. Por cada ventana se prueban inicios
  `startMinute + k * startStepMinutes`; no se exige que la duración sea múltiplo.
- maxExplorations: entero 0–100000. Cuenta cada candidato enviado al validador,
  aceptado o rechazado. Prevalidación de catálogos y comprobación final aparte.

Límites explícitos del prototipo: hasta 32 cursos, docentes, aulas y ventanas;
hasta 128 secciones y 128 sesiones requeridas en total. Entradas mayores son
inválidas, no imposibles. Estos límites acotan también preparación y recursión.
Ventanas solapadas/repetidas se permiten; candidatos idénticos se deduplican.
Vacío es válido; cero demanda no crea secciones ni requisitos. Cada sección usa
capacidad objetivo completa, incluso la última. Catálogos pasan el validador de
etapa 2 antes de buscar. Habilitaciones/grupos solo pueden referir cursos de entrada.
Mismo docente por toda sección, días separados y objetivos de calidad no se exigen.

Salida: status, schedule, requirements, coverage, exploredCandidates, backtracks,
rejectionCounts y diagnostics. Estados:

- complete: todas las sesiones están cubiertas exactamente una vez, con sección,
  curso y duración correctos, y el horario pasa el validador de etapa 2.
- impossible: búsqueda agotada dentro del dominio finito declarado; no es prueba
  de imposibilidad con otras franjas, recursos o inicios fuera de cuadrícula.
- search-limit: había candidatos pendientes cuando se consumió el presupuesto;
  no demuestra imposibilidad. Un problema vacío termina complete incluso con cero.
- invalid-input: entrada mal formada/inconsistente; schedule y coverage son null.

En fallo de búsqueda se devuelve el mejor prefijo válido encontrado y su cobertura
incompleta; jamás se añaden sesiones ficticias. missingSessionIds describe ese
prefijo, no prueba que cada sesión sea individualmente imposible. rejectionCounts
resume rechazos observados, no identifica un conjunto mínimo de causas.
Todo resultado tiene diagnósticos con code, message y sessionIds.

`checkSessionCoverage(schedule, requirements)` valida el horario con etapa 2 y
rechaza requisitos inválidos, faltantes, extras y discrepancias de sección,
curso o duración. No acepta una lista de sesiones incorrecta como completa.

## Algoritmo y tareas

Orden estable por IDs (comparación textual, sin locale), número de sección,
sesión semanal, docente, aula, día e inicio. DFS con retroceso: agregar candidato,
validar todo el prefijo, descender solo si es válido, retirar al fallar. No duplica
reglas de disponibilidad/cruces/capacidad/carga. No optimiza calidad ni garantiza
la mejor propuesta parcial. No usa MRV ni poda de recursos propia en esta etapa.

| Orden | Archivos nuevos | Aceptación |
| --- | --- | --- |
| 1 | generator.types.ts, este documento | Contrato y estados definidos |
| 2 | generator-input.ts | Runtime validation, cálculo etapa 1 y expansión de sesiones |
| 3 | session-coverage.ts | Faltantes, extras y discrepancias detectadas |
| 4 | schedule-generator.ts | Retroceso determinista, presupuesto y validador reutilizado |
| 5 | generator.fixtures.ts, pruebas nuevas | Completos, recursos, grupos, retroceso, límites, cobertura y entradas inválidas |
| 6 | Este registro | 113 pruebas anteriores + nuevas pasan, 13 huellas conservadas |

Implementación directa con configuración actual: los TOML de perfil no están en
este checkout, como se constató en etapa 1 y se revalidó. No se declara despacho
Luna ni workers. Backend sigue sin node_modules: no instalar dependencias ni
afirmar build/lint/tipos/Vitest aprobados. Wrapper .spec.ts para Vitest y mismos
casos en Node. Resolución local .js→.ts solo en el wrapper Node y para archivos
del módulo: permite conservar imports ESM del backend sin modificar configuración.

## Aceptación ejecutada

Node v24.22.1 del runtime local de Codex, sin instalar paquetes:

```sh
node --experimental-strip-types --test --test-reporter=tap backend/test/programacion-academica-generator.test.mjs backend/test/programacion-academica-schedule.test.mjs backend/test/programacion-academica-section-sizing.test.mjs
```

Resultado final: 173 pruebas, 173 aprobadas, cero fallos/omisiones, código 0.
Se conservan 113 anteriores y se añaden 60 casos del generador/cobertura.
Incluyen expansión por demanda, dos sesiones por sección, duraciones explícitas,
recursos/capacidad/disponibilidad/carga/grupos, retroceso real, repetición, cero
demanda, dominio vacío, cuadrícula, presupuesto cero/exacto, deduplicación,
entradas inválidas, cobertura incompleta/extra/discrepancias y no mutación.
Los IDs generados usan tuplas JSON para evitar colisiones de delimitadores y
aceptar cadenas escapadas sin depender de codificación URI.

Ejemplo sintético: demanda 31/capacidad 30 crea dos secciones. Dos reuniones
semanales de 60 minutos por sección producen cuatro asignaciones lunes
09–10, 10–11, 11–12 y 12–13 con T1/R1. Cobertura completa. Se prueban diez
candidatos; seis rechazos intermedios por cruces son parte normal de la búsqueda.

Build, lint, comprobación TypeScript y ejecución Vitest no ejecutados: faltan
dependencias. La entrada .spec.ts coincide con configuración actual, pero no se
declara comprobada su ejecución. No hay aceptación de integración de matrícula
ni nueva fidelidad contra SUM. Los límites de la búsqueda se mantienen explícitos.
