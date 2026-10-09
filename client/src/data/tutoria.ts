export function validateTutoriaLocal(value: unknown): asserts value is [] {
  if (!Array.isArray(value) || value.length !== 0) {
    throw new Error('La respuesta local de tutoría no cumple el contrato.')
  }
}
