export declare const matriculaWireKeys: readonly [
  'matriculaInfo',
  'programacion',
  'prematricula',
  'matricula',
  'horarios',
]

export type MatriculaWireKey = (typeof matriculaWireKeys)[number]
export type WireJson = null | string | number | boolean | WireJson[] | WireJsonObject
export type WireJsonObject = { [key: string]: WireJson }

export declare function validateMatriculaWire(
  key: MatriculaWireKey,
  value: unknown,
): asserts value is WireJsonObject
