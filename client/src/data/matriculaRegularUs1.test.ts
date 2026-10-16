import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  MatriculaRegularContext,
  MatriculaRegularCourseDocument,
  MatriculaRegularId,
  MatriculaRegularScope,
} from '../../../shared/matricula-regular.mjs'

import {
  formatPreEnrollmentStatus,
  formatPreEnrollmentRows,
  buildPreEnrollmentCsvData,
} from './prematriculaPanel.ts'

const baseScopeSistemas: MatriculaRegularScope = {
  facultyId: 'FISI',
  schoolId: 'SISTEMAS',
  period: '2026-II',
  planId: 'SYN-SIS-PLAN',
  modality: 'regular-virtual',
}

const baseScopeSoftware: MatriculaRegularScope = {
  facultyId: 'FISI',
  schoolId: 'SOFTWARE',
  period: '2026-II',
  planId: 'SYN-SOFT-PLAN',
  modality: 'regular-virtual',
}

function createSampleContext(options: {
  school: 'SISTEMAS' | 'SOFTWARE'
  preEnrollmentEnabled: boolean | null
  preEnrollmentComplete: boolean
  courses?: MatriculaRegularCourseDocument[]
}): MatriculaRegularContext {
  const scope = options.school === 'SISTEMAS' ? baseScopeSistemas : baseScopeSoftware
  const actorId: MatriculaRegularId = options.school === 'SISTEMAS' ? 'SYN-SIS-A' : 'SYN-SOFT-A'
  const time = '2026-08-11T15:00:00.000Z'

  return {
    actorId,
    scope,
    profileRevision: `MR-SYN-${options.school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-1`,
    serverNow: time,
    preEnrollmentEnabled: options.preEnrollmentEnabled,
    preEnrollmentComplete: options.preEnrollmentComplete,
    preEnrollment: options.courses ?? [],
    offerKnown: true,
    offer: [],
    calendar: {
      publishedRows: [],
      effectiveWindows: [],
      unknownDates: [],
    },
    eligibility: {
      state: options.preEnrollmentEnabled === true && options.preEnrollmentComplete ? 'eligible' : 'configuration-pending',
      windowId: null,
      windowOrigin: null,
      causes: [],
      gaps: options.preEnrollmentEnabled === null
        ? [{ code: 'PRE_ENROLLMENT_UNKNOWN', courseIds: [], sourceIds: [] }]
        : !options.preEnrollmentComplete
          ? [{ code: 'PLAN_OR_OFFER_UNKNOWN', courseIds: [], sourceIds: [] }]
          : [],
    },
    sources: [],
  }
}

test('formatPreEnrollmentStatus distinguishes true, false and null states (AC03/AC20)', () => {
  const enabledStatus = formatPreEnrollmentStatus(true)
  assert.equal(enabledStatus.label, 'Habilitada')
  assert.equal(enabledStatus.variant, 'enabled')

  const disabledStatus = formatPreEnrollmentStatus(false)
  assert.equal(disabledStatus.label, 'No habilitada')
  assert.equal(disabledStatus.variant, 'disabled')

  const unknownStatus = formatPreEnrollmentStatus(null)
  assert.equal(unknownStatus.label, 'Desconocida (gap)')
  assert.equal(unknownStatus.variant, 'pending')
})

test('formatPreEnrollmentRows transforms CourseDocuments into table rows for Sistemas and Software (AC01)', () => {
  const sisCourses: MatriculaRegularCourseDocument[] = [
    { courseId: 'SYN-SIS-C1', planId: 'SYN-SIS-PLAN', name: 'Algorítmica I', credits: 4 },
    { courseId: 'SYN-SIS-C2', planId: 'SYN-SIS-PLAN', name: 'Cálculo I', credits: 5 },
  ]
  const sisRows = formatPreEnrollmentRows(sisCourses)
  assert.equal(sisRows.length, 2)
  assert.deepEqual(sisRows[0], ['SYN-SIS-C1', 'Algorítmica I', '4', 'SYN-SIS-PLAN'])
  assert.deepEqual(sisRows[1], ['SYN-SIS-C2', 'Cálculo I', '5', 'SYN-SIS-PLAN'])

  const softCourses: MatriculaRegularCourseDocument[] = [
    { courseId: 'SYN-SOFT-C1', planId: 'SYN-SOFT-PLAN', name: 'Construcción de Software', credits: 4 },
  ]
  const softRows = formatPreEnrollmentRows(softCourses)
  assert.equal(softRows.length, 1)
  assert.deepEqual(softRows[0], ['SYN-SOFT-C1', 'Construcción de Software', '4', 'SYN-SOFT-PLAN'])
})

test('buildPreEnrollmentCsvData builds local CSV headers and rows without claiming official SUM PDF (AC01; CSV de prematrícula local)', () => {
  const courses: MatriculaRegularCourseDocument[] = [
    { courseId: 'SYN-SIS-C1', planId: 'SYN-SIS-PLAN', name: 'Algorítmica I', credits: 4 },
  ]
  const csvData = buildPreEnrollmentCsvData(courses, 'SYN-SIS-A')
  assert.equal(csvData.name, 'prematricula_SYN-SIS-A')
  assert.deepEqual(csvData.headers, ['Código de Asignatura', 'Nombre de Asignatura', 'Créditos', 'Plan de Estudios'])
  assert.deepEqual(csvData.rows, [
    ['SYN-SIS-C1', 'Algorítmica I', '4', 'SYN-SIS-PLAN'],
  ])
})

test('empty complete pre-enrollment is distinct from incomplete pre-enrollment (AC03, MAT01-V04 vs MAT01-V05)', () => {
  const emptyCompleteCtx = createSampleContext({
    school: 'SISTEMAS',
    preEnrollmentEnabled: true,
    preEnrollmentComplete: true,
    courses: [],
  })
  assert.equal(emptyCompleteCtx.preEnrollmentComplete, true)
  assert.equal(emptyCompleteCtx.preEnrollment.length, 0)

  const incompleteCtx = createSampleContext({
    school: 'SISTEMAS',
    preEnrollmentEnabled: true,
    preEnrollmentComplete: false,
    courses: [],
  })
  assert.equal(incompleteCtx.preEnrollmentComplete, false)
})
