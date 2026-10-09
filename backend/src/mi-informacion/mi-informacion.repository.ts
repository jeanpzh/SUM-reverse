import { Injectable } from '@nestjs/common'
import {
  loadMiInformacionSnapshots,
  miInformacionSnapshotBasename,
  readMiInformacionSnapshot,
  type MiInformacionSnapshots,
} from '../common/mi-informacion-snapshots.js'
import { buildSections } from './mi-informacion.catalogs.js'
import { familiaresFixture, historialFixture, perfilFixture } from './mi-informacion.fixtures.js'
import type {
  FichaSocioeconomica, HistorialAcademico, MiInformacionDataMap, MiInformacionKey,
  MiInformacionSnapshot,
} from './mi-informacion.types.js'
import { ReportesRepository } from '../reportes/reportes.repository.js'

export type MiInformacionSnapshotSelection =
  | { kind: 'fixture' }
  | { kind: 'missing'; basename: string }
  | ({ kind: 'snapshot' } & MiInformacionSnapshot)

@Injectable()
export class MiInformacionRepository {
  private readonly empty: boolean
  private readonly snapshots: MiInformacionSnapshots | null

  constructor(private readonly reportes: ReportesRepository) {
    this.snapshots = loadMiInformacionSnapshots(
      process.env.MI_INFORMACION_SNAPSHOT_DIR,
      process.env.MI_INFORMACION_SNAPSHOT_LOCAL_KEYS,
    )
    const mode = process.env.MI_INFORMACION_FIXTURE
    if (mode !== undefined && mode !== 'populated' && mode !== 'empty') {
      throw new Error('MI_INFORMACION_FIXTURE: se esperaba populated o empty')
    }
    this.empty = mode === 'empty'
  }

  readSnapshot(key: MiInformacionKey): MiInformacionSnapshotSelection {
    if (this.snapshots === null) return { kind: 'fixture' }
    const snapshot = readMiInformacionSnapshot(this.snapshots, key)
    if (snapshot === null) return { kind: 'missing', basename: miInformacionSnapshotBasename(key) }
    return {
      kind: 'snapshot',
      envelope: snapshot.envelope,
      representation: snapshot.representation,
    }
  }

  read<Key extends MiInformacionKey>(key: Key): MiInformacionDataMap[Key]
  read(key: MiInformacionKey): MiInformacionDataMap[MiInformacionKey] {
    if (key === 'perfil') return structuredClone(perfilFixture)
    if (key === 'historial') {
      const formulario = this.reportes.readFormulario()
      const data: HistorialAcademico = {
        alumno: formulario.alumno,
        resumen: this.empty ? { asignaturasAprobadas: 0, creditosAprobados: 0, promedioPonderado: null } : historialFixture.resumen,
        periodos: this.empty ? [] : historialFixture.periodos,
        asignaturas: this.empty ? [] : historialFixture.asignaturas,
      }
      return structuredClone(data)
    }
    if (key === 'formularioDatos') {
      const formulario = this.reportes.readFormulario()
      return {
        ...formulario,
        secciones: buildSections('formulario', formulario.alumno, this.empty),
      }
    }

    const formulario = this.reportes.readFormulario()
    const data: FichaSocioeconomica = {
      alumno: formulario.alumno,
      secciones: buildSections('ficha', formulario.alumno, this.empty),
      familiares: this.empty ? [] : familiaresFixture,
    }
    return structuredClone(data)
  }
}
