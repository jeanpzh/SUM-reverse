import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockResponses } from './mocks/responses.ts'

test('mock identity and dates follow the JSON contracts', () => {
  const alumno = mockResponses.formulario.data.alumno
  assert.equal(alumno.codAlumno, mockResponses.programacion.data.alumno.codAlumno)
  assert.equal(alumno.correoInstitucional, mockResponses.perfil.data.correoInstitucional)
  assert.equal(typeof alumno.infoSemestre.fecInicioEncuestaDocente, 'string')
  assert.ok(Number.isFinite(Date.parse(alumno.infoSemestre.fecInicioEncuestaDocente)))
  assert.equal(mockResponses.matriculaInfo.data.codSemestre, alumno.periodo)
})

test('enrolled courses share sections with programming, reports and attendance', () => {
  const matricula = mockResponses.matricula.data.matricula
  assert.equal(matricula.length, 3)
  for (const course of matricula) {
    for (const records of [mockResponses.programacion.data.programacion,
      mockResponses.prematricula.data, mockResponses.horarios.data,
      mockResponses.asistencias.data]) {
      assert.ok(records.some((row) => row.codAsignatura === course.codAsignatura &&
        row.codSeccion === course.codSeccion))
    }
    assert.ok(mockResponses.plan.data.some((row) => row.codAsignatura === course.codAsignatura))
  }
})

test('attendance percentages and course capacities are consistent', () => {
  for (const row of mockResponses.asistencias.data) {
    assert.equal(row.cantPresentes + row.cantTardanzas + row.cantFaltas, row.numClases)
    assert.equal(row.cantAsistencias, row.cantPresentes + row.cantTardanzas)
    assert.equal(row.porcentajeAsistencias, row.cantAsistencias / row.numClases * 100)
    assert.equal(row.porcentajePresentes, row.cantPresentes / row.numClases * 100)
    assert.equal(row.porcentajeTardanzas, row.cantTardanzas / row.numClases * 100)
    assert.equal(row.porcentajeFaltas, row.cantFaltas / row.numClases * 100)
  }
  for (const row of mockResponses.programacion.data.programacion) {
    assert.ok(row.matriculados <= row.topeAlumnos)
    for (const horario of row.horarios) assert.ok(horario.horaInicioMin < horario.horaFinMin)
  }
})

test('unknown contracts do not invent records', () => {
  assert.deepEqual(mockResponses.evaluaciones.data, [])
  assert.deepEqual(mockResponses.tutoria.data, [])
  assert.deepEqual(mockResponses.deudas, { message: null, codError: null, data: [] })
})

test('enrolled timetable contains no overlapping course intervals', () => {
  const rows = mockResponses.horarios.data
  for (let i = 0; i < rows.length; i++) {
    for (const other of rows.slice(i + 1)) {
      if (rows[i].numDia === other.numDia) {
        assert.ok(rows[i].horaFin <= other.horaInicio || other.horaFin <= rows[i].horaInicio)
      }
    }
  }
})
