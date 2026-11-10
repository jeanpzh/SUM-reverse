# V3 Semana — revisión de integración

Fecha: 2026-11-07. Principal actual: Codex GPT-6.1 Sol, medium, por elección del usuario. Base integrada: `f492a8f`. Entrega candidata: `c07746b11fb0554f6123cf6476ae2cb3bf781768`, rama `t3/planning-week-view`.

Estado actual: **V3 integrada en `1649962`; escenarios funcionales pendientes cerrados el 2026-11-07**. El historial de la revisión anterior se conserva abajo. Primera entrega `c07746b`; corrección combinada `d52fba8f7a02b90ad08c7751c176b15723b6bc63` en `t3/fix-planning-week-overlaps`. La revisión inicial fue estática; las ejecuciones independientes posteriores se detallan abajo. En aquella revisión no se inició otra reparación automática ni se aceptó el paquete completo; el cierre funcional posterior consta al final.

Alcance: solo Horario del producto interno; obligatorio `docs/design-direction.md` (A visual, B interacción Semana). Preservar SUM alumno, sus tokens, componentes y contratos. Fuentes: código propio y fixtures sintéticos exclusivamente. Nunca acceder a `datos-reales/`, snapshots privados ni al servidor del operador.

## Hallazgos estáticos

| ID | Severidad | Evidencia de la entrega candidata | Corrección / aceptación |
| --- | --- | --- | --- |
| WV-1 | Alta | `PlanningWeekView.tsx` dibuja todos los bloques del mismo día con solo top/height; `PlanningWeekView.css` aplica el mismo left/right y z-index. Dos asignaciones simultáneas válidas con distintos docentes/aulas se tapan. | Carriles o disposición que mantenga visibles y seleccionables ambos bloques. Caso sintético con concurrencia real; verificar rectángulos y selección individual. |
| WV-2 | Media | Tabla/Semana se desmontan al alternar; los únicos efectos de scroll son `scrollIntoView` por sección. No hay captura/restauración de posiciones. En móvil, el selector global puede encontrar antes un elemento del grid oculto. | Persistir posiciones por vista y evitar desplazarse hacia contenido oculto. Prueba de ida/vuelta con filtro y selección conservados. |
| WV-3 | Media | Etiquetas de sección/hora/recurso usan `0.6875rem` (11px con raíz 16px). Hay sombras decorativas y colores literales en la nueva hoja. | Texto esencial >=12px y lenguaje A con tokens existentes; comprobar estilos calculados en grid/agenda. |
| WV-4 | Media | Tabla filtra por el conjunto de bloques de una sección; Semana filtra cada bloque por separado. Al buscar un recurso de una sección dividida, puede desaparecer su otro componente al alternar. | Igual criterio de pertenencia por sección en ambas vistas; mostrar todos sus bloques o explicar explícitamente otra semántica acordada. Caso split sintético. |

También revisar la tarjeta de agenda con `role=button` que contiene un botón de edición: evitar dos acciones interactivas anidadas y duplicación por propagación de Enter/Espacio.

## Comprobaciones requeridas para aceptar

- Build, lint y `test:data` del cliente en la corrección.
- Prueba persistida y reproducible para WV-1 a WV-4, ajuste válido/rechazado por API real, teclado, fin de semana, estado bloqueado y agenda a 720px.
- Reutilizar `verify-academic-scheduling.mjs` como regresión, sin confundirlo con una suite específica de Semana.
- Entorno propio con datos independientes sintéticos y puertos aislados; no detener la demo del usuario ni inspeccionar servicios de procedencia desconocida.
- Principal revisa e integra únicamente el resultado corregido; luego ejecuta los checks afectados y registra evidencia real.

La recepción de V3 no resuelve la Preparación con 96 cursos. Ese problema y la inconsistencia 96/32 del estimador están registrados en `docs/design/academic-planning-architecture.md`; no ampliar esta reparación para abordarlos.

## Revisión independiente de la corrección d52fba8

Se inspeccionaron el helper de carriles, las vistas, el manejo de filtros y el script nuevo. Los carriles y la pertenencia por sección están implementados; las vistas quedan montadas y se restauran offsets verticales. Se eliminaron los roles interactivos anidados de la agenda y se añadió guardia de edición para `isLocked`.

Entorno ejecutado: worktree de la corrección `/home/ubuntu/.t3/worktrees/SUM-reverse/t3-2c54c0ba`. El script usa procesos propios en loopback 3291/5291 y fixtures incorporados sintéticos. Se lanzó con `env -i PATH="$PATH"` para evitar heredar fuentes o configuración del operador. No se utilizaron mocks para la generación y el ajuste comprobados. No hubo mezcla con la demo del usuario.

| Comando / criterio | Resultado real del principal | Límite |
| --- | --- | --- |
| `pnpm --dir client build` | Exit 0 | Compilación de la corrección, no del resultado integrado |
| `pnpm --dir client lint` | Exit 0 | Estático |
| `pnpm --dir client test:data` | 230/230; exit 0 | Incluye 8 casos puros de carriles, no toda la interacción |
| `timeout 180 env -i PATH="$PATH" node client/scripts/verify-academic-week.mjs` | Exit 0; generó propuesta, alternó vistas, comprobó offsets/agenda/overflow, aceptó un ajuste y recibió efectivamente un 422 en esta ejecución | El resumen final del script sobreafirma cobertura; ver abajo |
| Código estudiantil y contratos | Diff limitado a 9 archivos de cliente asignados | No hubo modificación en la rama principal |

### Por qué el script verde no completa la aceptación

1. **Concurrencia de asignaciones:** comprueba los rectángulos de una ubicación actual frente a su preview. No prepara ni comprueba dos asignaciones distintas válidas y simultáneas. Los casos puros del helper sí cubren intervalos superpuestos.
2. **Sección dividida:** el escenario no configura una sección split ni busca por un ambiente exclusivo de uno de sus bloques. Busca por nombre de curso y compara cantidades. Ese caso no demuestra WV-4 aunque la lógica se haya corregido.
3. **Rechazo 422:** en esta ejecución se recibió 422, pero el script permite 200 como alternativa. Además, compara una inclusión de texto en vez de la igualdad de las asignaciones comprometidas antes/después.
4. **Versión congelada:** el apartado de bloqueo contiene comentarios, sin acción ni aserción sobre una propuesta bloqueada. No se acredita ese criterio.
5. **Fines de semana:** se comprueban opciones en un select; falta configurar disponibilidad de fin de semana y recorrer su bloque en grid/agenda.

**Decisión:** conservar la corrección en su rama para no perder el trabajo y mantener la rama integrada en `f492a8f`. Antes de aceptar V3 hay que cerrar estos escenarios con pruebas reproducibles que fallen si desaparece la conducta. Ese es un problema de aceptación del paquete ya reparado; no se despacha un segundo worker automático ni se amplía a Preparación.


## Continuación e integración — 2026-11-07

El principal completó directamente la aceptación, sin otro worker ni reiniciar el contador de reparación. La prueba de versión aprobada reprodujo un defecto adicional: el `fieldset` deshabilitaba también el selector Semana y la consulta del horario. Corrección aislada: el fieldset de Horario solo bloquea durante una operación de guardado; los controles mutables conservan `isLocked` y los handlers de inicio/envío de ajustes comprueban el bloqueo. Preparación y Revisión mantienen sus bloqueos. No cambian contratos ni estilos estudiantiles.

Commits integrados: `79d8be7` (V3 corregida) y `1649962` (aceptación y consulta de versiones aprobadas). Fuentes: dirección interna vinculante `docs/design-direction.md`, código propio y fixtures independientes sintéticos; no evidencia de producción SUM. Skills aplicadas: `sum-workflow`, `sum-react-verify`, `sum-react-implement` para la corrección puntual y `sum-fullstack-verify` para aceptación integrada.

| Criterio → escenario → resultado esperado | Resultado real integrado |
| --- | --- |
| WV-1: dos cursos de ciclos distintos, docentes/ambientes distintos y misma franja → rectángulos disjuntos y selección individual por teclado | Cumple; asignaciones válidas creadas/ajustadas por NestJS, sin respuestas simuladas |
| WV-2: filtro y selección, offsets 240/160 al alternar Tabla/Semana → conservar ambos offsets, selección y búsqueda | Cumple |
| WV-3: estilos calculados de etiquetas, tiempos, detalles y badges → >=12px | Cumple en los selectores examinados; no equivale a auditoría visual completa |
| WV-4: sección split real en varios días, búsqueda por ambiente exclusivo de un componente → una sección en Tabla y todos sus bloques en Semana | Cumple |
| Ajuste válido a sábado con disponibilidad → HTTP 200, duración preservada, lectura posterior igual | Cumple |
| Ajuste a domingo sin ventana → HTTP 422, propuesta completa del servidor y asignaciones visibles exactamente iguales | Cumple; se eliminó la alternativa que aceptaba 200 |
| Sábado → bloque visible en grid y agenda filtrada a 720px, edición por teclado y sin roles interactivos anidados | Cumple |
| Propuesta aprobada mediante revisión/conformidades reales → consultar calendario e inspector, botones de edición deshabilitados, sin slots ni POST de ajuste | Cumple para `approved`; no se recorrió separadamente `published` |
| Build/lint/test:data → salida 0 | Cumple; 230/230 tests de datos |
| Regresión `verify-academic-scheduling.mjs` → salida 0 | Cumple: generación, ajuste/regeneración, demanda cero, entrada inválida, retención, recuperación de red y guardia estudiantil |

Comandos ejecutados en la raíz integrada: `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data`, `pnpm --dir backend build`, `timeout 180 env -i PATH="$PATH" node client/scripts/verify-academic-week.mjs` y `timeout 240 env -i PATH="$PATH" node client/scripts/verify-academic-scheduling.mjs`. Todos terminaron con código 0. Scripts Semana: procesos propios 3291/5291, entorno permitido solo PATH y variables sintéticas explícitas, almacén temporal exclusivo limpiado al terminar. Regresión: 3210/5176 comprobados libres antes del arranque; entorno limpio. No se consultó la demo del operador. Los PNG y JSON que la regresión regeneró se restauraron a su estado previo para evitar ruido en evidencia histórica.

Límites: aceptación funcional local de los escenarios descritos. No comparación visual con referencias equivalentes, auditoría de contraste ni recorrido separado de zoom nativo al 200%; no se afirma paridad visual ni conducta SUM. Preparación de 96 cursos continúa en un paquete separado; el catálogo sintético incorporado actual contiene 56 cursos (comprobación del factory propio).
