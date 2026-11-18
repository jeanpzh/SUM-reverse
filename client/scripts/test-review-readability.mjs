import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// SSR semantic/DOM verification only. No browser, listening server, backend, or operator data.
const vite = await createServer({
  configFile: false,
  envDir: false,
  root: new URL('..', import.meta.url).pathname,
  ssr: { external: true },
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  appType: 'custom',
})
after(() => vite.close())

const { PlanningSessionProvider } = await vite.ssrLoadModule('/src/components/PlanningSessionProvider.tsx')
const { AcademicTeacherReview } = await vite.ssrLoadModule('/src/screens/AcademicTeacherReview.tsx')

const renderReview = (props) => renderToStaticMarkup(
  React.createElement(
    PlanningSessionProvider,
    null,
    React.createElement(AcademicTeacherReview, props),
  ),
)

const longTeacherChanges = 'MARÍA DEL CARMEN DE LA CRUZ VILLANUEVA-SANTISTEBAN'
const longTeacherPending = 'AUGUSTO PARCEMON CORTEZ VÁSQUEZ DE LOS RÍOS'
const longCourse = 'PROGRAMACIÓN Y FUNDAMENTOS DE ALGORÍTMICA AVANZADA PARA SISTEMAS'
const longRoom = 'Laboratorio de Cómputo Especializado 204 - Pabellón Nuevo'
const longObservation = 'El horario del miércoles entre las 14:00 y 18:00 coincide con asesoría académica de tesis; solicito trasladar las prácticas al jueves por la mañana.'

const syntheticProposal = {
  proposalId: 'syn-prop-review-1',
  createdAt: '2026-11-17T10:00:00Z',
  expiresAt: '2026-11-17T10:30:00Z',
  status: 'complete',
  coverageComplete: true,
  sections: [
    {
      sectionId: 'SYN-201-S1',
      courseId: 'SYN-201',
      courseName: longCourse,
      sectionCode: '1',
      capacity: 40,
      teacherAssignmentMode: 'single-teacher-section',
    },
  ],
  assignments: [
    {
      sessionId: 'SYN-201-S1-T',
      sectionId: 'SYN-201-S1',
      courseId: 'SYN-201',
      courseName: longCourse,
      teacherId: 'SYN-T-1',
      teacherName: longTeacherChanges,
      roomId: 'SYN-R-204',
      roomName: longRoom,
      day: 3,
      startMinute: 630,
      endMinute: 720,
      sessionType: 'T',
    },
  ],
  pending: [],
  diagnostics: [],
  counts: { sections: 1, requiredSessions: 1, scheduledSessions: 1 },
  stats: { exploredCandidates: 10, candidateVisits: 10, backtracks: 0, limitReason: null },
}

const syntheticReview = {
  round: 2,
  submittedVersion: 4,
  submittedAt: '2026-11-17T10:05:00Z',
  teachers: [
    {
      teacherId: 'SYN-T-2',
      teacherName: longTeacherPending,
      fingerprint: 'b'.repeat(64),
      status: 'pending',
      observation: '',
      decisionVersion: null,
      decidedAt: null,
    },
    {
      teacherId: 'SYN-T-1',
      teacherName: longTeacherChanges,
      fingerprint: 'a'.repeat(64),
      status: 'changes-requested',
      observation: longObservation,
      decisionVersion: 4,
      decidedAt: '2026-11-17T10:10:00Z',
    },
  ],
  history: [
    {
      type: 'submitted',
      version: 4,
      round: 2,
      at: '2026-11-17T10:05:00Z',
      teacherId: null,
      decision: null,
      observation: '',
      fingerprint: null,
    },
    {
      type: 'decision',
      version: 4,
      round: 2,
      at: '2026-11-17T10:10:00Z',
      teacherId: 'SYN-T-1',
      decision: 'changes-requested',
      observation: longObservation,
      fingerprint: 'a'.repeat(64),
    },
  ],
}

test('scrollable master and detail tables expose accessible region names and keyboard tabIndex', () => {
  const html = renderReview({
    review: syntheticReview,
    proposal: syntheticProposal,
    draftId: '11111111-1111-4111-8111-111111111111',
    draftVersion: 4,
    derivedState: 'En revisión docente',
    dirty: false,
    busy: false,
    error: null,
    onSubmit() {},
    onRespond() {},
  })

  assert.match(html, /<div class="academic-teacher-review__table-wrap" role="region" aria-label="Lista de docentes en revisión" tabindex="0"/)
  assert.match(html, /<table aria-label="Docentes en revisión">/)
  assert.match(html, new RegExp(`<div class="academic-teacher-review__blocks" role="region" aria-label="Horario asignado de ${longTeacherChanges}" tabindex="0"`))
  assert.match(html, new RegExp(`<table aria-label="Bloques de ${longTeacherChanges}">`))
})

test('long teacher names, course titles, rooms, and observations render in full while preserving attention order and actions', () => {
  const html = renderReview({
    review: syntheticReview,
    proposal: syntheticProposal,
    draftId: '11111111-1111-4111-8111-111111111111',
    draftVersion: 4,
    derivedState: 'En revisión docente',
    dirty: false,
    busy: false,
    error: null,
    onSubmit() {},
    onRespond() {},
  })

  for (const text of [
    longTeacherChanges,
    longTeacherPending,
    longCourse,
    longRoom,
    longObservation,
    'Observó cambios',
    'Pendiente',
    `Registrar respuesta de ${longTeacherPending}`,
    'Cerrar detalle',
  ]) {
    assert.ok(html.includes(text), `Expected full text in SSR markup: ${text}`)
  }

  // Attention ordering places changes-requested before pending, so longTeacherChanges appears first and opens in detail pane.
  const changesPos = html.indexOf(`data-teacher-id="SYN-T-1"`)
  const pendingPos = html.indexOf(`data-teacher-id="SYN-T-2"`)
  assert.ok(changesPos > -1 && pendingPos > -1 && changesPos < pendingPos, 'Attention order must prioritize changes-requested before pending')
  assert.ok(html.includes(`id="academic-review-pane-title">${longTeacherChanges}</h2>`))
  assert.ok(html.includes('aria-label="Rol simulado de revisión"'))
})

test('teacher without assigned blocks shows fallback message without an empty blocks scroll region', () => {
  const html = renderReview({
    review: {
      ...syntheticReview,
      teachers: [syntheticReview.teachers[0]],
    },
    proposal: syntheticProposal,
    draftId: '11111111-1111-4111-8111-111111111111',
    draftVersion: 4,
    derivedState: 'En revisión docente',
    dirty: false,
    busy: false,
    error: null,
    onSubmit() {},
    onRespond() {},
  })

  assert.ok(html.includes('No hay bloques asignados a este docente.'))
  assert.doesNotMatch(html, /class="academic-teacher-review__blocks"/)
})
