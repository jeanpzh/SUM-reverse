import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toStudentSummary, toProfileRows, toPlanRows, toPrematriculaRows,
  toMatriculaRows, toAttendanceRows, toProgrammingRows, toScheduleEvents, toCourseScheduleRows } from './adapters.ts'
import { mockResponses } from './mocks/responses.ts'

test('shared identity follows the loaded student, not navigation constants', () => {
  const alumno = { ...mockResponses.formulario.data.alumno, nomAlumno: 'NUEVO', codAlumno: 'CHANGED', periodo: '2030-1' }
  const summary = toStudentSummary(alumno)
  assert.ok(summary.name.includes('NUEVO'))
  assert.equal(summary.code, 'CHANGED')
  assert.equal(summary.period, '2030-1')
  assert.ok(summary.plan.includes('2018'))
})

test('profile rows use loaded personal fields and can be exported unchanged', () => {
  const personal = toProfileRows({ ...mockResponses.perfil.data, numDocumento: 'CHANGED-DOC' }, mockResponses.formulario.data.alumno)
  assert.ok(personal.some(([label, value]) => label === 'Número de documento' && value === 'CHANGED-DOC'))
  assert.ok(personal.some(([label, value]) => label === 'Teléfono' && value === 'No registrado'))
  assert.ok(personal.every((row) => row.every((cell) => typeof cell === 'string')))
})

test('academic adapters place loaded values in table column order', () => {
  const plan = toPlanRows(mockResponses.plan.data)
  assert.deepEqual(plan[0], [0, 'DEMO-001 - Matemática I', 4, 'Obligatorio', 'GEG', 'Ninguno', '--'])
  const pre = toPrematriculaRows(mockResponses.prematricula.data)
  assert.deepEqual(pre[0], ['2018', 1, 'Matemática I', 4, 0, 0, 0, 'Regular'])
  const enrollment = toMatriculaRows(mockResponses.matricula.data.matricula)
  assert.deepEqual(enrollment[0], [1, 'Matemática I', 4, 1, 'DOCENTE DE DEMOSTRACIÓN'])
  const attendance = toAttendanceRows(mockResponses.asistencias.data)
  assert.deepEqual(attendance[0], ['Matemática I', 1, 16, 14, 87.5, 1, 6.25, 1, 6.25, 15, 93.75])
  const programming = toProgrammingRows(mockResponses.programacion.data.programacion)
  assert.deepEqual(programming[0], ['', 'DEMO-001 - Matemática I', 4, 1,
    'DOC-1 - DE DEMOSTRACIÓN, DOCENTE', 40, 20, '2 horarios'])
})

test('empty datasets stay empty instead of regenerating fictional rows', () => {
  for (const adapter of [toPlanRows, toPrematriculaRows, toMatriculaRows, toAttendanceRows, toProgrammingRows]) {
    assert.deepEqual(adapter([]), [])
  }
})

test('calendar adapts valid days/times and refuses invalid positions', () => {
  const events = toScheduleEvents(mockResponses.horarios.data)
  assert.equal(events.length, mockResponses.horarios.data.length)
  assert.equal(events[0].course, 'Matemática I')
  assert.equal(events[0].day, 1)
  const row = mockResponses.horarios.data[0]
  for (const invalid of [{ numDia: 0 }, { numDia: 8 }, { horaInicio: '99:00' },
    { horaFin: '07:00' }, { horaInicio: 'n/a' }, { horaFin: '08:30:99' }]) {
    assert.throws(() => toScheduleEvents([{ ...row, ...invalid }]), /horario/i)
  }
  const shortSlot = toScheduleEvents([{ ...row, horaInicio: '08:30:15', horaFin: '08:30:30' }])[0]
  assert.equal(shortSlot.start, 510.25)
  assert.equal(shortSlot.end, 510.5)
  assert.equal(shortSlot.time, '08:30:15–08:30:30')
})

test('course schedule modal preserves every slot with room and class type', () => {
  const course = mockResponses.programacion.data.programacion[0]
  assert.ok(course.horarios.length >= 2, 'Demo course needs multiple schedule slots')
  const rows = toCourseScheduleRows(course.horarios)
  assert.equal(rows.length, course.horarios.length)
  assert.deepEqual(rows[0], [1, 'LUNES', '08:00 - 10:00', 'A-1', 'Teoría'])
  assert.equal(rows[1][3], course.horarios[1].codAula)
  assert.deepEqual(toCourseScheduleRows([]), [])
})
