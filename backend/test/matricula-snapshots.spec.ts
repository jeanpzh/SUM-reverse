import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspect } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadMatriculaSnapshots } from '../src/common/matricula-snapshots.js'
import { MatriculaInformacionRepository } from '../src/matricula-informacion/matricula-informacion.repository.js'
import { MatriculaInformacionService } from '../src/matricula-informacion/matricula-informacion.service.js'
import { ProgramacionRepository } from '../src/programacion/programacion.repository.js'
import { ProgramacionService } from '../src/programacion/programacion.service.js'
import { populatedFixtures } from '../src/reportes/reportes.fixtures.js'
import { ReportesRepository } from '../src/reportes/reportes.repository.js'
import { ReportesService } from '../src/reportes/reportes.service.js'

const filenames = {
  matriculaInfo: 'matricula-info.json',
  programacion: 'programacion-asignaturas.json',
  prematricula: 'reporte-pre-matricula.json',
  matricula: 'reporte-matricula.json',
  horarios: 'reporte-horario.json',
} as const

function wireSnapshots(variant = false) {
  const alumno = structuredClone(populatedFixtures.formulario.alumno)
  if (variant) {
    alumno.codAlumno = 'SYNTHETIC-002'
    alumno.periodo = '2099-1'
  }
  const envelope = (data: unknown, message: string | null = null) => ({ message, codError: null, data })
  return {
    matriculaInfo: envelope({
      codSemestre: '2099-1', codFacultad: 1, fechaDB: '2026-10-08T08:30:15-05:00',
      fecIniMatInternet: '', fecFinMatInternet: '', mensajeMatricula: 'synthetic', mensaje: '',
      indMatHabilitada: false, matriculado: false, indMatCtrlHorario: '', valProgramacion: null,
      perfil: {
        anioIngreso: 2020, anioEstudio: 3, promedio: 0, situAcademica: '', permanencia: '',
        semestreSuspension: null, codTipoAutorizacion: null,
      },
      creditaje: { '2026-2': 12 }, amonestaciones: null, extra: { retained: true },
    }, 'snapshot-info'),
    programacion: envelope({ alumno, programacion: [], extra: 'preserved' }, 'snapshot-programacion'),
    prematricula: envelope(populatedFixtures.prematricula, 'snapshot-prematricula'),
    matricula: envelope(populatedFixtures.matricula, 'snapshot-matricula'),
    horarios: envelope(populatedFixtures.horarios, 'snapshot-horarios'),
  }
}

function writeSnapshots(directory: string, snapshots = wireSnapshots()) {
  mkdirSync(directory, { recursive: true })
  for (const [key, filename] of Object.entries(filenames)) {
    writeFileSync(join(directory, filename), JSON.stringify(snapshots[key as keyof typeof filenames]))
  }
}

function clearConfig() {
  vi.stubEnv('MATRICULA_SNAPSHOT_DIR', undefined)
  vi.stubEnv('REPORTES_FIXTURE', undefined)
  vi.stubEnv('PROGRAMACION_FIXTURE', undefined)
  vi.stubEnv('MATRICULA_INFORMACION_FIXTURE', undefined)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('offline matrícula snapshots', () => {
  it('loads all five fixed files as a complete validated set', () => {
    const directory = mkdtempSync(join(tmpdir(), 'matricula-snapshots-'))
    try {
      writeSnapshots(directory)
      const snapshots = loadMatriculaSnapshots(directory)
      expect(Object.keys(snapshots ?? {})).toEqual(Object.keys(filenames))
      expect(snapshots?.matriculaInfo.data.fechaDB).toBe('2026-10-08T08:30:15-05:00')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects relative, empty and conflicting configuration, including explicit populated', () => {
    clearConfig()
    expect(() => loadMatriculaSnapshots('relative/path')).toThrow('MATRICULA_SNAPSHOT_DIR')
    expect(() => loadMatriculaSnapshots('')).toThrow('MATRICULA_SNAPSHOT_DIR')
    vi.stubEnv('PROGRAMACION_FIXTURE', 'populated')
    expect(() => loadMatriculaSnapshots('/tmp/synthetic')).toThrow('PROGRAMACION_FIXTURE')
  })

  it('fails closed on missing files, invalid JSON and invalid schema without exposing contents', () => {
    const directory = mkdtempSync(join(tmpdir(), 'matricula-snapshots-invalid-'))
    try {
      writeSnapshots(directory)
      rmSync(join(directory, filenames.horarios))
      expect(() => loadMatriculaSnapshots(directory)).toThrow('(reporte-horario.json): archivo ausente')

      writeSnapshots(directory)
      writeFileSync(join(directory, filenames.matriculaInfo), '{ "private-value": "do-not-print"')
      expect(() => loadMatriculaSnapshots(directory)).toThrow('matricula-info.json): JSON inválido')
      try {
        loadMatriculaSnapshots(directory)
      } catch (error) {
        expect(String(error)).not.toContain('do-not-print')
      }

      writeFileSync(join(directory, filenames.matriculaInfo), 'SECRET_INVALID')
      let rejected: unknown
      try {
        loadMatriculaSnapshots(directory)
      } catch (error) {
        rejected = error
      }
      expect(rejected).toBeInstanceOf(Error)
      expect(inspect(rejected)).not.toContain('SECRET')

      writeSnapshots(directory)
      const malformed = wireSnapshots()
      malformed.matriculaInfo.data.codFacultad = undefined
      writeSnapshots(directory, malformed)
      expect(() => loadMatriculaSnapshots(directory))
        .toThrow('matricula-info.json: matriculaInfo.data.codFacultad: se esperaba campo presente')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('returns the complete snapshot envelope from each service and keeps responses isolated', () => {
    clearConfig()
    const directory = mkdtempSync(join(tmpdir(), 'matricula-snapshots-service-'))
    try {
      writeSnapshots(directory, wireSnapshots(true))
      vi.stubEnv('MATRICULA_SNAPSHOT_DIR', directory)
      const reportesRepository = new ReportesRepository()
      const reportesService = new ReportesService(reportesRepository)
      const programacionService = new ProgramacionService(new ProgramacionRepository(reportesRepository))
      const infoService = new MatriculaInformacionService(new MatriculaInformacionRepository(reportesRepository))

      const programacion = programacionService.consultar()
      expect(programacion).toEqual(wireSnapshots(true).programacion)
      expect(programacion.data.alumno.codAlumno).toBe('SYNTHETIC-002')
      expect(programacion.message).toBe('snapshot-programacion')
      const mutated = programacion as { data: { extra: string } }
      mutated.data.extra = 'mutated'
      expect(programacionService.consultar().data.extra).toBe('preserved')
      expect(infoService.consultar()).toEqual(wireSnapshots(true).matriculaInfo)
      expect(reportesService.consultar('prematricula')).toEqual(wireSnapshots(true).prematricula)
      expect(reportesService.consultar('matricula')).toEqual(wireSnapshots(true).matricula)
      expect(reportesService.consultar('horarios')).toEqual(wireSnapshots(true).horarios)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('keeps the existing synthetic fixtures when snapshot configuration is absent', () => {
    clearConfig()
    const repository = new ReportesRepository()
    const result = new ReportesService(repository).consultar('prematricula')
    expect(result).toMatchObject({ message: null, codError: null, data: populatedFixtures.prematricula })
    expect(repository.readMatriculaSnapshot('prematricula')).toBeNull()
  })
})
