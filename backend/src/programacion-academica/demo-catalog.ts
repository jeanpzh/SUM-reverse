import { adaptSyntheticCatalog } from './synthetic-catalog-adapter.js'
import type { AcademicCatalog } from '../../../shared/programacion-academica-api.d.mts'

export function createDemoCatalog(): AcademicCatalog {
  return adaptSyntheticCatalog()
}
