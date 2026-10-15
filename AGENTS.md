# Repository Guidelines

## Private operator JSON: denied to all agents

- `datos-reales/` is excluded from agent access, including all subagents. Do not read, list its contents, search, index, copy, attach, log, upload, edit or use its files as model context. This exclusion is scoped to the directory, not to all JSON files or filenames elsewhere. Existing explicitly synthetic fixture bundles remain usable.
- Do not access private snapshot data indirectly through the running backend, frontend, browser, REA, MCP, API responses, screenshots, caches or logs. Do not start a server with private `MATRICULA_SNAPSHOT_DIR` or run integration checks against real datasets. Ask the operator for a synthetic reproduction or sanitized diagnostic containing only file/key/field path when needed.
- Scripts may be authored for the operator to execute; agents must not run export scripts on production or open the exported files. The operator starts the backend outside the agent sandbox to consume private snapshots locally.
- `.codex/config.toml` defines `sum-data-private` with filesystem deny rules; `codegraph.json` and `.gitignore` exclude the private directory. Instructions apply immediately, but technical sandbox enforcement requires a new session with this profile active and no legacy full-access/sandbox-mode override. MCP and browser controls are separate. Never claim a running unrestricted session became isolated by editing these files.

## 1. Project Scope and Structure

This repository recreates the **observable interface and behavior** of the UNMSM Sistema Único de Matrícula (SUM). The deliverable is an **independent React frontend and NestJS backend** with synthetic data and explicit local contracts. It is not a production replacement or a recovery of SUM private backend implementation.

- Work on the React application in `client/`.
- Implement the independent NestJS and TypeScript backend in the existing `backend/` project. Read `backend/AGENTS.md`; do not create a duplicate `server/`.
- Read `client/AGENTS.md` for frontend work. Each folder uses its own `.agents/skills/` entrypoints.
- Local API contracts: `docs/reverse-engineering/contracts/local-api/`.
- Behavioral evidence: `evidence/sum/<flow>/behavior.md` and synthetic experiments in `evidence/local/<flow>/behavior.md`.
- React and TypeScript source: `client/src/`.
- Static files: `client/public/`.
- Imported assets: `client/src/assets/`.
- Screen evidence: `evidence/sum/<screen>/`.
- Academic domain dossier: `docs/domain/fisi/2026-II/`; its faculty, period, provenance and unresolved questions delimit its use.
- Spec Kit is initialized at the root in `.specify/`. Review its active templates, workflow and constitution before use; an unfilled template is not an adopted project principle.
- Persistent reverse-engineering notes and plans: `docs/reverse-engineering/`.
- Workflow and model-routing policy: `.agents/skills/sum-workflow/SKILL.md` and its linked references.

Implement only behavior supported by evidence or explicitly identified as a local prototype assumption. Never represent an assumption as a verified SUM behavior.

**Fidelidad visual y de interacción (preferencia explícita del usuario):** conservar las pantallas SUM ya replicadas, su estructura, estilos, componentes, textos y navegación al integrar nuevas funcionalidades. Adaptar los datos, contratos y estado de sesión a esas interfaces; no sustituirlas por vistas genéricas ni rediseñarlas para facilitar la implementación. Una interfaz local expresamente aprobada, como un selector de acceso, autoriza únicamente esa pantalla y no cambios visuales en el resto del dashboard. Si falta evidencia para una interfaz o comportamiento, consultar al usuario antes de inventarlo. Que el flujo funcione no acredita su fidelidad al SUM.

Before creating a contract, component, DTO, validator or data adapter, review the existing local contracts and implementations in `shared/`, `client/src/components/`, `client/src/data/` and the relevant backend module. Reuse or extend compatible artifacts first. Record the incompatibility and migration impact before introducing a replacement; do not create parallel contracts or components for the same behavior.

## Root orchestration and folder ownership

The root agent coordinates the task using `.agents/skills/sum-workflow/SKILL.md`. Root responsibilities are evidence acquisition, specifications/shared API contracts, task dependencies, model dispatch, browser ownership and integrated acceptance. Reuse existing plans and dispatch implementation only after its contract and acceptance criteria are ready.

Orca coordinates future workers. Each worker must receive the current root and folder instructions, assigned stage, source restrictions, exclusive files, contract revision, acceptance criteria and required tests. Existing Orca coordination does not authorize additional workers, broader access or implementation during a documentation stage. These root restrictions prevail over conflicting folder instructions, skills, historical plans or automation hooks.

| Working folder | Instructions | Skills owned by that folder |
| --- | --- | --- |
| Root | This file | `sum-workflow`, `sum-behavior-discovery`, `sum-evidence-to-spec`, `sum-fullstack-verify` under root `.agents/skills/` |
| `backend/` | [backend/AGENTS.md](backend/AGENTS.md) | `sum-nestjs-implement`, `sum-nestjs-verify` under `backend/.agents/skills/` |
| `client/` | [client/AGENTS.md](client/AGENTS.md) | `sum-react-implement`, `sum-react-verify` under `client/.agents/skills/` |

A handoff includes the target folder, its AGENTS.md and local SKILL.md, exclusive files, contract revision, dependencies, criteria and required checks. Assign backend and client to separate workers only with a fixed shared contract and disjoint file ownership. Workers do not edit root contracts/configuration or the other layer without explicit assignment. The principal may perform a diagnosed isolated correction and must record it.

Todo futuro prompt de planificación, implementación o delegación debe incluir la obligación de preservar la fidelidad visual y de interacción al SUM, las pantallas cuyo cambio está autorizado y la reutilización de las interfaces existentes como criterio de aceptación.

Both implementation profiles use `gpt-6-luna` with `high` reasoning. Existing root implementation/verification skill names are compatibility entrypoints that route to folder skills. Fullstack acceptance belongs to the root and requires actual client/server scenarios. Each layer's own checks alone do not establish integration.

Source, authorization and privacy rules below apply to all folders. Folder instructions refine their own implementation details and must not relax those shared boundaries. Do not duplicate global policy in multiple independent conflicting copies.

## 2. Reference Sources, Authorization, and Safety

Classify the source **before** invoking REA, Playwright, a browser, or network-inspection tools.

### A. Local application or synthetic test environment

Inspection, interaction, debugging, screenshots, and automated tests are allowed only with explicitly synthetic fixtures and local routes. Confirm the running environment's data provenance before inspecting it; localhost alone does not establish that it contains synthetic data. Do not inspect an operator's local server consuming private snapshots.

### B. Previously collected or operator-provided evidence

You may inspect screenshots, sanitized recordings, HTML, JavaScript, and network traces that were lawfully provided for this project and contain no private data or authentication material. Require the operator to sanitize private artifacts before supplying them; never open private data to sanitize it yourself. Prefer offline analysis. Sanitize personal and sensitive data before storing, sharing, or committing evidence. Do not infer unobserved behavior from incomplete artifacts.

### C. Production SUM

**REA and Playwright may inspect production SUM when the requester explicitly states that the target environment/account is authorized and the requested screens and actions are within that authorization.** That explicit statement is sufficient for this repository; a separate institutional authorization document is not required. An authenticated student session, account credentials, or prior access alone does not satisfy this requirement. If the requester has not stated that the target is authorized, or the account, screens, or actions are unclear, pause production inspection and ask for the missing scope. Never silently assume or fabricate authorization.

Once the authorization scope is stated, stay within its boundaries:

- Access only pages and controls permitted for the authorized account.
- Treat the SUM reference as read-only. Do not enroll, submit forms, change profile data, upload files, or otherwise mutate SUM state.
- Do not bypass access controls, enumerate accounts, inspect another student's data, probe administrative functionality, or scan undocumented endpoints.
- Never inspect private backend implementation, databases, server files, credentials, session tokens, or secrets.
- Frontend-observable request and response behavior may be recorded **only if explicitly within the authorized scope**; it does not establish backend implementation details.
- Do not capture or retain authentication material, cookies, authorization headers, sensitive response bodies, or personal identifiers.
- If a state-changing action is needed to observe a state, do not perform it automatically. Ask the authorized operator to supply a sanitized observation or use a local synthetic reproduction.

In the workflow record, note that authorization was explicitly stated by the requester and summarize the target, screens, permitted actions, date, and expiry if provided. Do not copy signatures, personal identifiers, credentials, or authentication material into the repository. If the scope is absent, unclear, or expired, treat production inspection as blocked.

Authorized production inspection remains observation only. Do not run automated tests or synthetic experiments against production, and never use its private data as test fixtures. Authorization to inspect does not relax the private-data exclusions above.

### Safety gate must not block unrelated work

A production-inspection restriction blocks **only that prohibited inspection**, not the entire development task. Continue with existing evidence, local React inspection, synthetic fixtures, implementation, and deterministic validation whenever possible. Document missing reference observations once and mark related behavior `unverified`. Do not repeatedly generate a blocking report in place of feasible local work.

## 3. Evidence-First Reverse Engineering

For each requested screen or flow, follow this sequence:

1. **Understand the task.** Identify the target route, observable states, expected deliverable, and acceptance criteria.
2. **Reuse evidence.** Review existing `evidence/sum/<screen>/`, specifications, screenshots, relevant domain documents and prior workflow notes before collecting more. Check their date, faculty, period, source, verification status and correspondence with the current local code/contracts. Treat old repository documentation as a candidate source until reviewed; its existence does not establish current SUM functionality. Record reused references, discrepancies and remaining uncertainty without contacting production unless its inspection gate is satisfied.
3. **Evaluate the source gate.** Choose local/synthetic, provided artifacts, or explicitly authorized production. Do not cross the production gate by default.
4. **Investigate only gaps.** Use REA for supported artifacts, JavaScript semantics, runtime execution and network observations; use Playwright or controlled REA scenarios for local behavior and UI. Follow `.agents/skills/sum-behavior-discovery/SKILL.md`. Define action, preconditions, state transitions, request/response, visible result and persistence; missing links remain unverified. Stay within the source gate and permitted scope.
5. **Record observations.** Classify normative evidence, observed evidence, testimony and inference separately as defined below; also retain `unverified` and `local-only` status where applicable. Include route, viewport, scroll position, interaction state, source, and collection date when available.
6. **Specify the behavior.** Identify components, layout, navigation, state transitions, validation, errors, effects and any observable network contract in scope. Specify the own NestJS API separately from candidate SUM endpoints; label persistence, permissions and business rules by evidence or local design decision.
7. **Implement in `client/` and/or `backend/` as assigned.** Reuse components, design tokens and the data layer. NestJS modules/controllers/providers implement explicit local contracts with DTO validation and synthetic repositories; do not call or proxy live SUM.
8. **Verify locally.** Run build and lint of affected projects and the tests required by each change's acceptance criteria, exclusively with synthetic fixtures. Check client → own API → state/effect integration for integrated changes, including persistence/repetition when required. Compare reference behavior or visuals only against sufficient equivalent evidence. Build/lint alone do not prove functional fidelity. During specify/clarify, validate documents only and leave application tests for implementation/verification.
9. **Report precisely.** State what was implemented, the evidence used, checks performed, what remains unverified, and any blocker requiring human action.

Do not claim pixel-level parity when reference and local screenshots differ in viewport, scroll position, content, or state. Do not fabricate selectors, routes, request payloads, API contracts, or visual details to make a specification look complete.

Use a shared browser session sequentially; only one browser-owning worker may navigate or inspect it at a time. Never run REA and Playwright concurrently against the same session.

## 4. Evidence and Specification Hygiene

Record each claim's source ID/path, date, faculty/period, verification status and limits. Classify the source independently from the claim's confidence:

| Source class | Meaning and permitted claim |
| --- | --- |
| Normative evidence (`normative`) | Published regulation, resolution or official schedule; supports the stated requirement within its scope and validity, not proof that SUM enforces it. Preserve existing `[Verificado-norma]` and `[Verificado-FISI]` references. |
| Observed evidence (`observed`) | Sanitized capture or reproducible trace of an interaction with recorded conditions; supports only the visible behavior in that environment, state and collection date. Local observations do not confirm production behavior. |
| Testimony (`testimony`) | User/operator account or interview without a supporting capture or trace; retain as reported behavior awaiting corroboration. Historical `[Observado-testimonio]` labels belong here, not to confirmed observations. |
| Inference (`inferred`) | Deduction or hypothesis with supporting references and an explicit uncertainty; supports investigation or an identified local design decision, not a confirmed SUM behavior. |

Never promote a hypothesis, testimony, normative requirement or passing local test into confirmed SUM behavior. Promotion to `observed` requires supporting observable evidence and a recorded review; preserve the original provenance. Keep unknowns `unverified` and prototype choices `local-only`. If sources conflict, retain both and record the discrepancy; do not silently choose one or invent missing transitions, messages or rules.

Keep concise, useful evidence in `evidence/sum/<screen>/`:

- Sanitized reference screenshot(s), if available.
- Notes on hierarchy, dimensions, spacing, typography, components, navigation, and interaction states.
- Behavioral scenarios and action → handler → request → response → visible result traces, with Evidence IDs or source references, coverage limitations and unknown links.
- Provenance and collection conditions: source, route, viewport, scroll, state, and date.
- An explicit gap list for states not observed.

Use placeholders such as `STUDENT_ID`, `STUDENT_NAME`, and `COURSE_CODE` where needed. Never commit original personal data, session material, raw HAR files containing secrets, or unredacted production screenshots. Retain only the minimal technical evidence needed for reconstruction.

Existing historical notes are reusable evidence, not automatic proof of current production behavior. Update specifications only when supported by sufficiently clear evidence; label partial reconstructions accurately.

### Spec Kit: specify/clarify boundaries

During `specify` and `clarify`, inspect relevant non-private code/contracts read-only and update only specifications, clarifications, checklists and required Spec Kit feature metadata. Do not change application code, runtime configuration, dependencies, fixtures or tests, implement enrollment, or run migrations/export scripts. Review hooks and handoffs before executing them; do not allow them to start implementation or make prohibited changes automatically.

Write measurable acceptance criteria and planned synthetic test scenarios for every requirement. Link each to its source class or explicit local decision, and retain unanswered questions as gaps rather than generated behavior. Use the FISI dossier's N0–N3 distinctions where applicable: normative fidelity and local simulation do not establish observable parity. Implementation starts in a separately assigned stage after the plan, shared contract and acceptance criteria are ready.

## 5. Dynamic Agent and Model Routing

For SUM tasks, first consult `.agents/skills/sum-workflow/SKILL.md` and its model-routing reference. Follow the repository's **actual agent TOML configuration** for model selection and reasoning effort.

- **Feature planning before implementation (explicit user preference):** for every new feature or functional extension, first dispatch `sum-planner` (GPT-6.1 Sol High) to produce or complete the persistent implementation plan, exact local contracts and acceptance criteria. Reuse an existing sufficient plan authored by this planning stage; do not skip the stage merely because the feature looks straightforward. The principal coordinates evidence and scope, then dispatches `sum-implementer`/`sum-executor` (GPT-6 Luna High) only after the planning handoff is ready. Assign backend work its local `sum-nestjs-implement`, frontend its local `sum-react-implement`, and integrated verification root `sum-fullstack-verify`; split files/dependencies before parallel implementation. Record actual planner/worker roles and plan paths. Documentation-only and trivial isolated corrections may remain with the principal.
- **Trivial, low-risk tasks:** complete directly using the configured lightweight/Luna profile.
- **Well-specified implementation:** assign to the configured GPT-6 Luna High implementation profiles (`sum-implementer` or `sum-executor`) as explicitly requested by the user.
- **Ambiguous, architectural, security-sensitive, or high-impact decisions:** use the configured Sol High planning or critical-review profile when available.
- **Deterministic checks:** prefer build, lint, diff inspection, and reproducible local tests over another model's opinion.

Routing should adapt to task complexity, uncertainty, and impact. Do not invoke an expensive reviewer for routine edits. Do not claim to have switched models merely by mentioning a model in a prompt: an actual configured agent profile must be used. If the required profile is unavailable, use the permitted current configuration, disclose the limitation briefly, and do not pretend a delegation occurred.

Operational constraints:

- At most two subagents may execute concurrently.
- Workers must not delegate to further agents.
- Por instrucción del usuario (2026-10-11), cada worker delegado debe comprobar CodeGraph y ejecutar `codegraph init` si falta su configuración/índice local. Antes de inicializar debe validar `codegraph.json` con exclusiones explícitas de `datos-reales/`, archivos privados, dependencias y symlinks ajenos; esta instrucción no autoriza leer ni indexar datos privados. El coordinador asigna también los metadatos locales de CodeGraph necesarios y verifica el resultado real.
- Concurrent workers must own disjoint files and independent tasks.
- Browser-owning work is sequential, even when other independent work runs concurrently.
- Perform at most one automatic repair cycle after failed verification; then diagnose and record the next decision.
- Reuse sufficient existing plans and evidence. Do not repeatedly replan a sufficiently specified task.
- Maintain persistent state and verification references for complex tasks; keep simple work lightweight.

## 6. Development Commands

Run from the repository root:

```sh
pnpm --dir client dev      # Start Vite
pnpm --dir client build    # Type-check and produce a build
pnpm --dir client lint     # Run ESLint
pnpm --dir client preview  # Preview the build
```

Read the affected project's current `package.json` before selecting commands. Client checks are `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data` for data behavior and `pnpm --dir client verify` for applicable local UI scenarios. Backend scripts currently include `build`, `lint`, `test` and `test:e2e`, invoked with `pnpm --dir backend <script>`. Review verification scripts and their environment before execution to ensure exclusively synthetic fixtures, local targets and the assigned browser ownership. Do not run commands for a nonexistent server or claim tests passed without running them.

Every implementation assignment includes authorization for its required local synthetic tests. Reuse relevant tests and add meaningful coverage for changed behavior or contracts; execute the checks mapped to acceptance criteria before claiming completion. Documentation-only changes require documented acceptance criteria and deterministic checks of the document, links and policy consistency; application tests are not required for them. Specify/clarify defines application test scenarios without implementing or running them.

## 7. Code Style and Architecture

- Use TypeScript and React function components in `client/`, and NestJS modules, controllers and injectable providers in `backend/`.
- Separate HTTP/DTO validation, business logic and persistence. Runtime validation is required at the local API boundary; TypeScript types alone do not validate input.
- Define seed/reset, errors and persistence lifetime explicitly. Authentication, ORM/database and academic rules need a concrete local requirement; do not infer them from UI.
- Keep academic rules configurable and versioned by faculty and academic period, with school/program, plan and modality where relevant. Record source, validity, exceptions and verification status for each profile. Separate common normative rules from faculty/period overrides; do not hardcode FISI 2026-II schedules, credit limits or eligibility as universal defaults. A missing profile or unresolved rule is an explicit gap, not a silent fallback to another faculty/period. This is the replica's design requirement, not a claim about SUM's internal architecture.
- Plan atomicity, idempotency and concurrency for local writes when required, especially enrollment/capacity.
- Follow two-space indentation, single quotes, and no semicolons.
- Name components and component files in PascalCase; use camelCase for hooks, variables, and functions.
- Keep styling near the relevant screen/component and reuse existing CSS conventions.
- Reuse shared UI components when evidence supports common behavior.
- Separate view components, data adapters, synthetic fixtures, application logic and server repositories. Integrate React with the own local API through its data layer. Do not couple the replica to live SUM endpoints.
- Prefer accessible semantic HTML, keyboard-operable controls, and sensible loading/empty/error states when those are local prototype behavior or backed by evidence.
- Avoid new dependencies unless justified by the feature.

## 8. Testing and Visual Acceptance

Every change must have explicit, measurable acceptance criteria and corresponding tests or deterministic document checks before completion. Record criterion → synthetic scenario/check → expected result → actual result. Cover the affected success, empty, error and boundary cases as applicable; integrated changes require actual local React/NestJS scenarios, and changed academic profiles require cases demonstrating faculty/period isolation and exceptions. Reuse sufficient existing coverage; do not add tests that merely duplicate implementation details. A planned, skipped or failed check does not count as passed acceptance.

Use exclusively fixtures explicitly identified as synthetic, with documented provenance, repeatable setup and reset. Do not use real exports, private snapshots, production sessions or fixtures of uncertain provenance. A folder named `datos-sinteticos/` or replacement of personal identifiers alone does not prove a derived bundle is safe; require operator confirmation that it contains no private data, otherwise request an independently constructed synthetic reproduction. Never run a generator that reads private inputs, including to produce synthetic output.

For visual comparisons, align **viewport, route, scroll position, interaction state, and content conditions**. Compare only equivalent states. Record relevant mismatches, prioritize major structural differences, and verify the implemented changes locally.

A screen is **locally implemented** when it renders and relevant build/lint and acceptance tests pass. A backend is locally implemented when it implements its explicit own contract and relevant checks and acceptance tests pass. **Integration verified** additionally requires real local client/server scenarios, not mocks alone. **Reference-verified behavior** requires sufficient comparable reference evidence for each claim. Report visual fidelity, behavioral fidelity, backend contract and integration separately; none establishes recovery of private SUM internals.

If a production observation remains unauthorized or unavailable, complete the supported local scope and leave a short explicit list of reference gaps. Do not block build or lint because production cannot be inspected.

## 9. Task Completion and Reporting

For every material change, report:

1. Files or screens changed.
2. Source evidence used and its verification status.
3. What was implemented and what remains a local assumption.
4. Validation commands and actual results.
5. Remaining blockers or next action, only if material.

Avoid lengthy repeated authorization explanations. Raise the gate once per task or when the source/scope changes. Do not invent completed REA sessions, Playwright screenshots, verification, or upstream behavior.

## 10. Commits and Pull Requests

Use short imperative commit subjects, for example `Add student profile screen`. Pull requests should describe the user-visible change, reference relevant sanitized evidence, include actual validation results, and attach sanitized before/after screenshots when meaningful. Never commit secrets or unredacted student information.
