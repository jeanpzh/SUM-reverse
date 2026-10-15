import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { matriculaWireKeys, type MatriculaWireKey } from '../../shared/matricula-wire.mjs'
import { createSyntheticClock } from '../src/matricula-regular/clock.js'
import { MATRICULA_REGULAR_CLOCK, MatriculaRegularModule } from '../src/matricula-regular/matricula-regular.module.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { MatriculaInformacionModule } from '../src/matricula-informacion/matricula-informacion.module.js'
import { ProgramacionModule } from '../src/programacion/programacion.module.js'
import { populatedFixtures } from '../src/reportes/reportes.fixtures.js'
import { ReportesModule } from '../src/reportes/reportes.module.js'
import { ReportesService } from '../src/reportes/reportes.service.js'

// T049: regression of the five legacy read-only matrícula reads. Synthetic fixtures only (the repository's own
// `populatedFixtures` / seeds), ephemeral supertest servers (never `listen`), no AppModule and no snapshot directory.

type ReadSpec = { key: MatriculaWireKey; path: string; accion: string }

// Literal routes/actions copied from MC-CONTRACT-1 (matricula-compatibility.md, "HTTP sin cambios"), not from the pipes.
const READS: readonly ReadSpec[] = [
  { key: 'matriculaInfo', path: '/alumnoWebSum/v2/matricula/informacion', accion: 'obtenerInformacion' },
  { key: 'programacion', path: '/alumnoWebSum/v2/matricula/programacion', accion: 'obtenerProgramacionAsignaturas' },
  { key: 'prematricula', path: '/alumnoWebSum/v2/reportes/prematricula', accion: 'obtenerAlumnoPrematricula' },
  { key: 'matricula', path: '/alumnoWebSum/v2/reportes/matricula', accion: 'obtenerAlumnoMatricula' },
  { key: 'horarios', path: '/alumnoWebSum/v2/reportes/horarios', accion: 'obtenerHorariosAsignatura' },
]
const FIXTURE_KEYS = ['REPORTES_FIXTURE', 'PROGRAMACION_FIXTURE', 'MATRICULA_INFORMACION_FIXTURE'] as const
const ERR = {
  action: { message: 'Acción de consulta inválida.', codError: 'INVALID_ACTION', data: null },
  query: { message: 'Parámetro de consulta no admitido.', codError: 'INVALID_QUERY', data: null },
  body: { message: 'La consulta no admite cuerpo de datos.', codError: 'INVALID_BODY', data: null },
}
const ENVELOPE_KEYS = ['codError', 'data', 'message']

function assertSyntheticEnvironment(): void {
  // Reports a count only: values (and names) of operator variables are never printed.
  const unsafe = Object.keys(process.env).filter((name) => name.endsWith('_SNAPSHOT_DIR') && process.env[name] !== undefined)
  if (unsafe.length > 0) {
    throw new Error(`Entorno no sintético: ${unsafe.length} variable(s) *_SNAPSHOT_DIR definidas; ejecución abortada`)
  }
}

type FixtureModes = Partial<Record<(typeof FIXTURE_KEYS)[number], string>>
const open: INestApplication[] = []

async function createApp(modes: FixtureModes = {}, withRegular = true): Promise<INestApplication> {
  assertSyntheticEnvironment()
  vi.stubEnv('MATRICULA_SNAPSHOT_DIR', undefined)
  for (const key of FIXTURE_KEYS) vi.stubEnv(key, modes[key])
  let builder = Test.createTestingModule({
    imports: [
      ReportesModule, ProgramacionModule, MatriculaInformacionModule,
      ...(withRegular ? [MatriculaRegularModule] : []),
    ],
  })
  if (withRegular) builder = builder.overrideProvider(MATRICULA_REGULAR_CLOCK).useValue(createSyntheticClock())
  const app = (await builder.compile()).createNestApplication()
  await app.init()
  open.push(app)
  // Explicit ephemeral loopback listener (port 0): supertest then reuses it instead of listening per request.
  const server = app.getHttpServer()
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  return app
}

const post = (app: INestApplication, spec: ReadSpec) =>
  request(app.getHttpServer()).post(`${spec.path}?accion=${spec.accion}`)

async function readAll(app: INestApplication): Promise<Record<MatriculaWireKey, any>> {
  const out = {} as Record<MatriculaWireKey, any>
  for (const spec of READS) out[spec.key] = (await post(app, spec).expect(200)).body
  return out
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(open.splice(0).map((app) => app.close()))
})

beforeAll(() => {
  assertSyntheticEnvironment()
})

const COURSES = [
  'Matemática I', 'Introducción a la Informática', 'Lenguaje y Comunicación', 'Metodología del Estudio',
  'Estadística', 'Programación I', 'Matemática II', 'Física General',
]
const DAYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']
const code = (index: number) => `DEMO-${String(index + 1).padStart(3, '0')}`

describe('REG-PROV: provenance and preserved contract', () => {
  it('REG-PROV-01 aborts before building any module when a *_SNAPSHOT_DIR variable exists', async () => {
    vi.stubEnv('MATRICULA_SNAPSHOT_DIR', '/nonexistent/synthetic-guard-probe')
    await expect(createApp()).rejects.toThrow('Entorno no sintético: 1 variable(s) *_SNAPSHOT_DIR')
    expect(open).toHaveLength(0)
  })

  it('REG-PROV-02 exposes exactly the five wire keys with the contract routes and literal actions', () => {
    expect(matriculaWireKeys).toEqual(['matriculaInfo', 'programacion', 'prematricula', 'matricula', 'horarios'])
    expect(READS.map((spec) => spec.key)).toEqual([...matriculaWireKeys])
    expect(READS).toHaveLength(5)
  })

  it('REG-PROV-03 serves only repository-owned synthetic data (DEMO-001, example.test, 2026-2)', async () => {
    const app = await createApp()
    const { programacion, matriculaInfo } = await readAll(app)
    const alumno = programacion.data.alumno
    expect(alumno.codAlumno).toBe('DEMO-001')
    expect(alumno.correoInstitucional).toMatch(/@example\.test$/)
    expect(alumno.periodo).toBe('2026-2')
    expect(alumno).toEqual(populatedFixtures.formulario.alumno)
    expect(matriculaInfo.data.codSemestre).toBe('2026-2')
  })
})

describe('REG-HTTP: populated read-only scenarios', () => {
  it.each(READS)('REG-HTTP-01 $key: 200 JSON with the exact success envelope', async (spec) => {
    const app = await createApp()
    const res = await post(app, spec).expect(200).expect('Content-Type', /application\/json/)
    expect(Object.keys(res.body).sort()).toEqual(ENVELOPE_KEYS)
    expect(res.body.message).toBeNull()
    expect(res.body.codError).toBeNull()
  })

  it('REG-HTTP-02 matriculaInfo: own article (not the raw academic shape) for 2026-2', async () => {
    const { matriculaInfo } = await readAll(await createApp())
    expect(Object.keys(matriculaInfo.data).sort()).toEqual(['articulo', 'codSemestre'])
    expect(matriculaInfo.data.codSemestre).toBe('2026-2')
    expect(matriculaInfo.data.articulo.introduccion).toBe('Módulo de Matrícula Vía Internet')
    expect(matriculaInfo.data.articulo.secciones).toEqual([
      { id: 'cronograma', titulo: 'Control de Cronograma de Matrícula', descripcion: 'Información sobre el cronograma académico relacionado con la matrícula del periodo 2026-2.' },
      { id: 'acceso-facultad', titulo: 'Control de Acceso de Facultad', descripcion: 'Información sobre el control de acceso de la facultad.' },
      { id: 'prematricula', titulo: 'Control de Pre-Matrícula', descripcion: 'Información sobre el proceso de pre-matrícula.' },
      { id: 'deudas', titulo: 'Control de Deudas Registradas', descripcion: 'Información sobre las deudas registradas.' },
      { id: 'interfaz', titulo: 'Interfaz de Matrícula', descripcion: 'Información sobre la interfaz del módulo de matrícula.' },
    ])
    expect(matriculaInfo.data).not.toHaveProperty('indMatHabilitada')
  })

  it('REG-HTTP-03 programacion: eight RI-PROG courses with two schedules each', async () => {
    const { programacion } = await readAll(await createApp())
    expect(Object.keys(programacion.data).sort()).toEqual(['alumno', 'programacion'])
    const rows = programacion.data.programacion
    expect(rows).toHaveLength(8)
    rows.forEach((row: any, index: number) => {
      expect(row).toMatchObject({
        codAsignatura: code(index), desAsignatura: COURSES[index], codDocente: `DOC-${index + 1}`,
        nomDocente: 'DOCENTE', apePatDocente: 'DE', apeMatDocente: 'DEMOSTRACIÓN', creditos: 4,
        ciclo: index < 4 ? 1 : 2, codSeccion: 1, horario: 1, topeAlumnos: 40, matriculados: 20,
      })
      const day = DAYS[index % 6]
      expect(row.horarios).toHaveLength(2)
      expect(row.horarios[0]).toMatchObject({
        codAsignatura: code(index), dia: day, horaInicio: '08:00', horaFin: '10:00', horaInicioMin: 480, horaFinMin: 600,
        codAula: `A-${index + 1}`, codTipoHoraAsignatura: 'T', desTipoHoraAsignatura: 'Teoría', horario: 1,
        topeAlumnosLab: 40, matriculadosLab: 20, codSemestre: null, codPlan: null, desAsignatura: null, nomDocente: null,
      })
      expect(row.horarios[1]).toMatchObject({
        dia: day, horaInicio: '10:00', horaFin: '11:00', horaInicioMin: 600, horaFinMin: 660, codAula: '--',
        codTipoHoraAsignatura: 'P', desTipoHoraAsignatura: 'Práctica', horario: 2,
      })
    })
  })

  it('REG-HTTP-04 prematricula: three DEMO courses, 4 credits each, exact nullable fields', async () => {
    const { prematricula } = await readAll(await createApp())
    expect(prematricula.data).toHaveLength(3)
    prematricula.data.forEach((row: any, index: number) => {
      expect(Object.keys(row).sort()).toEqual([
        'codArea', 'codAsignatura', 'codEscuela', 'codEspecialidad', 'codFacultad', 'codPlan', 'codSeccion',
        'desAsignatura', 'gs_cod_orient', 'gs_tip_asig', 'ind_etapa', 'lisSeccion', 'num_ciclo_ano_asig',
        'num_creditaje', 'num_mat_equiv', 'num_rep_plan_act', 'num_rep_total', 'totales_creditos',
      ])
      expect(row).toMatchObject({
        codAsignatura: code(index), desAsignatura: COURSES[index], num_creditaje: 4, totales_creditos: 12,
        num_ciclo_ano_asig: 1, codSeccion: 1, ind_etapa: 'Regular',
        codArea: null, gs_cod_orient: null, gs_tip_asig: null, lisSeccion: null,
      })
    })
  })

  it('REG-HTTP-05 matricula: three rows, 12 credits, fixed header data and null identity fields', async () => {
    const { matricula } = await readAll(await createApp())
    expect(Object.keys(matricula.data).sort()).toEqual(['codFacultad', 'datosMatricula', 'indMatHabilitadaLabPra', 'matricula'])
    expect(matricula.data.datosMatricula).toEqual({ fechaMatricula: '2026-08-10', codOrientacion: '0', tipoMatricula: 'Regular' })
    expect(matricula.data.indMatHabilitadaLabPra).toBe(false)
    expect(matricula.data.codFacultad).toBe(1)
    expect(matricula.data.matricula).toHaveLength(3)
    matricula.data.matricula.forEach((row: any, index: number) => {
      expect(row).toMatchObject({
        codAsignatura: code(index), desAsignatura: COURSES[index], creditoAsignatura: 4, creditosMatriculados: 12,
        codAula: `A-${index + 1}`, codSemestre: null, codAlumno: null, nomAlumno: null, apePatAlumno: null,
        apeMatAlumno: null, codTurno: null, tipoHorario: null, anioIngreso: null, correoIntitucional: null,
        etapa: null, usuarioMatricula: null, fechaMatricula: null,
      })
    })
  })

  it('REG-HTTP-06 horarios: six events, HH:mm intervals and numDia/dia aligned', async () => {
    const { horarios } = await readAll(await createApp())
    expect(horarios.data).toHaveLength(6)
    horarios.data.forEach((row: any, index: number) => {
      const course = Math.floor(index / 2)
      expect(row).toMatchObject({
        codAsignatura: code(course), numDia: course + 1, dia: DAYS[course], color: course + 1,
        codSemestre: null, desFacultad: null, desEscuela: null, codPlan: null, desPlan: null,
      })
      expect(row.horaInicio).toMatch(/^\d{2}:\d{2}$/)
      expect(row.horaInicio < row.horaFin).toBe(true)
    })
    expect(horarios.data.map((row: any) => [row.horaInicio, row.horaFin, row.codTipoHoraAsignatura])).toEqual(
      Array.from({ length: 3 }).flatMap(() => [['08:00', '10:00', 'T'], ['10:00', '11:00', 'P']]),
    )
  })
})

describe('REG-REPEAT: repetition, concurrency and clones', () => {
  it('REG-REPEAT-01 sequential, concurrent and cross-restart reads are semantically identical', async () => {
    const app = await createApp()
    const baseline = await readAll(app)
    expect(await readAll(app)).toEqual(baseline)
    const batch = await Promise.all(Array.from({ length: 3 }).flatMap(() => READS.map(async (spec) => [spec.key, (await post(app, spec).expect(200)).body] as const)))
    for (const [key, body] of batch) expect(body).toEqual(baseline[key])
    expect(await readAll(await createApp())).toEqual(baseline)
  })

  it('REG-REPEAT-02 service results are clones: mutation never reaches the catalog or later reads', async () => {
    const app = await createApp()
    const reference = structuredClone(populatedFixtures)
    const service = app.get(ReportesService)
    const first = service.consultar('prematricula') as { data: Array<Record<string, unknown>> }
    first.data[0]!.codAsignatura = 'MUTATED'
    first.data.length = 0
    const matricula = service.consultar('matricula') as { data: { matricula: unknown[] } }
    matricula.data.matricula.length = 0
    expect((service.consultar('prematricula') as { data: unknown[] }).data).toHaveLength(3)
    expect((await post(app, READS[2]!)).body.data[0].codAsignatura).toBe('DEMO-001')
    expect((await post(app, READS[3]!)).body.data.matricula).toHaveLength(3)
    expect(populatedFixtures).toEqual(reference)
  })
})

describe('REG-EMPTY / REG-MODE: fixture modes', () => {
  const allEmpty = { REPORTES_FIXTURE: 'empty', PROGRAMACION_FIXTURE: 'empty', MATRICULA_INFORMACION_FIXTURE: 'empty' }

  it('REG-EMPTY-01 empty mode: HTTP 200 envelopes keep context, lists are empty', async () => {
    const { matriculaInfo, programacion, prematricula, matricula, horarios } = await readAll(await createApp(allEmpty))
    expect(matriculaInfo).toEqual({ message: null, codError: null, data: { codSemestre: '2026-2', articulo: null } })
    expect(programacion.data.programacion).toEqual([])
    expect(programacion.data.alumno).toEqual(populatedFixtures.formulario.alumno)
    expect(prematricula).toEqual({ message: null, codError: null, data: [] })
    expect(horarios).toEqual({ message: null, codError: null, data: [] })
    expect(matricula.data.matricula).toEqual([])
    expect(matricula.data.datosMatricula).toEqual({ fechaMatricula: '2026-08-10', codOrientacion: '0', tipoMatricula: 'Regular' })
    expect(matricula.data.codFacultad).toBe(1)
  })

  it('REG-EMPTY-02 REPORTES_FIXTURE=empty alone leaves programacion and informacion populated for 2026-2', async () => {
    const { matriculaInfo, programacion, prematricula } = await readAll(await createApp({ REPORTES_FIXTURE: 'empty' }))
    expect(prematricula.data).toEqual([])
    expect(programacion.data.programacion).toHaveLength(8)
    expect(matriculaInfo.data.codSemestre).toBe('2026-2')
    expect(matriculaInfo.data.articulo.secciones).toHaveLength(5)
  })

  it('REG-EMPTY-03 explicit populated equals the default', async () => {
    const explicit = { REPORTES_FIXTURE: 'populated', PROGRAMACION_FIXTURE: 'populated', MATRICULA_INFORMACION_FIXTURE: 'populated' }
    expect(await readAll(await createApp(explicit))).toEqual(await readAll(await createApp()))
  })

  it.each([
    ['REPORTES_FIXTURE', 'EMPTY', 'REPORTES_FIXTURE inválido: EMPTY. Use populated o empty.'],
    ['REPORTES_FIXTURE', '', 'REPORTES_FIXTURE inválido: . Use populated o empty.'],
    ['PROGRAMACION_FIXTURE', 'bogus', 'PROGRAMACION_FIXTURE inválido: bogus. Use populated o empty.'],
    ['MATRICULA_INFORMACION_FIXTURE', ' empty ', 'MATRICULA_INFORMACION_FIXTURE inválido:  empty . Use populated o empty.'],
  ] as const)('REG-MODE-01 %s=%j aborts startup with the documented diagnostic', async (name, value, message) => {
    await expect(createApp({ [name]: value })).rejects.toThrow(message)
    expect(open).toHaveLength(0)
  })
})

describe('REG-ERR: rejected input, methods and recovery', () => {
  const other = (spec: ReadSpec) => READS.find((candidate) => candidate !== spec)!

  it.each(READS)('REG-ERR-01 $key: invalid action → 400 INVALID_ACTION with exact envelope', async (spec) => {
    const app = await createApp()
    const server = request(app.getHttpServer())
    const urls = [
      spec.path, `${spec.path}?accion=`, `${spec.path}?accion=${spec.accion.toUpperCase()}`,
      `${spec.path}?accion=${other(spec).accion}`, `${spec.path}?accion=${spec.accion}&accion=${spec.accion}`,
      `${spec.path}?accion[]=${spec.accion}`, `${spec.path}?Accion=${spec.accion}`,
    ]
    for (const url of urls) {
      const res = await server.post(url).expect(400)
      expect(res.body, url).toEqual(ERR.action)
    }
  })

  it.each(READS)('REG-ERR-02 $key: extra query → 400 INVALID_QUERY', async (spec) => {
    const server = request((await createApp()).getHttpServer())
    for (const extra of ['codAlumno=DEMO-001', 'periodo=2026-1', 'fixture=empty', 'snapshot=x', 'accion=']) {
      const res = await server.post(`${spec.path}?accion=${spec.accion}&${extra}`)
      expect(res.status, extra).toBe(400)
      // a repeated `accion` is an action error (action has priority); every other extra is a query error
      expect(res.body, extra).toEqual(extra === 'accion=' ? ERR.action : ERR.query)
    }
  })

  it.each(READS)('REG-ERR-03 $key: absent or {} body accepted; any other body → 400 INVALID_BODY', async (spec) => {
    const app = await createApp()
    const baseline = (await post(app, spec).expect(200)).body
    expect((await post(app, spec).send({}).expect(200)).body).toEqual(baseline)
    for (const body of [{ codAlumno: 'DEMO-001' }, [], [{}], { accion: spec.accion }]) {
      const res = await post(app, spec).send(body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(res.body).toEqual(ERR.body)
    }
    const text = await post(app, spec).type('text/plain').send('opaque-body')
    expect([text.status, text.body]).toEqual([400, ERR.body])
  })

  it('REG-ERR-04 validation priority is action → query → body, and nothing but the envelope is returned', async () => {
    const server = request((await createApp()).getHttpServer())
    const spec = READS[0]!
    expect((await server.post(`${spec.path}?accion=zzz&extra=1`).send({ a: 1 })).body).toEqual(ERR.action)
    expect((await server.post(`${spec.path}?accion=${spec.accion}&extra=1`).send({ a: 1 })).body).toEqual(ERR.query)
    expect((await server.post(`${spec.path}?accion=${spec.accion}`).send({ a: 1 })).body).toEqual(ERR.body)
  })

  it('REG-ERR-05 syntactically invalid JSON is rejected by the framework parser with HTTP 400 and no data', async () => {
    const server = request((await createApp()).getHttpServer())
    for (const spec of READS) {
      const res = await server.post(`${spec.path}?accion=${spec.accion}`).type('json').send('{"broken":')
      expect(res.status).toBe(400)
      expect(res.body).not.toHaveProperty('data.alumno')
      expect(res.body).not.toHaveProperty('codError', null)
    }
  })

  it.each(READS)('REG-ERR-06 $key: GET/PUT/PATCH/DELETE are not registered → 404', async (spec) => {
    const app = await createApp()
    const server = app.getHttpServer()
    for (const method of ['get', 'put', 'patch', 'delete'] as const) {
      await request(server)[method](`${spec.path}?accion=${spec.accion}`).expect(404)
    }
    await request(server).post(`${spec.path}/extra?accion=${spec.accion}`).expect(404)
  })

  it('REG-ERR-07 a valid read after the whole error battery returns the unchanged catalog', async () => {
    const app = await createApp()
    const baseline = await readAll(app)
    const server = request(app.getHttpServer())
    for (const spec of READS) {
      await server.post(spec.path)
      await server.post(`${spec.path}?accion=${spec.accion}&periodo=2026-1`)
      await server.post(`${spec.path}?accion=${spec.accion}`).send({ matricula: 'x' })
      await server.put(`${spec.path}?accion=${spec.accion}`).send({ matricula: 'x' })
    }
    expect(await readAll(app)).toEqual(baseline)
  })
})

describe('REG-COEX: coexistence with MatriculaRegularModule (no writes)', () => {
  it('REG-COEX-01 legacy responses are identical with and without MatriculaRegularModule', async () => {
    const without = await readAll(await createApp({}, false))
    const withRegular = await readAll(await createApp({}, true))
    expect(withRegular).toEqual(without)
  })

  it('REG-COEX-02 legacy reads, errors and wrong methods leave MR state untouched (no enrollments, requests, sessions, reports, capacity)', async () => {
    const app = await createApp()
    const repository = app.get(MatriculaRegularRepository)
    const before = repository.readSnapshot()
    expect(before.sessions).toHaveLength(0)
    expect(before.enrollments).toHaveLength(0)
    expect(before.requests).toHaveLength(0)
    expect(before.reports).toHaveLength(0)
    const actorId = before.actors[0]!.actorId
    const contextBefore = (await request(app.getHttpServer()).get(`/local/matricula-regular/v1/contextos/${actorId}`).expect(200)).body

    const server = request(app.getHttpServer())
    for (const spec of READS) {
      await Promise.all([
        server.post(`${spec.path}?accion=${spec.accion}`),
        server.post(`${spec.path}?accion=${spec.accion}`).send({}),
        server.post(`${spec.path}?accion=bad`),
        server.post(`${spec.path}?accion=${spec.accion}&periodo=2026-1`),
        server.post(`${spec.path}?accion=${spec.accion}`).send({ codAlumno: actorId }),
        server.get(`${spec.path}?accion=${spec.accion}`),
        server.put(`${spec.path}?accion=${spec.accion}`).send({}),
        server.delete(`${spec.path}?accion=${spec.accion}`),
      ])
    }

    expect(repository.readSnapshot()).toEqual(before)
    expect((await request(app.getHttpServer()).get(`/local/matricula-regular/v1/contextos/${actorId}`).expect(200)).body).toEqual(contextBefore)
  })

  it('REG-COEX-03 the legacy and local namespaces stay separate: MR GET does not answer legacy routes and vice versa', async () => {
    const app = await createApp()
    const repository = app.get(MatriculaRegularRepository)
    const before = repository.readSnapshot()
    const server = app.getHttpServer()
    await request(server).get('/local/matricula-regular/v1/contextos/SYN-UNKNOWN-ACTOR').expect(404)
    await request(server).get('/alumnoWebSum/v2/matricula/informacion?accion=obtenerInformacion').expect(404)
    await request(server).post('/local/matricula-regular/v1/contextos/x?accion=obtenerInformacion').expect(404)
    expect(repository.readSnapshot()).toEqual(before)
  })
})
