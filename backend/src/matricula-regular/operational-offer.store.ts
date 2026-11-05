import { Injectable } from '@nestjs/common'
import { join } from 'node:path'
import { SavedDraftStore, SavedDraftStoreError } from '../programacion-academica/saved-draft-store.js'
import { OperationalStorageError } from './operational-run-store.js'
import type { OperationalRunDocument, OperationalRunStore } from './operational-run-store.js'

/** Mounted only by the explicit local E3 module; the base MR graph has no filesystem dependency. */
@Injectable()
export class OperationalOfferStore implements OperationalRunStore {
  private readonly store: SavedDraftStore<OperationalRunDocument>

  constructor() {
    const directory = process.env.SUM_ACADEMIC_DRAFT_DIR?.trim()
    const enabled = process.env.SUM_ACADEMIC_SCHEDULING === '1' && process.env.SUM_LOCAL_SCENARIOS === '1'
      && process.env.SIMULATOR_DEPLOYMENT !== 'public' && process.env.SIMULATOR_STORAGE !== 'postgres'
      && process.env.MATRICULA_SNAPSHOT_DIR === undefined
    this.store = new SavedDraftStore(enabled && directory ? join(directory, 'e3-ofertas') : '')
  }

  get configured() { return this.store.configured }
  list() { return this.store.list() }
  write(id: string, document: OperationalRunDocument) {
    try { this.store.write(id, document) } catch (error) {
      if (error instanceof SavedDraftStoreError) throw new OperationalStorageError(error.status, error.code, error.message)
      throw new OperationalStorageError(503, 'STORAGE_UNAVAILABLE', 'No se pudo persistir la oferta operativa')
    }
  }
}
