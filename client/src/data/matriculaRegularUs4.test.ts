import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  MatriculaRegularCause,
  MatriculaRegularContext,
  MatriculaRegularEligibility,
  MatriculaRegularGap,
  MatriculaRegularOutcome,
  MatriculaRegularScope,
  MatriculaRegularSource,
} from '../../../shared/matricula-regular.mjs'
import {
  buildAcademicRequirementsViewModel,
  formatCause,
  formatEligibilityStatus,
  formatGap,
  formatSourceClass,
  formatSourceItem,
  formatSourceStatus,
} from './academicRequirements.ts'

const scopeSistemas: MatriculaRegularScope = {
  facultyId: 'FISI',
  schoolId: 'SISTEMAS',
  period: '2026-II',
  planId: 'SYN-SIS-PLAN',
  modality: 'regular-virtual',
}

const scopeSoftware: MatriculaRegularScope = {
  facultyId: 'FISI',
  schoolId: 'SOFTWARE',
  period: '2026-II',
  planId: 'SYN-SOFT-PLAN',
  modality: 'regular-virtual',
}

function createTestContext(options: {
  scope: MatriculaRegularScope
  eligibility: MatriculaRegularEligibility
  sources?: MatriculaRegularSource[]
}): MatriculaRegularContext {
  return {
    actorId: options.scope.schoolId === 'SISTEMAS' ? 'SYN-SIS-A' : 'SYN-SOFT-A',
    scope: options.scope,
    profileRevision: `MR-SYN-${options.scope.schoolId === 'SISTEMAS' ? 'SIS' : 'SOFT'}-1`,
    serverNow: '2026-08-11T15:00:00.000Z',
    preEnrollmentEnabled: true,
    preEnrollmentComplete: true,
    preEnrollment: [],
    offerKnown: true,
    offer: [],
    calendar: {
      publishedRows: [],
      effectiveWindows: [],
      unknownDates: [],
    },
    eligibility: options.eligibility,
    sources: options.sources ?? [
      {
        id: 'F1',
        origin: 'evidence',
        class: 'normative',
        reference: 'Reglamento General de Matrícula UNMSM',
        date: '2026-01-15',
        status: 'documented',
      },
      {
        id: 'L-01',
        origin: 'local-decision',
        class: null,
        reference: 'Decisión local L-01: Conjunto completo de causas',
        date: '2026-10-11',
        status: 'local-only',
      },
    ],
  }
}

test('formatEligibilityStatus distinguishes eligible, ineligible, and pending without defaulting to approval (AC05, AC06)', () => {
  const eligible = formatEligibilityStatus('eligible')
  assert.equal(eligible.label, 'Habilitado para selección')
  assert.equal(eligible.variant, 'eligible')
  assert.ok(eligible.description.includes('Cumple las condiciones'))

  const ineligible = formatEligibilityStatus('ineligible')
  assert.equal(ineligible.label, 'No habilitado')
  assert.equal(ineligible.variant, 'ineligible')
  assert.ok(ineligible.description.includes('causas académicas o normativas'))

  const pending = formatEligibilityStatus('configuration-pending')
  assert.equal(pending.label, 'Pendiente de configuración')
  assert.equal(pending.variant, 'pending')
  assert.ok(pending.description.includes('No se asume aprobación por omisión'))
})

test('formatCause maps all known cause codes with clear human-readable texts and no sensitive personal data (AC08, AC10, AC12, AC13)', () => {
  const causeTutorship: MatriculaRegularCause = {
    code: 'TUTORSHIP_REQUIREMENT_UNMET',
    courseIds: ['SYN-SIS-C1'],
    sectionIds: [],
    sourceIds: ['F1'],
  }
  const formattedTutorship = formatCause(causeTutorship)
  assert.equal(formattedTutorship.code, 'TUTORSHIP_REQUIREMENT_UNMET')
  assert.equal(formattedTutorship.title, 'Tutoría académica requerida')
  assert.ok(formattedTutorship.description.includes('dos o más desaprobaciones'))

  const causeDebt: MatriculaRegularCause = {
    code: 'DEBT_REQUIREMENT_UNMET',
    courseIds: [],
    sectionIds: [],
    sourceIds: ['L-01'],
  }
  const formattedDebt = formatCause(causeDebt)
  assert.equal(formattedDebt.title, 'Requisito administrativo pendiente')
  assert.ok(formattedDebt.description.includes('condición sintética'))
  // Privacy check: must not mention real monetary sums, banks, or debt accounts
  assert.ok(!formattedDebt.description.includes('soles') && !formattedDebt.description.includes('S/.'))

  const causeHealth: MatriculaRegularCause = {
    code: 'HEALTH_REQUIREMENT_UNMET',
    courseIds: [],
    sectionIds: [],
    sourceIds: ['L-01'],
  }
  const formattedHealth = formatCause(causeHealth)
  assert.equal(formattedHealth.title, 'Requisito de salud pendiente')
  assert.ok(formattedHealth.description.includes('condición sintética'))
  // Privacy check: must not expose real medical diagnoses or personal health information
  assert.ok(!formattedHealth.description.includes('diagnóstico') && !formattedHealth.description.includes('clínica'))
})

test('formatGap preserves unknown information as explicit gaps without assuming compliance by default (AC03, AC11, AC28)', () => {
  const exceptionGap: MatriculaRegularGap = {
    code: 'EXCEPTION_UNKNOWN',
    courseIds: [],
    sourceIds: ['RN-01'],
  }
  const formattedException = formatGap(exceptionGap)
  assert.equal(formattedException.code, 'EXCEPTION_UNKNOWN')
  assert.equal(formattedException.title, 'Condición de excepción de créditos no determinada')
  assert.ok(formattedException.description.includes('No se asume cumplimiento por defecto'))

  const instGap: MatriculaRegularGap = {
    code: 'INSTITUTIONAL_REQUIREMENT_UNKNOWN',
    courseIds: [],
    sourceIds: ['L-01'],
  }
  const formattedInst = formatGap(instGap)
  assert.equal(formattedInst.title, 'Requisito institucional no determinado')
  assert.ok(formattedInst.description.includes('No se asume cumplimiento por defecto'))
})

test('formatSourceClass and formatSourceStatus classify sources rigorously according to Constitution and MR-CONTRACT-2', () => {
  assert.equal(formatSourceClass('normative'), 'Normativa oficial')
  assert.equal(formatSourceClass('observed'), 'Evidencia observada')
  assert.equal(formatSourceClass('testimony'), 'Testimonio de usuario')
  assert.equal(formatSourceClass('inferred'), 'Inferencia técnica')
  assert.equal(formatSourceClass(null), 'Decisión de diseño local')

  assert.equal(formatSourceStatus('documented'), 'Documentada')
  assert.equal(formatSourceStatus('reported'), 'Reportada')
  assert.equal(formatSourceStatus('unverified'), 'No verificada')
  assert.equal(formatSourceStatus('local-only'), 'Solo prototipo local')

  const sampleSource: MatriculaRegularSource = {
    id: 'F6',
    origin: 'evidence',
    class: 'normative',
    reference: 'Calendario publicado FISI 2026-II',
    date: '2026-07-21',
    status: 'documented',
  }
  const formatted = formatSourceItem(sampleSource)
  assert.equal(formatted.id, 'F6')
  assert.equal(formatted.originLabel, 'Evidencia')
  assert.equal(formatted.classLabel, 'Normativa oficial')
  assert.equal(formatted.reference, 'Calendario publicado FISI 2026-II')
  assert.equal(formatted.statusLabel, 'Documentada')
})

test('buildAcademicRequirementsViewModel builds correct view model for Sistemas and Software (SC002)', () => {
  const sisContext = createTestContext({
    scope: scopeSistemas,
    eligibility: {
      state: 'eligible',
      windowId: null,
      windowOrigin: null,
      causes: [],
      gaps: [],
    },
  })
  const sisVm = buildAcademicRequirementsViewModel(sisContext)
  assert.equal(sisVm.schoolId, 'SISTEMAS')
  assert.equal(sisVm.planId, 'SYN-SIS-PLAN')
  assert.equal(sisVm.period, '2026-II')
  assert.equal(sisVm.statusBadge.variant, 'eligible')
  assert.equal(sisVm.hasUnmetConditions, false)
  assert.equal(sisVm.hasPendingGaps, false)
  assert.equal(sisVm.sources.length, 2)

  const softContext = createTestContext({
    scope: scopeSoftware,
    eligibility: {
      state: 'configuration-pending',
      windowId: null,
      windowOrigin: null,
      causes: [
        {
          code: 'CREDIT_LOAD_INVALID',
          courseIds: [],
          sectionIds: [],
          sourceIds: ['F1'],
        },
      ],
      gaps: [
        {
          code: 'EXCEPTION_UNKNOWN',
          courseIds: [],
          sourceIds: ['L-01'],
        },
      ],
    },
  })
  const softVm = buildAcademicRequirementsViewModel(softContext)
  assert.equal(softVm.schoolId, 'SOFTWARE')
  assert.equal(softVm.planId, 'SYN-SOFT-PLAN')
  assert.equal(softVm.period, '2026-II')
  assert.equal(softVm.statusBadge.variant, 'pending')
  assert.equal(softVm.hasUnmetConditions, true)
  assert.equal(softVm.hasPendingGaps, true)
  assert.equal(softVm.causes.length, 1)
  assert.equal(softVm.causes[0]?.code, 'CREDIT_LOAD_INVALID')
  assert.equal(softVm.gaps.length, 1)
  assert.equal(softVm.gaps[0]?.code, 'EXCEPTION_UNKNOWN')
})

test('buildAcademicRequirementsViewModel respects Outcome when supplied by root (T031)', () => {
  const baseContext = createTestContext({
    scope: scopeSistemas,
    eligibility: {
      state: 'eligible',
      windowId: null,
      windowOrigin: null,
      causes: [],
      gaps: [],
    },
  })

  // Simulated rejected outcome
  const rejectedOutcome: MatriculaRegularOutcome = {
    requestId: '00000000-0000-4000-8000-000000000001',
    actorId: 'SYN-SIS-A',
    profileRevision: 'MR-SYN-SIS-1',
    state: 'rejected',
    evaluatedAt: '2026-08-11T15:05:00.000Z',
    windowOrigin: 'synthetic',
    selection: [
      { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
    ],
    causes: [
      {
        code: 'SCHEDULE_CONFLICT',
        courseIds: ['SYN-SIS-C1'],
        sectionIds: ['SYN-SIS-S1'],
        sourceIds: ['L-01'],
      },
      {
        code: 'SECTION_FULL',
        courseIds: ['SYN-SIS-C1'],
        sectionIds: ['SYN-SIS-S1'],
        sourceIds: ['L-01'],
      },
    ],
    gaps: [],
    enrollmentId: null,
    reportPath: null,
  }

  const vm = buildAcademicRequirementsViewModel(baseContext, rejectedOutcome)
  assert.equal(vm.isFromOutcome, true)
  assert.equal(vm.statusBadge.variant, 'ineligible')
  assert.equal(vm.statusBadge.label, 'Solicitud rechazada')
  assert.equal(vm.hasUnmetConditions, true)
  assert.equal(vm.causes.length, 2)
  assert.equal(vm.causes[0]?.code, 'SCHEDULE_CONFLICT')
  assert.equal(vm.causes[1]?.code, 'SECTION_FULL')
  assert.equal(vm.hasPendingGaps, false)
})
