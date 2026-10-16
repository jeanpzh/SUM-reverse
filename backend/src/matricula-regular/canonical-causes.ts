import type { MatriculaRegularCause } from '../../../shared/matricula-regular.mjs'

function compareRaw(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function causeKey(cause: MatriculaRegularCause): string {
  return `${cause.code}|${cause.courseIds.join(',')}|${cause.sectionIds.join(',')}`
}

export function canonicalizeCauses(
  causes: readonly MatriculaRegularCause[],
): MatriculaRegularCause[] {
  const byKey = new Map<string, MatriculaRegularCause>()

  for (const cause of causes) {
    const key = causeKey(cause)
    const previous = byKey.get(key)
    byKey.set(key, previous === undefined
      ? structuredClone(cause)
      : {
        ...structuredClone(cause),
        sourceIds: [...new Set([...previous.sourceIds, ...cause.sourceIds])].sort(compareRaw),
      })
  }

  return [...byKey.entries()]
    .sort(([left], [right]) => compareRaw(left, right))
    .map(([, cause]) => cause)
}
