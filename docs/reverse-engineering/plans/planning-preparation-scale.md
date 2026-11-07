# Preparación de una oferta grande

Fecha: 2026-11-07. Estado: P96-UI integrada en `1ac4499`, comprobaciones locales ejecutadas y auditoría pendiente por cuota de Claude; estimador e integración de 96 pendientes. Base: `1649962` en `feat/planning-program`. Fuente funcional: petición del usuario de continuar tras el diagnóstico de los 96 cursos, [arquitectura](../../design/academic-planning-architecture.md) y [dirección vinculante](../../design-direction.md). Todo el diseño es `local-only`; no representa comportamiento observado en SUM.

## Alcance y contrato fijo del ticket UI

Solo Preparación dentro de `/local/programacion-academica`; conservar Horario/Semana, revisión, aprobación, selector de módulos y pantallas SUM del alumno. Lenguaje A, sin reabrir la identidad visual. Reutilizar los campos, adaptadores, recursos y validadores existentes; no añadir dependencias ni reemplazar contratos. Contrato existente **PA-DEMO-1**, `shared/programacion-academica-api.{mjs,d.mts}`: curso seleccionado → demanda, capacidad, patrón y modalidad existentes; generación recibe todos los seleccionados independientemente del filtro. El ticket UI no modifica límites del estimador ni su payload.

La tabla muestra una fila compacta por curso y grupos por ciclo, con código/nombre, demanda, capacidad, secciones previstas y selección. Solo un curso tiene abierto su inspector con los controles existentes de patrón/modalidad y referencia histórica. Buscar por nombre/código y filtrar ciclo afecta solo las filas visibles. Contadores separados: catálogo, incluidos y visibles. No inventar estados de suficiencia académica: los avisos se limitan a errores que los validadores existentes puedan demostrar.

La selección múltiple actúa sobre un conjunto explícito de cursos; “seleccionar visibles” conserva los de otros filtros. Cambios en lote de **demanda o capacidad** tienen vista previa con los códigos afectados, cantidad, valor anterior/nuevo y exclusiones por validación antes de confirmar. Cancelar no cambia nada. Confirmar aplica una sola transición local e invalida propuesta/estimación una vez como hoy; no añade guardado automático. Cursos sin selección no cambian salvo que el operador los seleccione explícitamente. No inferir inclusión por ciclo par/impar.

## Tickets y propiedad

| Ticket | Dependencias | Archivos exclusivos | Rol |
| --- | --- | --- | --- |
| P96-UI | V3 integrada; contrato PA-DEMO-1 fijo | `client/src/screens/AcademicScheduling.tsx`, nuevos `AcademicPreparationCourses.tsx` y `.css`, `client/src/data/academicPreparation.ts` y `.test.ts`, `client/scripts/verify-academic-preparation.mjs`; actualizar scripts académicos únicamente si sus selectores de Preparación cambian | UI · antigravity / gemini-3.8-flash / high |
| P96-DEMAND | Revisión de límites de petición, respuesta y fuente; no concurrente con workers que posean los mismos shared/backend | Asignar después de revisar: validadores compartidos de demanda, estimador y sus pruebas. Sin cambios de UI ni de otros contratos de rondas | Backend conforme §5 |
| P96-INTEGRATION | P96-UI y P96-DEMAND integrados | Prueba raíz con catálogo y fuente independientes de 96 cursos, informe integrado | Principal/Test conforme §5 |

No están listos para despacho paralelo: la revisión del estimador y el fixture de 96 no forman parte del ticket UI. Confirmar contratos y propiedad antes de despachar P96-DEMAND. No tocar rondas docentes, reajuste S-5, SQL ni cambios estudiantiles en este paquete.

## Aceptación y comprobaciones

| ID | Escenario sintético / check | Resultado esperado |
| --- | --- | --- |
| P1 | Catálogo independiente de 96 cursos en prueba de UI explícitamente simulada | 96 filas compactas, ningún conjunto de 96 formularios expandidos; como máximo un inspector de curso |
| P2 | Buscar código/nombre con y sin acentos y filtrar ciclo después de seleccionar en varios ciclos | Coincidencias correctas, contadores diferenciados, selección intacta |
| P3 | Seleccionar visibles; cambiar de filtro; generar | Payload contiene todos los incluidos y ningún curso oculto se elimina por el filtro |
| P4 | Lote válido y límite/inválido; cancelar y confirmar | Vista previa exacta, cancelación sin cambios, confirmación aplica solo el conjunto declarado; validación existente conservada |
| P5 | Editar patrón/modalidad en el único inspector; cerrar/reabrir | Valores coherentes y mismas reglas de invalidación; referencias históricas solo bajo disclosure |
| P6 | Propuesta aprobada/publicada recuperada | Campos mutables de Preparación siguen bloqueados; consulta de Semana conserva la corrección de V3 |
| P7 | Teclado, foco, 720px y zoom 200% | Controles accesibles; tabla con región propia de scroll, sin desbordar el documento; no texto esencial <12px |
| P8 | Build, lint, test:data y regresión académica | Salida 0; no regresión en flujos existentes ni modificaciones de componentes/tokens SUM |
| P9 | Cliente/NestJS real con el catálogo incorporado | Selección, generación y guardado/recuperación preservados; no confundir con la prueba simulada P1 |
| P10 | Estimador 33, 96 y 97 cursos; petición y respuesta | Contrato de 96 coherente y 97 rechazado; duplicados/desconocidos siguen rechazados. Pendiente de P96-DEMAND |
| P11 | Recorrido cliente → API → estimador → generación con catálogo/fuente independientes de 96 cursos | Entrada completa y respuesta honesta sobre límites de búsqueda; no prometer solución completa. Pendiente de P96-INTEGRATION |

El catálogo sintético actual tiene **56 cursos**, comprobado ejecutando exclusivamente el factory propio `createDemoCatalog()` compilado. No derivar el fixture de 96 de snapshots ni de fuentes privadas. La prueba P1 puede interceptar solo el catálogo con un fixture construido independientemente y debe declararse como UI simulada; no acredita P9/P11. P9 utiliza procesos propios y respuestas reales. Revisar scripts antes de ejecutarlos; entorno permitido, puertos libres y almacenes temporales exclusivos, sin adjuntarse a servicios del operador.

## Handoff del worker

Leer `AGENTS.md`, `client/AGENTS.md`, `client/.agents/skills/sum-react-implement/SKILL.md`, `/home/ubuntu/.codex/RTK.md`, este plan y dirección de diseño. Nunca acceder directa ni indirectamente a `datos-reales/`, snapshots, servicios privados o producción. No delegar. Comprobar CodeGraph; si falta el índice local, validar primero exclusiones explícitas de privados/dependencias/symlinks ajenos en `codegraph.json` y ejecutar `codegraph init` conforme la instrucción del usuario. No leer privados para validar exclusiones.

Entregar commit local, archivos modificados, evidencia de P1–P9 realmente ejecutados, comandos y resultados, bloqueos y límites. Principal revisa e integra; ningún worker certifica P10/P11 ni amplía el contrato para hacer pasar la UI.


Verificación por criterio y límites: [informe local](../../../evidence/local/programacion-academica-preparation/fullstack-verification.md). Corrección puntual del principal: foco del diálogo y bloqueo de confirmación de una vista previa desactualizada; sin nueva ronda de reparación delegada.
