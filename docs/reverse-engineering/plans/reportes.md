# Plan persistente: Reportes, Programación y Plan de Estudios

**Revisión vigente: R2, 2026-10-14 (America/Lima), ajuste de fidelidad del cliente sintético.** La sección R2 al final gobierna el trabajo actual. Las secciones R1 siguientes preservan el cierre histórico de 2026-10-08: sus fixtures DEMO, perfiles Medium y ausencia de observación de producción no describen la sesión actual. El cierre funcional R1 no acredita fidelidad de la rama `synthetic-actors` incorporada posteriormente.

- **ID:** `reportes-2026-10-08`; revisión 1, 2026-10-08.
- **Objetivo:** completar Pre-Matrícula, Matrícula, Horarios, Evaluaciones y Deudas con datos sintéticos servidos por NestJS propio y verificación cliente → API local. Reutilizar las cinco rutas, pantallas, adaptadores, CSV, shell y scaffold actuales.
- **Estado:** implementación y verificación funcional local completadas por implementadores y principal; ver workflow y evidencia local. El planner original solo produjo el handoff documental.
- **Restricciones:** evidencia B proporcionada/histórica y A local; sin autorización de producción en esta tarea, sin nueva adquisición de evidencia. No recuperar internos privados SUM. Preservar cambios ajenos ya presentes. Implementación propia en `backend/` por instrucción de sesión; no crear `server/`. Planner solo modifica este plan y el contrato.
- **Entradas vigentes:** cinco `screens/reportes-*.md`, `evidence/sum/reportes-*/{structure,interactions,measurements}.md`, `coverage-matrix.md`, `existing-evidence.md`, rutas frontend, plan histórico `docs/superpowers/plans/2026-10-07-raw-types-api.md`, tipos candidatos y capa de datos actual. Se conserva su cobertura; se completan solo tipos opacos e integración ausente.
- **Contrato fijado:** [reportes-api-v1](../contracts/local-api/reportes.md), fuente única para los dos implementadores. Ningún worker modifica contrato/plan ni archivos de otro responsable. Cambios de interfaz se devuelven al principal antes de implementarlos.

## Decisión que requiere Sol

Complejidad alta (cinco vistas, loader raíz y dos proyectos); incertidumbre media (filas de evaluaciones/deudas opacas y configuración global del cliente); impacto alto en la frontera de arquitectura. El scaffold `backend/` ya existe, mientras la política general menciona `server/`, y un modo API global exigiría endpoints ajenos al alcance para cargar el root loader.

Decisión `local-only`: conservar scaffold; cinco POST compatibles más `formulario` para resumen; nuevo modo `local` híbrido que consulta solo esas seis claves; tipos propios evaluaciones/deudas; repository readonly determinista, sin ORM/auth/escrituras; CSV cliente existente; proxy local sin credenciales y desactivar telemetría Observe de plantilla. Esta decisión cierra la incertidumbre de frontera y permite tareas delimitadas Luna; no revela arquitectura SUM. Perfil de planificación configurado `.codex/agents/sum-planner.toml` = `gpt-6.1-sol/high`; registrar selección efectiva del hilo en workflow por el principal, sin inferirla del texto.

## Invariantes de alto impacto

| ID | Invariante | Comprobación prevista |
| --- | --- | --- |
| I-01 | Solo API propia local; ninguna sesión, proxy, credencial o telemetría hacia SUM/Observe. | Config/diff + requests locales; proxy literal loopback; credenciales omitidas en local. |
| I-02 | Cada consulta es readonly aunque su método sea POST; no matricula, paga ni cambia catálogos. | R-INVALID/R-REPEAT/R-CSV; comparar lecturas y reinicio. |
| I-03 | DTO query validado en runtime y filas malformadas no se muestran como vacío. | R-INVALID, boundary cliente y error visible. |
| I-04 | Resumen y datos pertenecen al mismo fixture DEMO-001/2026-2; relojes/reinicios no alteran seed. | R-HTTP/R-UI/R-REPEAT. |
| I-05 | Evaluaciones/deudas usan contratos locales explícitos, no assertions de unknown ni tipos privados inventados. | Diff tipos/adaptadores/validación y R-UI/R-EMPTY. |
| I-06 | Archivos de client y backend disjuntos; contrato inmutable durante implementación paralela. | Handoffs, inventario de diff y escalamiento si cambia frontera. |

Atomicidad/cupos/idempotency keys no aplican a escrituras: no hay escrituras. Concurrencia se cubre como lecturas independientes e inmutabilidad; no añadir mecanismo de matrícula.

## Tareas pequeñas e interfaces

La división contractual precede implementación. Como máximo dos implementadores concurrentes, ninguno delega. B-01–B-03 y C-01–C-03 pueden ser secuenciales dentro de un responsable por árbol; ambos árboles pueden avanzar en paralelo desde P-01. Reparaciones 0/1 por tarea; ante un fallo persistente devolver diagnóstico al principal, sin relanzar para resetear contador.

| ID | Resultado/dependencias | Perfil previsto | Archivos exclusivos | Aceptación/verificación prevista | Estado |
| --- | --- | --- | --- | --- | --- |
| P-01 | Contrato y descomposición. Reutiliza specs/fixtures/scaffold. | sum-planner; Sol High configurado | Este plan y `contracts/local-api/reportes.md` | Campos/errores/fixtures/config/escenarios definidos; lectura documental, sin tests. | lista |
| B-01 | Catálogo/DTOs propios y repositorio de copias. Dep. P-01. | sum-implementer; Luna Medium | `backend/src/reportes/reportes.types.ts`, `reportes.fixtures.ts`, `reportes.repository.ts`, `dto/consulta-reporte.dto.ts` | Tipos exactos contrato; populated/empty reproducibles; alumno completo; sin imports runtime cliente. | completa |
| B-02 | Servicio/controller/módulo/validación HTTP. Dep. B-01. | mismo responsable backend | `backend/src/reportes/reportes.service.ts`, `reportes.controller.ts`, `reportes.module.ts`, `consulta-reporte.pipe.ts` | Seis POST/accion exactos; 200 éxito/400 validación; query/body validados; sin nuevos paquetes. | completa |
| B-03 | Registrar módulo y bootstrap local sin Observe. Dep. B-02. | mismo responsable backend | `backend/src/{app.module,main}.ts`, `backend/README.md`; `backend/package.json` solo si comando requiere corrección; mantener lock coherente si se cambia | Loopback/PORT; no telemetría; comandos existentes build/lint ejecutados tras implementación; no tocar tests scaffold ajenos sin necesidad. | completa |
| C-01 | Tipos locales y filas/adaptadores evaluaciones/deudas. Dep. P-01. | sum-implementer; Luna Medium | `client/src/data/reportes.ts`, `contracts.ts`, `transport.ts`, `adapters.ts` | Runtime valida nuevas formas; conservar mocks vacíos actuales y raw-types; adaptadores exactos tabla; no regresión otras claves. | completa |
| C-02 | Modo local híbrido, proxy local y dev:local reproducible. Dep. C-01. | mismo responsable client | `client/src/data/{config,api,client}.ts`, `client/vite.config.ts`, `client/.env.example`, `client/package.json`, `client/scripts/dev-local.mjs` solo si launcher necesario | Solo 6 claves HTTP en local; base relativa; credentials omit; abort/retry preservados; desarrollo/preview proxy. Mock/api compatibles, mock predeterminado, scripts verify intactos. | completa |
| C-03 | Renderizar nuevas filas/vacíos manteniendo resto de vistas y CSV. Dep. C-01–02. | mismo responsable client | `client/src/screens/TableScreens.tsx`; cinco `client/src/routes/alumnoWebSum.v2.reportes.*.tsx` solo si necesario; `client/src/components/RouteStatus.tsx` solo ante retry defectuoso; `client/src/App.css` solo para brecha estructural respaldada | Encabezados/rutas/resumen existentes; evaluaciones/deudas no descartan datos; cinco vacíos; sin filtros/selector fixtures/descargas nuevas. Build/lint de cliente tras implementación. | completa |
| V-01 | Verificar integración real y preservar evidencia sintética. Dep. B-03+C-03. | principal/checks; sum-fullstack-verify, Luna Low solo si aporta valor | `evidence/local/reportes/{behavior,verification}.md`, resultados/capturas sintéticas bajo esa carpeta; scripts de comprobación solo tras asignación explícita | R-HTTP, R-INVALID, R-UI, R-EMPTY, R-RETRY, R-REPEAT, R-CSV, R-GUARD; nunca mocks solos para declarar integración. | completa |
| P-02 | Actualizar estado real del plan y workflow. Dep. V-01. | principal | Este plan después de liberar propiedad planner; `workflows/reportes.md` | Registrar archivos, comandos/resultados, reparaciones, fidelidad por criterio y brechas. | completa |

C-01–03 tienen un solo propietario para evitar solapar `contracts.ts`, `api.ts` y `TableScreens.tsx`. B-01–03 otro, usando skill `sum-backend-implement` con excepción de ruta `backend/` y sin renombrar. Si se realiza ejecución mediante Luna High por carga de pasos, usar perfil real `sum-executor`; no agregar otro planner.

## Criterios obligatorios y límites

- **Frontend:** navegación directa y menú a cinco rutas existentes; títulos/resumen; columnas 8 prematrícula, 5 matrícula, 5 evaluaciones, 6 deudas y semana 7 días; loading/error/retry accesibles existentes; filas sintéticas legibles; CSV solo dos reportes.
- **Comportamiento:** cinco lecturas, no mutaciones; vacíos deterministas; retry tras restaurar backend; descargas CSV locales de filas recibidas.
- **API propia:** seis rutas exactas, DTO query/body validado runtime, envelopes/HTTP exactos; evaluaciones/deudas tipadas; datos sintéticos sin secretos.
- **Persistencia:** catálogo readonly; recarga y reinicio reproducen datos, selección empty solo env proceso; sin persistencia/side effects de escritura.
- **Integración:** R-* completos con cliente modo local y NestJS en loopback, observar requests reales y efectos de parada/restauración. Mock o build/lint por sí solos no bastan.
- **Fidelidad:** estructura/rótulos trazables a notas existentes. Sin referencia sanitizada comparable para paridad visual ni comportamiento de descargas SUM; registrar límites, sin certificar filas/reglas/errores SUM. No realizar producción para cerrar esa brecha.

Comandos previstos, no ejecutados por planner: `pnpm --dir backend build`, `pnpm --dir backend lint`, `pnpm --dir client build`, `pnpm --dir client lint`. Leer scripts vigentes antes de usarlos. No escribir tests nuevos; el principal comprueba HTTP y navegador local reales en V-01. Una reparación automática máxima; fallo persistente exige diagnóstico específico, no repetición ciega ni revisión Sol rutinaria.

## Huellas de entrada

SHA-256 antes de implementación (2026-10-08). Si el principal completa specs para enlazar este contrato, conservar estas huellas como snapshot, no invalidar trabajo por cambio documental equivalente.

| Entrada | SHA-256 |
| --- | --- |
| screens/reportes-prematricula.md | `6b798a76736ec7c5b0647372800f4a5ee352a85595309112e7bcec069a1719a2` |
| screens/reportes-matricula.md | `e237d5a0b948d6fad5f9fda9f4794bb4794701ec77d828f6035381b6e836c676` |
| screens/reportes-horarios.md | `dec3ed05215f403e5de82d0cdba2c567c76f42b4f60336bbbeebf6c892772ff9` |
| screens/reportes-evaluaciones.md | `22a1e5d61b657ed112b5f81a50f20c5b0ccb0641a5e587b57cc323b14397fec7` |
| screens/reportes-deudas.md | `dc6faaec94d5cc955c257b2a1e8433fc0ade88e8acfe4902b90f008cfed86393` |
| client/src/data/endpoints.ts | `6f3cb0ad658473c70aa0b46aca5749a5e98ac70022dbae3d5dd5c3a7bad07236` |
| client/src/data/mocks/responses.ts | `2f87df4a5c6b135ee5359060d8db8636673956819c44adc7ac491c0485617947` |
| backend/package.json | `6e65d98487ca78d8367c884158d5c084adb87540c86435ee7487d6261929cccd` |

## Resultado de planificación

Contrato listo y tareas definidas; no frontend/backend implementado por este planner, no pruebas ejecutadas, no delegación ni navegador/red. La brecha de referencia permanece registrada una vez; no bloquea la API sintética propia ni las verificaciones locales del alcance.

## Cierre por el principal

Los ocho escenarios del contrato, build/lint de ambos proyectos y dos escenarios de frontera aprobaron. REA capturó navegación y HTTP locales; detalles en [workflow](../workflows/reportes.md) y [verificación](../../../evidence/local/reportes/verification.md). Sin paridad visual certificada ni inspección de producción. La política posterior exige Luna High y skills propias de client/backend; los perfiles previstos Medium de la tabla son historial del plan inicial.

## R2 — Restaurar las interfaces SUM sobre los contratos sintéticos vigentes

### Alcance y estado

El usuario solicita comparar con REA y corregir siete pantallas existentes: `/alumnoWebSum/v2/matricula/programacion`, las cinco rutas `/alumnoWebSum/v2/reportes/{prematricula,matricula,horarios,evaluaciones,deudas}` y `/alumnoWebSum/v2/planEstudios`. La fidelidad visual y de interacción al SUM, la conservación del shell y la reutilización de interfaces existentes son criterios obligatorios. No se autoriza rediseñar el dashboard ni el flujo de matrícula regular.

Estado de esta revisión: **implementación cliente realizada; verificación REA posterior al cambio pendiente**. La comparación estructural REA se había recogido antes de implementar. El cliente ahora proyecta las vistas descritas abajo desde el contrato sintético existente, sin cambios de backend/contratos. Build, lint y test:data pasan; resultados y límites están en [verificación local](../../../evidence/local/reportes/verification.md#corrección-de-presentación-r2-2026-10-14). Aún no hay captura posterior al cambio ni aceptación visual/integrada.

El solicitante declaró explícitamente autorizados la cuenta y SUM de producción, con alcance de solo lectura para estas pantallas, menús, pestañas y scroll; confirmaciones de la sesión, fecha de registro 2026-10-14, sin expiración indicada. Las observaciones REA suministradas al planner ya se habían recogido por el coordinador. Este handoff no autoriza nueva inspección de producción. Se registran únicamente IDs y estructura genérica: ninguna fila personal, identificador de cuenta, sesión o imagen de producción.

### Fuentes revisadas y límites

- [Contrato de reportes existente](../contracts/local-api/reportes.md), `reportes-api-v1`, conserva las ramas legacy y sus decisiones locales; no se migra ni duplica.
- [Contrato de dashboard sintético](../contracts/local-api/local-profile-dashboard.md), `LPD-CONTRACT-1`, y [decisiones LPD-DEC-1/1a](local-profile-dashboard-decisions.md): autoridad de identidad, consultas y payloads en `synthetic-actors`. Se preservan las aclaraciones de sesión ya vigentes en código; esta revisión no decide persistencia, renovación ni login.
- [Contrato de matrícula regular](../contracts/local-api/matricula-regular.md), MR2 más campos opcionales MR3: única fuente de `Context`, `EnrollmentReport`, oferta, secciones y horarios sintéticos.
- Especificaciones existentes de [Programación](../screens/programacion-asignaturas.md), [Plan](../screens/plan-estudios.md), [Prematrícula](../screens/reportes-prematricula.md), [Matrícula](../screens/reportes-matricula.md), [Horarios](../screens/reportes-horarios.md), [Evaluaciones](../screens/reportes-evaluaciones.md) y [Deudas](../screens/reportes-deudas.md): rótulos y estructura histórica revisados, sin promover datos ni comportamientos no observados.
- [Plan de matrícula regular con interfaz SUM](matricula-regular-sum-ui.md) ya especifica la vista del reporte aceptado. Reutilizar su implementación disponible cuando sea compatible; no repetir su implementación ni modificar sus otras pantallas. El reporte del menú estaba fuera de su alcance histórico, pero está dentro de la autorización actual.

Los siguientes registros son `observed`, según el handoff REA del coordinador de 2026-10-14. La referencia de producción no fija facultad/periodo universal; los valores de cuenta fueron omitidos. Local: actor independiente `SYN-SIS-A`, SISTEMAS, 2026-II, dashboard sintético aislado. Las cantidades DOM describen el estado observado, **no son cantidades de filas que deban fabricarse para aceptación**. TR incluye cabeceras, agrupaciones y vacíos.

| Pantalla | Referencia REA producción | Local REA con perfil activo | Brecha sustentada |
| --- | --- | --- | --- |
| Programación | `ev_15228519b7abc45d2ff872781e407ebcdc5795b9aa743c7aa6e8abe11259bb1e`: 2 tablas, 178 TR, 13 TH, 1.401 TD, 4.070 nodos | `ev_97192f0544661f965757542c2d1434602cf176d091d836f43ff40d29aea27ec7`: 6 tablas, 35 TR, 34 TH, 180 TD, 797 nodos; captura sintética `ev_0803231a50a498c2071e952430462bf8a8c5c2d8cc36391cea0e30a17f4b2c7d` | Local antepone paneles de calendario/procedencia/requisitos y tabla de tres cursos; falta composición de resumen, descarga, búsqueda y programación por secciones. |
| Prematrícula | `ev_2babd216e7bf24d2a47230c1c1cc6eb8c323f9f763d3b664fab5077a79bd74a8`: 1 tabla, 5 TR, 8 TH, 32 TD | `ev_f07d3e4d91a324798aa04f1c8a7af80cf55c1e6c6a5af4413225b883fd6d06e4`: 5 tablas, 31 TR, 30 TH, 168 TD | Paneles genéricos sustituyen la tabla de ocho columnas. |
| Matrícula | `ev_8c2f1e487e091b8b30265b131d07d3d37a534076a3300746985967c2232873a9`: 2 tablas, 5 TR, 5 TH, 20 TD | `ev_082e29e0bcd4f221d17ae078dc123beb09280c83cbe79881942580a91399ca85`: 164 nodos, encabezado local sin tabla ni periodo | La ausencia de matrícula sintética debe conservar la estructura de reporte y explicar el vacío. |
| Horarios | `ev_0d3d89dacd4e133ff34fa1e2eadb39db2513eed55755cdc4ea36abc3d10aa212`: resumen y cuadrícula semanal, sin TABLE HTML, 1.033 nodos | `ev_9a9dbd942ab258cc5a4b49278fad57e22d761fdb85f3cf1be33c19c591069bc6`: solo encabezado, sin cuadrícula/resumen | Falta la estructura semanal incluso sin matrícula confirmada. |
| Evaluaciones | `ev_627857063543b1c767c73a6a5ab4a9d859250f14636dabba33c26cfd5a2ec029`: 1 tabla, 13 TR, 5 TH, 60 TD | `ev_61c36bac1e4051d8cfcb04e81f197523528536c039b75b96793a88a14ed3f87f`: 1 tabla, 2 TR, 5 TH, 1 TD | Columnas ya compatibles; diferencia de población legítima del fixture. No inventar evaluaciones. |
| Deudas | `ev_841adffea9e2a57ad827f62bd13f53a4d285f1de4b0b4f0c205995d4c653e4ca`: 1 tabla aparentemente vacía, 2 TR, 6 TH, 1 TD | `ev_9b200c8ea75e84b433b8f68751f951f70f572485685094599106b24c28a05e13`: 1 tabla vacía, 2 TR, 6 TH, 1 TD | Forma de vacío compatible; no se ha probado igualdad visual ni ausencia de obligaciones. |
| Plan | `ev_0fa44996036aa33b691177bb1b128c6bc8a50c486112a6987b653f86476d7953`: 1 tabla, 108 TR, 7 TH, 749 TD | `ev_95dc3cb9e4d63501bc71d457fc7e70725d35f5bb8de01efb2a06ed78c5af8298`: 6 tablas, 35 TR y tabla de tres cursos | Sustituir paneles genéricos por las siete columnas; la oferta local es parcial, no un plan completo. |

Producción se observó a 1295×887 y local a 1285×883. No hay igualdad de viewport, contenido ni necesariamente scroll/estado: estas pruebas sustentan brechas estructurales, **no paridad de píxeles**. No se inventan medidas, colores ni resultados de descarga. La tabla histórica de deudas poblada y la observación actual aparentemente vacía describen estados distintos; conservar ambas sin afirmar contradicción ni pago.

### Decisión Sol R2 y contrato de presentación fijado

La decisión de impacto es separar **la interfaz SUM ya disponible** de **la semántica local MR/LPD**. Volver directamente a los loaders legacy de `TableScreen` presentaría catálogos ajenos y rompería coherencia por actor; fabricar DTOs legacy con valores oficiales inventados también es incorrecto. La corrección es reutilizar componentes, columnas, clases y composición existentes con proyecciones puras del payload ya validado. No hay nueva API ni cambio de DTO, endpoint, validador compartido, repositorio o persistencia. Esta frontera fija la interfaz antes de cualquier reparto: **solo cliente, sin tarea backend**.

`client/src/data/localAcademicView.ts` conserva `LocalAcademicResponse = Context | EnrollmentReport | null`, `localAcademicContext` y `buildScheduleFromCommittedReport`; sus consumidores existentes siguen funcionando. Añadir allí únicamente proyecciones de presentación tipadas, no envelopes ni assertions que finjan un `ApiResponseMap` legacy. El renderer recibe filas/celdas y datos de horario explícitos; la capa de ruta conserva los loaders actuales. Si una modificación exige cambiar esta frontera, devolver diagnóstico al coordinador antes de implementarla.

| Vista | Fuente fija y correspondencia | Ausencia / límite local explícito |
| --- | --- | --- |
| Resumen compartido | Reutilizar `PageTitle`, `StudentSummary` y `useStudent` de la sesión activa, scope del mismo Context/Report. Mantener títulos/rótulos existentes de las rutas. | Mostrar solo la proyección de identidad ya disponible; no completar especialidad, nombres oficiales o códigos ausentes. No cambiar login, shell ni estado de sesión. |
| Programación | Aplanar `context.offer` por `sections`. Ocho columnas: primera indicadora vacía, Asignatura (`courseId` y `name`), Créd. (`credits`), Sec. (`label ?? sectionId`), Docente (`teacher`), Tope (`capacity`), Matriculados (`occupied`), Horarios (`section.schedule`). Agrupar por `cycle` conocido y reutilizar búsqueda y control/modal de horario existentes. | Sin ciclo/tipo/docente/aula no inferir valores. Ciclo desconocido se distingue de ciclo 0; la regla legacy 99→0 no se aplica a MR3. `schedule: null` es desconocido, `[]` es conocido vacío. No calcular elegibilidad ni cupos nuevos. |
| Prematrícula | Solo `context.preEnrollment`, en las ocho columnas existentes: Plan, Ciclo, Asignatura, Créditos, Nro. Rep, Nro. Mat. Equiv, Nro. Rep. Total, Etapa. Plan/curso/créditos vienen del documento; ciclo solo de oferta coincidente en ese scope si existe. | Contadores/etapa faltantes: `—`, sin asumir cero o aprobación; no usar toda la oferta como prematrícula. `preEnrollmentComplete` no inventa filas ni etapa SUM. Mensaje de parcialidad sintética fuera de la tabla. |
| Matrícula | Solo `EnrollmentReport.rows`, cinco columnas Ciclo, Asignatura, Créditos, Sección, Docente Asignado; usar `cycle`, `courseId/name`, `credits`, `label ?? sectionId`, `teacher`. Resumen, periodo y metadatos conocidos del mismo reporte; reutilizar reporte aceptado existente cuando sea compatible. | `null` mantiene título/resumen/periodo/tabla de cinco columnas y mensaje local de ausencia. No sustituir por oferta, no inventar fecha/tipo oficial. Esta página nunca confirma una matrícula por sí misma. |
| Horarios | Solo `EnrollmentReport.rows[].schedule` del mismo reporte. Conservar semana Lunes–Domingo usando la cuadrícula `WeeklySchedule` existente; día/minutos MR se proyectan directamente a eventos de presentación. | Sin reporte/eventos, conservar siete encabezados y cuadrícula vacía con mensaje local; no tomar horarios de oferta. No inventar tipo de hora/aula. Si se comparte el renderer, ampliar sus props de presentación de forma compatible con el caller legacy, sin construir filas HTTP ficticias. |
| Plan | Proyección parcial de `context.offer` en Esp., Asignatura, Créd., Tipo, Grupo, Pre-Requisito, Grupo. Curso/créditos y `courseType` conocido; prerrequisitos como IDs conocidos de `prerequisiteIds`, con nombre solo cuando está disponible en la misma oferta. | Especialidad/grupos ausentes: `—`. Explicar que son cursos conocidos de la oferta sintética, no plan íntegro ni certificación de prerrequisitos. Nunca generar 107 asignaturas para igualar la cuenta de producción. |
| Evaluaciones / Deudas | Conservar `TableScreen`, sus adaptadores, cinco/seis columnas y payloads de lectura existentes. Solo corregir brecha visual concreta demostrada; el estado vacío actual es válido. | Mantener notas sintéticas; vacío de evaluaciones no equivale a nota aprobatoria y vacío de deudas no significa pago. No agregar datos, filtros ni descargas nuevas. |

Para las vistas afectadas, remover del contenido principal los paneles `PreEnrollmentPanel`, `EnrollmentCalendarPanel` y `AcademicRequirementsPanel` que desplazaron la interfaz observada. Esos paneles siguen disponibles y sin cambio en Información de Matrícula y el flujo regular. Las notas necesarias de procedencia/parcialidad se conservan breves y claramente locales, sin dominar el layout.

Descarga y búsqueda conservan los comportamientos locales ya definidos: CSV explícitamente local, sin prometer PDF SUM. Programación mantiene su exportación de todas las filas disponibles aunque la búsqueda filtre la tabla; Prematrícula/Matrícula/Plan conservan los controles compatibles existentes y sus columnas, exportando datos conocidos y `—` para campos no disponibles. El resultado de descarga de producción sigue `unverified`. Modal de horario conserva cierre accesible, Escape y foco; no se agregan acciones de escritura.

### Invariantes adicionales de alto impacto

| ID | Invariante | Comprobación |
| --- | --- | --- |
| R2-I1 | Identidad, run, scope y reporte proceden del mismo actor; transporte/validación LPD/MR sin cambio. | Diff limitado y pruebas de proyección con SIS/SOFT; no consulta legacy para claves académicas sintéticas. |
| R2-I2 | Ninguna vista infiere reglas académicas, matrícula, pagos, historial ni plan completo desde filas ausentes. | Casos null/vacío/metadata ausente; ausencia de ceros, notas o filas fabricados. |
| R2-I3 | Shell, selector, sesión, recuperación y ejecución regular no se modifican. | Diff por archivos; navegación de las siete rutas y smoke de pantallas excluidas sin nuevos efectos. |
| R2-I4 | Reutilizar primero tablas, resumen, descargas, modal y calendario existentes; compatibilidad de callers legacy. | Build/lint, tests de adaptadores existentes, revisión del diff de componentes compartidos. |
| R2-I5 | Sin backend, contratos compartidos, snapshots privados, dependencia nueva ni acceso adicional a SUM. | Inventario de archivos y configuración del entorno sintético; todos los escenarios loopback/sintéticos. |

### Tareas pequeñas (estado de implementación)

Un solo implementador cliente secuencial evita conflictos entre vistas y componentes compartidos; un verificador local posterior puede ejecutar aceptación. No hay división client/backend porque el contrato HTTP queda congelado. Trabajadores no delegan ni usan producción. Todos reciben AGENTS raíz/cliente, esta R2, fronteras LPD/MR, restricciones de origen y obligación de preservar fidelidad visual e interacción SUM en las siete pantallas, reutilizando interfaces existentes. Se preservan ediciones ajenas. No usar skills de descubrimiento SUM obsoletas ni Playwright para este encargo; el navegador local queda bajo el coordinador con REA.

| ID | Dependencia / resultado | Archivos exclusivos del responsable | Aceptación / comprobación | Estado |
| --- | --- | --- | --- | --- |
| R2-P | Revisión de fuentes, decisiones y correspondencias anteriores | Este archivo, propiedad temporal del planner | Ningún contrato paralelo ni cambio de aplicación; enlaces y alcance comprobados | Completa documentalmente |
| R2-C1 | Dep. R2-P. Proyecciones puras por tipo, incluyendo vacíos, metadata opcional y reportes confirmados | `client/src/data/localAcademicView.ts`, `client/src/data/localAcademicView.test.ts` | R2-A2/A3/A4/A5 y actor/scope; sin DTO legacy inventado | Implementada; test:data pasa |
| R2-C2 | Dep. C1. Programación/Prematrícula/Plan en su composición SUM, conservando ramas `perfil`/`matriculaInfo` | `client/src/screens/LocalAcademicView.tsx` | R2-A1/A2/A3/A5; resumen, búsqueda, CSV y modal local; `matriculaInfo` conserva paneles | Implementada; build/lint pasan |
| R2-C3 | Dep. C1/C2. Matrícula/Horarios reutilizan reporte, también en vacío | `client/src/screens/LocalAcademicView.tsx`, `client/src/screens/WeeklySchedule.tsx` | R2-A4; reporte únicamente, semana vacía visible; callers legacy conservados | Implementada; build/lint pasan |
| R2-C4 | Dep. C2/C3. Revisión de Evaluaciones/Deudas | `client/src/screens/TableScreens.tsx` revisado; sin modificación | R2-A6; estructura y vacíos ya compatibles; sin cambios superfluos | Revisada; se conserva |
| R2-V | Dep. C1–C4. Verificación cliente y aceptación integrada local REA | Coordinador: `evidence/local/reportes/verification.md` y capturas exclusivamente sintéticas bajo `evidence/local/reportes/` | Ejecutar matriz siguiente y registrar esperado/real; un ciclo automático de reparación máximo y luego diagnóstico | Parcial: build/lint/test:data aprobados; captura REA post-cambio pendiente |

Las rutas y loaders no necesitan cambios para este contrato: el render debe consumir sus payloads actuales. Si apareciera una necesidad real de modificar una ruta, el coordinador asignará el archivo exacto; no extender propiedad a `__root`, `Shell`, sesiones, client config, backend o `shared/`. C4 pertenece al mismo implementador que C2/C3; no ejecutarlas en paralelo. No inicializar CodeGraph si ya hay índice/configuración válidos; si faltaran en una futura tarea, validar exclusiones antes de indexar según AGENTS.

### Matriz de aceptación prevista (solo datos sintéticos)

| Criterio / fuente | Escenario y comprobación | Resultado esperado | Resultado actual |
| --- | --- | --- | --- |
| R2-A1, `observed` estructura + `local-only` identidad | Elegir SYN-SIS-A mediante JS únicamente en selector local; navegar por links internos a las siete rutas, sin recargar para simular navegación SPA | Misma identidad/resumen, títulos/menú/shell existentes, cero paneles genéricos en Programación/Prematrícula/Plan; ningún request a SUM | Pendiente |
| R2-A2, observación Programación + correspondencia local | Oferta sintética con varias secciones, cycle conocido/desconocido, docente y horario null/[]/poblado; búsqueda coincidente/no coincidente/limpiar; abrir/cerrar Horarios y CSV | Ocho columnas; una fila por sección conocida; orden estable, sin ciclo inventado; búsqueda recuperable, modal accesible; cantidades y capacidad fieles al payload; CSV local exporta todas las filas disponibles | Pendiente |
| R2-A3, observación Prematrícula + correspondencia local | Context con preEnrollment diferente de offer, luego preEnrollment vacío y contadores ausentes | Ocho columnas, solo documentos de prematrícula; desconocidos `—`; vacío visible, sin equivalencias/etapa inferidas; CSV conserva columnas | Pendiente |
| R2-A4, observaciones Matrícula/Horarios + MR local | Proyección de reporte sintético aceptado independiente (unitaria), luego null; integración con el mismo reporte confirmado del actor cuando el entorno ya lo tenga, sin autoejecutar matrícula | Matrícula mantiene resumen/periodo/cinco columnas en ambos casos. Horarios mantiene siete días/cuadrícula; eventos solo del reporte y horas exactas. Null no muestra oferta ni inventa aceptación/fecha. Si no existe reporte local, registrar integración poblada pendiente sin fabricar uno ni atribuir paso a producción | Pendiente |
| R2-A5, observación Plan + límite LPD | Oferta parcial con prerrequisitos conocidos/no presentes, metadata opcional ausente y offer vacío | Siete columnas; IDs y créditos exactos, desconocidos `—`; aviso de subconjunto local; sin rellenar el plan ni derivar reglas | Pendiente |
| R2-A6, observación Evaluaciones/Deudas + LPD vacío | Abrir ambas rutas con sus payloads vacíos existentes; usar tests de adaptadores poblados existentes como regresión, sin cambiar fixture del dashboard | Cinco/seis columnas y mensajes sintéticos existentes; vacío no implica aprobación/pago; cero nueva descarga/acción | Pendiente |
| R2-A7, invariantes I1–I5 | Unitarias SIS/SOFT y null/optional, tests de datos existentes; build/lint; diff de APIs/archivos; revisión de Información de Matrícula, Perfil y flujo regular fuera de alcance | Sin contaminación entre actores ni llamadas nuevas, sin cambios backend/contratos/sesión; legacy sigue compilando y sus pruebas pasan | Pendiente |
| R2-A8, límite visual | REA local con viewport 1295×887, ruta/scroll/estado anotados; comparar estructura/rótulos con evidencia sanitizada disponible | Capturas solo sintéticas; tabla/resumen/toolbar/calendario en orden documentado. Diferencias de población/parcialidad declaradas; no afirmar píxel-paridad con la captura previa 1285×883 | Pendiente |

Comandos de implementación previstos, **no ejecutados por el planner**: `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data` (scripts vigentes revisados). Las pruebas unitarias nuevas se limitan a proyecciones que pueden confundir datos de oferta/aceptación o inventar campos; no agregar pruebas espejo de CSS. No ejecutar `client verify`, pues lanza Playwright y no corresponde al método pedido. El coordinador registra las observaciones REA locales y escenarios reales cliente→NestJS aislado; build/lint o unitarias por sí solos no acreditan integración.

### Brechas que permanecen explícitas

No están verificados píxeles, viewport equivalente de todos los estados, comportamiento de descarga SUM, red/payload de producción, vacíos/errores alternativos SUM, ni plan completo de cada escuela. Datos distintos entre producción y el fixture son esperables. Evaluaciones/Deudas no necesitan cambios de población para aprobar estructura. No convertir esta revisión en nuevas reglas académicas ni en recuperación de backend privado. El cierre requiere resultados reales de la matriz, separados en fidelidad estructural, comportamiento local e integración; hasta entonces permanece pendiente la implementación.
