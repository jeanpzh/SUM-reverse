import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockResponses } from './mocks/responses.ts'
import { parseResponse } from './transport.ts'
import { matriculaWireKeys, validateMatriculaWire } from './matriculaWire.ts'

test('shared validator accepts the four candidate report envelopes and preserves object identity', () => {
  const fixtures = {
    programacion: structuredClone(mockResponses.programacion),
    prematricula: structuredClone(mockResponses.prematricula),
    matricula: structuredClone(mockResponses.matricula),
    horarios: structuredClone(mockResponses.horarios),
  }
  assert.deepEqual(matriculaWireKeys, ['matriculaInfo', 'programacion', 'prematricula', 'matricula', 'horarios'])
  for (const [key, envelope] of Object.entries(fixtures) as [keyof typeof fixtures, (typeof fixtures)[keyof typeof fixtures]][]) {
    validateMatriculaWire(key, envelope)
    assert.equal(parseResponse(key, envelope, true), envelope)
  }
})

test('programming accepts generalized strings, empty names, zero values, extras and opaque candidate-null fields', () => {
  const response = structuredClone(mockResponses.programacion)
  const row = response.data.programacion[0]
  row.ciclo = 99
  row.codSeccion = 0
  row.horario = 0
  row.nomDocente = ''
  row.codDocente = ''
  const extraRow = row as unknown as Record<string, unknown>
  extraRow.s = false
  extraRow.wireExtra = { untouched: ['value'] }
  const slot = row.horarios[0]
  const generalizedSlot = slot as unknown as Record<string, unknown>
  generalizedSlot.horaInicio = '08:30'
  generalizedSlot.horaFin = '08:30:15'
  generalizedSlot.dia = 'DOMINGO'
  generalizedSlot.codTipoHoraAsignatura = 'OTRO'
  generalizedSlot.desTipoHoraAsignatura = 'Seminario'
  generalizedSlot.codSemestre = { opaque: true }
  generalizedSlot.wireExtra = 'kept'
  const faculty = response.data.alumno.codFacultad
  slot.codFacultad = faculty + 100

  assert.equal(parseResponse('programacion', response, true), response)
  assert.deepEqual((response.data.programacion[0].horarios[0] as unknown as Record<string, unknown>).codSemestre,
    { opaque: true })
})

test('missing required report fields fail with a key and field path', () => {
  const programming = structuredClone(mockResponses.programacion)
  delete (programming.data.alumno.infoSemestre as { fecInicioEncuestaDocente?: string }).fecInicioEncuestaDocente
  assert.throws(() => parseResponse('programacion', programming, true),
    /programacion\.data\.alumno\.infoSemestre\.fecInicioEncuestaDocente/)

  const prematricula = structuredClone(mockResponses.prematricula)
  delete (prematricula.data[0] as { totales_creditos?: number }).totales_creditos
  assert.throws(() => parseResponse('prematricula', prematricula, true), /prematricula\.data\[0\]\.totales_creditos/)

  const matricula = structuredClone(mockResponses.matricula)
  delete (matricula.data as { datosMatricula?: unknown }).datosMatricula
  assert.throws(() => parseResponse('matricula', matricula, true), /matricula\.data\.datosMatricula/)

  const horarios = structuredClone(mockResponses.horarios)
  delete (horarios.data[0] as { color?: number }).color
  assert.throws(() => parseResponse('horarios', horarios, true), /horarios\.data\[0\]\.color/)
})
