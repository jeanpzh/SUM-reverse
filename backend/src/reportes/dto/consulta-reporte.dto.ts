import type { ConsultaKey } from '../reportes.types.js'

export class ConsultaReporteDto {
  accion!: string
}

export type ConsultaEsperada = { key: ConsultaKey; accion: string }
