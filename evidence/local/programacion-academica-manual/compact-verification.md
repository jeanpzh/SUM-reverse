# E1 · edición desde tabla y análisis de demanda

Fecha: 2026-11-02, America/Lima. Rama schedule-pt1. Aceptación local del principal.
Fuente funcional: solicitud del usuario, prototipo local-only. No se inspeccionó
SUM oficial, localhost5180 del operador, PDFs privados ni datos-reales.

## Qué cambió

- client/src/screens/AcademicScheduling.tsx: columna Sección solo numérica; acción
  Editar horario en cada fila con asignaciones; marca Ajustada en Acciones cuando
  corresponde. Un único panel seleccionado debajo de esa tabla, cerrado por defecto
  y con Cancelar. Sin tarjetas grandes repetidas por sección. aria-expanded y
  aria-controls enlazan acción y editor.
- client/src/screens/AcademicScheduling.css: redistribución de seis columnas y
  estilos locales del editor único/selector de bloque; no cambia CSS estudiantil.
- client/scripts/verify-academic-manual.mjs: pruebas nuevas sobre el mismo flujo
  existente, sin crear otra suite de navegación. Cubre selección, cambio de sección,
  cancelación, números limpios, secciones sin asignaciones y dos bloques split.

Se reutilizan startBlockReview, submitBlockReview, aggregateAcademicBlocks,
AcademicAdjustment y endpoint existentes sin modificar contratos, adaptador,
backend ni generador. Conserva docente habilitado, día, inicio, ambientes por
componente, duración/continuidad, disponibilidad/carga/límites y validación atómica.
Un bloque asignado de una sección split parcial sigue siendo editable; no se
deshabilita toda una sección solo porque falten otros componentes. Una sección sin
asignaciones no ofrece una edición ficticia. Las marcas manuales permanecen en
asignaciones/calendario; Automática se retiró de la tabla Secciones propuestas.

## Criterio → escenario → resultado

| Criterio | Verificación real |
| --- | --- |
| Tabla simple | Cuatro filas ERP con columna Sección exclusivamente1,2,3,4 y acción Editar horario; sin texto Automática en esa tabla. sections-table.png. |
| Sin editor inicial | Cero paneles manual-review antes de seleccionar. |
| Solo sección activa | Seleccionar sección1, cambiar a2: siempre un panel con título de la sección elegida; Cancelar lo elimina. |
| Ajuste válido | ERP180/45:4secciones/8componentes/4bloques. Sección1 pasa a viernes16–20, versión1, tabla/calendario coherentes, otras secciones conservadas. |
| Ajustes rechazados | TEACHER_CONFLICT y ROOM_CONFLICT, HTTP422, mensaje específico junto al editor y propuesta anterior conservada. |
| Continuidad/preferencias | Bloques4h, preferencia satisfecha para cuatro secciones inicialmente; fallback con un docente conserva avisos blandos. Mismas reglas/API anteriores. |
| Pendientes | Sin asignaciones: sin acción Editar horario. El resultado parcial y SEARCH_LIMIT se representan sin falsa imposibilidad. |
| Split | ERPdemanda45, docente/ambientes con lunes y martes16–18: dos sesiones de120min en días distintos. Selector con dos opciones, cambio de bloque con un solo editor y Cancelar. split-editor.png. |
| Demanda manual | Sigue editable;180/45 genera cuatro secciones. No se añadió estimador automático. |
| Matrícula | Oferta idéntica antes/después de generar/ajustar; flujo estudiantil, solicitud aceptada, replay idempotente y cupos alterados únicamente por esa matrícula de prueba. |

Scripts browser contra proyecto propio `sum-academic-acceptance`,
http://127.0.0.1:5280, fixtures integrados explícitamente sintéticos y sin mocks.
Viewport1440×1000. Principal único propietario del navegador. Sin errores de
JavaScript ni solicitudes externas. No se afirma paridad visual con SUM oficial.

## Comandos y resultados

- `pnpm --dir client build`:aprobado, incluye tipos; repetido tras corrección
  preventiva para conservar edición de bloques de secciones parciales.
- `pnpm --dir client lint`:aprobado; `pnpm --dir client test:data`:196/196.
- `node --check client/scripts/verify-academic-manual.mjs`:aprobado.
- `pnpm --dir backend test programacion-academica test/matricula-regular-regression.spec.ts test/enrollment-scenarios.spec.ts`:
  14 archivos,304/304 (253 académicas y51 regresiones). No se modificó backend.
- `node --test shared/programacion-academica-api.test.mjs`:6/6.
- `SUM_PORT=5280 docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance up --build --detach --wait`:
  compilación frontend aprobada, backend sin cambios reutilizado desde caché,
  ambos servicios saludables. Sin instalar dependencias adicionales.
- `SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 node client/scripts/verify-academic-manual.mjs`:
  aprobado, incluidos selector único y split con dos bloques reales.
- Con la misma confirmación sintética,
  `node client/scripts/verify-academic-compose.mjs`:aprobado, navegación estudiantil
  y matrícula aceptada/idempotente incluidas.
- `git diff --check`:aprobado; permanece aviso previo LF/CRLF de routeTree.gen.ts.

No hubo fallos en las verificaciones finales de esta entrega. Las correcciones
preventivas de revisión fueron mantener acceso a bloques asignados de secciones
parciales y guardar conteo del selector antes de cerrarlo. No se cambió el generador.
Los seis archivos rastreados modificados previamente conservan el mismo diff
(64 inserciones/7eliminaciones). El módulo previo sigue sin rastrear: git diff no
muestra por sí solo su contenido. Se preservaron todos los archivos existentes.

## Análisis entregado, sin implementación de demanda

`docs/reverse-engineering/plans/programacion-academica-demand-findings.md` contiene
inventario de tipos/funciones/rutas, metodología propuesta y decisiones pendientes.
Comprobación estructural de builders/seed sintéticos:165 filas/56 cursos de oferta,
97 filas/85 cursos de plan, nueve escenarios con36 apariciones pero solo cuatro
actores distintos (dos por escuela). No se produjo un nuevo conteo de habilitados ni demanda y no se
guardaron historiales personales. Se comprobó la existencia de las rutas citadas.

Recomendación: contar personas únicas académicamente habilitadas sobre una fuente,
periodo/corte y ámbito elegidos; repitencia como subconjunto, datos desconocidos
aparte, y demanda final manual conservada. No usar matrícula/oferta actual ni sumar
escenarios como si fueran población nueva. Falta acordar población y definición de
habilitación, equivalencias, electivos y continuidad antes de implementar.

## Límites y cómo revisar

La retención15min en memoria y la búsqueda heurística anteriores permanecen. Cambiar
de sección/bloque descarta el borrador no aplicado, sin modificar asignaciones ya
aceptadas; no hay persistencia ni edición simultánea multiusuario. No se implementó
E2/E3, aprobación, publicación, estimación de demanda ni nuevas reglas académicas.

Para ver el cambio habitual: `docker compose -f compose.local.yaml up --build`,
http://localhost:5180/local/programacion-academica, generar y elegir Editar horario
en Secciones propuestas. La prueba se hizo aisladamente en5280.

Las capturas/result.json de esta carpeta se regeneraron para esta evolución y
muestran la UI compacta. fullstack-verification.md registra la entrega anterior;
este informe documenta el comportamiento actual. No commits ni push.
