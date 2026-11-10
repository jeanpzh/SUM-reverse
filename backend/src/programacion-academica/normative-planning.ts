import { loadAuthorizationBlockers, NormativeProfileGapError, resolveNormativeProfile, teacherLoadLimits, teacherPrelation } from '../../../shared/academic-normative-profile.mjs'
import type { AcademicProposal, AcademicRequest, AcademicTeacherResource, AcademicWorkspace } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicTeacher } from './schedule.types.js'

type Context = Pick<AcademicRequest, 'academicPeriod' | 'lectiveHourMinutes' | 'planningPolicy'>
type Normative = NonNullable<AcademicProposal['normative']>

export function workspaceNormativeContext(workspace: AcademicWorkspace): Context {
  return { ...workspace.request, academicPeriod: workspace.academicPeriod,
    lectiveHourMinutes: workspace.lectiveHourMinutes }
}

export function resolvePlanningNormative(context: Context, teachers: AcademicTeacherResource[]) {
  const gaps = new Map<string, Normative['gaps'][number]>()
  const addGap = (gap: { code: string; message: string }, teacherId?: string) => {
    const row = gaps.get(gap.code) ?? { ...gap }
    if (teacherId) row.teacherIds = [...new Set([...(row.teacherIds ?? []), teacherId])].sort()
    gaps.set(gap.code, row)
  }
  let profile: ReturnType<typeof resolveNormativeProfile> | null = null
  const period = context.academicPeriod ?? context.planningPolicy?.period
  if (period) {
    try { profile = resolveNormativeProfile({ facultyId: 'FISI', period }) }
    catch (error) {
      if (!(error instanceof NormativeProfileGapError)) throw error
      addGap({ code: error.code, message: error.message })
    }
  } else addGap({ code: 'NORMATIVE_PERIOD_MISSING', message: 'No se registró el periodo para resolver el perfil normativo.' })
  if (context.lectiveHourMinutes === undefined) addGap({ code: 'LECTIVE_HOUR_MINUTES_MISSING', message: 'No se registró la duración de la hora lectiva; se conservan los topes declarados.' })
  profile?.gaps.forEach((gap) => addGap(gap))
  const limits = new Map<string, ReturnType<typeof teacherLoadLimits>>()
  const resolvedTeachers: AcademicTeacher[] = teachers.map((teacher) => {
    const { name: _name, ...resource } = structuredClone(teacher)
    if (!teacher.regime) addGap({ code: 'REGIME_MISSING', message: 'No se registró el régimen de dedicación; se conserva el tope declarado.' }, teacher.id)
    if (!profile || context.lectiveHourMinutes === undefined) return resource
    const load = teacherLoadLimits(profile, teacher, { lectiveHourMinutes: context.lectiveHourMinutes })
    limits.set(teacher.id, load)
    load.gaps.forEach((gap) => addGap(gap, teacher.id))
    const prelation = teacherPrelation(profile, teacher)
    prelation.gaps.forEach((gap) => addGap(gap, teacher.id))
    // Legacy resources retain their declared cap and ordering behavior.
    if (!teacher.regime) return resource
    const hardCap = load.authorizedMaxMinutes === null ? teacher.maxWeeklyMinutes : Math.min(teacher.maxWeeklyMinutes, load.authorizedMaxMinutes)
    return { ...resource, maxWeeklyMinutes: hardCap,
      ...(load.nextException?.maxMinutes != null && load.nextException.maxMinutes > hardCap
        ? { exceptionMaxWeeklyMinutes: load.nextException.maxMinutes, exceptionKind: load.nextException.kind } : {}),
      ...(prelation.appointmentTier !== null && prelation.categoryRank !== null
        ? { appointmentTier: prelation.appointmentTier, categoryRank: prelation.categoryRank } : {}),
    }
  })
  return {
    teachers: resolvedTeachers,
    enrichDecisions(decisions: NonNullable<AcademicProposal['decisions']>) {
      return decisions.map((decision) => {
        const next = decision.teacherId ? limits.get(decision.teacherId)?.nextException : null
        return decision.kind === 'teacher-load-exception' && next
          ? { ...decision, requires: [...next.requires], sourceIds: [...next.sourceIds] } : structuredClone(decision)
      })
    },
    report(assignments: AcademicProposal['assignments']): Normative {
      const assigned = new Map<string, number>()
      for (const item of assignments) assigned.set(item.teacherId, (assigned.get(item.teacherId) ?? 0) + item.endMinute - item.startMinute)
      return { profileRevision: profile?.revision ?? null, lectiveHourMinutes: context.lectiveHourMinutes ?? null,
        gaps: [...gaps.values()], blockers: profile && context.lectiveHourMinutes !== undefined
          ? loadAuthorizationBlockers(profile, teachers, assigned, { lectiveHourMinutes: context.lectiveHourMinutes }) : [] }
    },
  }
}
