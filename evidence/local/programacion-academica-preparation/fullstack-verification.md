# Preparación compacta — aceptación local

Fecha: 2026-11-07. Rama integrada: `feat/planning-program`; código `5078b9e` + corrección puntual `1ac4499`, base `5b1883b`. Estado: comprobaciones locales de Preparación, Semana y regresión general ejecutadas con salida 0; auditoría independiente pendiente por límite de cuota del proveedor Claude.

Fuentes: [plan P96-UI](../../../docs/reverse-engineering/plans/planning-preparation-scale.md), [dirección A vinculante](../../../docs/design-direction.md), contrato existente PA-DEMO-1 y código propio. Clasificación: requisitos locales y observaciones del entorno sintético; no evidencia de producción SUM.

## Cambios y revisión del principal

Se reemplazan las tarjetas repetidas de Preparación por tabla agrupada por ciclo, búsqueda normalizada, contadores separados, selección entre filtros y un inspector de curso activo. Demanda/capacidad se editan por fila o en lote con alcance y vista previa. Se conservan adaptadores, API, guardado explícito y las demás etapas.

La entrega original tenía pruebas insuficientes: el bloqueo se simulaba modificando el DOM, la recuperación solo comprobaba una fila de la lista y el teclado solo comprobaba que existiera un elemento activo. El principal completó esas pruebas y corrigió el diálogo: foco inicial, contención de Tab, Escape/restauración al disparador e invalidación de la vista previa al cambiar los valores. No se delegó una segunda reparación.

## Criterio → escenario → esperado → resultado

| ID | Escenario y resultado esperado | Resultado real |
| --- | --- | --- |
| P1 | Catálogo construido independientemente de 96 cursos → 96 filas, sin tarjetas expandidas, máximo un inspector | Cumple, prueba UI con catálogo interceptado explícitamente |
| P2 | Buscar código/nombre/tildes y cambiar ciclo tras incluir cursos → contadores diferenciados y selección conservada | Cumple |
| P3 | Generar con cursos seleccionados ocultos por ciclo → mismos IDs exactos en payload | Cumple, captura de petición en UI simulada; no acredita generación backend de esos IDs |
| P4 | Lote inválido, cancelar y confirmar → exclusiones visibles, cancelación sin cambios y aplicación del alcance | Cumple; se comprueba también que cambiar el valor invalida una vista previa anterior |
| P5 | Patrón/modalidad e historial en inspector → un inspector, disclosure, conservación al cerrar/reabrir | Cumple |
| P6 | Borrador real enviado a revisión, conformidades y aprobación por API; recargar y Consultar → selección/demanda/capacidad/lote bloqueados | Cumple para aprobado, sin modificación manual del DOM; publicado no recorrido por separado |
| P7 | Foco en región de tabla y Tab al checkbox; diálogo por teclado; 720px y render CSS al 200% → acceso operativo y documento sin overflow | Cumple en esos escenarios; fuentes examinadas >=12px. No prueba zoom nativo del navegador ni una auditoría completa de contraste |
| P8 | Build/lint/test:data → salida 0 | Cumple: build 0, lint 0, 239/239 tests de datos |
| P9 | Cliente → NestJS real con catálogo incorporado: generar, guardar, recargar y continuar → configuración/selección/demanda recuperadas | Cumple, procesos propios 3391/5391 y catálogo sintético de 56 cursos |
| Regresión general | `verify-academic-scheduling.mjs` → salida 0 | Cumple: generación, edición/regeneración, demanda cero, entrada inválida, retención, recuperación de red y guardia estudiantil |
| Regresión Semana | Suite estricta V3 → salida 0 | Cumple, procesos propios 3291/5291, incluida consulta de versión aprobada |

Comandos: `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data`, `timeout 180 env -i PATH="$PATH" node client/scripts/verify-academic-preparation.mjs`, `timeout 180 env -i PATH="$PATH" node client/scripts/verify-academic-week.mjs`. Todos finalizaron con salida 0 sobre código integrado. El backend no cambió; se reutilizó su build del mismo código base ya comprobado.

El script nuevo permite únicamente PATH y configuración sintética explícita a los hijos, comprueba puertos libres y usa un directorio temporal de borradores exclusivo. Dos contextos separados: UI96 simulada y cliente/API real. No se inspeccionó un servicio del operador, snapshots ni datos privados.

## Límites

P10 y P11 siguen pendientes: contrato del estimador coherente con 96 y recorrido completo con catálogo/fuente independientes de 96. No hay cambios en backend/shared, SQL, rondas completas o SUM estudiantil en este paquete. Los scripts adaptados `verify-academic-compose.mjs` no fueron ejecutados contra Compose en esta revisión. No se afirma paridad visual con capturas SUM ni implementación del estimador de 96.

Regresión general ejecutada con `timeout 240 env -i PATH="$PATH" node client/scripts/verify-academic-scheduling.mjs`, salida 0; puertos 3210/5176 comprobados libres antes del arranque. Sus PNG/JSON regenerados se restauraron al contenido histórico previo.

## Auditoría independiente no ejecutada

El 2026-11-07 se despachó el Auditor configurado (claudeAgent / claude-opus-5-5 / high). La tarea terminó con `Claude API rate limit reached. Try again later.`; no produjo hallazgos ni dictamen. Esto no cuenta como revisión aprobada. No se cambió de modelo ni se inició una reparación o reintento automático. Las comprobaciones ejecutadas por el principal permanecen válidas para el código indicado; la aceptación independiente queda pendiente hasta recuperar disponibilidad del Auditor configurado o recibir una nueva selección del usuario.
