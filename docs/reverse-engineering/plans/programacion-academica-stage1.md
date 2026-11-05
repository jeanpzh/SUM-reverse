# Programación académica asistida: etapa 1

Fecha: 2026-10-29. Rama autorizada: `schedule-pt1`. Autor: principal.
Fuente: requisitos explícitos del usuario de esta etapa; decisión `local-only`.
No representa demanda real, reglas oficiales de FISI ni comportamiento observado de SUM.

## Alcance y reutilización

Reutilizar el tipo de identificador de `CourseDocument` en
`backend/src/matricula-regular/profile.types.ts`, sin modificarlo. Se revisaron
los contratos `docs/reverse-engineering/contracts/local-api/matricula-regular.md`,
los modelos de programación y `shared/matricula-regular.d.mts` durante el análisis.
La demanda estimada y la capacidad objetivo son entradas de planificación distintas
de `Section.capacity`/`occupied`: no reemplazan oferta, cupos ni prematrícula.
No hay migración de consumidores ni contrato HTTP nuevo en esta etapa.

Contrato de función: `calculateRequiredSections(unknown)` valida un objeto plano
con exactamente `courseId`, `estimatedDemand` y `targetCapacity`, y devuelve esos
tres campos más `requiredSections`. El ID es un string no vacío sin espacios en
los extremos; no se valida su pertenencia a un catálogo todavía. Demanda: entero
seguro >= 0. Capacidad objetivo: entero seguro > 0. No hay coerción ni valores
por defecto. Entradas inválidas producen `TypeError` con el campo afectado.
Resultado: `Math.ceil(estimatedDemand / targetCapacity)`, incluyendo cero demanda.
La función no modifica la entrada ni persiste datos. Las fixtures A/B/C se
construyen de forma independiente: 70/30, 60/30 y 0/30; resultados 3, 2 y 0.

No crear endpoints, horarios, interfaz administrativa, integración, configuración,
dependencias ni persistencia. Preservar fidelidad visual y de interacción SUM:
ninguna pantalla ni navegación tiene cambios autorizados en esta etapa.

## Ejecución y aceptación

Complejidad baja, incertidumbre baja e impacto bajo: función pura aislada.
Implementación directa por principal, sin trabajadores ni cambio de modelo.
Los TOML de agente/configuración mencionados en las instrucciones no existen
en las rutas `.codex/agents/sum-implementer.toml` y `.codex/config.toml` de este
checkout; no se declara aplicación de un perfil ausente.

| Tarea | Dependencia | Archivos exclusivos | Aceptación |
| --- | --- | --- | --- |
| Modelos y validación | Contrato anterior | `backend/src/programacion-academica/*types.ts`, `section-sizing.ts` | Rechazar formas, campos y valores inválidos sin coerción |
| Cálculo y fixtures | Modelos | `section-sizing.ts`, `*fixtures.ts` en esa carpeta | Cero, división exacta y redondeo correctos; sin mutaciones |
| Pruebas | Cálculo | `backend/test/programacion-academica-section-sizing.test.mjs` | Casos anteriores, límites seguros, fixtures independientes |
| Comprobación | Pruebas | Este registro | Suite focalizada, build y lint backend; diff limitado a archivos nuevos |

No arrancar NestJS, Docker ni conexiones de datos. No ejecutar suites globales.
El checkout carece de `backend/node_modules`: sin instalar dependencias no están
disponibles Vitest, Nest CLI ni Oxlint. Se usa `node:test` con Node 24 y soporte
nativo TypeScript para probar directamente la función sin dependencias. No se
modifican scripts ni configuración. Build y lint quedan pendientes por entorno;
las pruebas runtime no sustituyen la comprobación de tipos de TypeScript.
Resultados reales de las comprobaciones se incorporarán al completar la etapa.

## Resultado de la etapa

- `node --experimental-strip-types --test --test-reporter=dot backend/test/programacion-academica-section-sizing.test.mjs`:
  código 0; 46 casos aprobados. Ejecutado con Node v24.22.1 del runtime local
  de Codex (el ejecutable no está en PATH).
- Cero demanda, divisiones exactas, redondeo y límite entero seguro: aprobados.
- Capacidades/demandas inválidas, ID inválido, campos ausentes/extra y objetos
  heredados: rechazados según contrato. Inmutabilidad y fixtures: aprobadas.
- Build, lint y comprobación estática TypeScript: no ejecutados, faltan las
  dependencias locales. No se instalaron dependencias para resolverlo.
- La prueba utiliza solo los tres archivos nuevos de código; no importa ni
  ejecuta escenarios de matrícula, NestJS, snapshots o bases de datos.
- Sin endpoints, interfaz, horarios, integración, migraciones o cambios Docker.
- Estado: cálculo verificado en runtime; validación estática pendiente por entorno.
