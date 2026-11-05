import { createHash } from 'node:crypto'
import type { AcademicProposal, AcademicSavedDraft, AcademicTeacherReview, AcademicReviewTeacher, AcademicReviewEvent, AcademicPlanningResources } from '../../../shared/programacion-academica-api.mjs'

const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
    : JSON.stringify(value) ?? 'undefined'

const lastIndex = <T>(values: T[], predicate: (value: T) => boolean): number => {
  for (let index = values.length - 1; index >= 0; index--) if (predicate(values[index]!)) return index
  return -1
}

export function teacherFingerprints(draft: Pick<AcademicSavedDraft, 'configuration' | 'proposal'>): Map<string, { teacherName: string, fingerprint: string }> {
  const proposal = draft.proposal
  const result = new Map<string, { teacherName: string, fingerprint: string }>()
  if (!proposal) return result

  const resources = draft.configuration.request.resources as AcademicPlanningResources
  const byTeacher = new Map<string, typeof proposal.assignments>()
  for (const assignment of proposal.assignments) {
    const rows = byTeacher.get(assignment.teacherId) ?? []
    rows.push(assignment)
    byTeacher.set(assignment.teacherId, rows)
  }

  for (const [teacherId, assignments] of byTeacher) {
    const teacherName = assignments[0]!.teacherName
    const teacher = resources.teachers.find((item) => item.id === teacherId)
    if (!teacher || teacher.name !== teacherName || assignments.some((item) => item.teacherName !== teacherName)) throw new Error('review teacher mismatch')
    const sectionIds = new Set(assignments.map((item) => item.sectionId))
    const roomIds = new Set(assignments.map((item) => item.roomId))
    const payload = {
      schoolId: draft.configuration.schoolId,
      academicPeriod: draft.configuration.academicPeriod,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        courseIds: [...teacher.courseIds].sort(),
        maxWeeklyMinutes: teacher.maxWeeklyMinutes,
        availability: [...teacher.availability].sort((a, b) => a.day - b.day || a.startMinute - b.startMinute || a.endMinute - b.endMinute),
        preferences: [...(teacher.preferences ?? [])].sort((a, b) => a.day - b.day || a.startMinute - b.startMinute || a.endMinute - b.endMinute),
        sectionLimits: [...(teacher.sectionLimits ?? [])].sort((a, b) => a.courseId.localeCompare(b.courseId)),
      },
      assignments: assignments.map(({ courseId, sectionId, sessionType, day, startMinute, endMinute, roomId }) => ({
        courseId, sectionId, sessionType: sessionType ?? '', day, startMinute, endMinute, roomId,
      })).sort((a, b) => canonical(a).localeCompare(canonical(b))),
      sections: proposal.sections.filter((item) => sectionIds.has(item.sectionId))
        .map(({ sectionId, courseId, capacity, deliveryMode }) => ({ sectionId, courseId, capacity, deliveryMode: deliveryMode ?? 'continuous' }))
        .sort((a, b) => a.sectionId.localeCompare(b.sectionId)),
      rooms: resources.rooms.filter((item) => roomIds.has(item.id))
        .map((room) => ({ ...room, availability: [...room.availability].sort((a, b) => a.day - b.day || a.startMinute - b.startMinute || a.endMinute - b.endMinute) }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }
    result.set(teacherId, { teacherName, fingerprint: createHash('sha256').update(canonical(payload)).digest('hex') })
  }
  return result
}

export function emptyTeacherReview(): AcademicTeacherReview {
  return { round: 0, submittedVersion: 0, submittedAt: '', teachers: [], history: [] }
}

export function reviewMatchesSnapshot(draft: AcademicSavedDraft): boolean {
  const review = draft.review
  if (!review) return !['in-review', 'ready-for-approval'].includes(draft.state)
  try {
    const current = teacherFingerprints(draft)
    if (!review.history.length || review.history.length > 200 || review.teachers.length !== current.size) return false
    const submitted = review.history.filter((event) => event.type === 'submitted')
    if (submitted.length !== review.round || review.round < 1) return false
    const lastSubmitted = submitted.at(-1)
    if (!lastSubmitted || lastSubmitted.round !== review.round || lastSubmitted.version !== review.submittedVersion || lastSubmitted.at !== review.submittedAt) return false
    if (submitted.some((event, index) => event.round !== index + 1)) return false
    let priorVersion = 0
    let priorRound = 0
    const submittedByRound = new Map(submitted.map((event) => [event.round, event]))
    for (const event of review.history) {
      if (event.version < priorVersion || event.round < priorRound || event.round > review.round) return false
      priorVersion = event.version
      priorRound = event.round
      if (event.type !== 'submitted') {
        const submission = submittedByRound.get(event.round)
        if (!submission || event.version <= submission.version) return false
      }
    }

    const teacherById = new Map(review.teachers.map((teacher) => [teacher.teacherId, teacher]))
    if (teacherById.size !== current.size) return false
    for (const [teacherId, expected] of current) {
      const teacher = teacherById.get(teacherId)
      if (!teacher || teacher.teacherName !== expected.teacherName) return false
      if (teacher.status === 'outdated') {
        const invalidatedAt = lastIndex(review.history, (event) => event.type === 'invalidated' && event.teacherId === teacherId)
        const invalidation = review.history[invalidatedAt]
        if (teacher.fingerprint !== expected.fingerprint || invalidatedAt < 0 || invalidation?.round !== review.round) return false
        if (teacher.decisionVersion !== null) {
          const decisionIndex = review.history.findIndex((event) => event.type === 'decision' && event.teacherId === teacherId
            && event.version === teacher.decisionVersion)
          const previousDecision = review.history[decisionIndex]
          const laterDecision = review.history.slice(decisionIndex + 1, invalidatedAt).some((event) => event.type === 'decision'
            && event.teacherId === teacherId && event.round >= (previousDecision?.round ?? 0))
          if (decisionIndex < 0 || decisionIndex >= invalidatedAt || laterDecision || previousDecision?.at !== teacher.decidedAt
            || previousDecision.observation !== teacher.observation) return false
        } else if (teacher.observation !== '' || teacher.decidedAt !== null) return false
      } else if (teacher.fingerprint !== expected.fingerprint) return false
      const latest = review.history.filter((event) => event.type === 'decision' && event.teacherId === teacherId
        && event.fingerprint === teacher.fingerprint).at(-1)
      if (teacher.status === 'conformity' || teacher.status === 'changes-requested') {
        if (!latest || latest.decision !== teacher.status || latest.fingerprint !== teacher.fingerprint
          || latest.version !== teacher.decisionVersion || latest.at !== teacher.decidedAt || latest.observation !== teacher.observation) return false
      } else if (teacher.status === 'pending' && (teacher.observation !== '' || teacher.decisionVersion !== null || teacher.decidedAt !== null)) return false
      else if (teacher.status === 'pending' && latest?.round === review.round) return false
    }

    const removedInvalidations = review.history.filter((event) => event.type === 'invalidated' && event.teacherId !== null && !current.has(event.teacherId))
    if (removedInvalidations.some((event) => !event.fingerprint || !submittedByRound.has(event.round))) return false
    const removedDecisions = review.history.filter((event) => event.type === 'decision' && event.teacherId !== null && !current.has(event.teacherId))
    if (removedDecisions.some((decision) => !review.history.some((event) => event.type === 'invalidated' && event.teacherId === decision.teacherId
      && event.fingerprint === decision.fingerprint && event.version >= decision.version))) return false
    if (draft.proposal === null) return draft.state === 'draft' && review.teachers.length === 0
    if (!hasCompleteNonemptyProposal(draft.proposal)) return draft.state === 'draft'
    return draft.state === (isReviewReady(draft) ? 'ready-for-approval' : 'in-review')
  } catch {
    return false
  }
}

export function makeReviewTeacher(teacherId: string, teacherName: string, fingerprint: string): AcademicReviewTeacher {
  return { teacherId, teacherName, fingerprint, status: 'pending', observation: '', decisionVersion: null, decidedAt: null }
}

export function reviewEvent(type: AcademicReviewEvent['type'], version: number, round: number, at: string,
  teacherId: string | null = null, fingerprint: string | null = null, decision: AcademicReviewEvent['decision'] = null,
  observation = ''): AcademicReviewEvent {
  return { type, version, round, at, teacherId, fingerprint, decision, observation }
}

export function isReviewReady(draft: Pick<AcademicSavedDraft, 'proposal' | 'review'>): boolean {
  return !!draft.proposal && draft.proposal.status === 'complete' && draft.proposal.coverageComplete && draft.proposal.assignments.length > 0
    && !!draft.review?.teachers.length && draft.review.teachers.every((teacher) => teacher.status === 'conformity')
}

export function hasCompleteNonemptyProposal(proposal: AcademicProposal | null): boolean {
  return !!proposal && proposal.status === 'complete' && proposal.coverageComplete && proposal.assignments.length > 0
}
