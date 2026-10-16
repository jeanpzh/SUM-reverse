## Extensión de escenarios completos — 2026-10-16

Decisión local solicitada: los escenarios Docker incorporan los dos conjuntos académicos que el operador confirmó íntegramente sintéticos. Conservan los archivos originales y la interfaz SUM. El plan contiene 97 filas/85 cursos; la programación 165 filas/56 cursos. Software usa esta misma base con escuela adaptada, no un plan oficial verificado. Los horarios/cupos de la primera sección de ocho cursos son variantes explícitas del escenario; el resto conserva los datos fuente.

Se reutilizan contratos existentes: `plan` admite contexto PS-1 o envelope validado por `validatePlanEstudiosWire`; `programacion`, contexto PS-1 o envelope de programación existente; `perfil`, null PS-1 o perfil local-v1. No cambian endpoints, identidad, sesiones ni envelope exterior. El cliente valida cada representación y reutiliza TableScreen y Profile. Los valores vacíos del contrato PS-1 siguen vigentes para ese fixture reducido; los actores enriquecidos incluyen datos personales ficticios, formulario y ficha con valores sintéticos, historial y ponderados calculados. El ledger admite periodos 20xx-0/1/2 anteriores al periodo activo y actas sintéticas únicas de hasta cuatro dígitos.

Cada actor enriquecido tiene 64/65 intentos, nueve periodos, 60/58 aprobadas y ocho cursos válidos en prematrícula. Las repitencias resueltas no son pendientes. Recomendación A: C09,C10,C11,C12 (12 créditos); B: C07,C08,C09,C10 (13 créditos). Prioridad B: C08,C09,C10,C14 omite C07. C13 requiere C09 y permanece fuera de prematrícula; su caso negativo usa C10,C11,C12,C13. Las secciones y los prerrequisitos proceden del catálogo completo. El resultado esperado de los 36 casos no cambia.

Validación y límites: `evidence/local/scenario-access/expanded-data.md`.

# Local profile dashboard API

## Unified local scenario entry (user-requested direct implementation)

Only `/local/login` may change its layout. It lists all nine existing synthetic scenarios and four existing student profiles, with summaries, recommended selections and expected results. All other SUM screens/components/navigation remain unchanged. `prerrequisito` must explain that C13 is excluded before selection; its forged HTTP-only submission is not a UI instruction.

Own API additions, reusing this namespace and existing MR error envelope:

- `GET /local/perfiles/v1/escenarios`, no query/body, returns `{runId,data:{serverNow,currentScenarioId,scenarios}}` validated by `validateScenarioCatalogResponse`; exact shared types `ScenarioCatalog/ScenarioChoice/ScenarioProfile`. Without configured scenario seeds: `scenarios:[]`, `currentScenarioId:null`, preserving legacy four-profile behavior. Configured: all nine in shared `scenarioIds` order, four profiles in existing actor order.
- `POST /local/perfiles/v1/escenarios/seleccion`, exact JSON `{runId,scenarioId}`, no query, HTTP200 returns the existing `ProfileCatalog` envelope with a fresh runId. Validate body with `validateScenarioSelectionRequest`; invalid paths/query/fields/scenario return 400 INVALID_REQUEST. Mismatched runId returns 409 RUN_CHANGED without effects. The operation queues on the existing repository, starts the chosen synthetic fixture from scratch and clears sessions/requests/enrollments/reports. One active test per local server; starting a new one invalidates other local tabs, which retain existing RUN_CHANGED handling. The access UI states that starting a test restarts the active scenario. No production authentication or endpoint is involved.

The client then enters its selected actor using the existing session flow, guarded by the new runId returned from selection, so a concurrent scenario change cannot silently enter another scenario. Transport/runtime checks remain in the client data layer. No automatic enrollment submission, lost-response replay or modification of recovery intents.

Local browser console: `MODE = DEV` selects the existing development views without the scenario chooser; `MODE = SIM` selects the synthetic entry. Expose `DEV='DEV'`, `SIM='SIM'`, and a validated `MODE` accessor only with local data mode and `VITE_SUM_DEVTOOLS=1`. Assignment persists the mode in the tab's sessionStorage (`sum:mode`) and automatically navigates/reloads (`/` for DEV, `/local/login` for SIM); no process/container restart. Clear only saved local profile session on a real mode change; preserve MR pending-intent records. Assigning the current mode has no effects. Invalid values throw without effects. Default SIM in the Compose local configuration: a fresh tab opens the scenario chooser immediately. No panel. This toggles local presentation/data adapters, not access to production SUM.

Default startup becomes `docker compose -f compose.local.yaml up --build`, with all scenarios bundled into the app; no dataset mount or export/generation command is required. The independent `compose.prod.yaml` remains operator-owned and must not be launched by agents with private data. No overlay files remain. Local Compose must use independently synthetic built-in data. No new dependencies.

**Revision: LPD-CONTRACT-1, 2026-10-14. Status: READY (frozen), reconciled with [LPD-DEC-1](../../plans/local-profile-dashboard-decisions.md); all additions local-only.**
Authority for the existing enrollment wire remains [MR-CONTRACT-2](matricula-regular.md). This frozen contract adds profile discovery and actor-scoped dashboard reads (logout is client-only, LPD-DEC-1 D3); it does not rename or enlarge MR2 requests, responses, error enums or recovery storage. No production authentication is implemented.

## Architectural decisions applied

LPD-DEC-1 resolved the four review points: (D2) six academic keys use MR2 Context/Report; (D2) `perfil` is the explicit unavailable branch `payload: null`, and the alumno projection uses only values valid under local-v1 without invented personal facts; (D6) activation requires `VITE_SUM_DATA_MODE=local` plus `VITE_SUM_LOCAL_PROFILE=synthetic-actors` and the isolated bootstrap; (D3) there is no server revocation or session-read endpoint, logout is client-only, and a lost entry response is recovered by deliberate re-entry. No worker may weaken validators or silently fabricate facts.

## Types and runtime boundary

Use MR2 `MatriculaRegularId`, `MatriculaRegularUuid`, `MatriculaRegularScope`, `MatriculaRegularSession`, `MatriculaRegularContext`, `MatriculaRegularEnrollmentReport`, envelope and error types directly from `shared/matricula-regular.mjs`/`.d.mts`. `ActorId` is the closed union `'SYN-SIS-A'|'SYN-SIS-B'|'SYN-SOFT-A'|'SYN-SOFT-B'`, stricter than the general SYN ID grammar. UUIDs and ISO instants retain MR2 validators. `Identity={runId:MatriculaRegularUuid,actorId:ActorId,sessionId:MatriculaRegularUuid}`.

New shared files `shared/local-profile-dashboard.mjs` and `.d.mts` own these exact shapes (all object keys exact, arrays without duplicates):

```ts
type ProfileChoice = { actorId: ActorId; name: string; scope: MatriculaRegularScope }
type ProfileCatalog = { serverNow: string; profiles: ProfileChoice[] }
type DashboardKey = 'perfil'|'formulario'|'historial'|'fichaSocioeconomica'|
  'matriculaInfo'|'programacion'|'prematricula'|'matricula'|'horarios'|
  'evaluaciones'|'deudas'|'asistencias'|'tutoria'|'plan'
type AcademicKey = 'matriculaInfo'|'programacion'|'prematricula'|'plan'
type ReportKey = 'matricula'|'horarios'
// LegacyMap means existing client ApiResponseMap, not a copy or backend runtime import.
type DashboardPayloadMap<LegacyMap> = Omit<LegacyMap, AcademicKey|ReportKey|'perfil'> &
  { perfil: null } &  // LPD-DEC-1 D2: explicit unavailable branch
  Record<AcademicKey, MatriculaRegularContext> &
  Record<ReportKey, MatriculaRegularEnrollmentReport|null>
type DashboardRead<K extends DashboardKey, P> = {
  actorId: ActorId; sessionId: MatriculaRegularUuid; key: K; serverNow: string;
  payload: P
}
// Every success: MatriculaRegularEnvelope<T> = {runId,data:T}.
```

Catalog has exactly four entries, ordered SIS-A, SIS-B, SOFT-A, SOFT-B. Names/scopes come from the current synthetic repository actor, never a second identity fixture. No secret, password, cookie, token or persistent browser identity. No arbitrary actor/fixture/scope selectors.

Exports: `dashboardKeys`, `validateProfileCatalogResponse(value:unknown)`, `validateDashboardIdentity(value:unknown)`, and `validateDashboardReadResponse<K,P>(value:unknown,expected:Identity & {key:K},validatePayload:(payload:unknown)=>asserts payload is P)`, all response validators assertion signatures. Also `validateDashboardKey(value:unknown):asserts value is DashboardKey`. Validate serverNow as canonical UTC ISO milliseconds, run/actor/session/key correlation before payload use. Session create/renew responses keep the existing MR2 `validateSessionResponse`. Shared module reuses exported MR2 validators and does not import client/backend. Client binds `DashboardPayloadMap<ApiResponseMap>` to avoid a parallel legacy type map. Existing MR2 validators validate context/report payloads wrapped as `{runId,data:payload}`; null report allowed only for dashboard read, never MR-REPORT success. `perfil` payload must be exactly `null` in this revision.

Legacy payload keys reuse `parseResponse`, `validateMiInformacionResponse`, `validatePlanEstudiosWire`, `validateMatriculaWire`, `validateAsistencias`, `validateTutoriaLocal` as applicable, not duplicate schemas. MI representation for this synthetic branch is always `local-v1`; pass it to existing parser and preserve representation metadata. Academic keys deliberately use existing MR2 domain objects: the old wire requires fabricated official fields, numeric sections and unrelated seeded reports, so it is incompatible with committed synthetic state. Migration is confined to new transport/dashboard branches; old `ApiResponseMap` and old wire remain intact. `DashboardPayloadMap` has no `unknown` or cast-only payload boundary.

## HTTP (backend paths, client prepends same-origin /api)

| Method/path | Exact input | HTTP200 data | Effects |
| --- | --- | --- | --- |
| GET `/local/perfiles/v1/perfiles` | No query/body | ProfileCatalog | None; available without session |
| POST `/local/matricula-regular/v1/sesiones` | Existing `{runId,actorId}` | Existing MR2 Session | Exactly one create request per deliberate entry; existing MR2 wire |
| GET `/local/perfiles/v1/consultas/:key` | Exactly `runId`, `actorId`, `sessionId` query | DashboardRead for key | None; active session required |
| POST `/local/matricula-regular/v1/sesiones/:sessionId/renovar` | Existing `{runId,actorId}` | Existing MR2 Session | Explicit button only, same ID/startedAt, expiry=now+900000 |

Use `credentials:'omit'`, Accept JSON, Content-Type JSON for POST, AbortSignal, no redirects to external services. GET rejects any body, missing/extra/duplicate query, invalid key/path encoding; POST rejects unknown fields/null/arrays/query. Use existing request parsing patterns and `MatriculaRegularErrorFilter` with MR2 JSON `{runId,error:{code,fields}}`. Structurally invalid input400 INVALID_REQUEST; run mismatch409 RUN_CHANGED; unknown actor404 ACTOR_NOT_FOUND; unknown session404 SESSION_NOT_FOUND; actor/session mismatch409 SESSION_CONTEXT_MISMATCH; expired409 SESSION_EXPIRED; internal failure500 LOCAL_FAILURE. Precedence: structure → run → actor → session exists → identity → expiry → projection. No new MR2 error code. LPD defines no session-close or session-read route (LPD-DEC-1 D3). All failures retain current runId and field paths only, no raw input. Context/result/report endpoints keep their existing precedence.

### Closed actor union and error precedence clarification

The four literal ActorId values are part of structural validation. An arbitrary grammatical SYN ID outside that closed union returns400 INVALID_REQUEST (query.actorId), before run lookup. A recognized ActorId absent from the current run returns404 ACTOR_NOT_FOUND after run validation; this can occur in controlled reset fixtures. MR2 session endpoints retain their own broader SYN-ID grammar and404 behavior unchanged. This clarifies the existing frozen schema/implementation precedence and adds no supported actor, route or wire field. Recorded by coordinator after Claude backend review; local-only, not SUM behavior.

## Server session/run and clock

One `MatriculaRegularRepository` instance is imported/exported through `MatriculaRegularModule`; never register duplicate provider. LPD service only reads its snapshot and never mutates sessions. Session creation/renewal remain MR2; login is catalog → createSession → `consultas/formulario`. Activation: the client branch exists only when `VITE_SUM_DATA_MODE=local` and `VITE_SUM_LOCAL_PROFILE=synthetic-actors` (absent → legacy behavior; any other value, or that value with a non-local mode → configuration error); the backend side runs only in the isolated test app/bootstrap, never AppModule. A failed entry never exposes dashboard. Button double click shares one in-flight Promise; no automatic POST retry. A lost creation response offers a deliberate new entry; an unreachable orphan session expires naturally (MR2 create is not idempotent). Independent tabs may have independent entries. Session is not an academic eligibility gate: all four actors may enter to inspect known synthetic data even when context is blocked.

Server demo clock: add `createAdvancingSyntheticClock(base='2026-08-11T14:00:00.000Z',elapsedNow:()=>number=()=>performance.now()):ServerClock`. Capture baseline once; `now = base + max(lastElapsed,elapsedNow()-startElapsed,0)`. One instance shared by catalog/session/context/submit/report in the isolated demo process. Base is the inclusive start of SYN-WINDOW-1, giving 2 h of open synthetic window per process; afterwards OUTSIDE_WINDOW is the correct result and a restart creates a new run. AppModule/MatriculaRegularModule keep `createSystemClock`. Keep `createFixedClock` and current unit-test factories fixed. Duration exactly900000ms, active iff now<expiresAt, equality expired. This clock advances within August with elapsed wall time; it does not change F6 published rows, unknown11–12 hours or documentary profile eligibility. Browser countdown: for each validated server instant S received at monotonic T_r (`startedAt` for create, `expiresAt−900000` for renew, `serverNow` for consultas), set `deadlineMono=T_r+(expiresAt−S)`; this is never earlier than the server deadline. Round remaining seconds upward and clamp at0; at0 the store becomes `expired`. It is display only; no GET, focus, hover, navigation or timer creates/renews a session. Client wall-clock edits cannot grant time.

Run restart/reset creates a new run and removes all sessions/results. `consultas` with an old run returns409 RUN_CHANGED; the client clears displayed actor data/router caches immediately (store `anonymous` plus reset notice), and the next entry's existing `restoreIntent` reports `reset` before deleting old-run intent. No replay into a new run.

## Projections and all-route coherence

`DashboardProjectionService.read<K>(key:K,identity:Identity):MatriculaRegularEnvelope<DashboardRead<K,DashboardPayloadMap<ApiResponseMap>[K]>>` is the client-facing type; backend declares a structurally compatible local map by reusing existing backend types, not importing client. Backend `read` takes one cloned run snapshot and one sampled now; passes snapshot/now into pure projection functions. No snapshot files/env, existing operator repositories, AppModule or mockResponses are reachable from this branch.

| Keys | Deterministic synthetic projection |
| --- | --- |
| formulario | Existing FormularioLocalData shape and eight existing catalogs; alumno.codAlumno=actorId, names from actor.name, school/plan/scope from same actor, ponderado from actor. All optional personal values empty/null per existing validators; readonly flags false, no completion claim. |
| perfil | Payload exactly `null` (explicit unavailable branch, LPD-DEC-1 D2): local-v1 requires a real `fechaNacimiento`, and no personal facts exist for these actors. The Profile screen shows identity from formulario plus “Datos personales no disponibles para perfiles sintéticos”. |
| historial | PS-1 synthetic-profile bootstrap may provide a validated local-only academic ledger. Project only its explicit attempts into the existing HistorialAcademico shape; derive summary, period averages, distinct approved courses and actor ponderado from explicit attempt outcomes. An absent ledger preserves the legacy empty history. This data is a demonstration, not an official academic record. |
| fichaSocioeconomica | Same alumno, 13 existing catalogs, values null except actor identity fields, familiares[]. |
| matriculaInfo, programacion, prematricula, plan | Existing Context from same actor/profile/offer and sampled now; reuse ContextService evaluator through extracted snapshot projection, not a second gate evaluator. Plan/prematrícula show known course documents/offer and gaps; no official complete-plan claim. |
| matricula, horarios | Report copy from snapshot.reports associated with snapshot.enrollments[actorId], or null when no enrollment exists. Association must match actor/scope/revision/enrollment/request; inconsistency500, never seed/null to hide corruption. Rows/totals/schedule exactly committed report. |
| evaluaciones, deudas, asistencias, tutoria | Existing valid empty envelopes. Show “Sin registros sintéticos en esta demostración”; empty debt/attendance/tutoring does not imply institutional requirements met or fulfilled. Enrollment eligibility still uses actor.institutional, labeled synthetic. |

### PEM-1 opt-in enrollment scenarios (local-only semantic extension)

The explicit `--scenario` launcher option may supply one of the nine fixture bundles defined in [PEM-1](../../plans/perfiles-escenarios-matricula.md). Each bundle keeps the existing four actor IDs, scopes, profile revisions, HTTP schemas and projections. It derives academic state from the synthetic ledger and provides controlled offer, pre-enrollment, capacity, schedules and institutional/tutoring requirements for reproducible local cases. It starts with no enrollment or report; only an accepted submission creates them. This option does not change the default PS-1 bootstrap or authorize UI changes.

The operator explicitly confirmed that `datos-sinteticos/` is entirely synthetic. Only the allowlisted academic fields from its plan file inform Systems course vocabulary, cycles, credits and types; no identity or personal record is imported. Software vocabulary and all scenario rules and schedules remain local design choices. Empty debt/tutoring read envelopes keep their existing meaning and do not establish that the corresponding enrollment requirements are met. Exported expected outcomes are test cases, not observations of SUM. See PEM-1 for precise seeds, provenance and acceptance.

PEM-1b correction: the scenario seed derives pre-enrollment from not-yet-approved offered courses whose prerequisites are explicitly approved in its synthetic history. The same pre-enrollment feeds both dashboard reads and the existing enrollment selector. In these seeds A exposes C09–C12, B exposes C07–C10, and C13 is absent. The `prerrequisito` negative HTTP case deliberately bypasses the selector and must be rejected; it does not authorize displaying an academically unavailable course. This coherence requirement comes from user testimony and local simulation design, without new production observation or wire changes.

### PS-1 synthetic academic profiles (local-only semantic extension)

This addendum changes only the data returned by `historial` for the isolated synthetic-profile bootstrap. It does not change HTTP paths, methods, query shapes, envelopes, shared validators, MR2 wire contracts, enrollment state, other dashboard projections, or the four actor IDs/scopes. The detailed seed shape and acceptance criteria are in [PS-1](../../plans/perfiles-sinteticos.md). Catalog titles, grades, periods, credits, plans and outcomes are synthetic design choices; public curriculum pages only informed candidate subject vocabulary and do not establish that these records belong to an official plan or student.

Each attempt must carry an explicit `approved` or `failed` result. Do not infer a passing result from its grade or apply an unverified SUM grading rule. Summary credits count distinct approved courses once; weighted averages use all explicitly recorded attempts and are calculated by the local seed rule documented in PS-1. No personal, socioeconomic, health, debt, or family information is added. This addendum does not authorize preloaded enrollment reports or changes to the selection, submission, capacity, or recovery workflows.

Legacy alumno projection uses the existing full AlumnoFixture type and must pass `alumnoLocal`: every numeric code (codFacultad, codEscuela, codEspecialidad, areas, ciclo, anio*, tickets) is 0, with no official-looking codes; planId exact; period legacy`2026-2` only inside legacy DTO, visibly same scope2026-II. Names: nomAlumno=actor.name, both surnames empty. desFacultad=scope.facultyId ('FISI'), desEscuela=scope.schoolId, desEspecialidad='No disponible' (nonempty required), desPlan=scope.planId, correoInstitucional/urlFoto/foto empty; all other strings empty, finite numeric fields0, booleans false, nested infoSemestre/infoMatricula required strings empty and nullable/opaque fields null. `ponderado` overwritten by actor.ponderado (default known). No permission derives from these legacy placeholders. Form fields with identity labels reference this projection; other values null. Reuse catalog builders without constructing legacy repository providers. Add profile banner explaining unavailable facts, not “Regular”, paid, health approved or official state inferred from zero/false.

Home and Manuales remain current components/static resources; all other 14 routes use keys above. All 16 retain URL/navigation identity and global shell. In profile mode the matricula-informacion route renders `LocalAcademicView` (Context) with a link labelled exactly “Ver matrícula” to `/local/matricula-regular` inside the same Shell. This is a local-only user decision: observed SUM `#irRepMat` targets `v2/reportes/matricula`, and entry there is `#iniciarMatricula`→`registro`, so no SUM parity is claimed. `EnrollmentInfo.tsx` is unchanged for legacy modes. After acceptance the existing result dialog links the committed report route, which requires `search.runId/actorId` to equal the active store identity; otherwise it redirects to `/alumnoWebSum/v2/reportes/matricula` without fetching. Outside profile mode `/local/matricula-regular` shows only an availability notice. RegularEnrollment consumes global actor/session, removes its actor selector/session-create controls and local default actor. It keeps academic entry gates and existing panels/dialog/recovery; no report existence gate. Existing report menu uses RegularEnrollmentReportView for committed report or explicit empty local state; horarios builds rows from the same report via buildReportView/DataTable, never current offer. Other academic screens reuse PreEnrollmentPanel, EnrollmentCalendarPanel, AcademicRequirementsPanel, CourseSelectionPanel and shared tables without inventing missing institutional fields.

## Memory, navigation and recovery

Client owns one module-scoped `createLocalProfileSessionStore()` with `getSnapshot`, `subscribe`, `enter(actorId):Promise<void>`, `renew():Promise<void>`, `logout():void`, `observe(serverNow:string):void`, `markExpired():void`, `markRunChanged():void`. Snapshot is a discriminated union anonymous/entering/active/expired/error; active and expired retain `{runId,actorId,sessionId,startedAt,expiresAt,deadlineMono,formulario,generation}`, and error retains no rendered actor data. Expose via useSyncExternalStore. No session/login identity is persisted: no cookie, localStorage or sessionStorage entry holds a sessionId or active actor. The only browser-stored data remain the MR2 pending-intent records (`runId,actorId,requestId,profileRevision,selection`) under `mr:intent:<runId>:<actorId>` in sessionStorage, exactly as MR-CONTRACT-2; they never restore a session or select an actor, and one actor never overwrites another actor's key. Router context consumes the store; root loader stops anonymous formulario fetch, root renders login outside Shell when anonymous. Active loader data retains existing formulario envelope so useStudent/useShellStudent share it; root cache invalidated on identity generation change. Tag asynchronous results with a monotonically increasing client generation and discard stale resolutions even when fetch abort is ignored.

Clarification LPD-DEC-1a (client only; wire unchanged):

- **Identity transitions.** `generation` changes only when the identity tuple `(runId,actorId,sessionId)` changes. Exactly three transitions do this:
  - `enter()` success: no tuple → new tuple. When called from `expired`, `enter()` first performs the logout transition.
  - `logout()`: tuple → none.
  - `markRunChanged()`: tuple → none.

  Only these three run `generation+=1`, `router.clearCache()` and `router.invalidate()`.
- **Anchor-only updates.** `observe(serverNow)`, renew success (same sessionId; only `expiresAt`/`deadlineMono` change), countdown ticks, `markExpired()` and `entering`/`error` states never touch generation, the router cache or `router.invalidate()`. Root `loaderDeps` is `{generation}` only, so these updates re-render subscribers such as the Shell countdown and never re-run loaders. `observe` ignores a `serverNow` whose request generation is stale.
- **Expiry.** `markExpired()` keeps the tuple. If the current match is `/local/matricula-regular`, that already-mounted screen stays and allows only manual MR-RESULT consult of its restored intent: selection, submit, renew and report navigation are disabled. For any other current route, the root immediately calls `router.navigate({to:'/local/login'})` with an expiry notice; this is navigation, not invalidation. While `expired`, root `beforeLoad` sends every protected navigation to `/local/login`, including `/local/matricula-regular` and its report child. The only exception is the screen that was already mounted when expiry happened.
- **Profile route.** The `perfil` route branch in profile mode calls the typed dashboard API directly (`read('perfil',identity)` → `null`) and renders the identity-plus-unavailable branch, exactly like the six academic keys. `sumApi.get` and `ApiResponseMap` stay unchanged. Only the seven compatible keys go through the `sumApi.get` profile branch, which unwraps their validated payload. A profile-mode `sumApi.get` for `perfil` or an academic key is a programming error thrown before fetch; it never uses a mock or legacy fallback.

Actual browser reload starts anonymous and shows chooser. Router navigation does not recreate store/session. Expiry disables new commands and dashboard loads, clears transient selection, preserves MR2 uncertain intent; the currently mounted enrollment screen may still offer manual MR-RESULT consult without renewal (MR2 permits reads after expiry); there is no separate expired view. Protected ordinary routes display expiry/chooser; re-entry creates a fresh session and restores only that actor/run’s uncertain intent. Explicit logout is client-only and synchronous: clear store, bump generation, `router.clearCache()` plus `invalidate()`, navigate to `/local/login`, with no HTTP call. The server session is not revoked and expires naturally (demo selector, not a credential; local-only). Never delete an uncertain intent merely for logout/actor change/expiry. Late submit may have committed: next same-run same-actor login consults exact intent. No polling, auto-resend, inferred rejection or new requestId for retry. Accepted/report publication continues atomic MR2. A submit in flight during logout or actor switch may commit server-side; its late response is discarded by generation, and that actor's intent is restored on its next same-run entry for manual MR-RESULT lookup with zero POST. Already-published replay keeps MR2 priority.

## Acceptance

LP-A01–LP-A12 in [spec](../../../../specs/002-local-profile-dashboard/spec.md) and the [execution plan](../../../superpowers/plans/2026-10-14-local-profile-dashboard.md) define mandatory local checks, extended by the LPD-DEC-1 test table. No global SUM parity, old242/170 completion or private runtime acceptance follows from LPD checks.


## Revisión LPD-CONTRACT-2 (2026-10-14, L-07)

Fuente: testimonio T-01 y V-07→V-08 ([behavior.md](../../../../evidence/sum/matricula-regular/behavior.md)).
Sustituye estas cláusulas anteriores: «Explicit button only» de la fila `renovar`; «It is display only;
no GET, focus, hover, navigation or timer creates/renews a session»; «No session/login identity is
persisted…»; y «Actual browser reload starts anonymous and shows chooser».

- La pestaña guarda en `sessionStorage['lp:session']` solo `{runId, actorId, sessionId}`, validado con
  `validateDashboardIdentity`. Lo escribe `enter()`; lo borran logout, expiración, cambio de ejecución
  y cualquier fallo de `resume()`. No hay cookie ni `localStorage`.
- `resume()` se ejecuta una vez al cargar la aplicación, antes del guard raíz: renueva la sesión
  guardada (MR2 renovar) y lee `formulario`. Si tiene éxito, la sesión queda activa con un plazo de
  900000 ms desde la respuesta; si falla, se borra la clave y queda `anonymous` (`notice: 'reset'`
  solo ante `RUN_CHANGED`). Nunca crea una sesión.
- Renuevan también la vuelta de la pestaña a `visible` y la redirección automática tras una matrícula
  aceptada. La navegación del router, los GET y el reloj no renuevan.
- La cabecera muestra el reloj, el nombre y «Salir». Se elimina el botón «Renovar sesión».
- Es una decisión `local-only`: no describe el mecanismo de sesión de SUM.
