import { loadAuthorizationBlockers, NormativeProfileGapError, resolveNormativeProfile, teacherLoadLimits, teacherPrelation } from '../../../shared/academic-normative-profile.mjs'
import type { AcademicProposal, AcademicRequest, AcademicTeacherResource, AcademicWorkspace } from '../../../shared/programacion-academica-api.mjs'
import type { AcademicTeacher } from './schedule.types.js'

type Context = Pick<AcademicRequest, 'academicPeriod' | 'lectiveHourMinutes' | 'planningPolicy'> & Partial<Pick<AcademicRequest, 'demands'>>
type Normative = NonNullable<AcademicProposal['normative']>

export function workspaceNormativeContext(workspace: AcademicWorkspace): Context {
  return { ...workspace.request, academicPeriod: workspace.academicPeriod,
    lectiveHourMinutes: workspace.lectiveHourMinutes }
}

export function resolvePlanningNormative(context: Context, teachers: AcademicTeacherResource[]) {
  const selectedCourses = context.demands ? new Set(context.demands.map((demand) => demand.courseId)) : null
  const inScope = new Set(teachers.filter((teacher) => !selectedCourses || teacher.courseIds.some((id) => selectedCourses.has(id))).map((teacher) => teacher.id))
  const gaps = new Map<string, Normative['gaps'][number]>()
  const addGap = (gap: { code: string; message: string }, teacherId?: string, loadRequirement = true) => {
    const row = gaps.get(gap.code) ?? { ...gap }
    if (teacherId) row.teacherIds = [...new Set([...(row.teacherIds ?? []), teacherId])].sort()
    row.blocking ||= loadRequirement && (!teacherId || inScope.has(teacherId)) && (['NORMATIVE_PERIOD_MISSING', 'LECTIVE_HOUR_MINUTES_MISSING', 'REGIME_MISSING', 'APPOINTMENT_MISSING', 'TP_SERVICE_HOURS_MISSING', 'RENACYT_TIEMPO_PARCIAL_UNRESOLVED'].includes(gap.code) || gap.code.startsWith('NORMATIVE_PROFILE_'))
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
    if (!teacher.regime && teacher.appointment !== 'contract') addGap({ code: 'REGIME_MISSING', message: 'No se registró el régimen de dedicación; se conserva el tope declarado.' }, teacher.id)
    if (!profile || context.lectiveHourMinutes === undefined) return resource
    const load = teacherLoadLimits(profile, teacher, { lectiveHourMinutes: context.lectiveHourMinutes })
    limits.set(teacher.id, load)
    load.gaps.forEach((gap) => addGap(gap, teacher.id))
    const prelation = teacherPrelation(profile, teacher)
    prelation.gaps.forEach((gap) => addGap(gap, teacher.id, false))
    // Legacy resources retain their declared cap and ordering behavior.
    if (!teacher.regime) return resource
    const hardCap = load.authorizedMaxMinutes === null ? teacher.maxWeeklyMinutes : Math.min(teacher.maxWeeklyMinutes, load.authorizedMaxMinutes)
    return { ...resource, maxWeeklyMinutes: hardCap,
      ...(load.authorizedMaxMinutes !== null && hardCap < load.authorizedMaxMinutes
        ? { configurationMaxWeeklyMinutes: load.authorizedMaxMinutes,
          exceptionMaxWeeklyMinutes: Math.max(load.authorizedMaxMinutes, load.nextException?.maxMinutes ?? 0),
          exceptionKind: load.nextException?.maxMinutes != null && load.nextException.maxMinutes > load.authorizedMaxMinutes ? load.nextException.kind : 'configuration-adjustment' as const }
        : load.nextException?.maxMinutes != null && load.nextException.maxMinutes > hardCap
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
        if (decision.exceptionKind === 'configuration-adjustment') return { ...decision, requires: [], sourceIds: [] }
        return decision.kind === 'teacher-load-exception' && next
          ? { ...decision, requires: [...next.requires], sourceIds: [...next.sourceIds] } : structuredClone(decision)
      })
    },
    report(assignments: AcademicProposal['assignments']): Normative {
      const assigned = new Map<string, number>()
      for (const item of assignments) assigned.set(item.teacherId, (assigned.get(item.teacherId) ?? 0) + item.endMinute - item.startMinute)
      const minimumGaps: Normative['gaps'] = []
      for (const teacher of teachers) {
        const load = limits.get(teacher.id)
        if (!inScope.has(teacher.id) || teacher.appointment === 'contract' || load?.minimumMinutes == null) continue
        const assignedMinutes = assigned.get(teacher.id) ?? 0
        if (assignedMinutes < load.minimumMinutes) minimumGaps.push({
          code: 'MINIMUM_LOAD_SCOPE_UNRESOLVED', blocking: true, teacherIds: [teacher.id],
          assignedMinutes, minimumMinutes: load.minimumMinutes, shortfallMinutes: load.minimumMinutes - assignedMinutes,
          message: `${teacher.id}: ${assignedMinutes} min asignados de un mínimo de ${load.minimumMinutes}; faltan ${load.minimumMinutes - assignedMinutes} min por acreditar. El alcance parcial no acredita la carga total ni existe un contrato de carga externa. No se puede publicar.`,
        })
      }
      return { profileRevision: profile?.revision ?? null, lectiveHourMinutes: context.lectiveHourMinutes ?? null,
        gaps: [...gaps.values(), ...minimumGaps], blockers: profile && context.lectiveHourMinutes !== undefined
          ? loadAuthorizationBlockers(profile, teachers, assigned, { lectiveHourMinutes: context.lectiveHourMinutes }) : [] }
    },
  }
}
