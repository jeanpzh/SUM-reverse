import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { ACADEMIC_REVISION } from '../../../shared/programacion-academica-api.mjs'
import type {
  AcademicCatalog,
  AcademicDemandEstimate,
  AcademicProposal,
  PlanningPeriod,
} from './academicScheduling.ts'
import { calculateCourseComponentHours, classifyCourseSessionType } from './planningCourseHours.ts'

interface AcademicPreparationCoursesTestProps {
  catalog: AcademicCatalog | null
  loadingCatalog: boolean
  catalogError: string | null
  onRetryCatalog: () => void
  planningPeriod: PlanningPeriod
  onApplyPeriodDefaults: (period: PlanningPeriod, force?: boolean) => void
  cycleFilter: string
  onCycleFilterChange: (cycle: string) => void
  selectedCourses: string[]
  onToggleCourse: (courseId: string, checked: boolean) => void
  onSelectCourses: (courseIds: string[]) => void
  demands: Record<string, string>
  capacities: Record<string, string>
  patterns: Record<string, string>
  deliveryModes: Record<string, 'continuous' | 'split'>
  onUpdateDemand: (courseId: string, value: string) => void
  onUpdateCapacity: (courseId: string, value: string) => void
  onUpdatePattern: (courseId: string, patternId: string) => void
  onUpdateDeliveryMode: (courseId: string, mode: 'continuous' | 'split') => void
  onApplyBulkChanges: (newDemands: Record<string, string>, newCapacities: Record<string, string>) => void
  proposal: AcademicProposal | null
  demandSourceId: 'existing-regular-v1' | 'independent-120-v1'
  onChangeDemandSource: (id: 'existing-regular-v1' | 'independent-120-v1') => void
  demandEstimate: AcademicDemandEstimate | null
  demandLoading: boolean
  demandError: string | null
  onEstimateDemand: () => void
  onUseBaseDemand: (courseId: string, value: number) => void
}

const vite = await createServer({
  configFile: false,
  envDir: false,
  root: new URL('../..', import.meta.url).pathname,
  ssr: { external: true },
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  appType: 'custom',
})
after(() => vite.close())

const { AcademicPreparationCourses } = (await vite.ssrLoadModule(
  '/src/screens/AcademicPreparationCourses.tsx',
)) as { AcademicPreparationCourses: React.ComponentType<AcademicPreparationCoursesTestProps> }

function extractCourseHoursCell(html: string, courseId: string): string {
  const rowMatch = html.match(
    new RegExp(`<tr[^>]*data-course-id="${courseId}"[^>]*>([\\s\\S]*?)<\\/tr>`),
  )
  assert.ok(rowMatch, `Expected rendered row for ${courseId}`)
  const cells = Array.from(rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g), (match) =>
    match[1].replace(/<[^>]+>/g, '').trim(),
  )
  assert.equal(cells.length, 8, `Expected 8 columns in row for ${courseId}`)
  return cells[6]
}

function renderCoursesScreen(
  courses: AcademicCatalog['courses'],
  patterns: Record<string, string> = {},
): string {
  const catalog: AcademicCatalog = {
    revision: ACADEMIC_REVISION,
    courses,
    teachers: [],
    rooms: [],
    windows: [{ day: 1, startMinute: 480, endMinute: 780 }],
    startStepMinutes: 30,
    maxExplorations: 100,
  }
  const noop = () => {}
  return renderToStaticMarkup(
    React.createElement(AcademicPreparationCourses, {
      catalog,
      loadingCatalog: false,
      catalogError: null,
      onRetryCatalog: noop,
      planningPeriod: '2027-I',
      onApplyPeriodDefaults: noop,
      cycleFilter: 'all',
      onCycleFilterChange: noop,
      selectedCourses: courses.map((course) => course.courseId),
      onToggleCourse: noop,
      onSelectCourses: noop,
      demands: Object.fromEntries(courses.map((course) => [course.courseId, String(course.estimatedDemand)])),
      capacities: Object.fromEntries(courses.map((course) => [course.courseId, String(course.targetCapacity)])),
      patterns,
      deliveryModes: {},
      onUpdateDemand: noop,
      onUpdateCapacity: noop,
      onUpdatePattern: noop,
      onUpdateDeliveryMode: noop,
      onApplyBulkChanges: noop,
      proposal: null,
      demandSourceId: 'existing-regular-v1',
      onChangeDemandSource: noop,
      demandEstimate: null,
      demandLoading: false,
      demandError: null,
      onEstimateDemand: noop,
      onUseBaseDemand: noop,
    }),
  )
}

test('AcademicPreparationCourses renders real T, P and L hours, absent components as 0, and fractional sums', () => {
  const courses: AcademicCatalog['courses'] = [
    {
      courseId: 'SYN-TPL',
      name: 'Curso completo T/P/L',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [
        { id: 's1', type: 'T', durationMinutes: 120 },
        { id: 's2', type: 'P', durationMinutes: 90 },
        { id: 's3', type: 'L', durationMinutes: 45 },
      ],
    },
    {
      courseId: 'SYN-TL',
      name: 'Curso sin práctica',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [
        { id: 's1', type: 'T', durationMinutes: 120 },
        { id: 's2', type: 'L', durationMinutes: 120 },
      ],
    },
    {
      courseId: 'SYN-FRAC-SUM',
      name: 'Curso solo teoría fraccionada',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [
        { id: 's1', type: 'T', durationMinutes: 20 },
        { id: 's2', type: 'T', durationMinutes: 40 },
      ],
    },
  ]

  const html = renderCoursesScreen(courses)
  assert.equal(extractCourseHoursCell(html, 'SYN-TPL'), '2 · 1.5 · 0.75')
  assert.equal(extractCourseHoursCell(html, 'SYN-TL'), '2 · 0 · 2')
  assert.equal(extractCourseHoursCell(html, 'SYN-FRAC-SUM'), '1 · 0 · 0')
})

test('AcademicPreparationCourses updates component hours when an alternative pattern is selected', () => {
  const course: AcademicCatalog['courses'][number] = {
    courseId: 'SYN-PAT',
    name: 'Curso con patrones',
    estimatedDemand: 40,
    targetCapacity: 40,
    weeklySessions: [{ id: 'p1-t', type: 'T', durationMinutes: 120 }],
    planningPatterns: [
      {
        id: 'pat-a',
        label: 'Patrón A',
        weeklySessions: [{ id: 'p1-t', type: 'T', durationMinutes: 120 }],
      },
      {
        id: 'pat-b',
        label: 'Patrón B',
        weeklySessions: [
          { id: 'p2-t', type: 'T', durationMinutes: 60 },
          { id: 'p2-p', type: 'P', durationMinutes: 90 },
          { id: 'p2-l', type: 'L', durationMinutes: 120 },
        ],
      },
    ],
  }

  const htmlPatternA = renderCoursesScreen([course], { 'SYN-PAT': 'pat-a' })
  assert.equal(extractCourseHoursCell(htmlPatternA, 'SYN-PAT'), '2 · 0 · 0')

  const htmlPatternB = renderCoursesScreen([course], { 'SYN-PAT': 'pat-b' })
  assert.equal(extractCourseHoursCell(htmlPatternB, 'SYN-PAT'), '1 · 1.5 · 2')
})

test('AcademicPreparationCourses renders unknown markers for incomplete, unknown, ambiguous or unresolved sessions', () => {
  const courses: AcademicCatalog['courses'] = [
    {
      courseId: 'SYN-UNK',
      name: 'Curso con tipo desconocido',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [
        { id: 's1', type: 'T', durationMinutes: 120 },
        { id: 's2', type: 'Seminario', durationMinutes: 60 },
      ],
    },
    {
      courseId: 'SYN-PROJ',
      name: 'Curso con prefijo pr no práctica',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [{ id: 's1', type: 'Proyecto', durationMinutes: 120 }],
    },
    {
      courseId: 'SYN-MIXED',
      name: 'Curso con tipo compuesto',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [{ id: 's1', type: 'Teórico-Práctico', durationMinutes: 120 }],
    },
    {
      courseId: 'SYN-MISSING-TYPE',
      name: 'Curso legacy sin tipo',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [{ id: 's1', durationMinutes: 90 }],
    },
    {
      courseId: 'SYN-BLANK-TYPE',
      name: 'Curso con tipo en blanco',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [{ id: 's1', type: '   ', durationMinutes: 90 }],
    },
    {
      courseId: 'SYN-UNRESOLVED-PAT',
      name: 'Curso con patrón inexistente',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [{ id: 's1', type: 'T', durationMinutes: 120 }],
      planningPatterns: [
        {
          id: 'pat-known',
          label: 'Conocido',
          weeklySessions: [{ id: 's1', type: 'T', durationMinutes: 120 }],
        },
      ],
    },
  ]

  const html = renderCoursesScreen(courses, { 'SYN-UNRESOLVED-PAT': 'pat-missing' })
  assert.equal(extractCourseHoursCell(html, 'SYN-UNK'), '— · — · —')
  assert.equal(extractCourseHoursCell(html, 'SYN-PROJ'), '— · — · —')
  assert.equal(extractCourseHoursCell(html, 'SYN-MIXED'), '— · — · —')
  assert.equal(extractCourseHoursCell(html, 'SYN-MISSING-TYPE'), '— · — · —')
  assert.equal(extractCourseHoursCell(html, 'SYN-BLANK-TYPE'), '— · — · —')
  assert.equal(extractCourseHoursCell(html, 'SYN-UNRESOLVED-PAT'), '— · — · —')
})

test('AcademicPreparationCourses supports legacy session labels normalized by the client contract', () => {
  const courses: AcademicCatalog['courses'] = [
    {
      courseId: 'SYN-LEGACY-1',
      name: 'Curso legacy español con tildes',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [
        { id: 's1', type: 'Teoría', durationMinutes: 120 },
        { id: 's2', type: 'Práctica', durationMinutes: 60 },
        { id: 's3', type: 'Laboratorio', durationMinutes: 90 },
      ],
    },
    {
      courseId: 'SYN-LEGACY-2',
      name: 'Curso legacy abreviado',
      estimatedDemand: 40,
      targetCapacity: 40,
      weeklySessions: [
        { id: 's1', type: 'teoria', durationMinutes: 60 },
        { id: 's2', type: 'Lab.', durationMinutes: 60 },
      ],
    },
  ]

  const html = renderCoursesScreen(courses)
  assert.equal(extractCourseHoursCell(html, 'SYN-LEGACY-1'), '2 · 1 · 1.5')
  assert.equal(extractCourseHoursCell(html, 'SYN-LEGACY-2'), '1 · 0 · 1')
})

test('calculateCourseComponentHours handles invalid durations, empty sessions and empty pattern fallback', () => {
  assert.equal(classifyCourseSessionType(' t '), 'T')
  assert.equal(classifyCourseSessionType('Pr.'), 'P')
  assert.equal(classifyCourseSessionType('LAB'), 'L')
  assert.equal(classifyCourseSessionType('Proyecto'), null)
  assert.equal(classifyCourseSessionType(undefined), null)

  const baseCourse: AcademicCatalog['courses'][number] = {
    courseId: 'SYN-EDGE',
    name: 'Curso borde',
    estimatedDemand: 40,
    targetCapacity: 40,
    weeklySessions: [{ id: 's1', type: 'T', durationMinutes: 90 }],
    planningPatterns: [
      { id: 'alt', label: 'Alternativo', weeklySessions: [{ id: 's2', type: 'L', durationMinutes: 45 }] },
    ],
  }

  assert.deepEqual(calculateCourseComponentHours(baseCourse, ''), [1.5, 0, 0])
  assert.deepEqual(calculateCourseComponentHours(baseCourse, 'alt'), [0, 0, 0.75])
  assert.deepEqual(calculateCourseComponentHours({ ...baseCourse, weeklySessions: [] }), ['—', '—', '—'])
  assert.deepEqual(
    calculateCourseComponentHours({ ...baseCourse, weeklySessions: [{ id: 's1', type: 'T', durationMinutes: 0 }] }),
    ['—', '—', '—'],
  )
  assert.deepEqual(
    calculateCourseComponentHours({ ...baseCourse, weeklySessions: [{ id: 's1', type: 'T', durationMinutes: -30 }] }),
    ['—', '—', '—'],
  )
  assert.deepEqual(
    calculateCourseComponentHours({ ...baseCourse, weeklySessions: [{ id: 's1', type: 'T', durationMinutes: Number.NaN }] }),
    ['—', '—', '—'],
  )
})

