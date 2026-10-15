# Plan incremental: snapshots de Plan de Estudios

- **ID:** `plan-estudios-snapshots-2026-10-09`, revisión1.
- **Contrato fijado:** [PE-SNAPSHOT-1](../contracts/local-api/plan-estudios-snapshots.md), **listo para implementar únicamente decisiones locales basadas en el tipo sanitizado**. Implementación/comprobaciones nuevas pendientes; no integración acreditada.
- **Planner:** `sum-planner`, GPT-6.1 Sol High. Propiedad exclusiva de este plan y su contrato; sin código, delegación, servidores, tests, browser, acceso privado ni producción.
- **Objetivo:** servir el envelope `plan-estudios.json` desde NestJS existente y representarlo en la ruta React existente, conservando datos y separando el candidato de los fixtures propios.
- **Arquitectura:** validator puro compartido, helper de carga fija/catálogo readonly, repo/servicio/controller actuales y cabecera fuera del envelope; metadata WeakMap/runtime en cliente; proyección candidata de siete columnas.
- **Complejidad media:** dos capas y frontera shared. **Incertidumbre delimitada:** campos tipados suficientes, sin payload de filas ni semántica de prerrequisitos/descarga SUM. **Impacto alto:** pérdida de datos, contexto synthetic mezclado y falsas reglas académicas.
- **Reparaciones nuevas:** 0/1 por tarea; no reiniciar contadores históricos. Un fallo persistente exige diagnóstico/escalamiento concreto, no cambiar automáticamente el esquema.

## Reutilización y decisión Sol

Reutilizar RI-PLAN de [remaining-implementation](remaining-implementation.md), el módulo `backend/src/plan-estudios/`, ruta/tabla/adaptador existentes y [especificación](../screens/plan-estudios.md). No rehacer módulo, seed, loader root, navegación o layouts. Fuentes: `raw-types/plan-studios.ts`, evidencia sanitizada `evidence/sum/plan-estudios/{structure,interactions,measurements}.md`; inspección estática CodeGraph de repositorio/servicio/validator/tabla y el filename canonical del plan de exportación.

Sol fija la distinción entre tipos explícitos del candidato y reglas locales del seed. Los literales `2018  `, E/O y GEG/-- se validan exactamente; unicidad, no negatividad, igualdad con alumno del shell y pares de prerrequisito no están tipados y no se imponen al candidato. El array no contiene identidad/periodo: no validar/presentar el resumen synthetic como dato del snapshot. Las filas/semántica SUM no quedan verificadas por leer un tipo local.

## Invariantes de alto impacto

1. No leer/listar `datos-reales/` ni sus datos por procesos/respuestas/browser/logs; operador inicia backend privado. Workers solo código/fixtures sintéticos.
2. Preservar envelope/message/extras/listas/duplicados/espacios semánticamente, sin normalizar/defaults/coerción. Metadato externo al JSON.
3. `PLAN_ESTUDIOS_SNAPSHOT_DIR` es opt-in propio; no heredar MATRÍCULA/MI ni mezclar identidades. Puede apuntar al mismo directorio explícitamente.
4. Config definida: missing del archivo es503; presente inválido aborta arranque. Nunca sustituir por `[]`/seed/mock. Env ausente conserva seed anterior.
5. Candidato exige los catorce campos y literales del tipo; ninguna regla de elegibilidad, bloqueo, equivalencia, aprobación o progreso se deriva del prerrequisito.
6. Datos de shell/Formulario siguen su fuente independiente; candidate omite StudentSummary de esta pantalla. Fixture local-v1 mantiene contexto previo.
7. Copias profundas, memoria readonly/carga única/reinicio; errores solo variable/basename/key/field-path/motivo seguros, sin values/cause/ruta privada absoluta.

## Tareas para Luna High

Root despacha como máximo dos workers, **sum-executor o sum-implementer, GPT-6 Luna High**, sin subdelegación ni reversión de cambios ajenos. B posee backend y los dos shared por asignación explícita. C posee cliente. Contrato ya fijado antes del reparto; C consume exports B1 cuando estén disponibles. No ejecutar C concurrentemente con otros workers que editen `transport.ts`, `contracts.ts`, `adapters.ts` o `TableScreens.tsx` (incluida ampliación Historial). Workers no editan docs/config global/otra capa.

### PE-B1 — Frontera wire candidata

**Estado:** implementada; build/lint aprobados por worker. **Rol real:** `/root/plan_estudios_backend`, `sum-executor`, GPT-6 Luna High. **Propiedad B:** `shared/plan-estudios-wire.mjs`, `shared/plan-estudios-wire.d.mts`, `backend/src/plan-estudios/plan-estudios.types.ts`.

**Produce:** exports `PlanEstudiosRepresentation`, `PlanEstudiosWireRow`, `PlanEstudiosWireEnvelope`, `PlanEstudiosWireValidationError`; `validatePlanEstudiosWire(value:unknown): asserts value is PlanEstudiosWireEnvelope`. Tipos exactos del contrato, JSON compartido ya existente, sin raw-types import runtime backend.

- [x] Declarar los catorce campos, validar envelope/arrays/extras y literales, string vacío permitido/números finitos.
- [x] Distinguir missing/type/literal, redactar rutas de extras; no mutar datos ni introducir reglas del seed.
- [x] Entregar exports a C; revisión estática confirmada.

**Aceptación:** PE-WIRE, PE-PRESERVE; no pruebas de producción.

### PE-B2 — Lectura fija y consulta backend

**Estado:** implementada; build/lint aprobados por worker. **Propiedad B:** `backend/src/common/plan-estudios-snapshots.ts`, `backend/src/plan-estudios/plan-estudios.repository.ts`, `plan-estudios.service.ts`, `plan-estudios.controller.ts` y tipos de B1. **Rol real:** `/root/plan_estudios_backend`, `sum-executor`, GPT-6 Luna High.

**Interfaces:** `loadPlanEstudiosSnapshot(directory:string|undefined):PlanEstudiosSnapshotState` con unión `{kind:'disabled'} | {kind:'missing'} | {kind:'snapshot';envelope:PlanEstudiosWireEnvelope}`. Null no es éxito ni vacío. `PlanEstudiosRepository.readSnapshot():PlanEstudiosSnapshotState` devuelve copia del snapshot; conservar `read()` del fixture. `PlanEstudiosService.consultar():{representation:PlanEstudiosRepresentation;envelope:PlanEstudiosEnvelope|PlanEstudiosWireEnvelope}`; missing lanza HTTP503 del contrato, disabled compone fixture previo, snapshot conserva envelope completo.

- [x] Validar ruta absoluta/directorio accesible y conflicto PLAN_ESTUDIOS_FIXTURE sin exponer path/value; leer un basename fijo.
- [x] Distinguir directorio inválido, ENOENT de archivo, ilegible/JSON/esquema inválidos; errores seguros sin cause.
- [x] Repositorio en modo snapshot no consulta Reportes para construir data/alumno; sin env conserva fixture/empty. Carga readonly una vez.
- [x] Controller emite `X-SUM-PLAN-Representation` y retorna envelope; mantiene ruta y consulta.
- [x] `pnpm --dir backend build` y `pnpm --dir backend lint`: exit 0 reportado por worker. Sin tests/servidor/HTTP.

**Aceptación:** PE-SOURCE, PE-ERROR, PE-PRESERVE, PE-STATIC-B.

### PE-C1 — Frontera runtime y mapping React

**Estado:** implementada; build/lint aprobados por worker. **Rol real:** `/root/plan_estudios_client`, `sum-executor`, GPT-6 Luna High. **Propiedad C:** `client/src/data/planEstudios.ts`, `client/src/data/contracts.ts`, `client/src/data/transport.ts`, `client/src/data/adapters.ts` y rama Plan de `client/src/screens/TableScreens.tsx`.

**Skills:** leer `client/AGENTS.md` y `client/.agents/skills/sum-react-implement/SKILL.md`. **Consume:** B1/PE-SNAPSHOT-1. **Produce:** `rememberPlanEstudiosRepresentation(response,representation)` y `getPlanEstudiosRepresentation(response)` con firmas del contrato; `toPlanCandidateRows(data:PlanEstudiosWireRow[]):string[][]`.

- [x] Extender ApiResponseMap/parse; cabecera requerida y WeakMap fuera del DTO.
- [x] Candidate usa validator shared; local-v1 y mock conservan validación/presentación anteriores. Candidate no valida contra alumno del shell.
- [x] Manejar 503 SNAPSHOT_MISSING de forma segura, sin contenido remoto arbitrario ni fallback.
- [x] Siete columnas, texto/códigos literales, orden y duplicados; candidate omite StudentSummary.
- [x] CSV local rotulado; no afirma exportación completa de JSON/SUM.
- [x] `pnpm --dir client build` y `pnpm --dir client lint`: exit 0 reportado por worker. Sin tests, verify, browser/servidor.

**Aceptación:** PE-UI, PE-CONTEXT, PE-ERROR, PE-SEED, PE-STATIC-C. No rediseño ni fidelidad visual completa acreditada.

### PE-R1 — Cierre root

**Estado:** cerrado con revisión estática. **Propiedad root:** workflow/documentación operativa y actualizar estados de estos IDs.

- [x] Recoger cuatro build/lint nuevos; ambos workers reportaron exit 0. Revisión estática de aliases, header, filename, mapping, privacidad y ownership completada.
- [x] Registrar límites: escenarios funcionales no ejecutados; snapshot privado lo inicia el operador.
- [ ] Si otro codPlan/alias causa rechazo, solicitar tipo/diagnóstico sanitizado y revisar PE-SNAPSHOT-1 antes de generalizar; no inferir esquema desde archivo privado.

## Criterios y checks

| ID | Criterio implementable / revisión de esta entrega |
| --- | --- |
| PE-WIRE | Catorce campos requeridos, aliases exactos/espacios, números finitos, extras; sin signos/uniqueness/context/prereq-pair inventados |
| PE-PRESERVE | Envelope completo/message/extras/orden/duplicados sin mutación; metadata externa; clones por lectura |
| PE-SOURCE | Env nueva opt-in, filename canonical fijo, coexistencia MATRÍCULA/MI sin fallback/lectura cruzada; no seed en snapshot |
| PE-ERROR | Archivo missing503, directorio/presente inválidos startup error seguro; header/parser/local error nunca seed |
| PE-UI | Siete columnas/códigos/texto/string numbers, empty headers, CSV local explícito; sin algoritmo académico |
| PE-CONTEXT | Sin StudentSummary candidate deducido del shell, sin identidad/periodo inventado ni validación cruzada |
| PE-SEED | Sin env nueva permanece RI-PLAN, incluso si MATRICULA_SNAPSHOT_DIR existe; mock/api previos sin nueva red |
| PE-STATIC-B/C | Backend y client build/lint reportados exit 0 por sus workers; ningún test añadido/ejecutado |

Escenarios PE-CANDIDATE/SEED/EMPTY/MISSING/INVALID/EXTRAS/REPEAT del contrato definen resultados futuros; no fueron ejecutados. Build/lint no prueban HTTP/persistencia/integración. No se pide ni acredita equivalencia visual, descarga SUM, completitud de filas, verificación de JSON real o producción. La propia planificación se valida mediante revisión de firmas/cobertura y diff de sus dos documentos; no aplicación.
