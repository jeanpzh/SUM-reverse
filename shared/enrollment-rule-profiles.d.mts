export const ENROLLMENT_RULES_REVISION: 'ENR-RULES-1'
export const CREDIT_EXCEPTION_KINDS: readonly ['remaining-for-completion', 'return-after-suspension', 'plan-change-no-offer']
export const RETAKE_INCLUSION_MODES: readonly ['mandatory-inclusion', 'seat-priority']
export const ENROLLMENT_RULE_ISSUE_CODES: readonly ['CREDIT_ABOVE_MAX', 'CREDIT_BELOW_MIN', 'CREDIT_EXCEPTION_UNKNOWN', 'RETAKE_REQUIRED', 'REPETITION_RULE_NOT_EVALUATED', 'RULE_PROFILE_MISSING']
export const ENROLLMENT_RULE_MESSAGES: Readonly<Record<EnrollmentRuleIssueCode, string>>

export type EnrollmentRuleIssueCode = (typeof ENROLLMENT_RULE_ISSUE_CODES)[number]
export type CreditExceptionRuleKind = (typeof CREDIT_EXCEPTION_KINDS)[number]
// Same shape as `Source` in backend/src/matricula-regular/profile.types.ts.
export type EnrollmentRuleSource = {
  id: string
  origin: 'evidence' | 'local-decision'
  class: 'normative' | 'observed' | 'testimony' | 'inferred' | null
  reference: string
  date: string
  status: 'documented' | 'reported' | 'unverified' | 'local-only'
}
export type EnrollmentRuleProfile = {
  revision: 'ENR-RULES-1'
  profileId: string
  scope: { facultyId: 'FISI'; schoolId: 'SISTEMAS'; academicPeriod: string }
  creditRange: { min: number; max: number; sourceIds: string[] }
  creditExceptions: { enabled: CreditExceptionRuleKind[]; sourceIds: string[] }
  retakeInclusion: { mode: 'mandatory-inclusion' | 'seat-priority'; sourceIds: string[] }
  sources: EnrollmentRuleSource[]
}
// Structurally identical to E2Issue in prematricula-api.d.mts.
export type EnrollmentRuleIssue = { kind: 'unmet' | 'insufficient' | 'incomplete'; code: EnrollmentRuleIssueCode; message: string; courseIds: string[]; sectionIds: string[] }
export type CreditExceptionInput = { kind: 'none' | CreditExceptionRuleKind; applicability: 'applicable' | 'not-applicable' | 'unknown' }
export type FailedCourseInput = { courseId: string; attempts: number; eligible: boolean }

export function resolveEnrollmentRuleProfile(scope: { schoolId: string; academicPeriod: string }): EnrollmentRuleProfile | null
export function validateEnrollmentRuleProfile(value: unknown): asserts value is EnrollmentRuleProfile
export function ruleProfileMissingIssue(): EnrollmentRuleIssue
export function evaluateCreditRange(input: { profile: EnrollmentRuleProfile; selectedCredits: number; selectedCount: number; exception: CreditExceptionInput }): EnrollmentRuleIssue[]
export function evaluateRetakeInclusion(input: { profile: EnrollmentRuleProfile; failedCourses: FailedCourseInput[]; offeredCourseIds: string[]; selectedCourseIds: string[] }): EnrollmentRuleIssue[]
