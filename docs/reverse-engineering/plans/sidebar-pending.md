# Sidebar visible durante la carga de rutas

- ID `SP-2026-10-08`, revisión 1, contrato local `SP-UI-1`, estado **lista para implementación Luna High**. Planificador real: `sidebar_pending_plan`, perfil `sum-planner` GPT-6.1 Sol High. Esta entrega es documental; implementación y aceptación funcional pendientes.
- Extensión puntual de [remaining-implementation](remaining-implementation.md). Reutiliza sus tareas completadas, [RI-CONTRACT-1](../contracts/local-api/remaining-implementation.md), [workflow](../workflows/remaining-implementation.md) y [verificación sintética](../../../evidence/local/remaining-implementation/verification.md). No reabre módulos, contratos HTTP ni verificaciones ya concluidas.
- Objetivo: mostrar navegación, marca y cabecera mientras carga el formulario raíz o una vista; conservar navegación SPA, resumen obtenido del API propio y errores/reintento visibles dentro del área principal.
- Complejidad media: límite de render raíz, datos opcionales y estado compartido. Incertidumbre baja en código instalado; falta aceptación de la nueva transición en navegador. Impacto medio, con invariantes de integridad en identidad y validación. No se solicita fidelidad visual de un estado SUM.

## Fuentes y certeza

| ID / categoría | Evidencia y límite |
| --- | --- |
| SP-E1 / observación reportada por principal | Captura local de `localhost:5173/matricula/programacion` muestra únicamente «Cargando información…». Ruta abreviada reportada; las rutas canónicas del cliente están bajo `/alumnoWebSum/v2/`. El planner no abrió la captura ni el navegador, ni acredita origen de datos, viewport o una referencia SUM. |
| SP-E2 / observado en código local | CodeGraph, 2026-10-08: `routes/__root.tsx:7-10` espera `sumApi.get('formulario')` antes de `Shell`; el pending raíz es `RoutePending`. `Shell.tsx:8` llama `useStudent`; `useStudent.ts:6-11` exige datos raíz. `RouteStatus.tsx:3-14` define carga, error y retry mediante `router.invalidate()`. |
| SP-E3 / observado en código local | `Shell` ya usa `Link` y `Outlet`, mantiene estado de colapso/submenús/cuenta y reutiliza rutas existentes. `router.tsx` declara precarga por intención, caché de 60 s, scroll restoration y pending/error por defecto. |
| SP-E4 / dependencia pública instalada | `@tanstack/react-router` 1.170.41, `src/route.tsx:59-64`: `shellComponent` recibe `children`. `src/Match.tsx:106-190`: shell raíz rodea Suspense, error y not-found y comparte match context. `src/useMatch.tsx:155-200` admite `shouldThrow: false` cuando no hay match. Es fuente pública del paquete, no evidencia SUM. |
| SP-E5 / aceptación anterior reutilizada | RI verificó integración propia, navegación de rutas, error 503/retry y modo mock sin HTTP. Esos resultados no prueban que la navegación siga visible durante el pending raíz nuevo. |

Context7 consultado con `/tanstack/router`, conceptos `shellComponent` y match raíz seguro. Las respuestas incluyen documentación Solid/Start y fuente React; no se extrapola SSR a este cliente Vite. La API y posición de los límites se corroboraron en el paquete React instalado. Referencias públicas: [useMatch](https://tanstack.com/router/latest/docs/framework/react/api/router/useMatchHook), [fuente Match](https://github.com/TanStack/router/blob/main/packages/react-router/src/Match.tsx). La versión instalada prevalece sobre ejemplos de otra plataforma.

**Hipótesis por comprobar:** mantener `Shell` como shell raíz preserva su instancia/estado al resolver el loader y durante pending/error de hijos. Está respaldado por estructura del renderer; SP-V1 debe comprobar la transición real.

**Decisiones locales:** carga provisional de identidad, textos de ausencia y prioridad del error son UX de la réplica. Permanecen `unverified` el comportamiento SUM durante carga/error y su apariencia exacta. Ninguna observación nueva de producción es necesaria para implementar este requisito local.

## Decisión Sol y contrato SP-UI-1

Sol resuelve el límite entre estructura estable y datos obligatorios: `Shell` será `shellComponent` de la raíz, recibirá `children` y los renderizará en el `main` existente. El `component` raíz renderizará exclusivamente `Outlet`. El pending raíz y los pending de hijos seguirán siendo `RoutePending` dentro del área principal. Root error/not-found también quedarán dentro de la misma estructura. Definir `pendingMs: 0` únicamente en la raíz para que la primera carga publique su presentación sin esperar el umbral global; conservar los demás tiempos y política de caché existentes.

Una nueva lectura opcional de identidad en `src/data/useShellStudent.ts` distinguirá **pending**, **ready** y **error** mediante el match `__root__`. Usar `getRouteApi('__root__').useMatch({ shouldThrow: false })` para inferencia tipada; match ausente o loaderData ausente durante carga significa pending, no fallo. Priorizar status error sobre cualquier loaderData anterior; ready solo adapta `loaderData.data.alumno` disponible mediante `toStudentSummary`. Se puede conservar un resumen previamente validado durante revalidación si el match tiene loaderData y no está en error. No convertir optional data a `any`, no capturar excepciones para inventar una identidad y no cambiar los hooks estrictos de pantallas.

| Estado / transición | Cabecera y menú | Área principal / datos |
| --- | --- | --- |
| Primer pending raíz, sin identidad | Marca/sidebar/topbar y controles de navegación operables. Zona cuenta muestra `Cargando alumno…` como texto provisional; sin botón de cuenta ni código/nombre inventado. | `RoutePending` conserva `role="status"`. Las pantallas consumidoras no se montan antes del loader raíz. |
| Root success | Cuenta y menú actuales reciben nombre/código del resumen validado. | `Outlet` muestra vista real y sus loaders. Formulario/Inicio conservan hooks y datos existentes. |
| Pending de hijo con raíz disponible | Resumen/navegación siguen disponibles. Colapso decidido por usuario se conserva. | Pending o vista anterior según transición/caché vigente del router; cuando aparece pending se ubica en `main`, sin sustituir Shell. |
| Error raíz / respuesta inválida | Navegación y cabecera disponibles; cuenta muestra `Información no disponible`, sin menú ni identidad obsoleta. | `RouteError` con mensaje y `Intentar de nuevo`; datos inválidos jamás se presentan como ready. |
| Retry raíz | Misma estructura; cuenta provisional hasta datos válidos, o error si vuelve a fallar. | `router.invalidate()` existente reejecuta loaders; no reload del documento. |
| Error de hijo | Identidad raíz válida disponible; navegación operable. | Error/retry de hijo vigente. No introducir captura global que oculte el error. |
| Not-found | Estructura de navegación disponible cuando se presenta match raíz. | Mensaje y Link `Volver al inicio` existentes. No cambiar rutas/aliases. |

Contrato HTTP fijo: `sumApi.get('formulario', { signal: abortController.signal })`, su forma de retorno, validación runtime, selección mock/local/api y `staleTime: 60_000` quedan vigentes. No nueva solicitud desde Shell/hook, repositorio, seed o persistencia. Estados UI se derivan del router; navegación y retry pueden disparar solicitudes que ya prevé su caché/invalidation. «Una consulta» significa no añadir otra por render/montaje del shell; no suprimir abortos, precargas o reintentos legítimos. No hay tarea backend ni división client/backend.

## Invariantes de alto impacto

| ID | Invariante y comprobación |
| --- | --- |
| SP-I1 | Root loader conserva request, signal y validación. HTTP local fallido o JSON inválido nunca hace fallback a mock; auditoría de diff y escenarios error/invalid. |
| SP-I2 | Shell puede montar sin formulario, pero vistas con hooks estrictos solo acceden a datos disponibles. Sin llamada `useStudent()` en Shell; SP-V1 initial/error/retry sin excepción. |
| SP-I3 | Identidad proviene únicamente del DTO raíz validado; pending no genera nombre/código de prueba y error no presenta identidad previa como vigente. Comparar antes/después de respuesta sintética. |
| SP-I4 | Una instancia Shell rodea límites de rutas; solo el main puede cambiar por active.id. Sidebar elegido visible sigue visible durante pending/error; colapso explícito del usuario conserva semántica `aria-hidden`/`inert`. |
| SP-I5 | Links SPA, `Outlet`, caché, retry, back/forward y datos locales mantienen su origen. Ningún href/document reload nuevo, endpoint externo, estado paralelo de fetch o consulta adicional por Shell. |
| SP-I6 | Sin browser/servidor contra snapshots privados, lectura de `datos-reales/` ni tráfico SUM. La aceptación usa backend explícitamente sintético separado; detener únicamente verificación si no puede acreditarse ese entorno. |

## Handoff Luna y dependencias

Un solo `sum-executor` o `sum-implementer`, GPT-6 Luna High, secuencia SP-C1–C3. Leer `client/AGENTS.md`, `client/.agents/skills/sum-react-implement/SKILL.md`; consultar las skills `react-router`/`router-core/data-loading` ya disponibles y Context7 si necesita otra sintaxis. No delegar. No está solo en el workspace: conservar modificaciones ajenas y revisar archivos vigentes antes de editar. Contrato fijado arriba antes del despacho.

Propiedad exclusiva del worker: `client/src/data/useShellStudent.ts` (nuevo), `client/src/components/Shell.tsx`, `client/src/routes/__root.tsx`. No es necesario cambiar CSS, router.tsx, RouteStatus, useStudent, data transport/adapters, rutas hijas, árbol generado, backend ni configuración. Si un check demuestra necesidad de otro archivo, devolver evidencia al principal para reasignación explícita.

| Tarea | Dependencias / interfaz | Archivos exclusivos de la unidad | Aceptación / verificación | Estado / reparaciones |
| --- | --- | --- | --- | --- |
| SP-P1 / fijar frontera estable | SP-E2–E4, RI-CONTRACT-1 | Este documento y enlace incremental del plan RI, planner | Estado UI, HTTP preservado, criterios y ownership fijos; consistencia documental | completada; 0 |
| SP-C1 / identidad opcional | SP-P1; match tipado raíz → union pending/ready/error | `data/useShellStudent.ts` | Adaptación existente solo con loaderData; root error prioritario; sin fetch/cast/fixtures; inspección de diff | lista; 0 |
| SP-C2 / Shell sin dependencia bloqueante | SP-C1; React children y resultado hook | `components/Shell.tsx` | Cambiar Outlet por children; hook opcional; cuenta provisional/error; resto markup/links/estado actuales; navegación no depende del alumno | lista; 0 |
| SP-C3 / límite raíz | SP-C2; Shell wrapper / Outlet componente | `routes/__root.tsx` | shellComponent único, component Outlet, root pendingMs 0; loader/caché/error/not-found existentes; build/lint | lista; 0 |
| SP-V1 / aceptación principal | SP-C3; entorno A inequívocamente sintético, browser asignado | Evidencia futura `evidence/local/sidebar-pending/verification.md` y capturas sintéticas; propiedad del principal | Escenarios siguientes, build/lint reales y diff; sin producción ni mocks para acreditar integración | pendiente; 0 |

SP-C1/C2/C3 son etapas de un mismo propietario; no paralelizar sobre Shell/root ni despachar backend. Planner no implementó ni delegó ninguna unidad.

## Aceptación observable y verificaciones propuestas

1. **SP-INITIAL:** abrir directamente ruta canónica `/alumnoWebSum/v2/matricula/programacion` en contexto sin caché. Demorar de forma controlada la respuesta de formulario de un backend sintético real, conservando cuerpo y status originales. Antes de resolver, marca, sidebar y topbar están visibles y existe status en main; expandir Matrícula/Reportes, operar menú por teclado y toggle. Zona cuenta no muestra datos fabricados. Tras liberar respuesta, nombre/código y contenido corresponden al DTO real; mismo elemento sidebar/estado de colapso, sin error de hooks.
2. **SP-CHILD:** con raíz cargada, navegar por Link a vista con loader aún pendiente y luego resolverla. Sidebar/topbar/resumen permanecen y contenido final viene del API propio. No navegación de documento ni shell duplicado. Cuando caché/precarga evite pending, usar contexto nuevo o ruta no precargada, no cambiar políticas para forzar el escenario.
3. **SP-ROOT-ERROR:** primera petición formulario con 503 sintético y otra variante malformada: main presenta error, shell sigue operable, sin resumen ni datos mock. Permitir backend válido y pulsar retry: root/main se recuperan vía invalidation. Intercepción negativa prueba UI de error; respuesta de éxito debe proceder del backend sintético real.
4. **SP-CHILD-ERROR:** error de Programación con raíz válida: resumen disponible y error dentro del main; recuperar mediante retry. Navegar a Inicio y atrás/adelante permanece SPA; Formulario conserva sus ocho secciones y datos raíz sin petición duplicada por Shell.
5. **SP-NAV-PENDING:** durante demora raíz navegar mediante menú a otra ruta, luego liberar solicitudes. Ruta/contenido final corresponden al último destino, sin excepción ni identidad procedente de respuesta inválida/cancelada. Contar peticiones con causa: precarga/invalidation/aborto son legítimos; una segunda consulta desde hook/Shell sería fallo.
6. **SP-MODES/NOTFOUND:** modo mock conserva navegación/resumen habituales sin HTTP; no introducir nuevo tráfico en modo api. Not-found conserva shell y vuelta a Inicio. Respeto de datos accesibles y roles en pending/error; ninguna captura con datos privados.

Checks de implementación: `pnpm --dir client build`, `pnpm --dir client lint`, `git diff --check`. Registrar comandos y resultados reales. Suite global `verify` tiene limitaciones históricas registradas en RI; no repararla ni reiniciar su contador para este alcance. `test:data`/tests/browser se ejecutan solo cuando el principal tenga autorización de verificación y propiedad de sesión. Si cambia únicamente estos tres archivos, no requiere retestar backend ni repetir todas las 16 pantallas. La prueba SP-INITIAL/ERROR sí es necesaria para acreditar esta extensión funcional; build/lint solos no bastan.

Planificación: solo lectura local de instrucciones/código/documentos y consulta de documentación pública; no ejecución de app, pruebas, capturas o inspección SUM. Consistencia/enlaces y diff de documentos se validan al entregar. SP-V1 queda pendiente.

## Riesgos y escalamiento

- Un shell que llame hooks estrictos suspendería/fallaría fuera del límite interior. La separación opcional es obligatoria y se comprueba con primer pending y root error.
- En revalidación puede haber loaderData previo: solo mostrarlo si no hay error, sin tratarlo como nueva respuesta ni borrar el mensaje de error. El hook no decide políticas académicas.
- `shellComponent` está fuera de los catch interiores; mantener su lógica simple y segura, sin nuevas consultas ni transformaciones sobre undefined. Tipado/build y transición real son criterios obligatorios.
- El tiempo de primera publicación del match es controlado por el router; root pendingMs 0 y SP-INITIAL deben corroborar shell visible antes de resolución. Si no ocurre en la versión instalada, tras un ciclo de reparación entregar traza segura y pregunta Sol concreta: «¿debe moverse el shell a InnerWrap de RouterProvider para cubrir el intervalo sin match?». No ampliar arquitectura/ownership por cuenta del worker.
- Máximo un ciclo automático de reparación de esta extensión nueva, sin reiniciar contadores RI anteriores. Escalar a Sol únicamente incompatibilidad del límite/hook instalado, necesidad de rediseñar la frontera de datos o fallo persistente con evidencia. El requisito local ya está decidido; incertidumbre de referencia SUM no bloquea su implementación.

### Huellas de entradas de código y contrato

SHA-256, leídas el 2026-10-08; revisar vigencia antes de implementación:

| Archivo | SHA-256 |
| --- | --- |
| `client/src/routes/__root.tsx` | `b08e0373e5e73806db4ca657483245d679023194773868fc26e973f5e0fb310e` |
| `client/src/components/Shell.tsx` | `eb30e928a465778efd7e25d79d040ab46a420a40c0229c14b5c46e795b75f732` |
| `client/src/data/useStudent.ts` | `399f5cd0317679997c9e71fde0218e0a20d26e2d9c2011ba2c8e6fba57406a83` |
| `client/src/components/RouteStatus.tsx` | `24e1e27724712733975d4883402f1a76940c46cb4a9c3447ab4e3a06b8ddcf51` |
| `client/src/router.tsx` | `8cb8d0da4e10fc77a861ac5e90bb02cc01a2639a9f89dfe3f968f6d72de47567` |
| `contracts/local-api/remaining-implementation.md` | `f67e4d93c998e021b0f5b6b3cc8d9cdc746b4218d2bd3a8f8e59271ff5a7c608` |
