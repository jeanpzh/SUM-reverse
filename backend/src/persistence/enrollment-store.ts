import type { MatriculaRegularChoice, MatriculaRegularEnvelope, MatriculaRegularOutcome, MatriculaRegularSubmission } from '../../../shared/matricula-regular.mjs'
import type { ActorProfile, EnrollmentProfile, OfferedCourse } from '../matricula-regular/profile.types.js'

export type PublicPrincipal = { campaignId: string; runId: string; actorId: string }
export type EnrollmentReadSnapshot = {
  runId: string
  profiles: EnrollmentProfile[]
  actors: ActorProfile[]
  offer: OfferedCourse[]
}

export interface EnrollmentStore {
  readSnapshot(principal: PublicPrincipal): Promise<EnrollmentReadSnapshot>
  submit(principal: PublicPrincipal, request: MatriculaRegularSubmission): Promise<MatriculaRegularEnvelope<MatriculaRegularOutcome>>
  lookup(principal: PublicPrincipal, requestId: string): Promise<unknown>
  report(principal: PublicPrincipal, enrollmentId: string): Promise<unknown>
  createAcademicSession(principal: PublicPrincipal): Promise<unknown>
  renewAcademicSession(principal: PublicPrincipal, sessionId: string): Promise<unknown>
  closeCampaign(campaignId: string): Promise<void>
}

export const ENROLLMENT_STORE = Symbol('ENROLLMENT_STORE')

export function canonicalSelection(selection: MatriculaRegularChoice[]): MatriculaRegularChoice[] {
  return structuredClone(selection).sort((a, b) => a.courseId.localeCompare(b.courseId) || a.sectionId.localeCompare(b.sectionId))
}
