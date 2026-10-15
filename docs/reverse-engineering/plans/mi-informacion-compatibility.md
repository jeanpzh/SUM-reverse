# Plan incremental: snapshots de Mi Información

- **ID:** `mi-informacion-compatibility-2026-10-08`, revisión 2, actualización Sol High del 2026-10-09.
- **Contrato fijado:** [MIC-CONTRACT-2](../contracts/local-api/mi-informacion-compatibility.md). MIC-CONTRACT-1 tiene implementación y comprobaciones estáticas terminadas según el registro previo. **Nueva ampliación Historial candidata lista para Luna High**; integración y esquema candidato de Ficha pendientes. No repetir tareas/checks históricos sin cambios nuevos que lo justifiquen.
- **Planner real:** `sum-planner`, GPT-6.1 Sol High. Esta etapa escribe únicamente este plan y su contrato; sin delegación, implementación, browser, producción, servidores ni tests.
- **Objetivo:** preparar las cuatro consultas existentes para envelopes offline originales del operador, conservando datos y separando las formas candidatas de las formas locales y opacas.
- **Arquitectura:** validator puro compartido; catálogo readonly del repositorio existente; metadato HTTP externo al JSON; adaptadores runtime y proyecciones de UI explícitas. Formulario obligatorio proporciona identidad del shell; otras tres lecturas opcionales sin fallback sintético.
- **Complejidad de ampliación media:** esquema y rama de pantalla Historial. **Incertidumbre delimitada:** `raw-types/historial.ts` suministra campos; no semántica de creditaje, criterioCalificacion ni aprobación. Ficha/formulario mantienen brechas. **Impacto alto:** pérdida de datos, mezcla de identidad y presentación académica inventada.
- **Reparaciones:** cada trabajador usó su único ciclo de reparación tras errores de compilación. La raíz resolvió diagnósticos aislados y registró correcciones/comprobaciones en [workflow](../workflows/mi-informacion-compatibility.md), sin nuevo despacho de reparación. No se replanificó para ampliar esquemas sin evidencia.

## Reutilización y decisión Sol

Conservar las tareas cumplidas de [Mi Información](mi-informacion.md), las cuatro especificaciones y `mi-informacion-api-v1`; reutilizar la política wire/snapshots de [Matrícula](matricula-compatibility.md) sin modificar su implementación. Perfil/Formulario mantienen sus candidatos; nuevo tipo sanitizado local `raw-types/historial.ts` define la fuente exhaustiva de Historial candidato. Ficha solo tiene DTO propio. El plan de exportación ya fija los nombres Perfil/Formulario: no renombrarlos.

La decisión de Sol de revisión 2 es proyectar directamente `historial/promedios/creditaje` del tipo local, conservando la diferencia con `alumno/resumen/periodos/asignaturas` del DTO propio. No crear resumen de aprobados ni promedio global a partir de calificaciones/créditos. Historial snapshot pasa a candidate-v1 por defecto con el mismo filename/opcionalidad; local-v1 continúa exigiendo declaración explícita. Se mantiene el mecanismo previo, sin regenerar la infraestructura. Esta revisión leyó únicamente el tipo local y los dos documentos asignados; no verifica producción ni el código implementado actualmente. Ficha continúa sin esquema candidato suministrado.

## Invariantes de alto impacto

1. No acceder a `datos-reales/` ni a procesos/logs/API/browser que lo consuman. El operador inicia el backend privado; los agentes usan solo código y fixtures identificados sintéticos.
2. Envelope y extras se conservan semánticamente; no completar, normalizar, reconstruir ni descartar campos originales. Metadato de representación fuera del JSON.
3. Archivo obligatorio inválido o cualquier archivo presente inválido aborta arranque. Opcional ausente es HTTP503, nunca éxito vacío/fixture.
4. Formulario importado es la fuente requerida del shell. Las consultas snapshot no llaman al repositorio sintético para identidad/flags/secciones.
5. Forma opaca no se convierte en tablas locales por inspección heurística, aliases o casts. Declaración local-v1 y validación son requisitos conjuntos.
6. Los diagnósticos incluyen solo variable/clave/basename/field-path seguros y motivo constante; no valores, ruta privada absoluta, causas nativas ni claves dinámicas sensibles.
7. Sin directorio snapshot conservar el comportamiento synthetic/mock previo. En modo local una falla no habilita demo; candidate-v1 nunca genera `Dato de demostración`.
8. Copias profundas, carga única/reinicio y catálogo readonly. No nuevas escrituras, endpoints, auth, ORM, dependencias ni conexión SUM.
9. Historial candidato muestra números/strings recibidos, orden y duplicados sin inferir aprobados, total ponderado, equivalencias de acta, escala o concordancia de identidades. creditaje/flags/campos opacos se conservan sin interpretación.

## Interfaces y propiedad

Dos implementadores separados, ambos **`sum-executor` GPT-6 Luna High**, sin delegación ni reversión de cambios ajenos. Backend tiene asignación explícita de los dos archivos compartidos raíz; frontend los consume. Ningún worker edita contratos, workflow, instrucciones/configuración raíz o la otra capa. Root mantiene documentos operativos y aceptación/reporte.

### MIC-B1 — Frontera wire compartida

**Estado:** implementada, revisada estáticamente. **Dependencias:** MIC-CONTRACT-1. **Propiedad exclusiva B:** crear `shared/mi-informacion-wire.mjs`, `shared/mi-informacion-wire.d.mts`; modificar `backend/src/mi-informacion/mi-informacion.types.ts` para tipos propios que correspondan a envelopes/clasificaciones.

**Interfaces producidas:** tuple `miInformacionWireKeys`, tipos `MiInformacionWireKey`, `MiInformacionRepresentation`, `MiInformacionWireEnvelope`; `validateMiInformacionWire(key,value,representation)` con firma y reglas exactas del contrato. Reutilizar los tipos WireJson del módulo Matrícula sin editarlo. Las reglas local-v1 se centralizan aquí; wrappers de capa no duplican validación.

- [x] Declarar todos los campos de los dos candidatos existentes y sus anidados, con las ampliaciones exclusivamente locales especificadas.
- [x] Implementar las tres representaciones, validación recursiva/extras, formas locales previas y diagnósticos seguros sin transformar entradas.
- [x] Entregar exports/paths disponibles al worker C; revisión estática de cobertura de campos y de inexistencia de fs/HTTP/DOM en shared.

**Aceptación:** MIC-WIRE, MIC-PRESERVE y MIC-CLASS del bloque de criterios. Esta tarea no acredita respuestas reales.

### MIC-B2 — Catálogo offline y consultas NestJS

**Estado:** implementada; build/lint finales aprobados tras corrección de imports diagnosticada por la raíz. **Propiedad exclusiva B:** crear `backend/src/common/mi-informacion-snapshots.ts`; modificar `backend/src/mi-informacion/mi-informacion.repository.ts`, `mi-informacion.service.ts`, `mi-informacion.controller.ts`. No editar ReportesRepository, módulos/pipes, main o helper Matrícula.

**Interfaces internas:** `loadMiInformacionSnapshots(directory:string|undefined,localKeys:string|undefined):MiInformacionSnapshots|null`; catálogo readonly parcial de entradas `{envelope:MiInformacionWireEnvelope,representation:MiInformacionRepresentation}`. Null significa exclusivamente directorio ausente. `MiInformacionRepository.readSnapshot(key)` devuelve `{kind:'fixture'}`, `{kind:'missing'}` o `{kind:'snapshot',envelope,representation}`; último devuelve clone. Conservar `read(key)` actual para fixtures. `MiInformacionService.consultar(key)` devuelve `{envelope,representation}`: fixture compone envelope previo; snapshot devuelve envelope intacto; missing lanza excepción HTTP503 segura. Controller extrae envelope, fija cabecera y retorna JSON.

- [x] Leer nombres fijos; Formulario obligatorio, ENOENT permitido en otros tres; invalidar configuración/archivo presente inválido antes de publicar catálogo.
- [x] Implementar variables, conflicto fixture, coexistencia Matrícula, carga/copia readonly y ausencia de cause/log de contenido según contrato.
- [x] Conectar selección de repositorio/servicio, sin `readFormulario()` synthetic en snapshot ni dependencia de Perfil para Formulario.
- [x] Poner `X-SUM-MI-Representation` con respuesta passthrough de Nest; retornar el envelope. Documentación consultada por planner con Context7: `/nestjs/docs.nestjs.com`, controllers response headers y HttpException object response. Una excepción de objeto con HTTP503 conserva el envelope propio; no incluir cause.
- [x] Ejecutar `pnpm --dir backend build` y `pnpm --dir backend lint`; registrar resultado real y diff. Sin tests ni servidor.

**Aceptación:** MIC-OFFLINE, MIC-MISSING, MIC-PRIVACY, MIC-SYNTHETIC y MIC-STATIC. No acreditar HTTP/integración por build/lint.

### MIC-C1 — Transporte y narrowing de respuesta

**Estado:** implementada; build/lint aprobados. Comenzó después de la entrega de exports B1. **Propiedad exclusiva C:** `client/src/data/miInformacion.ts`, `client/src/data/contracts.ts`, `client/src/data/transport.ts`, `client/src/data/adapters.ts`. Leer `client/AGENTS.md` y `client/.agents/skills/sum-react-implement/SKILL.md`; B lee `backend/AGENTS.md` y `backend/.agents/skills/sum-nestjs-implement/SKILL.md`, más apoyos locales aplicables.

**Consume:** exports B1. **Produce:** `rememberMiRepresentation(response,representation)`, `getMiRepresentation(response)`, `toHistorialLocalData(response):HistorialLocalData|null`, `toFichaLocalData(response):FichaSocioeconomicaLocalData|null`, firmas fijadas por contrato. ApiResponseMap acepta candidate/local/opaque sin afirmar data opaca como DTO local. Adaptador `toHistoryRows` consume `HistorialLocalData['asignaturas']`; `toProfileRows` requiere solo los campos del alumno que lee, evitando dependencia del tipo raw completo más estrecho.

- [x] Reemplazar validación MI exclusiva local con wrappers del módulo shared, dejando los DTOs de presentación separados.
- [x] Interceptar MI antes de chequeo envelope exacto en parseResponse; añadir argumento opcional de representación; lector HTTP local exige/valida cabecera y registra metadata en WeakMap fuera del JSON.
- [x] Distinguir 503 SNAPSHOT_MISSING con mensaje de producto seguro; no copiar message remoto arbitrario ni volver a mock.
- [x] Aplicar narrowing por representación antes de acceso a resumen/secciones/familiares; mantener modos/mock y AbortSignal/credentials/baseURL existentes.

**Aceptación:** MIC-WIRE, MIC-PRESERVE, MIC-CLASS, MIC-MISSING. No editar api/config/endpoints salvo diagnóstico material comunicado a root.

### MIC-C2 — Presentación y contexto sin relleno

**Estado:** implementada para formas candidatas/locales y disponibilidad opaca; build/lint aprobados. **Propiedad exclusiva C:** `client/src/screens/Profile.tsx`, `client/src/screens/StudentForms.tsx`, `client/src/screens/TableScreens.tsx` solo rama Historial y tipos asociados; las cuatro rutas `client/src/routes/alumnoWebSum.v2.informacion.{perfil,historial,formularioDatos,fichaSocioeconomica}.tsx`. Root loader/hooks conservan su contrato y no requieren modificación prevista. C puede ajustar `client/src/data/useStudent.ts` y `useShellStudent.ts` exclusivamente si el nuevo union requiere narrowing tipado, conservando root Formulario como única fuente.

- [x] Perfil: mostrar los campos personales/académicos candidatos validados y fecha string literal; contexto del Formulario obligatorio. Falta Perfil es error de su ruta.
- [x] Formulario: modo local no carga Perfil; branch candidate presenta alumno/flags y ocho grupos observados con estados de mapping pendientes, según texto exacto del contrato. No usar extras secciones ni mapa formulario como DTO local. CSV candidato deshabilitado.
- [x] Ficha/Historial: local-v1 conserva presentación anterior y alumno propio; opaque muestra disponibilidad sin tablas/CSV/valores sintéticos. No cargar Perfil complementario requerido.
- [x] Mantener mock explícito y synthetic local-v1 anterior; fecha sin mapping no se introduce como texto inválido en input date.
- [x] Ejecutar `pnpm --dir client build` y `pnpm --dir client lint`; registrar resultado real/diff. Sin tests, verify, browser ni servidores.

**Aceptación:** MIC-UI, MIC-CONTEXT, MIC-SYNTHETIC y MIC-STATIC. Sin cambios visuales generales ni afirmación de paridad.

### MIC-R1 — Cierre root

**Estado:** terminado; resultados y correcciones registrados en workflow. **Propiedad root:** documentación operativa y workflow; cierre de estados del plan/contrato al terminar los trabajadores.

- [x] Recoger resultados reales de los cuatro comandos build/lint y revisar que exports/cabecera/nombres coincidan con MIC-CONTRACT-1.
- [x] Registrar tareas hechas, archivos, límites de representación y ausencia de pruebas/integración. No iniciar backend con snapshots privados.
- [x] Incorporar el tipo local sanitizado de Historial mediante revisión 2 de contrato/mapping, conservando tareas cumplidas. Ficha sigue sin tipo candidato.

## Criterios y verificaciones autorizadas

Las tareas MIC-B1..R1 anteriores describen la ejecución histórica de MIC-CONTRACT-1; sus resultados no acreditan la nueva ampliación ni se reinician. La revisión 2 agrega únicamente las siguientes tareas.

### MIC-H-B1 — Validación y representación candidata de Historial

**Estado:** implementada; build/lint aprobados por worker. **Dependencia:** MIC-CONTRACT-2. **Rol real:** `/root/historial_backend`, `sum-executor`, GPT-6 Luna High; skill backend sum-nestjs-implement. **Propiedad B:** `shared/mi-informacion-wire.mjs`, `shared/mi-informacion-wire.d.mts`, `backend/src/common/mi-informacion-snapshots.ts`, `backend/src/mi-informacion/mi-informacion.types.ts`.

**Consume:** esquema exhaustivo `raw-types/historial.ts` y reglas candidate-v1 de MIC-CONTRACT-2, sin import runtime del tipo en backend. **Produce:** validación `validateMiInformacionWire('historial',value,'candidate-v1')` con firma existente y tipos exportados `HistorialCandidateRow`, `HistorialCandidatePromedio`, `HistorialCandidateData`. Mantener envelopes, metadata y APIs internas ya implementadas.

- [x] Incorporar Data y todos los campos de filas/promedios/creditaje con política de strings/números/extras/null opaco fijada. Diagnósticos seguros de mapa creditaje usan `[*]`; sin claves privadas ni valores.
- [x] Seleccionar candidate-v1 para Historial presente cuando no figure en LOCAL_KEYS; override explícito conserva local-v1. Conservar `historial-academico.json`, ENOENT opcional 503 y error de arranque por archivo presente inválido. Ningún fallback a opaque al fallar el candidato.
- [x] Entregar exports al worker C y revisar estáticamente preservación completa, ausencia de coerción/defaults/reglas académicas; no acceder a archivos del operador.
- [x] Ejecutar `pnpm --dir backend build` y `pnpm --dir backend lint`: ambos exit 0, informado por el worker. Sin tests, servidores ni HTTP.

**Aceptación:** MIC-H-WIRE, MIC-H-SNAPSHOT, MIC-H-PRESERVE. Reutiliza shared/header/catálogo; no rediseña repositorio/servicio.

### MIC-H-C1 — Proyección candidata de Historial

**Estado:** implementada; build/lint aprobados por worker. **Dependencia:** exports H-B1. **Rol real:** `/root/historial_client`, `sum-executor`, GPT-6 Luna High; skill client sum-react-implement. **Propiedad C:** `client/src/data/miInformacion.ts`, `client/src/data/adapters.ts` y rama Historial de `client/src/screens/TableScreens.tsx`; `MiHistorialResponse` amplía el mapa sin cambio separado en `contracts.ts`.

**Consume:** tipos H-B1, metadata existente, Formulario root como contexto separado. **Produce:** `toHistorialCandidateData(response):HistorialCandidateData|null`; `toHistorialLocalData` retorna null para candidate-v1, sin habilitar demo. Adaptadores `toHistorialCandidateRows(data:HistorialCandidateData):string[][]` (nueve columnas del contrato) y `toHistorialCandidatePromedios(data:HistorialCandidateData):string[][]` (dos columnas). La tabla distingue candidate/local por metadata, nunca por nombre de campos.

- [x] Ampliar el tipo de respuesta; validar/narrow antes de acceso. Mantener mock/local-v1 históricos y Ficha opaque; metadata incompatible/ausente falla.
- [x] Renderizar el mapping del contrato: resumen año/códigos, nueve columnas incluyendo semestre, promedios de dos columnas. El candidato no afirma aprobaciones ni ponderación global y no interpreta creditaje/flags.
- [x] Conservar listas/duplicados/strings/números; búsqueda solo por código/nombre, promedios independientes y vacíos por lista. Sin CSV, agrupación ni cálculos derivados.
- [x] Ejecutar `pnpm --dir client build` y `pnpm --dir client lint`: ambos exit 0, informado por el worker. Sin tests, verify, browser ni servidores.

**Aceptación:** MIC-H-UI, MIC-H-CONTEXT y MIC-H-PRESERVE. La novena columna y el resumen de códigos son presentación local del candidato; no equivalencia visual SUM.

### MIC-H-R1 — Cierre acotado de revisión 2

**Estado:** cerrado con revisión estática. **Propiedad root:** registro workflow y estado de estos IDs.

- [x] Registrar cambios/resultados nuevos y que la fuente fue el tipo local sanitizado, sin verificación producción/integración.
- [x] Revisar estáticamente correspondencia de columnas/campos con MIC-CONTRACT-2 y ausencia de deducciones académicas. No repetir ejecución histórica ni abrir snapshots para cerrar aceptación.

| ID nuevo | Criterio / verificación autorizada |
| --- | --- |
| MIC-H-WIRE | Data siete campos, filas todos los campos del tipo y promedios completos; creditaje todos valores finitos; extras/nulls opacos preservados; sin coerción/rangos/relaciones |
| MIC-H-SNAPSHOT | Mismo filename y ENOENT opcional; candidate-v1 por defecto, local-v1 explícito; fallo candidato no cae a opaque; header refleja representación elegida |
| MIC-H-PRESERVE | No transformar envelopes/listas/duplicados/valores; DTO propio y forma candidata separados; evidencia por revisión estática |
| MIC-H-UI | Mapping de nueve columnas, promedios de dos columnas y resumen de año/códigos; String(number), sin trim/redondeo/sumas/aprobados/promedio global; lista vacía independiente |
| MIC-H-CONTEXT | Formulario da contexto shell; candidato no contiene alumno tipado para reconstruir identidad y no requiere Perfil; creditaje/criterioCalificacion conservados sin interpretar |

Los cuatro build/lint nuevos terminaron exit 0 según ambos workers. La revisión estática no ejecutó pruebas ni inició procesos. Los escenarios HTTP y la integración funcional quedan sin verificar.

| ID | Resultado exigido / revisión estática de esta entrega |
| --- | --- |
| MIC-WIRE | Todos los campos candidatos requeridos/anidados se validan, extras permitidos, fecha string literal, sin defaults ni coerción |
| MIC-PRESERVE | Servicio devuelve clone del envelope completo; transporte conserva response; cabecera/WeakMap fuera del JSON |
| MIC-CLASS | Fixture local-v1; snapshot Perfil/Formulario/Historial candidate-v1, Ficha opaque; Historial/Ficha local-v1 solo allowlist explícita; incompatible/missing header falla |
| MIC-OFFLINE | Archivo Formulario obligatorio; tres opcionales fijos; carga única; configuración inválida/archivo presente inválido falla arranque; solo ENOENT opcional se admite |
| MIC-MISSING | Opcional ausente se representa como 503 SNAPSHOT_MISSING seguro, nunca vacío/fixture; UI distingue error de opaco y vacío local |
| MIC-PRIVACY | Ningún acceso privado/servidor ni impresión de raw; errores sin values/cause/ruta absoluta/keys sensibles; operador inicia privado |
| MIC-CONTEXT | Shell usa Formulario; Formulario/Ficha disponibles no dependen de Perfil; snapshot no lee seed para completar identidad |
| MIC-UI | Campos candidatos conocidos se muestran; mapping desconocido/opaco muestra disponibilidad; no relleno demo, aliases ni secciones derivadas |
| MIC-SYNTHETIC | Directorio ausente mantiene fixture/mock; local fallo no devuelve demo; no modificación de otros módulos synthetic como si fueran del mismo alumno |
| MIC-STATIC | Build/lint de ambas capas ejecutados realmente con resultados registrados; ningún test añadido/ejecutado |

Estos criterios guían la implementación; comprobaciones estáticas no prueban escenarios HTTP, copia/reinicio en ejecución ni integración client/server. Esa verificación queda **no ejecutada**, y requiere autorización posterior con fuente sintética segura. Tampoco hay equivalencia visual completa, compatibilidad con todos los JSON reales ni esquema privado recuperado.

## Brechas materiales restantes

- Historial: esquema local sanitizado implementado como candidate-v1; semántica de creditaje/criterioCalificacion y verificación de producción/integración siguen no acreditadas. Ficha: sin esquema candidato suministrado.
- Formulario: falta asociación clave→control y semántica de datos personales; conserva raw y muestra solo datos/flags identificados.
- Perfil: archivo puede faltar por redirección comunicada por operador; tratado como opcional sin impedir Formulario.
- Ningún archivo privado fue usado como entrada de planificación. La validación contra archivos originales y el arranque privado pertenecen al operador.
