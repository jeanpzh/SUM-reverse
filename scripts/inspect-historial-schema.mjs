import { readFile } from 'node:fs/promises'

// Operator-only diagnostic. Prints field names and types, never academic values.
// Review field names before sharing the output if any key contains personal data.
const inputPath = process.argv[2]

if (!inputPath || process.argv.length !== 3) {
  console.error('Uso: node scripts/inspect-historial-schema.mjs <archivo-historial.json>')
  process.exitCode = 1
} else {
  try {
    const envelope = JSON.parse(await readFile(inputPath, 'utf8'))
    const creditaje = envelope?.data?.creditaje
    if (!creditaje || typeof creditaje !== 'object' || Array.isArray(creditaje)) {
      throw new Error('schema')
    }
    const entries = Object.entries(creditaje)
    if (entries.some(([, value]) => typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error('schema')
    }
    const fields = entries.map(([key]) => `  ${JSON.stringify(key)}: number`)
    console.log(['// Solo esquema de data.creditaje; sin valores.', 'export interface HistorialCreditaje {',
      ...fields, '}'].join('\n'))
  } catch {
    // Do not expose parse errors, file contents, paths or values.
    console.error('No se pudo obtener el esquema. Se requiere un JSON con data.creditaje como mapa numérico.')
    process.exitCode = 1
  }
}
