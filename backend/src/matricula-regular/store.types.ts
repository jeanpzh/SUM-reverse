import type {
  MatriculaRegularChoice,
  MatriculaRegularId,
  MatriculaRegularEnrollmentReport,
  MatriculaRegularOutcome,
  MatriculaRegularSession,
} from '../../../shared/matricula-regular.mjs'
import type {
  ActorProfile,
  EnrollmentProfile,
  OfferedCourse,
} from './profile.types.js'

export type StoredRequest = {
  payload: {
    actorId: MatriculaRegularId
    profileRevision: string
    selection: MatriculaRegularChoice[]
  }
  outcome: MatriculaRegularOutcome
}

export type Enrollment = {
  enrollmentId: string
  requestId: string
  actorId: string
  profileRevision: string
  selection: MatriculaRegularChoice[]
  acceptedAt: string
}

export type RunState = {
  runId: string
  profiles: EnrollmentProfile[]
  actors: ActorProfile[]
  offer: OfferedCourse[]
  sessions: MatriculaRegularSession[]
  requests: Map<string, StoredRequest>
  enrollments: Map<string, Enrollment>
  reports: Map<string, MatriculaRegularEnrollmentReport>
}

export type RunSnapshot = Omit<RunState, 'requests' | 'enrollments' | 'reports'> & {
  requests: Array<[string, StoredRequest]>
  enrollments: Array<[string, Enrollment]>
  reports: Array<[string, MatriculaRegularEnrollmentReport]>
}
