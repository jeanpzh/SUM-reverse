import type {
  MatriculaRegularCause,
  MatriculaRegularCauseCode,
  MatriculaRegularContext,
  MatriculaRegularEligibilityState,
  MatriculaRegularGap,
  MatriculaRegularGapCode,
  MatriculaRegularOutcome,
  MatriculaRegularSource,
  MatriculaRegularSourceClass,
} from '../../../shared/matricula-regular.mjs'

export interface CauseDescription {
  code: MatriculaRegularCauseCode
  title: string
  description: string
}

export interface GapDescription {
  code: MatriculaRegularGapCode
  title: string
  description: string
}

export interface EligibilityStatusBadge {
  label: string
  variant: 'eligible' | 'ineligible' | 'pending'
  ariaLabel: string
  description: string
}

export interface FormattedSourceItem {
  id: string
  originLabel: string
  classLabel: string
  reference: string
  date: string
  statusLabel: string
}

export const CAUSE_MESSAGES: Record<MatriculaRegularCauseCode, { title: string; description: string }> = {
  PRE_ENROLLMENT_NOT_ENABLED: {
    title: 'Prematrícula no habilitada',
    description: 'El periodo o estado del estudiante no cuenta con habilitación de prematrícula.',
  },
  OUTSIDE_WINDOW: {
    title: 'Fuera de turno u horario',
    description: 'La solicitud se encuentra fuera del turno horario o ventana asignada según ponderado.',
  },
  CREDIT_LOAD_INVALID: {
    title: 'Carga de créditos fuera de rango',
    description: 'La selección no cumple con la carga regular permitida (mínimo 12 y máximo 26 créditos sin excepción aplicable).',
  },
  COURSE_NOT_IN_PRE_ENROLLMENT: {
    title: 'Asignatura fuera de prematrícula',
    description: 'La asignatura seleccionada no está incluida en el documento de prematrícula completa del estudiante.',
  },
  PLAN_MISMATCH: {
    title: 'Asignatura ajena al plan de estudios',
    description: 'La asignatura seleccionada no pertenece al plan de estudios correspondiente al estudiante.',
  },
  PREREQUISITE_UNMET: {
    title: 'Prerrequisitos no cumplidos',
    description: 'El estudiante no acredita los prerrequisitos académicos requeridos para cursar la asignatura.',
  },
  RETAKE_PRIORITY: {
    title: 'Prioridad de desaprobado pendiente',
    description: 'Existe una asignatura previamente desaprobada ofertada que debe incluirse de manera obligatoria.',
  },
  SCHEDULE_CONFLICT: {
    title: 'Cruce de horarios detectado',
    description: 'Existe coincidencia temporal entre las sesiones de clase de las secciones seleccionadas.',
  },
  SECTION_FULL: {
    title: 'Sección sin vacantes disponibles',
    description: 'La sección solicitada ha alcanzado su capacidad máxima al procesar la solicitud.',
  },
  DEBT_REQUIREMENT_UNMET: {
    title: 'Requisito administrativo pendiente',
    description: 'Registro de condición administrativa/arancelaria pendiente de regularización (condición sintética).',
  },
  HEALTH_REQUIREMENT_UNMET: {
    title: 'Requisito de salud pendiente',
    description: 'Acreditación del examen o ficha de salud pendiente de validación (condición sintética).',
  },
  ACADEMIC_INELIGIBILITY: {
    title: 'Inhabilitación académica',
    description: 'Situación académica de separación o inhabilitación según la normativa aplicable.',
  },
  TUTORSHIP_REQUIREMENT_UNMET: {
    title: 'Tutoría académica requerida',
    description: 'Se requiere acreditación de tutoría académica por registrar dos o más desaprobaciones en la asignatura.',
  },
  FOURTH_ENROLLMENT_RULE_UNMET: {
    title: 'Condición de cuarta matrícula no cumplida',
    description: 'No cumple las condiciones normativas aplicables para cuarta matrícula (curso único u horario autorizado).',
  },
  ALREADY_ENROLLED: {
    title: 'Matrícula ya registrada',
    description: 'El estudiante ya cuenta con una matrícula previamente aceptada y registrada en este periodo.',
  },
}

export const GAP_MESSAGES: Record<MatriculaRegularGapCode, { title: string; description: string }> = {
  PROFILE_MISSING: {
    title: 'Perfil académico ausente o incompleto',
    description: 'No se encuentra configurado el perfil de reglas o ponderado para este ámbito. No se asume aprobación por omisión.',
  },
  WINDOW_UNSPECIFIED: {
    title: 'Horario de turno no especificado',
    description: 'Las horas oficiales del turno o fecha no están documentadas en el calendario oficial. No se asume habilitación.',
  },
  PRE_ENROLLMENT_UNKNOWN: {
    title: 'Habilitación de prematrícula desconocida',
    description: 'El estado de prematrícula no está determinado. No se asume aprobación por omisión ni cumplimiento por defecto.',
  },
  PLAN_OR_OFFER_UNKNOWN: {
    title: 'Catálogo de oferta o plan incompleto',
    description: 'La información del plan de estudios o la oferta académica está incompleta en el sistema. No se asume catálogo completo.',
  },
  PREREQUISITE_OR_EQUIVALENCE_UNKNOWN: {
    title: 'Historial o equivalencias no determinados',
    description: 'No se cuenta con el historial de prerrequisitos o tabla de equivalencias oficial. No se asume cumplimiento por defecto.',
  },
  SCHEDULE_UNKNOWN: {
    title: 'Horario de clases no determinado',
    description: 'Alguna de las secciones ofrecidas carece de información de días y horas confirmados.',
  },
  EXCEPTION_UNKNOWN: {
    title: 'Condición de excepción de créditos no determinada',
    description: 'No se ha determinado si aplica una excepción de créditos para egreso o reincorporación. No se asume cumplimiento por defecto.',
  },
  INSTITUTIONAL_REQUIREMENT_UNKNOWN: {
    title: 'Requisito institucional no determinado',
    description: 'El estado del requisito institucional no está determinado en los datos de prueba disponibles. No se asume cumplimiento por defecto.',
  },
  REPETITION_OR_AUTHORIZATION_UNKNOWN: {
    title: 'Condición de repitencia o autorización no determinada',
    description: 'No se cuenta con la resolución de autorización o condición de repitencia documentada. No se asume cumplimiento por defecto.',
  },
}

export function formatCause(cause: MatriculaRegularCause): CauseDescription {
  const info = CAUSE_MESSAGES[cause.code] ?? {
    title: `Causa: ${cause.code}`,
    description: 'Motivo de rechazo o no habilitación académica identificado en la evaluación.',
  }
  return {
    code: cause.code,
    title: info.title,
    description: info.description,
  }
}

export function formatGap(gap: MatriculaRegularGap): GapDescription {
  const info = GAP_MESSAGES[gap.code] ?? {
    title: `Brecha de información: ${gap.code}`,
    description: 'Información institucional requerida no disponible. No se asume cumplimiento por defecto.',
  }
  return {
    code: gap.code,
    title: info.title,
    description: info.description,
  }
}

export function formatEligibilityStatus(state: MatriculaRegularEligibilityState): EligibilityStatusBadge {
  switch (state) {
    case 'eligible':
      return {
        label: 'Habilitado para selección',
        variant: 'eligible',
        ariaLabel: 'Estado de elegibilidad: Habilitado para selección',
        description: 'Cumple las condiciones contextuales conocidas para iniciar la selección de asignaturas.',
      }
    case 'ineligible':
      return {
        label: 'No habilitado',
        variant: 'ineligible',
        ariaLabel: 'Estado de elegibilidad: No habilitado',
        description: 'Presenta causas académicas o normativas conocidas que impiden la habilitación.',
      }
    case 'configuration-pending':
      return {
        label: 'Pendiente de configuración',
        variant: 'pending',
        ariaLabel: 'Estado de elegibilidad: Pendiente de configuración',
        description: 'Existen brechas de información o requisitos no determinados. No se asume aprobación por omisión.',
      }
  }
}

export function formatSourceClass(sourceClass: MatriculaRegularSourceClass | null): string {
  switch (sourceClass) {
    case 'normative':
      return 'Normativa oficial'
    case 'observed':
      return 'Evidencia observada'
    case 'testimony':
      return 'Testimonio de usuario'
    case 'inferred':
      return 'Inferencia técnica'
    case null:
      return 'Decisión de diseño local'
  }
}

export function formatSourceStatus(status: MatriculaRegularSource['status']): string {
  switch (status) {
    case 'documented':
      return 'Documentada'
    case 'reported':
      return 'Reportada'
    case 'unverified':
      return 'No verificada'
    case 'local-only':
      return 'Solo prototipo local'
  }
}

export function formatSourceItem(source: MatriculaRegularSource): FormattedSourceItem {
  return {
    id: source.id,
    originLabel: source.origin === 'evidence' ? 'Evidencia' : 'Decisión local',
    classLabel: formatSourceClass(source.class),
    reference: source.reference,
    date: source.date,
    statusLabel: formatSourceStatus(source.status),
  }
}

export interface AcademicRequirementsViewModel {
  schoolId: string
  period: string
  planId: string
  statusBadge: EligibilityStatusBadge
  causes: CauseDescription[]
  gaps: GapDescription[]
  sources: FormattedSourceItem[]
  isFromOutcome: boolean
  hasUnmetConditions: boolean
  hasPendingGaps: boolean
}

export function buildAcademicRequirementsViewModel(
  context: MatriculaRegularContext,
  outcome?: MatriculaRegularOutcome | null,
): AcademicRequirementsViewModel {
  const isFromOutcome = Boolean(outcome)
  const causesSource = outcome ? outcome.causes : context.eligibility.causes
  const gapsSource = outcome ? outcome.gaps : context.eligibility.gaps

  let statusBadge: EligibilityStatusBadge
  if (outcome) {
    if (outcome.state === 'accepted') {
      statusBadge = {
        label: 'Matrícula aceptada',
        variant: 'eligible',
        ariaLabel: 'Resultado académico: Matrícula aceptada',
        description: 'La solicitud fue procesada y aceptada con éxito en el sistema local.',
      }
    } else if (outcome.state === 'rejected') {
      statusBadge = {
        label: 'Solicitud rechazada',
        variant: 'ineligible',
        ariaLabel: 'Resultado académico: Solicitud rechazada',
        description: 'La solicitud fue evaluada y rechazada por causas académicas o de capacidad.',
      }
    } else {
      statusBadge = {
        label: 'Pendiente de configuración',
        variant: 'pending',
        ariaLabel: 'Resultado académico: Pendiente de configuración',
        description: 'La solicitud contiene brechas de información no determinadas.',
      }
    }
  } else {
    statusBadge = formatEligibilityStatus(context.eligibility.state)
  }

  const causes = causesSource.map(formatCause)
  const gaps = gapsSource.map(formatGap)
  const sources = context.sources.map(formatSourceItem)

  return {
    schoolId: context.scope.schoolId,
    period: context.scope.period,
    planId: context.scope.planId,
    statusBadge,
    causes,
    gaps,
    sources,
    isFromOutcome,
    hasUnmetConditions: causes.length > 0,
    hasPendingGaps: gaps.length > 0,
  }
}
