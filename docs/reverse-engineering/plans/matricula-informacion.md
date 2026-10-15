# Plan de ejecución: Información de Matrícula integrada

- **ID:** `matricula-informacion-2026-10-08`, revisión 1; `lista` para Luna High.
- **Planner:** rol real `sum-planner`, GPT-6.1 Sol High. Planificación obligatoria solicitada explícitamente por el usuario; el planner solo modifica los tres documentos asignados y no delega ni implementa.
- **Reutilización:** [plan previo del módulo Matrícula](matricula.md), composición y REA local ya observados. Las tareas `MAT-01`/`MAT-02` y limitaciones históricas se conservan; esta ampliación añade contrato backend y consumo real del artículo. La suite global histórica parcial no se declara aprobada ni se repite como requisito de esta ampliación.
- **Objetivo:** React obtiene un artículo readonly desde NestJS propio, con carga/vacío/error/reintento, preservando cinco temas, navegación y modos existentes.
- **Clasificación:** complejidad media (dos capas y transporte), incertidumbre media (artículo observado frente a DTO candidato distinto), impacto medio (frontera compartida y regresión de modos). No producción, browser del planner, dependencias o tooling nuevos.
- **Contrato fijo:** [MI-CONTRACT-1](../contracts/local-api/matricula-informacion.md). Implementadores no lo editan; cualquier conflicto semántico vuelve al principal antes de ampliar el alcance.

## Decisión que requiere Sol y preparación

La pantalla estática observada no muestra inscripción, cupos, estados de acceso, formularios o descargas. El candidato `raw-types/matricula-info.ts` contiene flags académicos, pero no hay traza que los vincule con el artículo. Recuperar semántica privada o derivar gates de esos flags excedería la evidencia. Sol fija un DTO propio mínimo de contenido: `{codSemestre,articulo}`, artículo nullable con introducción y cinco secciones ordenadas. React conserva compatibilidad mediante unión con el DTO heredado; su modo local exige el contenido HTTP y no usa el artículo constante después de un fallo. Esto permite a Luna resolver tareas delimitadas sin decidir reglas académicas.

Fuentes: notas `evidence/sum/matricula-informacion/{structure,interactions,measurements}.md` (históricas, sin screenshot sanitizado); pantalla/data actuales; `matricula.md` y especificación vigente; REA histórico local `ev_8408d7501e82732e71a7d462facbaffb14321b211d5bc1eb19d28809b580130b` solo confirma réplica previa. El contrato/seed/carga/vacío/reintento son `local-only`. No nueva evidencia SUM requerida para este alcance propio; fidelidad visual y funcional SUM permanece sin verificar.

## Invariantes de impacto

| ID | Invariante | Riesgo evitado / comprobación |
| --- | --- | --- |
| MI-I1 | Consulta readonly, actor implícito único; rechazar identidad, periodo y fixture por request. | Consultas no seleccionan otros actores ni cambian inscripción; MI-INVALID/READONLY. |
| MI-I2 | DTO local independiente de flags académicos; ninguna bandera de alumno cambia accesibilidad del artículo. | Inventar reglas de acceso; MI-UI/MODES. |
| MI-I3 | En local, artículo proviene de HTTP validado; null es vacío y fallos son errores. | Mantener contenido estático y ocultar fallos; MI-EMPTY/MALFORMED/RECOVERY. |
| MI-I4 | Cinco secciones de IDs únicos/orden establecido, texto renderizado por React. | DTO inconsistente o interpretación HTML; MI-MALFORMED. |
| MI-I5 | Periodo tomado del repositorio ya compartido; no duplicar proveedor ni seed de identidad. | Divergencia con resumen de alumno; MI-HTTP/REGRESSION. |
| MI-I6 | Fixtures readonly devueltos como copia y seed determinista por arranque. | Mutación entre solicitudes/reinicio; MI-READONLY. |
| MI-I7 | Mocks/api heredados conservan transporte/forma y respaldo histórico; local valida su forma exclusivamente. | Romper pantallas/modos previos o validar falsamente backend; MI-MODES/REGRESSION. |
| MI-I8 | Sin endpoints externos, actos de matrícula, descargas o dependencias nuevas. | Ampliación ajena a evidencia; diff y solicitudes locales. |

## Skills obligatorias antes del código

Backend: leer `backend/AGENTS.md`, `backend/.agents/skills/sum-nestjs-implement/SKILL.md`, `nestjs-best-practices/SKILL.md` y reglas `arch-feature-modules`, `arch-module-sharing`, `arch-avoid-circular-deps`, `di-prefer-constructor-injection`, `arch-use-repository-pattern`, `api-use-pipes`, `security-validate-all-input`, `security-sanitize-output`; aplicar validación propia existente sin agregar class-validator. Para checks, `sum-nestjs-verify/SKILL.md` y `oxlint/SKILL.md`. Skill → decisiones: módulo por feature, constructor DI, importar/exportar repositorio único, pipe reusable, JSON readonly/copias y lint vigente. Node/advanced types/Vitest solo si aparece necesidad concreta; no cargar todas por nombre ni instalar infra sugerida por una skill genérica.

Frontend: leer `client/AGENTS.md`, `client/.agents/skills/sum-react-implement/SKILL.md`, `sum-react-verify/SKILL.md` y `.codex/skills/router-core/data-loading/SKILL.md`; skill → loader/data boundary tipada, validación runtime, pendingComponent explícito y reintento por invalidate. Si requiere documentación de sintaxis específica de TanStack Router, consultar Context7; reutilizar el patrón existente con loader, AbortSignal y componentes de estado sin cambiar router compartido.

Root: `sum-workflow`, `sum-evidence-to-spec` (este handoff), `sum-fullstack-verify` para aceptación real; `sum-behavior-discovery` y REA solamente si la comprobación local aporta evidencia adicional. Browser único del principal; trabajadores no navegan ni delegan.

## Propiedad y unidades pequeñas de trabajo

**Worker B**, `sum-implementer`, GPT-6 Luna High: propiedad exclusiva de `backend/src/matricula-informacion/**` (nuevo), `backend/src/app.module.ts` y, si documenta comando fixture, sección nueva en `backend/README.md`. No editar common/readonly-query, módulos previos, cliente, contratos/config raíz ni otros docs. No estás solo; conservar cambios ajenos.

**Worker C**, `sum-implementer`, GPT-6 Luna High: propiedad exclusiva de `client/src/data/matriculaInformacion.ts` (nuevo), `client/src/data/{api.ts,contracts.ts,transport.ts,adapters.ts}`, `client/src/routes/alumnoWebSum.v2.matricula.informacion.tsx`, `client/src/screens/EnrollmentInfo.tsx`. Si los escenarios de frontera requieren archivo, `client/src/data/matriculaInformacion.test.ts` pertenece a C. No editar mocks/responses, raw-types, rutas compartidas, config/estilos, backend ni contratos. No estás solo; preservar trabajo ajeno.

Archivos de root/verificación: `docs/reverse-engineering/workflows/matricula-informacion.md`, `evidence/local/matricula-informacion/**`, checks temporales fuera de app. El principal actualiza estado de este plan después de entrega. B y C pueden correr en paralelo solo tras fijar MI-CONTRACT-1; ningún archivo compartido entre sus escrituras.

| ID / salida concreta | Dependencias | Archivos exclusivos | Aceptación de la unidad | Estado / checks |
| --- | --- | --- | --- | --- |
| MI-P1: contrato y especificación exactos | Evidencia/spec/plan anteriores | Los tres docs de este handoff | Semántica, DTO, fixtures, regresión, tareas y criterios definidos | Completada por Sol; revisión documental, sin tests de app. |
| MI-B1: tipos/DTO y seed | MI-P1 | `backend/src/matricula-informacion/matricula-informacion.types.ts`, `.fixtures.ts` | Tipos propios; builder del artículo parametrizado por periodo, textos/IDs exactos; empty=null | Implementada; build/lint backend aprobados. |
| MI-B2: repositorio y servicio | MI-B1 | `.repository.ts`, `.service.ts` bajo nueva carpeta | DI ReportesRepository; env estricta; read clone; servicio entrega envelope tipado | Implementada; escenarios HTTP pendientes. |
| MI-B3: frontera/registro | MI-B2 | `consulta-matricula-informacion.pipe.ts`, `.controller.ts`, `.module.ts`, `backend/src/app.module.ts` | Pipe valida request existente; POST200; módulo importa ReportesModule y registra feature una vez | Implementada; build/lint aprobados; MI-INVALID pendiente. |
| MI-C1: DTO/validator/compatibilidad | MI-P1 | `client/src/data/matriculaInformacion.ts`, `contracts.ts`, `transport.ts` | Tipos/legacyEnrollmentArticle + validator asserts concretos del contrato; unión propia/heredada; parse legacy conservado | Implementada; escenarios de frontera pendientes. |
| MI-C2: transporte y adaptación | MI-C1 | `api.ts`, `adapters.ts` | Key local HTTP añadido; toEnrollmentArticle usa narrowing por propiedad articulo, null no cae a respaldo; AbortSignal/credentials intactos | Implementada; MI-MODES pendiente. |
| MI-C3: ruta y render | MI-C2 | Ruta específica, `EnrollmentInfo.tsx` | Loader real y response tipado; RoutePending/RouteError explícitos en la ruta; artículo dinámico/null, sin constante en componente | Implementada; build/lint aprobados; MI-UI/EMPTY pendientes. |
| MI-V1: aceptación local real | MI-B3 + MI-C3 | Registros/evidencia propiedad root | Todos escenarios obligatorios aprobados o diagnóstico explícito; no aceptación con solo mocks | Pendiente; principal ejecuta escenarios debajo. |

Los nombres cortos `.fixtures.ts`, etc. en B significan el prefijo `matricula-informacion` (p. ej. `matricula-informacion.fixtures.ts`). Cada worker entrega archivos, requisitos resueltos, skill aplicada/decisión, comandos/resultados y divergencias. Máximo una reparación automática por corrida fallida; si persiste, diagnosticar y volver al principal. No modificar contrato para hacer pasar un check.

## Escenarios exactos de aceptación root

Actor sintético `DEMO-001`, seed periodo `2026-2`. Arrancar NestJS compilado en puerto local disponible y Vite `dev:local` con proxy a él; si se usa proxy fijo3000, reutilizar/gestionar solo servidor propio. Navegación local por Chromium con viewport1366×900, scroll0 para inicio; no producción. Lo que escriba la verificación es sintético. Ningún escenario afirma comparación pixel a pixel.

| ID | Precondición, acción y espera | Resultado obligatorio / efecto posterior |
| --- | --- | --- |
| MI-HTTP | Fixture ausencia y `populated`; POST sin body y POST `{}` con acción válida. | HTTP200/JSON y DTO exactamente como contrato; periodo igual al alumno de formulario; cinco títulos/IDs/orden/descr.; sin efectos. |
| MI-INVALID | POST sin acción, acción errónea, acción duplicada; acción válida + `codAlumno=OTHER`, `periodo=2020-1`, `fixture=empty`; body JSON `{x:1}`, `[]`, `null`, string y texto plano `x`; JSON roto. | 400; códigos/envelopes del pipe según prioridad, parser400 cuando aplica. Ninguna entrada cambia siguiente MI-READ. GET/PUT/DELETE no registrado404. |
| MI-READONLY | Serializar primera respuesta; 3 lecturas secuenciales y 5 paralelas, recargar UI y reiniciar backend con igual env. | Igual JSON semántico y cinco secciones siempre; aislamiento de copia comprobable en repositorio o inspección del uso de structuredClone (HTTP por sí solo no prueba esa implementación); no escritura/endpoints extras. |
| MI-EMPTY | Reiniciar backend `MATRICULA_INFORMACION_FIXTURE=empty`; POST y página nueva. | `data={codSemestre:'2026-2',articulo:null}`; título exterior y texto `No hay información de matrícula disponible.`; cero `ol`/secciones y ningún respaldo. Volver populated restaura contenido. |
| MI-UI | Nest y Vite reales populated; abrir ruta directa y desde link visible del menú Matrícula Vía Internet; esperar `.enrollment-article h3`. | POST local registrado con acción y200; título, h3 y cinco li/h4/p iguales al JSON real; primer párrafo incluye `periodo 2026-2`, diferente de constante previa. Recarga mantiene resultado. Cero controles de inscripción/descarga en artículo. |
| MI-LOADING | Nueva página local; demorar solo respuesta MI-READ ≥1800ms continuando la solicitud real (sin sustituir JSON). | Mientras espera, `role=status` `Cargando información…`; al terminar aparece artículo real. Loader propaga AbortSignal; navegar fuera no deja error tardío. |
| MI-RECOVERY | Backend accesible para formulario; hacer fallar solo MI-READ con HTTP503 sintético o cortar backend después de cargar shell; esperar alert. Restaurar MI-READ y pulsar `Intentar de nuevo`. | Mensaje error visible, sin artículo/empty/mock; nueva solicitud termina200 y devuelve cinco secciones. Si el fallo es del shell, documentarlo como cobertura global distinta y repetir fault específico MI-READ. |
| MI-MALFORMED | En frontera local inyectar de forma explícita DTO heredado, falta articulo, secciones4, ID duplicado/desordenado, extra keys o título numérico. | Todos rechazan con error de contrato, sin contenido de respaldo. `articulo:null` válido. Variante propia válida con un título/párrafo distinto y texto `<strong>Texto</strong>` renderiza cadenas recibidas y no monta HTML; marcar esta variante como experimento, no integración real. |
| MI-MODES | Fetch sintético para api legacy y local; mock con fetch que falla si es llamado. | Mock: sin red y artículo histórico; api: validación/response previas, credentialsinclude y fallback histórico; local: credentialsomit, keyHTTP, response local o error. Campo común codSemestre disponible en unión. No cambiar mocks existentes. |
| MI-REGRESSION | Build/lint ambas capas; test:data si el usuario solicita pruebas; consultas locales a Reportes y Asistencias y pantalla ajena no conectada. | Endpoints previos responden mismos DTO/seed; localHttpKeys solo añade matriculaInfo; plan/programación aún mocks según alcance actual. No cambiar main/routerglobal/proxy/tooling. Suite histórica global no se exige si tiene fallo ajeno documentado. |
| MI-ENV | Arrancar nuevo proceso con `MATRICULA_INFORMACION_FIXTURE=wrong` y luego vacío string. | Exit no cero y mensaje útil antes de estar disponible; ningún fallback a populated. Ausencia/populated/empty arrancan correctamente. |

Comandos obligatorios de los trabajadores: `pnpm --dir backend build`, `pnpm --dir backend lint`, `pnpm --dir client build`, `pnpm --dir client lint`. Para fronteras/modos, se proponen `pnpm --dir client test:data` y checks HTTP/UI enfocados locales del workflow; ejecutarlos solo cuando el usuario solicite pruebas o verificación. Este plan no concede autorización. No agregar framework; pruebas nuevas solo si prueban invariantes como contrato malformado/modos y no duplican getters triviales. Root inspecciona diff y `git diff --check` después de ambas entregas.

## Estado de cierre y brechas

Plan/contrato entregados; implementación backend y cliente entregada por Luna High con build/lint aprobados. Verificación integrada pendiente. Una reparación por worker; fallo restante de tipado en fixture diagnosticado por Sol High y corregido por Luna High con `satisfies`; build/lint del cliente nuevamente aprobados, sin repetir pruebas. Root registrará MI-V1 y evidencia real antes de cerrar. Persisten sin verificar el texto exacto SUM, vínculo de flags al artículo, reglas académicas, contenido estacional, destinos productivos y fidelidad visual por ausencia de referencia sanitizada. Estas brechas no impiden la API/read-only y UI propias aquí especificadas.
