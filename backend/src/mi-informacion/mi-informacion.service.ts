import { HttpException, Injectable } from '@nestjs/common'
import type { MiInformacionRepresentation } from '../../../shared/mi-informacion-wire.mjs'
import { MiInformacionRepository } from './mi-informacion.repository.js'
import type {
  MiInformacionKey,
  MiInformacionResponseEnvelope,
} from './mi-informacion.types.js'

@Injectable()
export class MiInformacionService {
  constructor(private readonly repository: MiInformacionRepository) {}

  consultar<Key extends MiInformacionKey>(key: Key): {
    envelope: MiInformacionResponseEnvelope
    representation: MiInformacionRepresentation
  }
  consultar(key: MiInformacionKey): {
    envelope: MiInformacionResponseEnvelope
    representation: MiInformacionRepresentation
  } {
    const selection = this.repository.readSnapshot(key)
    if (selection.kind === 'missing') {
      throw new HttpException({
        message: `${key}.${selection.basename}: snapshot no disponible`,
        codError: 'SNAPSHOT_MISSING',
        data: null,
      }, 503)
    }
    if (selection.kind === 'snapshot') {
      return { envelope: selection.envelope, representation: selection.representation }
    }
    return {
      envelope: { message: null, codError: null, data: this.repository.read(key) },
      representation: 'local-v1',
    }
  }
}
