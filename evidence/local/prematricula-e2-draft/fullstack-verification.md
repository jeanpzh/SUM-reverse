# E2: borrador individual — verificación integrada

Fecha: 2026-11-04 (Lima). Rama `schedule-pt1`. Fuente: requisito explícito del
usuario y datos sintéticos autorizados del repositorio. Implementación y decisiones
`local-only`; observaciones `observed` únicamente del entorno sintético local.
No se inspeccionaron SUM, documentos privados, `datos-reales/` ni el servidor del
operador en 5180. No se acredita comportamiento institucional ni paridad de píxeles.

## Entorno y alcance

Proyecto propio `sum-academic-acceptance`, `http://127.0.0.1:5280`, creado con
`SUM_PORT=5280 docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance up --build --detach --wait`.
El archivo de entorno vacío y Compose fijan los fixtures incluidos; no hay
`MATRICULA_SNAPSHOT_DIR`, backend expuesto o datos privados. Chrome/Playwright con
viewport 1440×1000, API NestJS real a través del proxy Nginx; sin interceptores/mocks.
La ejecución habitual del usuario permanece en `localhost:5180`.

Dos publicaciones nuevas se prepararon por API E1: generación, guardado, envío a
revisión, conformidades simuladas, aprobación y publicación. Asignaturas autorizadas
20118091 y 20118094, elegibles para ambos perfiles regulares. Recursos configurados
para prueba, sin inferir disponibilidad futura. Se conservaron códigos e IDs originales.

## Criterios y resultados

| Criterio | Comprobación sintética | Resultado |
| --- | --- | --- |
| Reporte previo y ruta habitual | `/alumnoWebSum/v2/reportes/prematricula`: reporte con filas y mismo texto antes/después de editar E2 | Cumple |
| Reutilización | Selector extraído de SectionPickerDialog, helpers chooseSection/removeChoice y WeeklySchedule sin cambiar contratos E3 | Cumple |
| Publicación confiable | PA-PUBLICATION-1 real, escuela/periodo/versión; rechazo de versión distinta y referencias ajenas | Cumple |
| Selección | Elegir sección 1, reemplazar por 2 sin duplicar curso, retirar y restaurar; calendario coherente y componentes continuos agrupados | Cumple |
| Créditos | Navegador acepta 2 créditos; backend acepta 28 sin aplicar mínimo12/máximo26 | Cumple |
| Reglas académicas | Aprobados, prerrequisitos incumplidos, requisito seleccionado que no consta aprobado, desconocimiento de equivalencias y reconocimiento explícito en clasificador | Cumple |
| Cruces | Dos cursos de la publicación con componentes superpuestos: `SCHEDULE_CONFLICT`, estado `unmet`, aviso visible | Cumple |
| Borrador parcial | Selección vacía guardada con estado `incomplete`, mismo ID al restaurar selección | Cumple |
| Identidad y propiedad | A/B con IDs de borrador diferentes; B sin borrador de A; intento de actualizar ID de A con sesión B devuelve403 | Cumple |
| Sesiones y ámbito | Sesión ausente/caducada, cambio mientras espera E1, escenario no regular y modo público bloqueados | Cumple (suite E2 y regresión de sesiones) |
| Concurrencia | CAS obsoleto devuelve409 en HTTP; dos creaciones concurrentes producen un éxito y un409 en prueba focal | Cumple |
| Nueva publicación | Vigente versión4 no sustituye referencia3; consultar4 no escribe el borrador; recuperar vuelve a3 | Cumple |
| Reinicio | Se cerró Chrome, se reinició solo backend, sesión nueva recuperó A con mismo ID/versión/selección; B mantiene su propio documento | Cumple |
| Separación E1/E3 | Oferta/ocupaciones y reporte confirmado iguales antes/después; publicación E1 idéntica; snapshot completo de repositorio igual en prueba focal | Cumple |
| Regresión integrada | Verificadores existentes de edición manual ERP180 y Compose/matrícula aceptada e idempotente | Cumple |

`browser-state.json` conserva solamente referencias sintéticas, publicaciones y
resultados; no sesiones, credenciales ni tokens. Capturas de panel recuperado,
cruce y reporte con propuesta fueron inspeccionadas visualmente. El reporte original
conserva el periodo E3 2026-II; el panel identifica por separado el periodo E2 2027-I.
No se compararon capturas contra producción. Las capturas de elementos pueden
incluir la cabecera fija superpuesta según el desplazamiento del navegador.

## Comandos y resultados reales

- `pnpm --dir backend build`: pasa.
- `pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false`: pasa, código fuente.
- `pnpm --dir backend lint`: pasa con cuatro advertencias previas `unbound-method`
  en `backend/test/local-profile-session.spec.ts`, líneas52,68,89,135.
- `pnpm --dir backend test prematricula programacion-academica test/matricula-regular-regression.spec.ts test/enrollment-scenarios.spec.ts`:
  **364/364**, 20 archivos (346 anteriores +18 E2).
- Suite adicional `pnpm --dir backend test test/local-profile-session.spec.ts test/local-profile-projection.spec.ts test/local-profile-dashboard-http.spec.ts test/local-profile-dashboard-bootstrap.spec.ts test/local-profile-academic.spec.ts`:
  **40 pasan y1 falla**, causa previa de portabilidad detallada abajo.
- `pnpm --dir client build`: pasa (comprobación de tipos y Vite; también dentro de Docker).
- `pnpm --dir client lint`: pasa.
- `pnpm --dir client test:data`: **204/204** (201 anteriores +3 adaptador E2).
- `node --test` de seis contratos académicos/E2 y `scripts/academic-compose-config.test.mjs`:
  **27/27**. Los tests de configuración comprueban flags locales y exclusión del modo público.
- `node --experimental-strip-types --test backend/test/programacion-academica-section-sizing.test.mjs backend/test/programacion-academica-schedule.test.mjs backend/test/programacion-academica-generator.test.mjs`:
  **203/203**, mismos casos base que Vitest; no sumarlos como cobertura independiente.
- `SUM_E2_BROWSER_VERIFY=1 SUM_E2_PHASE=save|resume node client/scripts/verify-e2-prematricula.mjs`:
  ambas fases pasan; resume incluye edición, cruce, borrador vacío y nueva publicación.
  Entre fases se ejecutó `docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance restart backend`.
- `SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 node client/scripts/verify-academic-manual.mjs`: pasa.
- Con la misma bandera, `node client/scripts/verify-academic-compose.mjs`: pasa.
- `git diff --check`: pasa. Rama final `schedule-pt1`; sin commits/push.

## Hallazgos y correcciones

Las primeras pruebas E2 tenían dos fixtures con numeración de aprobación inválida;
se corrigieron los fixtures, sin relajar PA-PUBLICATION-1. La ampliación encontró un
error propio real: pasar una asignación completa a `intervalsOverlap` viola su
contrato de tres campos. Se proyectan `day/startMinute/endMinute`; el cruce ahora se
detecta. Se corrigieron además identificación de publicación ausente (404), uso de
códigos originales y prevención de respuestas obsoletas/recuperación con versión antigua.
La nulabilidad detectada durante build del cliente quedó corregida antes del build final.

El único fallo final es **preexistente y ajeno a E2**:
`backend/test/local-profile-dashboard-bootstrap.spec.ts:100` compara directorios con
separadores `/`, pero `node:path.dirname` devuelve `\` en Windows. Los cinco directorios
son los esperados; falla su representación. El archivo está sin modificaciones en Git.
No se corrigió ni se presenta esa suite como aprobada.

## Integridad y límites

Archivos nuevos de esta etapa:

- `backend/src/prematricula/prematricula.module.ts`, `.controller.ts`, `.service.ts`
  y `prematricula-error.filter.ts`: API, validación, reglas y persistencia del borrador.
- `shared/prematricula-api.mjs`, `.d.mts`, `.test.mjs`: contrato E2-LOCAL-1 y validadores.
- `backend/test/prematricula-service.spec.ts`: 18 pruebas E2.
- `client/src/screens/StudentPreEnrollment.tsx` y `.css`: panel compacto dentro de la ruta previa.
- `client/src/data/prematricula.ts` y `.test.ts`: adaptador HTTP, correlación de respuestas y calendario.
- `client/scripts/verify-e2-prematricula.mjs`: aceptación real bifásica con publicación E1.
- Plan, contrato, guía y workflow `prematricula-e2-draft`/`prematricula-e2`, más esta evidencia.

Archivos reutilizados con cambios mínimos:

- `backend/src/app.module.ts`: registro E2 condicionado a ambos modos locales.
- `backend/src/programacion-academica/demo-module.ts`, `demo.controller.ts`,
  `demand-estimator.ts`, `demand-fixtures.ts`: exportaciones reutilizables.
- `backend/src/programacion-academica/saved-draft-store.ts`: tipo genérico, mismo mecanismo E1.
- `client/src/routes/alumnoWebSum.v2.reportes.prematricula.tsx`: añade panel, conserva reporte y loader.
- `client/src/components/SectionPickerDialog.tsx`: presentación compartida, wrapper E3 conservado.
- `client/src/data/sumEnrollmentTable.ts`: tipos genéricos de elegir/retirar; mismo comportamiento.
- `scripts/academic-compose-config.test.mjs`: amplía comprobaciones de flags y exclusión pública.

Cambios mínimos compartidos: registro condicionado del módulo, exportación de
clasificadores existentes y del guard HTTP E1, exportación de SavedDraftService y
parámetro genérico del store sin cambiar su comportamiento. Namespace E2
`e2-prematricula` dentro del volumen durable existente, separado de los JSON E1.
Checksum, escritura atómica y control de versión para un único backend escritor;
no es almacenamiento distribuido ni autenticación institucional.

Los diez archivos de generador/validador/cálculo coinciden por SHA256 con la línea
base de E1. Sin diff en reglas, fixtures, servicios de matrícula, contratos E3,
WeeklySchedule, package.json ni lockfiles. Los cambios Docker existentes son de
etapas anteriores, conservados; E2 no requirió cambios Docker o nuevas dependencias.

Solo dos perfiles regulares de Sistemas; corte de historial2026-1, equivalencias
regulares explícitamente conocidas y vacías. La prueba positiva de reconocimiento
usa una proyección sintética aislada del clasificador, no modifica el historial regular.
No hay intención registrada, agregados, reserva, aprobación E2, integración E3 o
predicción de matrícula. La demo local permite elegir ambos perfiles; no prueba
identidad real. La protección depende de conservar el volumen; no se añadieron
backups, migraciones ni múltiples escritores. No se ejecutó un simulador público.
