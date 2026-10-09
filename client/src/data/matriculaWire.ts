import { validateMatriculaWire } from '../../../shared/matricula-wire.mjs'

export { matriculaWireKeys, validateMatriculaWire } from '../../../shared/matricula-wire.mjs'
export type { MatriculaWireKey, WireJson, WireJsonObject } from '../../../shared/matricula-wire.mjs'

export type WireShape<T> = T extends Date ? string
  : T extends null ? import('../../../shared/matricula-wire.mjs').WireJson
  : T extends string ? string
  : T extends number ? number
  : T extends boolean ? boolean
  : T extends (infer Item)[] ? WireShape<Item>[]
  : T extends object ? { [Key in keyof T]: WireShape<T[Key]> } & import('../../../shared/matricula-wire.mjs').WireJsonObject
  : T

export type WireEnvelope<T> = import('../../../shared/matricula-wire.mjs').WireJsonObject & {
  message: string | null
  codError: null
  data: T
}

export function assertMatriculaWire(key: import('../../../shared/matricula-wire.mjs').MatriculaWireKey,
  value: unknown): asserts value is import('../../../shared/matricula-wire.mjs').WireJsonObject {
  validateMatriculaWire(key, value)
}
