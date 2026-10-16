import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  MatriculaRegularCourseDocument,
  MatriculaRegularOfferedCourse,
  MatriculaRegularChoice,
} from '../../../shared/matricula-regular.mjs'
import {
  computeSelectableCourses,
  calculateSelectionTotalCredits,
  validateSelectionRules,
} from './selectionPanel.ts'

const samplePreEnrollmentSis: MatriculaRegularCourseDocument[] = [
  { courseId: 'SYN-SIS-C1', planId: 'SYN-SIS-PLAN', name: 'Algorítmica I', credits: 4 },
  { courseId: 'SYN-SIS-C2', planId: 'SYN-SIS-PLAN', name: 'Cálculo I', credits: 5 },
  { courseId: 'SYN-SIS-C3', planId: 'SYN-SIS-PLAN', name: 'Física I', credits: 4 },
]

const sampleOfferSis: MatriculaRegularOfferedCourse[] = [
  {
    courseId: 'SYN-SIS-C1',
    planId: 'SYN-SIS-PLAN',
    name: 'Algorítmica I',
    credits: 4,
    prerequisiteIds: [],
    sections: [
      {
        sectionId: 'SYN-SIS-S1',
        capacity: 30,
        occupied: 10,
        schedule: [{ day: 1, startMinute: 480, endMinute: 600 }],
      },
    ],
  },
  {
    courseId: 'SYN-SIS-C2',
    planId: 'SYN-SIS-PLAN',
    name: 'Cálculo I',
    credits: 5,
    prerequisiteIds: [],
    sections: [
      {
        sectionId: 'SYN-SIS-S2',
        capacity: 25,
        occupied: 25, // Full section
        schedule: [{ day: 2, startMinute: 480, endMinute: 600 }],
      },
    ],
  },
  {
    courseId: 'SYN-SIS-C4', // Offered in same plan, but NOT in pre-enrollment!
    planId: 'SYN-SIS-PLAN',
    name: 'Química General',
    credits: 3,
    prerequisiteIds: [],
    sections: [
      {
        sectionId: 'SYN-SIS-S4',
        capacity: 20,
        occupied: 0,
        schedule: null, // Schedule unknown
      },
    ],
  },
  {
    courseId: 'SYN-SOFT-C1', // Offered in DIFFERENT plan!
    planId: 'SYN-SOFT-PLAN',
    name: 'Construcción de Software',
    credits: 4,
    prerequisiteIds: [],
    sections: [
      {
        sectionId: 'SYN-SOFT-S1',
        capacity: 20,
        occupied: 0,
        schedule: [{ day: 3, startMinute: 480, endMinute: 600 }],
      },
    ],
  },
]

test('computeSelectableCourses strictly computes preEnrollment ∩ offer of same plan (L-05, MAT02-V03, MAT02-V04, MAT02-V05, MAT02-V08)', () => {
  // If preEnrollmentComplete is false, returns empty array and gap status (never guesses or offers partial)
  const incompleteResult = computeSelectableCourses({
    preEnrollmentComplete: false,
    offerKnown: true,
    planId: 'SYN-SIS-PLAN',
    preEnrollment: samplePreEnrollmentSis,
    offer: sampleOfferSis,
  })
  assert.equal(incompleteResult.isComplete, false)
  assert.equal(incompleteResult.courses.length, 0)
  assert.equal(incompleteResult.gapCode, 'PLAN_OR_OFFER_UNKNOWN')

  // If offerKnown is false, returns empty array and gap status
  const unknownOfferResult = computeSelectableCourses({
    preEnrollmentComplete: true,
    offerKnown: false,
    planId: 'SYN-SIS-PLAN',
    preEnrollment: samplePreEnrollmentSis,
    offer: sampleOfferSis,
  })
  assert.equal(unknownOfferResult.isComplete, false)
  assert.equal(unknownOfferResult.courses.length, 0)
  assert.equal(unknownOfferResult.gapCode, 'PLAN_OR_OFFER_UNKNOWN')

  // When both complete and known:
  // C1: in preEnrollment and in offer (same plan) -> SELECTABLE
  // C2: in preEnrollment and in offer (same plan) -> SELECTABLE (even if section is full; no disabled by full/cruce at click time)
  // C3: in preEnrollment, but NOT in offer -> NOT selectable (MAT02-V03)
  // C4: in offer (same plan), but NOT in preEnrollment -> NOT selectable (MAT02-V04, L-05)
  // SOFT-C1: in offer, but DIFFERENT plan -> NOT selectable (MAT02-V05)
  const completeResult = computeSelectableCourses({
    preEnrollmentComplete: true,
    offerKnown: true,
    planId: 'SYN-SIS-PLAN',
    preEnrollment: samplePreEnrollmentSis,
    offer: sampleOfferSis,
  })
  assert.equal(completeResult.isComplete, true)
  assert.equal(completeResult.gapCode, null)
  assert.equal(completeResult.courses.length, 2)
  assert.deepEqual(completeResult.courses.map(c => c.courseId), ['SYN-SIS-C1', 'SYN-SIS-C2'])
})

test('calculateSelectionTotalCredits counts credits once per unique course (AC08, AC10)', () => {
  const choices: MatriculaRegularChoice[] = [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
    { courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' },
  ]
  const total = calculateSelectionTotalCredits(choices, sampleOfferSis)
  assert.equal(total, 9) // 4 + 5 = 9
})

test('validateSelectionRules enforces unique courseIds and single section per course without disabling by conflicts/prerequisites (AC08, L-05)', () => {
  // Valid single section per course
  const validChoices: MatriculaRegularChoice[] = [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
  ]
  const validCheck = validateSelectionRules(validChoices)
  assert.equal(validCheck.isValid, true)
  assert.equal(validCheck.errorMessage, null)

  // Invalid: duplicate courseId
  const duplicateChoices: MatriculaRegularChoice[] = [
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
    { courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' },
  ]
  const duplicateCheck = validateSelectionRules(duplicateChoices)
  assert.equal(duplicateCheck.isValid, false)
  assert.match(duplicateCheck.errorMessage ?? '', /duplicad/i)
})
