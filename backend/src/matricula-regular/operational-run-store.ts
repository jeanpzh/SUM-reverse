import type { OperationalOffer } from '../../../shared/enrollment-offer.mjs'
import type { RunSnapshot } from './store.types.js'

export type OperationalRunDocument = { schemaVersion: 1; offer: OperationalOffer; snapshot: RunSnapshot }
export interface OperationalRunStore {
  readonly configured: boolean
  list(): Array<{ id: string; payload: OperationalRunDocument | null }>
  write(id: string, document: OperationalRunDocument): void
}

export class OperationalStorageError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}
