import { describe, expect, it } from 'vitest'
import {
  matriculaWireKeys,
  validateMatriculaWire,
  type MatriculaWireKey,
  type WireJsonObject,
} from '../../shared/matricula-wire.mjs'

const alumno = {
  codAlumno: 'DEMO-001', apePaterno: '', apeMaterno: '', nomAlumno: '',
  codFacultad: 0, desFacultad: '', areaFacultad: 0, codEscuela: 0, desEscuela: '',
  areaEscuela: 0, codEspecialidad: 0, desEspecialidad: '', codPlan: '', desPlan: '',
  ponderado: 0, actualizoFormulario: false, habEncuesta: false, habEncuestaEgresados: false,
  habMatricula: false, periodo: '', urlFoto: '', foto: '', codPermanencia: '', desPermanencia: '',
  codSituacion: '', desSituacion: '', regimen: '', egresadoEG: '', cicloEstudios: 0,
  anioIngreso: 0, correoInstitucional: '', sexo: '', nroTicketMatEG: 0,
  infoSemestre: {
    fecSistema: null, fecInicioEncuestaDocente: '', fecFinEncuestaDocente: '',
    fecInicioEncuestaDocenteS1: '', fecFinEncuestaDocenteS1: '',
    fecInicioEncuestaDocenteS2: '', fecFinEncuestaDocenteS2: '',
    fecInicioEncuestaDocenteA1: '', fecFinEncuestaDocenteA1: '',
    fecInicioEncuestaDocenteA2: '', fecFinEncuestaDocenteA2: '',
  },
  infoMatricula: {
    fecInicioMatInternet: '', fecFinMatInternet: '', indMatInternet: '', indMatObservados: '',
    indMatDeudores: '', indMatIngresantes: '', indMatExonerados: '', indMatRepMultiple: '',
    indProgramacionInterna: '', indPagosAdicionales: '', obsSemMatInternet: null,
    indCertificadoMed: '', indHabMatricula: '', numMaxRepitencias: 0, indAutoSeguro: '',
    indMatCtrlHorario: '', sfecInicioMatInternet: '', sfecFinMatInternet: '',
  },
  anioEstudio: 0, codSede: '', sedeAlumno: '', difCriterioCalif: false,
}

function envelope(data: unknown) {
  return { message: null, codError: null, data }
}

const fixtures: Record<MatriculaWireKey, WireJsonObject> = {
  matriculaInfo: envelope({
    codSemestre: '', codFacultad: 0, fechaDB: '', fecIniMatInternet: '', fecFinMatInternet: '',
    mensajeMatricula: '', mensaje: '', indMatHabilitada: false, matriculado: false,
    indMatCtrlHorario: '', valProgramacion: null,
    perfil: {
      anioIngreso: 0, anioEstudio: 0, promedio: 0, situAcademica: '', permanencia: '',
      semestreSuspension: null, codTipoAutorizacion: null,
    },
    creditaje: {}, amonestaciones: null,
  }) as WireJsonObject,
  programacion: envelope({ alumno, programacion: [] }) as WireJsonObject,
  prematricula: envelope([]) as WireJsonObject,
  matricula: envelope({
    matricula: [], datosMatricula: { fechaMatricula: '', codOrientacion: '', tipoMatricula: '' },
    indMatHabilitadaLabPra: false, codFacultad: 0,
  }) as WireJsonObject,
  horarios: envelope([]) as WireJsonObject,
}

describe('matricula wire contract', () => {
  it('exports the fixed key tuple and accepts every complete synthetic envelope', () => {
    expect(matriculaWireKeys).toEqual(['matriculaInfo', 'programacion', 'prematricula', 'matricula', 'horarios'])
    for (const key of matriculaWireKeys) expect(() => validateMatriculaWire(key, fixtures[key])).not.toThrow()
  })

  it('accepts strings, empty strings, finite numbers and opaque JSON without narrowing examples', () => {
    const info = structuredClone(fixtures.matriculaInfo) as Record<string, any>
    info.message = 'Aviso local'
    info.extraEnvelope = { retained: [true, 3] }
    info.data.fechaDB = '2026-10-08T08:30:15-05:00'
    info.data.creditaje['libre'] = 0
    info.data.perfil.semestreSuspension = { label: 'opaco' }
    info.data.otraClave = { preserved: true }
    const original = info

    expect(() => validateMatriculaWire('matriculaInfo', info)).not.toThrow()
    expect(info).toBe(original)
    expect(info.data.fechaDB).toBe('2026-10-08T08:30:15-05:00')
    expect(info.extraEnvelope).toEqual({ retained: [true, 3] })
  })

  it('reports missing and malformed known fields with key and field path', () => {
    const missing = structuredClone(fixtures.programacion) as Record<string, any>
    delete missing.data.alumno.infoSemestre.fecInicioEncuestaDocente
    expect(() => validateMatriculaWire('programacion', missing))
      .toThrow('programacion.data.alumno.infoSemestre.fecInicioEncuestaDocente: se esperaba campo presente')

    const wrongType = structuredClone(fixtures.matricula) as Record<string, any>
    wrongType.data.datosMatricula = undefined
    expect(() => validateMatriculaWire('matricula', wrongType))
      .toThrow('matricula.data.datosMatricula: se esperaba objeto')
  })

  it('rejects non-JSON values and invalid codError without coercion', () => {
    for (const value of [new Date(), new Map(), /not-json/]) {
      const withNonJson = { ...fixtures.matriculaInfo, extraValue: value }
      expect(() => validateMatriculaWire('matriculaInfo', withNonJson))
        .toThrow('matriculaInfo.extraValue: se esperaba valor JSON')
    }

    const withInfinity = structuredClone(fixtures.prematricula) as Record<string, any>
    withInfinity.data = [{ codFacultad: Infinity }]
    expect(() => validateMatriculaWire('prematricula', withInfinity))
      .toThrow('prematricula.data[0].codFacultad: se esperaba number finito')

    const invalidError = structuredClone(fixtures.horarios) as Record<string, any>
    invalidError.codError = '0'
    expect(() => validateMatriculaWire('horarios', invalidError))
      .toThrow('horarios.codError: se esperaba null')
  })
})
