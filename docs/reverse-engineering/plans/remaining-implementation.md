# Plan incremental de implementación pendiente

- ID `remaining-implementation-2026-10-08`, revisión1, **lista** para Luna High; contrato fijo [RI-CONTRACT-1](../contracts/local-api/remaining-implementation.md).
- Cierre de ejecución: RI-B1–B5, RI-C1–C6, RI-V1–V3 y RI-D1 completados e integrados localmente el 2026-10-08. Los estados «lista/pendiente» en la tabla de handoff conservan la asignación inicial; los resultados finales están en [workflow](../workflows/remaining-implementation.md) y [verificación](../../../evidence/local/remaining-implementation/verification.md). Fidelidad SUM pendiente de evidencia autorizada.
- Extensión posterior independiente: [SP-2026-10-08 / sidebar durante carga](sidebar-pending.md), contrato UI `SP-UI-1` listo para Luna High. Conserva el cierre RI y sus contratos HTTP; implementación/verificación SP pendientes. Planificador real `sidebar_pending_plan`, perfil sum-planner GPT-6.1 Sol High, solo documentación.
- Planner real `remaining_scope_plan`, perfil configurado sum-planner GPT-6.1 Sol High. Propiedad exclusiva: este plan y el contrato nuevo. Sin código, browser, producción ni subdelegación. Cambios previos del workspace se conservan.
- Objetivo del encargo posterior «Realízalo»: cerrar brechas factibles de las16pantallas con API propia y datos sintéticos; reutilizar lo implementado/aceptado. Aceptación local integrada para las extensiones de lectura; fidelidad visual integral no forma parte de un resultado acreditable con las fuentes actuales.
- Complejidad alta (adaptadores compartidos, tres módulos y rutas); incertidumbre media (estados/acciones SUM no observados); impacto medio y frontera de alto impacto para aislamiento de modos, identidad y no ocultar fallos. Sol decide esa frontera antes de dividir archivos; Luna recibe unidades sin decisiones académicas abiertas.

## Reutilización y brecha real por área

| Pantallas / artefacto vigente | Estado reutilizado | Brecha asignada |
| --- | --- | --- |
| Inicio / screens/inicio.md | Shell y resumen desde formulario raíz HTTP local; bento/destinos locales vigentes | Sin nueva implementación; navegación/regresión local. Sin referencia segura para visual fiel. |
| Perfil / mi-informacion-api-v1 | Backend28campos readonly aceptado; loaderperfil existe | Añadir claveperfil HTTP local; domicilio/panel académico usan valores del DTO. |
| Historial / planmi-informacion | Backend3asignaturas/12créditos/promedio15; cliente fixed8/28/2026-1 y tabla vacía | Loader local, runtime, resumen/periodos/filas y búsqueda local en datos recibidos. |
| Formulario / mi-informacion-api-v1 | **YaHTTP local** por claveformulario/root loader; secciones8 vienen del backend | Consumir secciones/valores reales y nulls; evitar lookup/perfil placeholders en local. |
| Ficha / mi-informacion-api-v1 | Backend13secciones/familiar sintético aceptado; cliente catálogo y tabla vacía | Loader local propio, campos/familiares reales con acciones readonly. |
| Información de Matrícula / plans/matricula-informacion.md | Implementado; once escenarios MI-* aprobados en evidence/local/matricula-informacion/integracion/check-results.json (timestampUTC2026-10-09, fechaLima2026-10-08); principal confirma client test:data21/21 | Reutilizar como concluido; regresión solo por modificaciones compartidas. No reimplementar. Workflow anterior pendiente es histórico superado por resultados nuevos; root actualiza su estado. |
| Programación / plans/matricula.md | Tabla7columnas/modal5/CSV ya implementados; estructura modal de observación operadora sanitizada | Backend readonly8cursos,16horarios; transporte/validación local real. |
| Cinco Reportes / plans/reportes.md y contrato | Backend y cliente local existentes; tipos evaluaciones/deudas ya propios | Reutilizar aceptación y comprobar regresión por edits data/TableScreens; ningún módulo nuevo. |
| Asistencias / asistencia-api-v1 | API/integración previas existentes; calendario deshabilitado | Reutilizar, regresión breve; no calendario supuesto. |
| Tutoría / workflowtutoria simulado | Solo estado vacío observado; unknown[] legacy no define filas | Backend[] concreto; transporte real y rechazo local de filas no especificadas. |
| Plan de Estudios / spec vigente | Tabla7columnas/CSV/mocks8filas existentes | Backend readonly con forma raw completa vigente y validación local. |
| Manuales / spec y tutorialResources | Nueve artículos estáticos; destinos no observados | Sin backend ni enlaces/descargas supuestos; verificar composición disponible y contenido vigente. |

Fuentes: AGENTS raíz/client/backend, sum-workflow/model-routing y sum-evidence-to-spec/behavior-contract; specs/cobertura/notas B vigentes; consultas CodeGraph antes de localizar código, fuente actual de api/transport/contracts/endpoints/Profile/StudentForms/TableScreens/adapters/CourseScheduleModal/mocks y módulos MiInformación. Artefactos A acreditan solo réplica. No recuperar internos SUM ni observar producción. Contrato nuevo agrega compatibilidad cliente a MI sin editar documentos históricos.

## Decisiones Sol y categorías de certeza

**Observado:** títulos/rutas/columnas/grupos de las notas; Tutoría vacío y tarjetas Manuales; estructura modal Horarios desde descripción sanitizada de artefacto operador. No se observaron acciones mutadoras, respuestas de descarga o destinos Manuales.

**Hipótesis:** tipos raw y nombres de acciones candidatos pueden describir una API legacy, pero no hay tráfico que pruebe su semántica. Bandera habMatricula, topeAlumnos y prerrequisitos no prueban reglas, permisos o capacidad SUM. No incorporarlos como reglas.

**Decisiones locales fijas:** readonly/memoria/copia/actor único; formas compatibles completas en Programación/Plan para conservar adaptadores y evitar una migración grande; Tutoría[] únicamente; Manuales sin API; modo local consume payload validado y fallos visibles; modos mock/api conservan vistas anteriores para Historial/Ficha/Formulario y no contactan nuevos endpoints supuestos. Historial puede filtrar por curso en memoria, sin umbral de aprobación ni cálculo nuevo.

Sol fue necesario para resolver la frontera entre campos candidatos, datos existentes y ampliación integrada: un mock poblado no acredita SUM; representar unknown[] con filas o conectar tarjetas a URLs inventadas ampliaría la evidencia. El contrato deja las dudas de fidelidad pendientes sin bloquear la lectura propia. No se necesita otra revisión Sol para ejecución rutinaria. Escalar solo contradicción de contrato, necesidad de nuevo efecto persistente o fallo después de una reparación con pregunta concreta.

## Invariantes de alto impacto

| ID | Invariante / verificación |
| --- | --- |
| RI-I1 | Ningún HTTP/red/proxy SUM, sesión, auth o dato real. Auditar diff y externalRequests=[] en navegador local. |
| RI-I2 | Actor únicoDEMO-001/contexto de ReportesRepository; formulario conserva un handler. HTTP identidad y equivalencia de reportes. |
| RI-I3 | En local, cada área integrada consume HTTP validado; response inválida/error jamás se convierte en mock, vacío o No registrado. RI-CONTRACT/RECOVERY. |
| RI-I4 | Formulario ya conecta: consumir secciones desde root loader sin petición redundante ni duplicar ownership/backend. RI-MI-UI. |
| RI-I5 | IDs de campos distinguen rótulos repetidos; null es ausencia conocida, no Dato de demostración. RI-MI-UI/EMPTY. |
| RI-I6 | Nuevas claves Historial/Ficha jamás originan peticiones api legacy; ramas legacy preservadas y fixtures nuevos solo sintéticos. RI-MODES. |
| RI-I7 | Ninguna lectura modifica matrícula, cupos, finanzas, formulario o familia; flags/prerrequisitos no habilitan actos. RI-READONLY y botones disabled. |
| RI-I8 | Repositorio exportado único por DI; fixtures deepclone y env estricta; lecturas/reinicio deterministas. RI-HTTP/READONLY/CONFIG. |
| RI-I9 | Tutoría local no acepta filas sin contrato; Manuales no necesita API. RI-TUTOR/MANUALES. |
| RI-I10 | Un propietario de todos archivos cliente compartidos y uno de app.module/backend; contratos fijos antes del despacho. Sin edits concurrentes a data/TableScreens. |
| RI-I11 | Capacidad y prerrequisitos son campos de presentación, no reglas académicas; no agregar auth/DB/ediciones o pruebas de carga. Diff y endpoints readonly. |

## Handoff y secuencia

No despachar hasta registrar RI-CONTRACT-1 fijo. Principal posee aceptación integrada, browser secuencial, workflow/evidence/estado del plan y contratos. Worker no está solo; conserva cambios ajenos y no modifica otra capa, documentos raíz/configuración ni delega. Releer estado actual antes de cada fase porque hay numerosas modificaciones preexistentes.

**B**, sum-implementer o sum-executor GPT-6 Luna High: `backend/AGENTS.md`, `backend/.agents/skills/sum-nestjs-implement/SKILL.md`, `sum-nestjs-verify/SKILL.md`, apoyo nestjs-best-practices para módulos/DI/repositorios/pipes y oxlint para checks. Propiedad exclusiva `backend/src/programacion/**`, `backend/src/plan-estudios/**`, `backend/src/tutoria/**`, `backend/src/app.module.ts`, sección nueva `backend/README.md`. No edits módulos actuales/common/Reportes/MI salvo diagnóstico vuelto al principal. Todos app.module registros pertenecen B y se hacen una vez. Context7 obligatorio si necesita sintaxis/docs actuales; reutilizar patrón existente sin consulta genérica innecesaria.

**C**, sum-executor GPT-6 Luna High: `client/AGENTS.md`, `client/.agents/skills/sum-react-implement/SKILL.md`/sum-react-verify; router data-loading solo si modifica loader/estados. Propiedad exclusiva `client/src/data/{api,contracts,endpoints,transport,adapters,client}.ts`, nuevo `data/miInformacion.ts`, `data/programacion.ts`, `data/planEstudios.ts`, `data/tutoria.ts`, `data/mocks/responses.ts` (solo dos claves nuevas), cuatro rutas`alumnoWebSum.v2.informacion.{perfil,historial,formularioDatos,fichaSocioeconomica}.tsx`, tres rutas`alumnoWebSum.v2.{matricula.programacion,planEstudios,tutoria}.tsx`, `screens/{Profile,StudentForms,TableScreens}.tsx`. `data/api.test.ts`/contracts.test.ts/adapters.test.ts solo ajustes de expectativas directamente afectados si verificación de suites está autorizada. Sin rediseño/estilos/router raíz/raw-types/backend. Helpers locales van en archivos asignados; no abrir ownership global por comodidad.

B/C pueden coexistir con archivos disjuntos tras contrato fijo. Internamente **cada worker secuencia tareas**, sin subagentes. C-MI y C-CATALOG nunca se ejecutan con implementadores distintos concurrentes porque comparten api/transport/contracts/TableScreens. Si principal libera un worker para otra fase, conserva esa exclusión.

| ID / salida | Dependencias e interfaz | Archivos exclusivos | Aceptación de unidad | Estado / reparación |
| --- | --- | --- | --- | --- |
| RI-P1 fijar contrato/plan | Evidencias/contratos vigentes | Estos2docs | DTOs/seed/empty/errors/modos/criterios y ownership precisos | completada documental;0 |
| RI-B1 tipos+fixtures Programación | RI-P1, RI-PROG | backend/src/programacion/programacion.types.ts y .fixtures.ts |8cursos/16horarios completos, sin imports client, contexto por parámetros | lista;0 |
| RI-B2 repositorio/servicio Programación | RI-B1, ReportesRepository exportado | misma carpeta .repository.ts/.service.ts |envPROGRAMACION_FIXTURE estricto; deepclone/readonly; respuesta concreta | lista;0 |
| RI-B3 tipos/fixture/repo/service Plan | RI-P1, RI-PLAN | backend/src/plan-estudios/plan-estudios.{types,fixtures,repository,service}.ts |8filas/empty, plan común y env estricto; no cálculo de prerequisitos | lista;0 |
| RI-B4 Tutoría vacío | RI-P1, RI-TUTOR | backend/src/tutoria/tutoria.{types,repository,service}.ts |data[] concreta/copia, sin forma de fila/env innecesaria | lista;0 |
| RI-B5 fronteras y registro | RI-B2/3/4 | tres carpetas controller/module/consulta-*.pipe.ts/dto, app.module.ts/README |pipesreadonly comunes;3POST200; registro único; docs comandos fixture | lista;0 |
| RI-C1 DTOs MI y validator local | RI-P1, contratoMI-v1 | data/miInformacion.ts/contracts.ts/transport.ts |validar campos usados y arrays; secciones8/13, IDs/nulls/formularioextendido, fecha y números | lista;0 |
| RI-C2 transporte MI/modos | RI-C1 | data/api.ts/endpoints.ts/client.ts/mocks/responses.ts |perfil3claves añadidaslocal; formulario existente; helpernull no-local; mock nuevohist/ficha sin nuevaspeticionesapi | lista;0 |
| RI-C3 Perfil/Historial UI | RI-C2 | Profile.tsx/TableScreens.tsx, rutasperfil/historial, adapters.ts |domicilio+9datosacadémicos locales; historial3filas/12cr/15periodo2026-2; searchlocal; legacy intacto | lista;0 |
| RI-C4 Formulario/Ficha UI | RI-C2, secuencial conC3 | StudentForms.tsx/rutasformulario/ficha |8/13grupos payload, nulls, campos repetidos porID;1familiar; empty sin placeholders; CSV mismo dato | lista;0 |
| RI-C5 validators catálogos | RI-C4 para exclusión compartida, RI-P1 | data/programacion.ts/planEstudios.ts/tutoria.ts/transport.ts |camposcompletos/horas/prereqpareado; Tutoría[]solo, malformed eserror | lista;0 |
| RI-C6 transporte y rutas catálogos | RI-C5 | data/api.ts,3rutascatálogos, TableScreens.tsx/adapters.ts |3clavesHTTPlocal, pending/error/retry; tabla/modal/CSVdesdeHTTP; mock/api previos | lista;0 |
| RI-V1 HTTP backend y regresión | RI-B5 | rootworkflow/evidencia |3consultas exactas/invalid/empty/restart; endpoints anteriores equivalentes | pendiente;0 |
| RI-V2 integración MI | RI-C4 +MIbackend actual | rootworkflow/evidencia |UI/HTTPreal/empty/error/modes y CSV coherentes | pendiente;0 |
| RI-V3 integración catálogos y16rutas | RI-C6/RI-B5/V1/V2 | rootworkflow/evidencia |UIHTTPreal/modal/CSV/Tutoría,16rutas/regresiones,0redexterna | pendiente;0 |
| RI-D1 reconciliar registros | RI-V* | rootplan/workflow/estado documentos |separar implementado/integrado/reference-unverified y reuseMI11/11 | pendiente;0 |

Nombres de archivos B propuestos siguen patrón existente; el worker puede elegir prefijos exactos dentro de su carpeta si mantiene controller/pipe/service/repository/types/fixtures separados. No criterio exige archivo vacío innecesario. Root puede asumir Manuales sin cambios después de comprobar existente; ninguna implementación espera contenidos remotos desconocidos.

## Escenarios de aceptación integrada

Solo fuente A sintética; actorDEMO-001/periodo2026-2. Backend propio+Vite dev:local; principal es único propietario browser. Cada escenario registra precondición→acción→espera→resultado visible→lectura posterior. Ningún check previsto se reporta aprobado en este plan. Verificación debe estar autorizada por el encargo/workflow; plan no crea permiso adicional para suites nuevas.

| ID | Acción / espera | Aceptación y persistencia |
| --- | --- | --- |
| RI-HTTP | POST3rutas nuevas/bodyausente y{}; cuatroMI existentes |200/envelope exacto; programación8/16,plan8,Tutoría0; MI28campos/3filas/8grupos/13grupos/1familiar; mismaidentidad. |
| RI-INVALID | Cada nueva ruta: acción ausente/errónea/duplicada, queryextra, bodyobjeto/array/textplain |400/código porprioridad, métodosGET404; válida posterior catálogo intacto; parserJSON error separado. |
| RI-CONFIG | Arranqueausente/populated/empty y inválido de2env nuevas |Ausente=populated; empty conserva alumnoProgramación y vacíaPlan; inválidos abortan. Tutoría sinenv. |
| RI-READONLY | Lecturasrepetidas/concurrentes y reinicioigualmodo |JSONequivalente, no efectos escritos; inspección deepclone/DI único. |
| RI-MI-UI | Abrir4rutas directas/menu/recarga y esperarloaders HTTP |Perfil académicos15/2026-2; Historial3/12/15; formulariofecha/identificadorpayload; ficha1familiar; camposnull No registrado; valoresrepetidos porID. Búsqueda solo filas. |
| RI-CATALOG-UI | Abrir3rutas directas/menu/recarga y observarPOSTreal |Programación8filas,modalHTTP2horarios correctos y cierre; Plan8filas7columnas; Tutoría6columnas/estado[]; resumenbackend. |
| RI-EMPTY | Reiniciarbackend MI_INFORMACION_FIXTURE=empty,PROGRAMACION_FIXTURE=empty,PLAN_ESTUDIOS_FIXTURE=empty |MIhistorial0/0/null/sinfilas, formulario/ficha estructuraintacta/null y familia0; Programaciónsinfilas/alumno; Plan[]; Tutoría[]; no contenido fijo como respaldo. |
| RI-RECOVERY | Inducir fallored503 en consulta afectada usando infraestructura local; restaurar/pulsarIntentar de nuevo |alertvisible,sindatosinventados; nuevaPOST200real recupera; demorarespuestareal compruebapending; salidaderuta preservaAbortSignal. |
| RI-CONTRACT | Respuestas inválidas locales mínimas: MIseccionesausentes/IDduplicado/numero string/familiar inválido; programaciónhorainválida/horariomiscurso; planE/Oinválido/prereqpareadoerróneo; Tutoría[{}] |Todaserror,sinmock/sinvacíofalso; null backendhist/ficha inválido; muestras modificadas válidas se muestran como texto. Inyección validafrontera,sin acreditar integración exitosa. |
| RI-CSV | Descargaslocalesexistentesperfil/formulario/ficha/programación/plan traspopulated/empty |Headers/filas visibles,formulario13/8 grupossegúnruta; mismastransformaciones/nullsqueUI; programación/plan7columnas y soloheadersenempty; consulta posterior sinmutación. Sinendpointarchivo. |
| RI-MODES | Mock/api confetchsintético/local conbackendreal |Mock predeterminado;sindatafetchmock; originalesmocksnoalterados; Historial/Fichanonlocal conservarvistasprevias/sinnuevaURLcandidata; apilegacyotrasclavescredinclude; localcredomit,AbortSignal y mismoorigen; erroreslocalesnorespaldo. |
| RI-REGRESSION | Navegar16rutas; consultasreportes5/asistencia/MIartículo/formulario |Navegación SPA/back/forward,resumencomún,sinexcepciones; matriculainfoartículo5secciones,reportes3/3/6/1/1,asistencia3y0clases; mismasrespuestas previas; no repetir11escenariosMI salvo criterioafectado. |
| RI-MANUALES | AbrirManuales e inspeccionar9artículos/fechas/texto |Recursosestáticosvigentes,ningúnlinkdestinoinventado/HTTPbackendmanuales; Tutoría/Manuales comparaciónsolo regiones sanitizadas equivalentes. Escroll desconocido queda límite visual. |

Checks por cambios de capa: `pnpm --dir backend build`, `pnpm --dir backend lint`, `pnpm --dir client build`, `pnpm --dir client lint`. `test:data` existente solo si principal confirma autorización de verificación; no nueva suite que replique implementación. Usar escenarios HTTP/UI temporales y registros concisos si autorizados. La suite verify global tiene fallo histórico de espera y un ciclo agotado; no reiniciar contador ni ejecutar reparaciones generales para satisfacer esta extensión. Check nuevo delimitado espera estados correctamente y conserva fallo histórico documentado.

Registros root propuestos: `docs/reverse-engineering/workflows/remaining-implementation.md`, `evidence/local/remaining-implementation/{verification.md,check-results.json,source-hashes.json}` y capturas sintéticas por ruta. Registrar inputs/hash antes/después para distinguir verificaciones nuevas y previas. Planner solo valida consistencia documental/enlaces/ownership; no ejecuta aplicación.

## Condiciones de cierre y escalamiento

Cierre local exige RI-V1/V2/V3 aprobados y build/lint reales, o un informe que identifique exactamente criterio pendiente; implementación alone no equivale integración. Reutilizar los11MI-* y contratos previos, repetir únicamente criterios tocados por cambios nuevos. Máximo una reparación automática por tarea/ejecución fallida; si persiste, diagnóstico y pregunta concreta al principal/Sol. Cambio de agente no reinicia ese límite.

Quedan `unverified` de SUM: columnaindicadoraProgramación, descargas/formatos originales, umbrales de aprobación, reglas de prerequisito/cupos, filas/accionesTutoría, contraseña/edición/opcionesformulario, calendarioAsistencia, URLsManualeseinteraccionesInicio, paridadvisualsinreferencias/scroll. No impedir lectura local por esas dudas ni representar éxito propio como recuperaciónSUM.
