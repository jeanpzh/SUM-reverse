# ENR-RULES-1: prematrícula credit and retake rules (F-E2) and E3 gap check (F-E3)

Date: 2026-11-07. Owner: Planner. Status: **fixed local contract** for the rule profile and server validation. The student-visible presentation is **blocked on user approval** (§8). Program: [planning-product-program](../../plans/planning-product-program.md). This contract extends [E2-INTENT-1](prematricula-intention.md) and [prematricula-e2](prematricula-e2.md) without replacing them. It reverses the latter's explicit "no mínimo 12 / máximo 26" exclusion, but only for scopes that have a rule profile.

## 1. Sources

| ID | Claim | Source class | Reference |
| --- | --- | --- | --- |
| RN-01 | Regular load is 12 to 26 credits. Fewer than 12 is allowed to finish the degree, after returning from separation, or after a plan change with no open courses, with VRAP authorization | `normative` [Verificado-norma] | [business-rules.md](../../../domain/fisi/2026-II/business-rules.md) RN-01 (F1 art. 13.p) |
| OF-01 | Same art. 13.p range; art. 19 allows up to 12 credits with authorization | `normative` | [phase3-planning-sources-2026-11-05.md](../../../domain/fisi/2026-II/phase3-planning-sources-2026-11-05.md) OF-01 |
| RN-18 | Failed courses must be taken in the next period in which they are offered, with priority and respecting prerequisites | `normative` [Verificado-norma] | [business-rules.md](../../../domain/fisi/2026-II/business-rules.md) RN-18 (art. 18) |
| Q-02 | When does the credit limit block, and with which message? | open question | [open-questions.md](../../../domain/fisi/2026-II/open-questions.md) Q-02 |
| Q-16 | Who authorizes credit exceptions? | open question | [open-questions.md](../../../domain/fisi/2026-II/open-questions.md) Q-16 |
| PROP-6 | Profile parameters: art. 13.p "Excepciones habilitadas"; art. 18 "inclusión obligatoria o prioridad de vacante"; the FISI pilot uses mandatory inclusion | design requirement (`local-only`) | Proposal PDF v1.0 §6 |
| PROP-13.2 | The scope of art. 18 is a faculty decision | open faculty question | Proposal PDF §13.2 |
| E3-RULES | E3 already applies 12–26 with exceptions and `RETAKE_PRIORITY` for FISI 2026-II | local implementation (not SUM evidence) | `backend/src/matricula-regular/rules.ts` (credit load around :293–299, retake around :268–273) |

A norm establishes the requirement within its scope. It does not show that SUM enforces it during prematrícula, and no SUM observation of prematrícula credit validation exists. Applying the norm to the synthetic 2027-I scope is a local decision (`local-only`).

## 2. Rule profile

A new module `shared/enrollment-rule-profiles.mjs` holds versioned profiles. Its source shape is the existing `Source` type in `backend/src/matricula-regular/profile.types.ts`.

```ts
type EnrollmentRuleProfile = {
  revision: 'ENR-RULES-1'
  profileId: string                                   // 'E2-SYN-SIS-2027-I-1'
  scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', academicPeriod: string }
  creditRange: { min: number, max: number, sourceIds: string[] }
  creditExceptions: {
    enabled: Array<'remaining-for-completion' | 'return-after-suspension' | 'plan-change-no-offer'>
    sourceIds: string[]
  }
  retakeInclusion: { mode: 'mandatory-inclusion' | 'seat-priority', sourceIds: string[] }
  sources: Source[]
}
resolveEnrollmentRuleProfile(scope: { schoolId: string, academicPeriod: string }): EnrollmentRuleProfile | null
```

The registry holds exactly one synthetic profile:

| Field | Value | Source and status |
| --- | --- | --- |
| `profileId` | `E2-SYN-SIS-2027-I-1` | local |
| `scope` | FISI / SISTEMAS / 2027-I | synthetic E2 scope |
| `creditRange` | min 12, max 26 | RN-01 and OF-01 `normative`; applying them to synthetic 2027-I is `local-only` |
| `creditExceptions.enabled` | all three art. 13.p kinds | RN-01 `normative` for their existence; enabling all three is `local-only`; who authorizes them is open (Q-16) |
| `retakeInclusion.mode` | `mandatory-inclusion` | PROP-6 (`local-only`); FISI scope pending (PROP-13.2) |

Each value lives in the profile, never in the evaluator code. FISI 2026-II E3 values in `rules.ts` are not reused as a default for any other scope.

## 3. Evaluators (pure, shared)

```ts
evaluateCreditRange(input: {
  profile: EnrollmentRuleProfile
  selectedCredits: number
  selectedCount: number
  exception: { kind: 'none' | 'remaining-for-completion' | 'return-after-suspension' | 'plan-change-no-offer', applicability: 'applicable' | 'not-applicable' | 'unknown' }
}): E2Issue[]

evaluateRetakeInclusion(input: {
  profile: EnrollmentRuleProfile
  failedCourses: Array<{ courseId: string, attempts: number, eligible: boolean }>
  offeredCourseIds: string[]
  selectedCourseIds: string[]
}): E2Issue[]
```

The exception shape reuses `actor.creditException` from the matrícula-regular actor model.

### 3.1 Credit range

| Condition | Issue |
| --- | --- |
| `selectedCount === 0` | none (`EMPTY_SELECTION` already handles it) |
| `selectedCredits > max` | `unmet`, `CREDIT_ABOVE_MAX` |
| `selectedCredits < min`, exception kind is in `enabled` and `applicable` | none |
| `selectedCredits < min`, exception `unknown` | `insufficient`, `CREDIT_EXCEPTION_UNKNOWN` |
| `selectedCredits < min`, otherwise | `unmet`, `CREDIT_BELOW_MIN` |

### 3.2 Retake inclusion

| Condition | Issue |
| --- | --- |
| Mode `mandatory-inclusion`, failed course with `attempts ≤ 2`, `eligible` (the demand estimator's `classify` returns `retake`), offered in the publication, not selected | `unmet`, `RETAKE_REQUIRED`, `courseIds: [courseId]` |
| Mode `seat-priority` | none in E2 (priority affects seat allocation, which E2 does not perform) |
| Failed course with `attempts ≥ 3` | `insufficient`, `REPETITION_RULE_NOT_EVALUATED` (arts. 19 and 20 are not implemented in E2) |

Prerequisites stay with the existing eligibility check: a failed course that is not `eligible` produces no `RETAKE_REQUIRED`.

### 3.3 Missing profile

The scope comes from the E2 record's `schoolId` and `academicPeriod`; the faculty is FISI for the regular E2 scenario. A scope without a profile produces one `insufficient` issue, `RULE_PROFILE_MISSING`, with no fallback. Today the E2 scope validator (`shared/prematricula-api.mjs`, `scope`) accepts only SISTEMAS / 2027-I, so this is a defensive path the API cannot reach. Under the existing E2 rule, `insufficient` blocks registration. Every current E2 test and script uses 2027-I, so none loses registration.

## 4. Wire changes

- `E2Validation` (validated in `shared/prematricula-api.mjs` with strict keys) gains `rulesProfile: { profileId: string, revision: 'ENR-RULES-1' } | null`. It names the profile resolved for the scope, including for an empty selection (which still returns only `EMPTY_SELECTION`). It is `null` exactly when no profile resolved, and then the issues include `RULE_PROFILE_MISSING`.
- `E2Issue.code` gains `CREDIT_ABOVE_MAX`, `CREDIT_BELOW_MIN`, `CREDIT_EXCEPTION_UNKNOWN`, `RETAKE_REQUIRED`, `REPETITION_RULE_NOT_EVALUATED` and `RULE_PROFILE_MISSING`. The issue kinds stay `unmet | insufficient | incomplete`.
- `E2_REVISION` stays `'E2-LOCAL-1'`. It is persisted in stored E2 drafts, and changing it would invalidate them.
- Registration keeps its existing rule: `422` on any `unmet` or `insufficient` issue, or on an empty selection.

Whether these issues should block or only advise is open (Q-02). The contract applies the existing E2 blocking rule until the user decides (§9, ER-Q1).

## 5. Persistence and existing intentions

- Stored intentions are not rewritten.
- At demand time (`getDemand`), each latest intention is revalidated with the profile in force. Intentions that now fail are counted in `excluded` with their issue codes, never in demand.
- No change to the E2 draft or intention store formats.

## 6. Message texts

Each issue keeps a server `message`. The texts below are **local placeholders** (`local-only`). No SUM evidence for these messages exists:

| Code | Placeholder message |
| --- | --- |
| `CREDIT_ABOVE_MAX` | `La selección supera el máximo de créditos del perfil.` |
| `CREDIT_BELOW_MIN` | `La selección no alcanza el mínimo de créditos del perfil.` |
| `CREDIT_EXCEPTION_UNKNOWN` | `No se pudo determinar si aplica una excepción de créditos.` |
| `RETAKE_REQUIRED` | `Debe incluir el curso desaprobado ofertado en este periodo.` |
| `REPETITION_RULE_NOT_EVALUATED` | `La regla para cursos con tres o más desaprobaciones no se evalúa en esta etapa.` |
| `RULE_PROFILE_MISSING` | `No existe un perfil de reglas para este periodo.` |

## 7. Tickets

All tickets share these constraints:
- Never read, list, search or use `datos-reales/`.
- Use synthetic fixtures only.
- Use no live SUM.
- Make no visual change to SUM student screens beyond what the user approves (§8).
- Workers run `codegraph init` if the index is missing, after checking `codegraph.json`.
- Workers do not delegate.

| Ticket | Scope | Exclusive files | Depends on | Role · model (AGENTS §5) |
| --- | --- | --- | --- | --- |
| **F-E2.1** | §2 and §3: profile registry and pure evaluators | new `shared/enrollment-rule-profiles.mjs`, `.d.mts`, `.test.mjs` | this contract | Backend worker · `claudeAgent` `claude-sonnet-5-5` high (alt. `codex` `gpt-6-luna` high) |
| **F-E2.2** | §4 and §5 on the server: wire the evaluators into `makeValidation` and `getDemand`; update the E2 and E3 scenarios that select one 4-credit course to reach at least 12 credits with synthetic courses, or report that the fixture cannot | `backend/src/prematricula/prematricula.service.ts`, `shared/prematricula-api.mjs` and `.d.mts`, `backend/test/prematricula-intention.spec.ts`, `backend/test/e3-intention-import.spec.ts`, `backend/test/enrollment-offer.integration.spec.ts` (only if affected), `client/src/data/prematricula-intention.test.ts`, `client/scripts/verify-e2-intention.mjs`, `client/scripts/verify-e2-prematricula.mjs`, `client/scripts/verify-cycle-complete.mjs`, new `backend/test/prematricula-rules.spec.ts` | F-E2.1 | Backend worker · Sonnet 5.5 high |
| **F-E2.3** (optional) | E3 `rules.ts` uses the shared evaluators with no behavior change | `backend/src/matricula-regular/rules.ts` and its existing tests | F-E2.1 | Backend worker · Sonnet 5.5 high |
| **F-E2.4** (blocked) | Student-visible presentation of the new issues | `client/src/screens/StudentIntentionPanel.tsx`, `client/src/screens/StudentPreEnrollment.tsx` | user approval §8 | UI worker · `antigravity` `gemini-3.8-flash` high |

`prematricula.service.ts` is also edited by F-S5.4 ([planning-readjustment.md](planning-readjustment.md) §9). F-E2.2 goes first.

## 8. Student screen impact: user approval required

`client/src/screens/StudentIntentionPanel.tsx:92,99` and `client/src/screens/StudentPreEnrollment.tsx:246,252` render `issue.message` verbatim. When F-E2.2 lands, the new messages (§6) will therefore appear on SUM-styled student screens **with no client change**. The root rule protects these screens: visual and interaction fidelity, and asking the user before inventing an interface or behavior without evidence.

Before F-E2.2 merges, the user must choose one of these:

1. Accept the server messages rendered in the existing issue list. No layout change; only new text.
2. Keep the rules advisory on the server (§9, ER-Q1) and hide them from student screens until there is SUM evidence.
3. Provide SUM evidence or approved texts for these messages.

F-E2.4 stays blocked until then. The "suggest a clash-free combination" feature in PDF §4.5 is not part of this contract (ER-Q3).

## 9. Acceptance criteria

Checks: shared `node --test shared/enrollment-rule-profiles.test.mjs`, backend vitest (`pnpm --dir backend test`), backend build and lint, client `test:data`, build and lint, and real local React→NestJS scenarios (`client/scripts/verify-e2-*.mjs`, `verify-cycle-complete.mjs`) against the full local app with synthetic data only.

| # | Criterion | Synthetic scenario | Check | Ticket |
| --- | --- | --- | --- | --- |
| E1 | Profile resolves only for its scope | 2027-I resolves; 2026-II returns null | shared test | F-E2.1 |
| E2 | Credit range boundaries | 11, 12, 26 and 27 credits; empty selection | shared test: issues exactly at 11 (`CREDIT_BELOW_MIN`) and 27 (`CREDIT_ABOVE_MAX`); none at 12, 26 or empty | F-E2.1 |
| E3 | Exceptions | 8 credits with each kind applicable, not applicable, unknown, and a kind not enabled | shared test: none; `CREDIT_BELOW_MIN`; `CREDIT_EXCEPTION_UNKNOWN`; `CREDIT_BELOW_MIN` | F-E2.1 |
| E4 | Retake inclusion | failed and offered and not selected; selected; not offered; not eligible; three attempts; `seat-priority` mode | shared test: `RETAKE_REQUIRED` only in the first case; `REPETITION_RULE_NOT_EVALUATED` for three attempts; none in seat-priority | F-E2.1 |
| E5 | Server validation carries the profile and issues | SYN-SIS-A selects 27 credits; then a valid ≥12-credit selection | vitest: `422` with `CREDIT_ABOVE_MAX`; then `201` with `rulesProfile.profileId` set | F-E2.2 |
| E6 | Missing profile blocks without fallback | The server's validation helper called directly with a 2026-II scope object (unreachable through the API, §3.3) | vitest: `insufficient` `RULE_PROFILE_MISSING`, `rulesProfile: null`, and the helper's registration gate rejects it | F-E2.2 |
| E7 | Demand excludes intentions that fail the rules | An intention stored before the rules (one 4-credit course) | vitest: `getDemand` reports it under `excluded` with the code; counted demand excludes it | F-E2.2 |
| E8 | `E2_REVISION` and stored data unchanged | Existing stored E2 drafts and intentions | vitest: drafts load; `E2_REVISION === 'E2-LOCAL-1'` | F-E2.2 |
| E9 | Existing flows pass after fixture updates | Updated ≥12-credit scenarios | existing specs, `test:data`, `verify-e2-intention.mjs`, `verify-e2-prematricula.mjs`, `verify-cycle-complete.mjs` | F-E2.2 |
| E10 | E3 behavior unchanged after adoption | Existing E3 rule fixtures | existing `matricula-regular` specs pass unchanged | F-E2.3 |

## 10. F-E3 gap check: "only what changed" and alternatives

Evidence read on 2026-11-07, at commit `3d40b56`:

- **Partially present (only what changed).** The E3 intention transfer (`backend/src/prematricula/prematricula.service.ts:238–378`, `transferIntention`) preloads unchanged choices and reports one issue per changed course: `COURSE_UNAVAILABLE` (:295, :305), `SECTION_UNMAPPED` (:316, :328), `SCHEDULE_CHANGED` (:343), `SECTION_FULL` (:347) and `ACADEMIC_PENDING` (:356, through `evaluateSelectionAdmission`). The client lists them in `client/src/screens/RegularEnrollment.tsx:92–101` (`INTENTION_ISSUE_MESSAGES`) and `:488–489`. This logic lives in `prematricula`, not in `matricula-regular`.
- **Absent (alternatives).** No module proposes alternative sections with free seats and no clash (PDF §4.5.4). `backend/src/matricula-regular/rules.ts:329` only emits `SECTION_FULL`, and there is no "alternativ" logic in `matricula-regular` or `prematricula`.
- **Consequence.** F-E3 is a new feature, not a fix. It needs SUM evidence or user approval for an E3 student screen change, a contract (inputs: the transfer issues and the current publication; output: per-course alternatives), and it depends on F-S5 because v2 publications are what create these changes. It stays unplanned in this program until the user decides (ER-Q3).

## 11. Gaps and open questions

- **ER-Q1** (user, Q-02): should credit and retake issues block registration, as the E2 rule currently does, or only advise?
- **ER-Q2** (user): approval of the student-screen impact (§8).
- **ER-Q3** (user): should the clash-free combination suggestion (PDF §4.5) and E3 alternatives (§10) be planned, and on which screen?
- **ER-Q4** (faculty, Q-16, PROP-13.2): who authorizes credit exceptions, which kinds are enabled, and the scope of art. 18 (mandatory inclusion or seat priority).
- **Gap:** how exception applicability reaches E2. The synthetic actor model provides `creditException`, but no source of authorization exists.
