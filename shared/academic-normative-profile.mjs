// Perfil normativo (NORM-PROFILE-1): the only place that knows the UNMSM teaching-load regulation.
// Callers ask for resolved limits; nobody else encodes article numbers or hour caps. Pure functions, no I/O.
// Sources: R.R. 001380-2026-R/UNMSM (OF-02, art. 1, 5, 7, 8, 9, disposiciones complementarias 1, 2, 5 and final 3) amended in
// art. 9 by R.R. 005348-2026-R/UNMSM (OF-07). Catalog and limits: docs/domain/fisi/2026-II/planning-teaching-load-norms-2026-11-10.md.
// A norm states a requirement within its scope; it does not show that SUM enforces it. Values with class `inferred` are
// interpretations pending user confirmation, not regulation. A missing profile or datum is an explicit gap, never a fallback
// to another faculty/period or a guessed number (AGENTS.md §7).
export const NORMATIVE_PROFILE_REVISION = 'UNMSM-AAD-2026-04'
export const NORMATIVE_PROFILE_FACULTIES = Object.freeze(['FISI'])
export const NORMATIVE_PROFILE_VALID_FROM = '2026-II'
export const LECTIVE_HOUR_MINUTES = Object.freeze([45, 50, 60])
export const TEACHER_REGIMES = Object.freeze(['dedicacion-exclusiva', 'tiempo-completo', 'tiempo-parcial'])
export const TEACHER_APPOINTMENTS = Object.freeze(['faculty-ordinary', 'interfaculty-ordinary', 'contract'])
export const TEACHER_CATEGORIES = Object.freeze(['principal', 'asociado', 'auxiliar'])
export const TEACHER_LOAD_CONDITIONS = Object.freeze(['renacyt-researcher', 'postgraduate-study', 'on-leave'])
export const LOAD_AUTHORIZATION_KINDS = Object.freeze(['voluntary-declaration', 'vrap-authorization'])
export const NORMATIVE_GAP_CODES = Object.freeze([
  'APPOINTMENT_MISSING', 'APPOINTMENT_RANK_INFERRED', 'CATEGORY_MISSING', 'CONTRACT_LOAD_NOT_REGULATED', 'FISI_LECTIVE_HOUR_UNVERIFIED',
  'ON_LEAVE_INFERRED', 'PERFORMANCE_EVALUATION_NO_SOURCE', 'REGIME_MISSING', 'RENACYT_TIEMPO_PARCIAL_UNRESOLVED', 'SOURCE_OF07_URL_NOT_RECORDED',
  'TP_MINIMUM_BASIS_UNSPECIFIED', 'TP_MAXIMUM_NOT_REGULATED', 'TP_SERVICE_HOURS_MISSING',
])

export class NormativeProfileGapError extends Error {
  constructor(code, message, scope) {
    super(message)
    this.name = 'NormativeProfileGapError'
    this.code = code
    this.facultyId = scope.facultyId
    this.period = scope.period
  }
}

const gapMessages = {
  APPOINTMENT_MISSING: 'No se registró el tipo de nombramiento; el art. 1 limita el reglamento a docentes ordinarios y no se verifica ese alcance.',
  APPOINTMENT_RANK_INFERRED: 'El orden nombrado de la facultad, interfacultativo y contrato sobre la categoría es una interpretación (`inferred`) pendiente de confirmación.',
  CATEGORY_MISSING: 'No se registró la categoría docente; no se calcula el orden de prelación por categoría.',
  CONTRACT_LOAD_NOT_REGULATED: 'El reglamento (art. 1) alcanza a docentes ordinarios; no regula la carga lectiva de docentes contratados.',
  FISI_LECTIVE_HOUR_UNVERIFIED: 'El art. 8 deja a cada Consejo de Facultad la duración de la hora lectiva (45, 50 o 60 minutos); la de FISI no está verificada y debe indicarse explícitamente.',
  ON_LEAVE_INFERRED: 'Tratar a un docente con licencia o año sabático como no disponible para carga es una inferencia (`inferred`); la disposición complementaria quinta solo ordena registrarlos.',
  PERFORMANCE_EVALUATION_NO_SOURCE: 'La evaluación del desempeño docente (art. 9, criterio 3) está en el perfil pero inactiva: no existe fuente de datos.',
  REGIME_MISSING: 'No se registró el régimen de dedicación; no se calculan límites de carga.',
  RENACYT_TIEMPO_PARCIAL_UNRESOLVED: 'La disposición complementaria primera fija 6 horas lectivas mínimas para investigadores RENACYT; su efecto sobre el 40 % de un tiempo parcial no está regulado y no se aplica.',
  SOURCE_OF07_URL_NOT_RECORDED: 'R.R. 005348-2026-R: PDF aportado por el operador el 2026-11-10 y publicado en la Plataforma del Estado Peruano; la URL exacta no se registró.',
  TP_MINIMUM_BASIS_UNSPECIFIED: 'El art. 5.3 exige al menos 40 % de horas lectivas; no precisa si se mide sobre horas de servicio cronológicas. Se aplica 40 % de las horas semanales de servicio como horas lectivas (`inferred`).',
  TP_MAXIMUM_NOT_REGULATED: 'El art. 7 no establece un máximo de carga lectiva para tiempo parcial.',
  TP_SERVICE_HOURS_MISSING: 'No se registraron las horas semanales de servicio del tiempo parcial; no se calcula el mínimo del 40 %.',
}
const gap = (code) => ({ code, message: gapMessages[code] })

function deepFreeze(value) {
  if (value && typeof value === 'object') Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

const PROFILE = deepFreeze({
  revision: NORMATIVE_PROFILE_REVISION,
  scope: { facultyIds: [...NORMATIVE_PROFILE_FACULTIES], validFromPeriod: NORMATIVE_PROFILE_VALID_FROM, validUntilPeriod: null },
  sources: [
    {
      id: 'OF-02', title: 'R.R. N.° 001380-2026-R/UNMSM, Reglamento General para la Actividad Académica Docente', date: '2026-02-06',
      articles: ['1', '5.1', '5.2', '5.3', '7', '8', '9', 'DC-1', 'DC-2', 'DC-5', 'DF-3'], class: 'normative', status: 'documented',
      reference: 'https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R-ANEXO.pdf; catálogo OF-02 de phase3-planning-sources-2026-11-05.md. Alcance: docentes ordinarios. Verificado por el orquestador el 2026-11-10.',
    },
    {
      id: 'OF-07', title: 'R.R. N.° 005348-2026-R/UNMSM, modificación del art. 9 del Reglamento General para la Actividad Académica Docente', date: '2026-04-17',
      articles: ['9'], class: 'normative', status: 'documented',
      reference: 'PDF aportado por el operador el 2026-11-10; publicado en la Plataforma del Estado Peruano (gob.pe, normas legales UNMSM). URL exacta no registrada. Las demás partes del reglamento siguen vigentes.',
    },
    {
      id: 'INF-APPOINTMENT-PRELATION', title: 'Interpretación: el nombramiento (nombrado de la facultad, interfacultativo, contrato) precede a categoría y régimen', date: '2026-11-10',
      articles: [], class: 'inferred', status: 'unverified',
      reference: 'Lectura del orquestador del último párrafo del art. 9 de OF-02 (no modificado por OF-07); pendiente de confirmación del usuario.',
    },
    {
      id: 'INF-PERFORMANCE-INACTIVE', title: 'Interpretación: la evaluación del desempeño docente integra el perfil pero está inactiva por falta de datos', date: '2026-11-10',
      articles: [], class: 'inferred', status: 'unverified',
      reference: 'Art. 9, criterio 3 de OF-02; ninguna fuente de datos local lo alimenta; pendiente de confirmación del usuario.',
    },
    {
      id: 'INF-VRAP-OVER-POSTGRADUATE', title: 'Interpretación: una autorización de la VRAP puede exceder el tope de 10 horas de posgrado', date: '2026-11-10',
      articles: [], class: 'inferred', status: 'unverified',
      reference: 'Disp. final 3.ª de OF-02 habla de casos que excedan «la carga lectiva máxima»; no se corroboró que alcance al tope de la disp. compl. 2.ª. Implementación del Backend worker, pendiente de confirmación.',
    },
    {
      id: 'INF-LEAVE-UNAVAILABLE', title: 'Interpretación: docentes con licencia o año sabático no están disponibles para carga lectiva (autorizado 0 y mínimo 0)', date: '2026-11-10',
      articles: [], class: 'inferred', status: 'unverified',
      reference: 'La disposición complementaria quinta de OF-02 ordena a SUM registrar licencias y sabático; no dispone su efecto en la carga.',
    },
  ],
  loadRules: {
    lectiveHourMinutes: { allowed: [...LECTIVE_HOUR_MINUTES], default: null, articles: ['8'], sourceIds: ['OF-02'], status: 'unverified' },
    regimes: {
      'dedicacion-exclusiva': { serviceHoursPerWeek: 40, minimumLectiveHours: 10, ordinaryMaxLectiveHours: 12, articles: ['5.1', '7'], sourceIds: ['OF-02'] },
      'tiempo-completo': { serviceHoursPerWeek: 40, minimumLectiveHours: 10, ordinaryMaxLectiveHours: 12, articles: ['5.2', '7'], sourceIds: ['OF-02'] },
      'tiempo-parcial': { serviceHoursBelow: 40, minimumLectiveShare: 0.4, ordinaryMaxLectiveHours: null, articles: ['5.3', '7'], sourceIds: ['OF-02'] },
    },
    voluntaryDeclaration: { maxLectiveHours: 20, articles: ['7'], sourceIds: ['OF-02'] },
    renacytResearcher: { minimumLectiveHours: 6, articles: ['DC-1'], sourceIds: ['OF-02'] },
    postgraduateStudy: { maxLectiveHours: 10, articles: ['DC-2'], sourceIds: ['OF-02'] },
    onLeave: { authorizedMaxLectiveHours: 0, articles: ['DC-5'], sourceIds: ['OF-02', 'INF-LEAVE-UNAVAILABLE'] },
    vrapAuthorization: { articles: ['DF-3'], sourceIds: ['OF-02'], overPostgraduateCapSourceIds: ['OF-02', 'INF-VRAP-OVER-POSTGRADUATE'] },
  },
  prelation: {
    criteria: [
      { order: 0, id: 'appointment', active: true, class: 'inferred', articles: ['9'], sourceIds: ['OF-02', 'INF-APPOINTMENT-PRELATION'] },
      { order: 1, id: 'specialty', active: true, class: 'normative', articles: ['9'], sourceIds: ['OF-02'] },
      { order: 2, id: 'category-regime', active: true, class: 'normative', articles: ['9'], sourceIds: ['OF-07'] },
      { order: 3, id: 'performance-evaluation', active: false, class: 'inferred', articles: ['9'], sourceIds: ['OF-02', 'INF-PERFORMANCE-INACTIVE'] },
    ],
    appointmentTiers: { 'faculty-ordinary': 0, 'interfaculty-ordinary': 1, contract: 2 },
    categoryRegimeOrder: [
      ['principal', 'dedicacion-exclusiva'], ['principal', 'tiempo-completo'], ['principal', 'tiempo-parcial'],
      ['asociado', 'dedicacion-exclusiva'], ['asociado', 'tiempo-completo'], ['asociado', 'tiempo-parcial'],
      ['auxiliar', 'dedicacion-exclusiva'], ['auxiliar', 'tiempo-completo'], ['auxiliar', 'tiempo-parcial'],
    ],
    categoryRegimeSourceIds: ['OF-07'],
    cycleRange: { from: 1, to: 10 },
  },
  gaps: ['APPOINTMENT_RANK_INFERRED', 'CONTRACT_LOAD_NOT_REGULATED', 'FISI_LECTIVE_HOUR_UNVERIFIED', 'PERFORMANCE_EVALUATION_NO_SOURCE',
    'SOURCE_OF07_URL_NOT_RECORDED', 'TP_MINIMUM_BASIS_UNSPECIFIED', 'TP_MAXIMUM_NOT_REGULATED'].map(gap),
})

const periodPattern = /^(20\d{2})-(0|I|II)$/
const periodRank = (period) => {
  const [, year, term] = periodPattern.exec(period)
  return Number(year) * 10 + { 0: 0, I: 1, II: 2 }[term]
}

// Returns a copy. A period before the profile's validity or a faculty without profile is an explicit gap (throws): the caller
// must block, never fall back to another period or faculty.
export function resolveNormativeProfile({ facultyId, period } = {}) {
  if (typeof facultyId !== 'string' || !facultyId) throw new TypeError('facultyId: texto requerido')
  if (typeof period !== 'string' || !periodPattern.test(period)) throw new TypeError('period: formato AAAA-0, AAAA-I o AAAA-II requerido')
  if (!NORMATIVE_PROFILE_FACULTIES.includes(facultyId)) {
    throw new NormativeProfileGapError('NORMATIVE_PROFILE_FACULTY_UNKNOWN', `No existe un perfil normativo para la facultad ${facultyId}.`, { facultyId, period })
  }
  if (periodRank(period) < periodRank(NORMATIVE_PROFILE_VALID_FROM)) {
    throw new NormativeProfileGapError('NORMATIVE_PROFILE_PERIOD_BEFORE_VALIDITY',
      `No existe un perfil normativo para ${period}: el perfil ${NORMATIVE_PROFILE_REVISION} rige desde ${NORMATIVE_PROFILE_VALID_FROM}.`, { facultyId, period })
  }
  return structuredClone(PROFILE)
}

function assertProfile(profile) {
  if (!profile || typeof profile !== 'object' || profile.revision !== NORMATIVE_PROFILE_REVISION || !profile.loadRules || !profile.prelation) {
    throw new TypeError('Perfil normativo inválido: use resolveNormativeProfile')
  }
}
function assertLectiveHourMinutes(profile, value) {
  if (!profile.loadRules.lectiveHourMinutes.allowed.includes(value)) {
    throw new TypeError('lectiveHourMinutes: debe indicarse explícitamente y ser 45, 50 o 60 (art. 8; la duración de FISI no está verificada)')
  }
}
function assertTeacher(teacher) {
  if (!teacher || typeof teacher !== 'object' || Array.isArray(teacher)) throw new TypeError('teacher: objeto requerido')
  for (const [field, allowed] of [['regime', TEACHER_REGIMES], ['appointment', TEACHER_APPOINTMENTS], ['category', TEACHER_CATEGORIES]]) {
    if (teacher[field] !== undefined && !allowed.includes(teacher[field])) throw new TypeError(`teacher.${field}: valor inválido`)
  }
  if (teacher.weeklyServiceHours !== undefined && (!Number.isSafeInteger(teacher.weeklyServiceHours) || teacher.weeklyServiceHours < 1 || teacher.weeklyServiceHours > 39)) {
    throw new TypeError('teacher.weeklyServiceHours: entero de 1 a 39 requerido')
  }
  if (teacher.loadConditions !== undefined && (!Array.isArray(teacher.loadConditions) || teacher.loadConditions.some((item) => !TEACHER_LOAD_CONDITIONS.includes(item)))) {
    throw new TypeError('teacher.loadConditions: lista inválida')
  }
  if (teacher.loadAuthorizations !== undefined) {
    if (!Array.isArray(teacher.loadAuthorizations)) throw new TypeError('teacher.loadAuthorizations: lista inválida')
    for (const item of teacher.loadAuthorizations) {
      if (!item || !LOAD_AUTHORIZATION_KINDS.includes(item.kind)) throw new TypeError('teacher.loadAuthorizations: tipo inválido')
      if (item.kind === 'vrap-authorization' && (!Number.isSafeInteger(item.maxLectiveHours) || item.maxLectiveHours < 1)) {
        throw new TypeError('teacher.loadAuthorizations: la autorización de la VRAP requiere maxLectiveHours')
      }
    }
  }
}

const unique = (items) => [...new Set(items)]
const REQUIREMENTS = {
  'voluntary-declaration': [
    'Solicitud del docente a su departamento académico',
    'Declaración jurada de carácter voluntario y sin compensación adicional',
  ],
  'vrap-authorization': [
    'Solicitud del docente',
    'Informe del director del departamento académico al decano',
    'Autorización de la VRAP',
  ],
}
const emptyLimits = (sourceIds, articles, gaps) => ({
  minimumMinutes: null, ordinaryMaxMinutes: null, authorizedMaxMinutes: null, nextException: null, gaps, sourceIds: unique(sourceIds), articles: unique(articles),
})

// Resolved weekly lective limits of one teacher, in minutes. `lectiveHourMinutes` is mandatory (art. 8, FISI value unverified).
// `authorizedMaxMinutes` is what can be used today given the recorded authorizations; `nextException` is the next regulated step.
// Beyond the fixed result shape it carries `articles`, the article references that justify each number.
export function teacherLoadLimits(profile, teacher, { lectiveHourMinutes } = {}) {
  assertProfile(profile)
  assertLectiveHourMinutes(profile, lectiveHourMinutes)
  assertTeacher(teacher)
  const rules = profile.loadRules
  const minutes = (hours) => Math.round(hours * lectiveHourMinutes)
  const sourceIds = ['OF-02']
  const articles = ['8']
  const gaps = []
  if (teacher.appointment === 'contract') return emptyLimits(sourceIds, ['1', ...articles], [gap('CONTRACT_LOAD_NOT_REGULATED')])
  if (teacher.appointment === undefined) gaps.push(gap('APPOINTMENT_MISSING'))
  const regime = rules.regimes[teacher.regime]
  if (!regime) return emptyLimits(sourceIds, articles, [...gaps, gap('REGIME_MISSING')])
  const conditions = teacher.loadConditions ?? []
  const authorizations = teacher.loadAuthorizations ?? []
  articles.push(...regime.articles)
  const postgraduate = conditions.includes('postgraduate-study')
  const partTime = teacher.regime === 'tiempo-parcial'

  let minimumHours
  if (partTime) {
    if (teacher.weeklyServiceHours === undefined) gaps.push(gap('TP_SERVICE_HOURS_MISSING'))
    else minimumHours = teacher.weeklyServiceHours * regime.minimumLectiveShare
    if (conditions.includes('renacyt-researcher')) gaps.push(gap('RENACYT_TIEMPO_PARCIAL_UNRESOLVED'))
  } else {
    minimumHours = regime.minimumLectiveHours
    if (conditions.includes('renacyt-researcher')) {
      minimumHours = rules.renacytResearcher.minimumLectiveHours
      articles.push(...rules.renacytResearcher.articles)
    }
  }

  let ordinaryMaxHours = regime.ordinaryMaxLectiveHours
  if (postgraduate) {
    ordinaryMaxHours = rules.postgraduateStudy.maxLectiveHours
    articles.push(...rules.postgraduateStudy.articles)
  }
  if (ordinaryMaxHours === null) gaps.push(gap('TP_MAXIMUM_NOT_REGULATED'))

  // The voluntary declaration (art. 7) lifts the 12 h maximum of TC/DE to 20 h; it does not lift the postgraduate cap.
  const voluntaryHours = !partTime && !postgraduate ? rules.voluntaryDeclaration.maxLectiveHours : null
  const voluntaryRecorded = voluntaryHours !== null && authorizations.some((item) => item.kind === 'voluntary-declaration')
  const vrapHours = authorizations.filter((item) => item.kind === 'vrap-authorization').map((item) => item.maxLectiveHours)
  let authorizedHours = ordinaryMaxHours === null ? null : Math.max(ordinaryMaxHours, voluntaryRecorded ? voluntaryHours : 0, ...vrapHours)
  if (voluntaryRecorded) articles.push(...rules.voluntaryDeclaration.articles)
  if (vrapHours.length) {
    articles.push(...rules.vrapAuthorization.articles)
    if (postgraduate) sourceIds.push(...rules.vrapAuthorization.overPostgraduateCapSourceIds)
  }

  let nextKind = null
  let nextHours = null
  if (ordinaryMaxHours !== null && !vrapHours.length) {
    if (voluntaryHours !== null && !voluntaryRecorded) { nextKind = 'voluntary-declaration'; nextHours = voluntaryHours } else nextKind = 'vrap-authorization'
  }

  if (conditions.includes('on-leave')) {
    minimumHours = 0
    authorizedHours = rules.onLeave.authorizedMaxLectiveHours
    nextKind = null
    sourceIds.push(...rules.onLeave.sourceIds)
    articles.push(...rules.onLeave.articles)
    gaps.push(gap('ON_LEAVE_INFERRED'))
  }
  if (nextKind === 'vrap-authorization') articles.push(...rules.vrapAuthorization.articles)
  return {
    minimumMinutes: minimumHours === undefined ? null : minutes(minimumHours),
    ordinaryMaxMinutes: ordinaryMaxHours === null ? null : minutes(ordinaryMaxHours),
    authorizedMaxMinutes: authorizedHours === null ? null : minutes(authorizedHours),
    nextException: nextKind ? {
      kind: nextKind,
      maxMinutes: nextHours === null ? null : minutes(nextHours),
      requires: [...REQUIREMENTS[nextKind]],
      sourceIds: ['OF-02'],
    } : null,
    gaps,
    sourceIds: unique(sourceIds),
    articles: unique(articles),
  }
}

// Order of preference for assigning lective load (art. 9). Tier: 0 faculty-ordinary, 1 interfaculty-ordinary, 2 contract (`inferred`).
// categoryRank 1..9 follows the table of R.R. 005348-2026-R. Missing data yields null and a gap, never a guess.
export function teacherPrelation(profile, teacher) {
  assertProfile(profile)
  assertTeacher(teacher)
  const { prelation } = profile
  const gaps = []
  const sourceIds = []
  let appointmentTier = null
  let categoryRank = null
  if (teacher.appointment === undefined) gaps.push(gap('APPOINTMENT_MISSING'))
  else {
    appointmentTier = prelation.appointmentTiers[teacher.appointment]
    sourceIds.push('OF-02', 'INF-APPOINTMENT-PRELATION')
    gaps.push(gap('APPOINTMENT_RANK_INFERRED'))
  }
  if (teacher.category === undefined) gaps.push(gap('CATEGORY_MISSING'))
  if (teacher.regime === undefined) gaps.push(gap('REGIME_MISSING'))
  if (teacher.category !== undefined && teacher.regime !== undefined) {
    categoryRank = prelation.categoryRegimeOrder.findIndex(([category, regime]) => category === teacher.category && regime === teacher.regime) + 1
    sourceIds.push(...prelation.categoryRegimeSourceIds)
  }
  return { appointmentTier, categoryRank, gaps, sourceIds: unique(sourceIds) }
}

// The voluntary declaration only helps when it reaches the assigned load; above its ceiling (20 h) the VRAP is the only route.
const declarationCovers = (next, assignedMinutes) => next?.kind === 'voluntary-declaration' && next.maxMinutes !== null && assignedMinutes <= next.maxMinutes

// Teachers whose assigned lective minutes exceed what is authorized today. A teacher without a regulated maximum (contract,
// part-time without cap, missing regime) is not listed: its gaps are visible in teacherLoadLimits. A UI approval never
// replaces the formal authorization named here; above the declaration ceiling, with a declaration already recorded, or for a teacher on leave the VRAP (DF-3) is the
// only named route (an on-leave teacher is really an availability problem, not an authorization one).
export function loadAuthorizationBlockers(profile, teachers, assignedMinutesByTeacherId, { lectiveHourMinutes } = {}) {
  assertProfile(profile)
  assertLectiveHourMinutes(profile, lectiveHourMinutes)
  if (!Array.isArray(teachers)) throw new TypeError('teachers: lista requerida')
  const assignedOf = assignedMinutesByTeacherId instanceof Map
    ? (id) => assignedMinutesByTeacherId.get(id)
    : (id) => (assignedMinutesByTeacherId && Object.hasOwn(assignedMinutesByTeacherId, id) ? assignedMinutesByTeacherId[id] : undefined)
  const blockers = []
  for (const teacher of teachers) {
    if (!teacher || typeof teacher.id !== 'string' || !teacher.id) throw new TypeError('teacher.id: texto requerido')
    const assignedMinutes = assignedOf(teacher.id) ?? 0
    if (!Number.isFinite(assignedMinutes) || assignedMinutes < 0) throw new TypeError(`assignedMinutes de ${teacher.id}: número no negativo requerido`)
    const limits = teacherLoadLimits(profile, teacher, { lectiveHourMinutes })
    if (limits.authorizedMaxMinutes === null || assignedMinutes <= limits.authorizedMaxMinutes) continue
    blockers.push({
      teacherId: teacher.id,
      assignedMinutes,
      authorizedMaxMinutes: limits.authorizedMaxMinutes,
      requiredAuthorization: declarationCovers(limits.nextException, assignedMinutes) ? 'voluntary-declaration' : 'vrap-authorization',
      sourceIds: limits.sourceIds,
    })
  }
  return blockers
}
