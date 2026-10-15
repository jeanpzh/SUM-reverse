import type {
  MatriculaRegularCause,
  MatriculaRegularEligibility,
  MatriculaRegularGap,
  MatriculaRegularId,
} from '../../../shared/matricula-regular.mjs'
import { findProfile } from './profiles.js'
import type {
  ActorProfile,
  EffectiveWindow,
  EnrollmentProfile,
  PublishedRow,
} from './profile.types.js'

const LIMA_UTC_OFFSET_MINUTES = 5 * 60
function isSyntheticId(value: string): value is MatriculaRegularId {
  return /^SYN-[A-Z0-9-]{1,48}$/.test(value)
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort()
}

function cause(
  code: MatriculaRegularCause['code'],
  sourceIds: string[],
): MatriculaRegularCause {
  return { code, courseIds: [], sectionIds: [], sourceIds: uniqueSorted(sourceIds) }
}

function gap(
  code: MatriculaRegularGap['code'],
  sourceIds: string[],
): MatriculaRegularGap {
  return { code, courseIds: [], sourceIds: uniqueSorted(sourceIds) }
}

function sourceIdsForRule(profile: EnrollmentProfile, ruleId: string): string[] {
  return profile.rules.find((rule) => rule.ruleId === ruleId)?.sourceIds ?? []
}

function limaDate(now: Date): string {
  return new Date(now.getTime() - LIMA_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10)
}

function utcFromLimaDateTime(date: string, time: string): Date {
  const limaLocalAsUtc = new Date(`${date}T${time}:00.000Z`)
  limaLocalAsUtc.setTime(limaLocalAsUtc.getTime() + LIMA_UTC_OFFSET_MINUTES * 60_000)
  return limaLocalAsUtc
}

function toPublishedWindow(row: PublishedRow): EffectiveWindow {
  const start = utcFromLimaDateTime(row.day, row.startLocal)
  const nextLimaMidnight = new Date(`${row.day}T00:00:00.000Z`)
  nextLimaMidnight.setUTCDate(nextLimaMidnight.getUTCDate() + 1)
  const end = utcFromLimaDateTime(nextLimaMidnight.toISOString().slice(0, 10), '00:00')

  return {
    id: `SYN-PUBLISHED-ROW-${row.row}`,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    minPp: row.ppMin,
    origin: 'published-derived',
    sourceIds: [row.sourceId],
  }
}

function isApplicableOnDate(window: EffectiveWindow, day: string): boolean {
  return window.startsAt.slice(0, 10) === day
}

function applicableWindow(
  profile: EnrollmentProfile,
  now: Date,
  ponderado: number | null,
): EffectiveWindow | null {
  const utcDay = now.toISOString().slice(0, 10)
  const explicit = profile.calendar.effectiveWindows.filter((window) => isApplicableOnDate(window, utcDay))

  if (explicit.length > 0) {
    return explicit
      .filter((window) => ponderado !== null && ponderado >= window.minPp)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0] ?? null
  }

  const published = profile.calendar.publishedRows
    .filter((row) => row.day === limaDate(now))
    .map(toPublishedWindow)
    .filter((window) => ponderado !== null && ponderado >= window.minPp)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))

  return published[0] ?? null
}

function isInside(window: EffectiveWindow | null, now: Date): boolean {
  if (window === null) return false
  const timestamp = now.getTime()
  return timestamp >= Date.parse(window.startsAt) && timestamp < Date.parse(window.endsAt)
}

function evaluateWindow(
  profile: EnrollmentProfile,
  actor: ActorProfile,
  now: Date,
): { window: EffectiveWindow | null; causes: MatriculaRegularCause[]; gaps: MatriculaRegularGap[] } {
  const day = limaDate(now)
  const window = applicableWindow(profile, now, actor.ponderado)
  const hasExplicitSynthetic = profile.calendar.effectiveWindows.some((item) =>
    item.origin === 'synthetic' && isApplicableOnDate(item, now.toISOString().slice(0, 10)),
  )
  const unknownDate = profile.calendar.unknownDates.includes(day)
  const gaps: MatriculaRegularGap[] = []

  if (actor.ponderado === null) {
    gaps.push(gap('PROFILE_MISSING', sourceIdsForRule(profile, 'PP-ABOVE-19-TESTIMONY')))
  }

  if (unknownDate && !hasExplicitSynthetic) {
    const ruleId = day === '2026-08-11'
      ? 'AUGUST-11-OPERATING-HOURS'
      : 'AUGUST-12-OPERATING-HOURS'
    gaps.push(gap('WINDOW_UNSPECIFIED', sourceIdsForRule(profile, ruleId)))
  }

  if (gaps.length > 0) {
    return { window, causes: [], gaps }
  }

  if (!isInside(window, now)) {
    const explicitSources = profile.calendar.effectiveWindows
      .filter((item) => isApplicableOnDate(item, now.toISOString().slice(0, 10)))
      .flatMap((item) => item.sourceIds)
    const sourceIds = window?.sourceIds
      ?? (explicitSources.length > 0 ? explicitSources : sourceIdsForRule(profile, 'F6-MONDAY-PP-BANDS'))
    return { window, causes: [cause('OUTSIDE_WINDOW', sourceIds)], gaps: [] }
  }

  return { window, causes: [], gaps: [] }
}

function evaluatePreEnrollment(actor: ActorProfile): {
  causes: MatriculaRegularCause[]
  gaps: MatriculaRegularGap[]
} {
  const causes: MatriculaRegularCause[] = []
  const gaps: MatriculaRegularGap[] = []
  const rule = actor.rules.find((item) => item.ruleId === 'PRE-ENROLLMENT-ENABLED')

  if (actor.preEnrollmentEnabled === null || rule === undefined || rule.knowledge === 'unknown') {
    gaps.push(gap('PRE_ENROLLMENT_UNKNOWN', rule?.sourceIds ?? []))
  } else if (rule?.knowledge !== 'not-applicable' && actor.preEnrollmentEnabled === false) {
    causes.push(cause('PRE_ENROLLMENT_NOT_ENABLED', rule?.sourceIds ?? []))
  }

  if (!actor.preEnrollmentComplete) {
    const planOfferRule = actor.rules.find((item) => item.ruleId === 'PLAN-AND-OFFER')
    gaps.push(gap('PLAN_OR_OFFER_UNKNOWN', planOfferRule?.sourceIds ?? []))
  }

  return { causes, gaps }
}

function evaluatePlanAndOffer(actor: ActorProfile): MatriculaRegularGap[] {
  const rule = actor.rules.find((item) => item.ruleId === 'PLAN-AND-OFFER')
  if (!actor.planKnown || !actor.offerKnown || rule === undefined || rule.knowledge === 'unknown') {
    return [gap('PLAN_OR_OFFER_UNKNOWN', rule?.sourceIds ?? [])]
  }
  return []
}

function evaluateInstitutional(actor: ActorProfile): {
  causes: MatriculaRegularCause[]
  gaps: MatriculaRegularGap[]
} {
  const rule = actor.rules.find((item) => item.ruleId === 'INSTITUTIONAL-REQUIREMENTS')
  const sourceIds = rule?.sourceIds ?? []
  const causes: MatriculaRegularCause[] = []
  const gaps: MatriculaRegularGap[] = []
  if (rule?.knowledge === 'not-applicable') return { causes, gaps }
  if (rule === undefined || rule.knowledge === 'unknown') {
    return { causes, gaps: [gap('INSTITUTIONAL_REQUIREMENT_UNKNOWN', sourceIds)] }
  }

  if (actor.institutional.debt === 'unmet') {
    causes.push(cause('DEBT_REQUIREMENT_UNMET', sourceIds))
  } else if (actor.institutional.debt === 'unknown') {
    gaps.push(gap('INSTITUTIONAL_REQUIREMENT_UNKNOWN', sourceIds))
  }

  if (actor.institutional.health === 'unmet') {
    causes.push(cause('HEALTH_REQUIREMENT_UNMET', sourceIds))
  } else if (actor.institutional.health === 'unknown') {
    gaps.push(gap('INSTITUTIONAL_REQUIREMENT_UNKNOWN', sourceIds))
  }

  if (actor.institutional.eligibility === 'unmet') {
    causes.push(cause('ACADEMIC_INELIGIBILITY', sourceIds))
  } else if (actor.institutional.eligibility === 'unknown') {
    gaps.push(gap('INSTITUTIONAL_REQUIREMENT_UNKNOWN', sourceIds))
  }

  return { causes, gaps }
}

function normalizeGaps(gaps: MatriculaRegularGap[]): MatriculaRegularGap[] {
  const byCode = new Map<MatriculaRegularGap['code'], MatriculaRegularGap>()
  for (const item of gaps) {
    const existing = byCode.get(item.code)
    byCode.set(item.code, {
      code: item.code,
      courseIds: [],
      sourceIds: uniqueSorted([...(existing?.sourceIds ?? []), ...item.sourceIds]),
    })
  }
  return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code))
}

function normalizeCauses(causes: MatriculaRegularCause[]): MatriculaRegularCause[] {
  const byCode = new Map<MatriculaRegularCause['code'], MatriculaRegularCause>()
  for (const item of causes) {
    const existing = byCode.get(item.code)
    byCode.set(item.code, {
      code: item.code,
      courseIds: [],
      sectionIds: [],
      sourceIds: uniqueSorted([...(existing?.sourceIds ?? []), ...item.sourceIds]),
    })
  }
  return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code))
}

export function evaluateContextEligibility(
  profiles: readonly EnrollmentProfile[],
  actor: ActorProfile,
  now: Date,
): MatriculaRegularEligibility {
  const profile = findProfile(profiles, actor.scope, actor.profileRevision)
  if (profile === null) {
    return {
      state: 'configuration-pending',
      windowId: null,
      windowOrigin: null,
      causes: [],
      gaps: [gap('PROFILE_MISSING', [])],
    }
  }

  const windowResult = evaluateWindow(profile, actor, now)
  const preEnrollment = evaluatePreEnrollment(actor)
  const institutional = evaluateInstitutional(actor)
  const causes = normalizeCauses([
    ...windowResult.causes,
    ...preEnrollment.causes,
    ...institutional.causes,
  ])
  const gaps = normalizeGaps([
    ...windowResult.gaps,
    ...preEnrollment.gaps,
    ...evaluatePlanAndOffer(actor),
    ...institutional.gaps,
  ])

  return {
    state: gaps.length > 0 ? 'configuration-pending' : causes.length > 0 ? 'ineligible' : 'eligible',
    windowId: windowResult.window !== null && isSyntheticId(windowResult.window.id)
      ? windowResult.window.id
      : null,
    windowOrigin: windowResult.window?.origin ?? null,
    causes,
    gaps,
  }
}
