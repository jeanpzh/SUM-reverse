# E1 · revisión manual de propuestas

Evolución posterior: las capturas/result.json de esta carpeta se regeneraron con
el editor único desde la tabla. Consultar `compact-verification.md` para el estado
actual; este informe conserva el registro de la implementación anterior.

Fecha: 2026-11-02 (America/Lima). Rama: `schedule-pt1`.
Fuente funcional: solicitud del usuario; decisiones de prototipo `local-only`.
Entorno observado: proyecto propio `sum-academic-acceptance`, Docker Compose local,
`http://127.0.0.1:5280`, fixtures integrados explícitamente sintéticos. No se abrió
el servicio del operador en5180, PDFs privados ni datos-reales. No se acredita
comportamiento oficial SUM ni fidelidad visual contra producción.

## Diagnóstico y decisiones

El generador existente ya prioriza intervalos que cubren todas las preferencias
del bloque, después docentes sin preferencias, después alternativas fuera de ellas.
Disponibilidad, habilitación, carga y límites son restricciones obligatorias;
preferencias son blandas. Ordena empates de manera determinista y se detiene en la
primera solución completa: puede concentrar días y no optimiza globalmente el total
de preferencias. No se encontró un defecto que justificara reescribirlo; se añadió
una regresión que elige miércoles preferido antes que lunes factible no preferido.
No se impone separación por día ni equidad obligatoria.

El servidor conserva entrada/autoridad/recursos originales, una copia automática y
la vista ajustada. La nueva operación comprueba versión y aplica un cambio atómico
sin invocar el generador. Fallos conservan íntegra la vista y su versión. El
responsable de una sección dividida cambia para todos sus componentes, pero solo
el bloque seleccionado cambia de horario/ambiente. Otras secciones permanecen
idénticas. Un envío sin cambios no incrementa versión ni marca la sección.

Compatibilidad local de ambientes: cada componente conserva el tipo classroom o
laboratory utilizado automáticamente, cuando existe kind. No se deducen requisitos
de laboratorio ni equipamiento a partir de la letra T/P/L. El tipo y capacidad del
ambiente no sustituyen sus comprobaciones de disponibilidad y cruces.

## Aceptación real

| Criterio | Escenario y resultado |
| --- | --- |
| Tablas compactas | Secciones:5 columnas sin Modalidad; asignaciones:7 sin Duración total. Componentes y horario completo conservados. Capturas sections-table.png y assignments-table.png. |
| ERP180/45 | Cuatro secciones, ocho componentes T120+L120, cuatro eventos continuos de240min. Dos docentes, dos secciones por docente y cuatro preferencias satisfechas. |
| Preferencias | Prueba HTTP prioriza miércoles preferido sobre lunes disponible; navegador obtiene cuatro secciones dentro de preferencias. Fallback de un docente:2 dentro/2 fuera, sin declarar imposibilidad. |
| Cambio válido | Sección1 pasa a viernes16:00–20:00, dos componentes consecutivos; versión1 y marca manual en tabla/calendario; otras secciones conservadas. |
| Cruce docente | HTTP422 TEACHER_CONFLICT; editor muestra explicación específica y conserva tabla, calendario, vista del servidor y versión. |
| Cruce ambiente | HTTP422 ROOM_CONFLICT con docente distinto; misma conservación. |
| Carga/límites/habilitación | Pruebas HTTP exigen códigos TEACHER_LOAD_EXCEEDED, TEACHER_SECTION_LIMIT y TEACHER_NOT_QUALIFIED. |
| Ambientes/disponibilidad | HTTP rechaza ROOM_CAPACITY, ROOM_KIND_MISMATCH, ROOM_UNAVAILABLE, TEACHER_UNAVAILABLE y WINDOW_UNAVAILABLE. |
| Continuidad | Pruebas HTTP de4h y6h, mismo responsable y orden/duración; split conserva otros bloques y no acepta fragmentos de un bloque contiguo. |
| Autoridad y concurrencia | Body con recursos/requisitos sustitutos rechazado; versión obsoleta409; expiración404; no-op no marca manual. |
| Propuesta parcial | Ajustar un bloque completo conserva pendientes, conteos y estado original de búsqueda. No inventa asignaciones. |
| Insuficiencia y límite | Escenario ERP estrecho:impossible con INSUFFICIENT_COURSE_TEACHER_LOAD y2secciones válidas. Escenario amplio:search-limit,4/8 componentes, mensaje explícito de búsqueda inconclusa. |
| Matrícula | Oferta idéntica antes/después de generación y ajustes; script Compose verifica navegación estudiantil, matrícula sintética aceptada, repetición idempotente y ocupación alterada solo por matrícula. |

## Comandos y resultados

- `pnpm --dir backend test programacion-academica`:12 archivos,253/253 pruebas;
  incluye9 pruebas HTTP/servicio nuevas. Las203 pruebas Node del núcleo se repiten
  también dentro de Vitest: los conteos no se deben sumar como casos distintos.
- `node --experimental-strip-types --test backend/test/programacion-academica-section-sizing.test.mjs backend/test/programacion-academica-schedule.test.mjs backend/test/programacion-academica-generator.test.mjs`:203/203.
- `node --test shared/programacion-academica-api.test.mjs`:6/6.
- `pnpm --dir backend test test/matricula-regular-regression.spec.ts test/enrollment-scenarios.spec.ts`:51/51.
- `pnpm --dir backend build`:aprobado; comprobación fuente
  `pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false`:aprobada.
- `pnpm --dir backend lint`:exit0; cuatro advertencias anteriores de unbound-method
  en `backend/test/local-profile-session.spec.ts` (52,68,89,135).
- `pnpm --dir client build`, `pnpm --dir client lint`:aprobados.
  `pnpm --dir client test:data`:196/196; build incluye tipos del cliente.
- `node --test scripts/academic-compose-config.test.mjs`:2/2, módulo local habilitado,
  simulador público deshabilitado.
- `SUM_PORT=5280 docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance up --build --detach --wait`:ambos servicios saludables.
- Con `SUM_ACADEMIC_COMPOSE_SYNTHETIC=1`, scripts
  `client/scripts/verify-academic-manual.mjs`, `verify-academic-erp.mjs` y
  `verify-academic-compose.mjs`:aprobados, navegador real1440×1000, sin mocks,
  errores JavaScript ni peticiones externas. JSON/capturas en esta carpeta y las
  carpetas hermanas programacion-academica-erp y programacion-academica-docker.
- `git diff --check`:aprobado; aviso conocido LF/CRLF del routeTree generado.

## Incidencias de verificación y resolución

Primera compilación del worker backend detectó inferencia de day y acceso a un
reporte opcional; corregidos en su único ciclo de reparación, compilación final
aprobada. Un local sin uso del test fue retirado.

El primer navegador se detuvo porque el script esperaba Teoría, mientras el contrato
conserva el código T. Se corrigió el script y la antigua expectativa ERP que dependía
de la columna eliminada. El siguiente intento verificó ajustes/cruces, pero exigió
impossible en una búsqueda amplia que devolvió legítimamente search-limit.
Decisión explícita del principal: corregir el criterio de verificación para exigir
estado, límite y diagnóstico coherentes según el resultado real, sin cambiar el
generador ni convertir el límite en imposibilidad. La prueba ERP estrecha y las
pruebas HTTP mantienen la demostración de insuficiencia. La ejecución final pasa.

## Archivos de esta entrega

Modificados dentro del trabajo E1 previo (continúan sin rastrear en Git):
`backend/src/programacion-academica/demo-proposal.service.ts`, `demo.controller.ts`;
`client/src/screens/AcademicScheduling.tsx`, `AcademicScheduling.css`;
`client/src/data/academicScheduling.ts`, `academicScheduling.test.ts`;
`client/scripts/verify-academic-erp.mjs`; `shared/programacion-academica-api.mjs`,
`programacion-academica-api.d.mts`, `programacion-academica-api.test.mjs`;
`docs/reverse-engineering/contracts/local-api/programacion-academica-demo.md`.

Nuevos: `backend/test/programacion-academica-manual-review.spec.ts`,
`client/scripts/verify-academic-manual.mjs`, plan
`docs/reverse-engineering/plans/programacion-academica-manual-review.md`, workflow
`docs/reverse-engineering/workflows/programacion-academica-manual-review.md` y esta
evidencia. Se conserva todo el trabajo anterior. Los seis archivos rastreados con
cambios previos mantienen el mismo diff (64 inserciones/7 eliminaciones); matrícula,
WeeklySchedule compartido, manifiestos y lockfiles no presentan cambios.

## Límites

No se añadió persistencia: propuestas15min en memoria/máximo20; reiniciar elimina
propuestas. Marca manual indica intervención, no aprobación. Se editan bloques ya
asignados, no se completan pendientes con esta operación. Una vista abierta en otra
pestaña puede recibir409 y requerir regenerar; no hay sincronización multiusuario.
No se garantiza óptimo global, cancelación real ni tiempo estricto. Una carga
obviamente insuficiente puede consumir el presupuesto antes de agotar el dominio;
en ese caso se conserva search-limit. Equipamiento y requisitos académicos de cada
tipo de ambiente siguen pendientes. No se certificó toda la suite global del repo.

No se modificó configuración Docker en esta entrega, ni dependencias, matrícula,
E2/E3, aprobación o publicación. No hubo commits ni push. No se inicializó CodeGraph:
no se acreditaron CLI/índice y exclusiones de symlinks/.pnpm-store suficientes.

Para revisar en el entorno habitual: `docker compose -f compose.local.yaml up --build`
y abrir `http://localhost:5180/local/programacion-academica`; generar y usar
«Revisar bloque» → «Aplicar ajuste». La aceptación se ejecutó separadamente en5280.
