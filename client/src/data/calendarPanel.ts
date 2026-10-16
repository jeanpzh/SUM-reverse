import type {
  MatriculaRegularEligibility,
  MatriculaRegularPublishedRow,
  MatriculaRegularWindow,
  MatriculaRegularSourceClass,
} from '../../../shared/matricula-regular.mjs'

export function formatCalendarRows(
  rows: readonly MatriculaRegularPublishedRow[],
): string[][] {
  return rows.map((r) => [
    String(r.row),
    r.groupLabel,
    r.day,
    r.startLocal,
    r.endLocal,
    String(r.ppMin),
    String(r.ppMax),
    r.sourceId,
  ])
}

export function formatEffectiveWindows(
  windows: readonly MatriculaRegularWindow[],
): string[][] {
  return windows.map((w) => [
    w.id,
    w.startsAt,
    w.endsAt,
    String(w.minPp),
    w.origin,
    w.sourceIds.join(', '),
  ])
}

export type EligibilityVariant = 'eligible' | 'ineligible' | 'pending'

export function formatEligibilityState(eligibility: MatriculaRegularEligibility): {
  label: string
  variant: EligibilityVariant
} {
  if (eligibility.state === 'eligible') {
    return {
      label: 'Habilitado para selección',
      variant: 'eligible',
    }
  }
  if (eligibility.state === 'ineligible') {
    return {
      label: 'No habilitado por turno o condiciones',
      variant: 'ineligible',
    }
  }
  return {
    label: 'Pendiente de configuración (gap)',
    variant: 'pending',
  }
}

export function formatSourceClass(sourceClass: MatriculaRegularSourceClass | null): string {
  switch (sourceClass) {
    case 'normative':
      return 'Normativa'
    case 'observed':
      return 'Observada'
    case 'testimony':
      return 'Testimonio'
    case 'inferred':
      return 'Inferencia'
    case null:
      return 'Decisión local'
  }
}
