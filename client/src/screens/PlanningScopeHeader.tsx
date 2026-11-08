import type { ReactNode } from 'react'
import { PageTitle } from '../components/Common'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Separator } from '../components/ui/Separator'
import type { AcademicDraftState } from '../../../shared/programacion-academica-api.mjs'

export interface PlanningScopeHeaderProps {
  school?: string
  period?: string
  draftVersion: number | null
  draftId: string | null
  savedDraftState: AcademicDraftState
  workspaceDirty: boolean
  canSave: boolean
  draftBusy: boolean
  onSave: () => void
  disabledReason?: string | null
}

function formatDraftStateLabel(
  draftVersion: number | null,
  workspaceDirty: boolean,
  savedDraftState: AcademicDraftState,
  draftId: string | null
): string {
  if (workspaceDirty) {
    return draftId && draftVersion !== null
      ? `Cambios sin guardar · versión guardada ${draftVersion}.`
      : 'Cambios sin guardar.'
  }
  if (draftVersion !== null) {
    if (savedDraftState === 'approved') return `Aprobada (simulada) r${draftVersion} · Guardado`
    if (savedDraftState === 'published') return `Publicada (simulada) r${draftVersion} · Guardado`
    return `Borrador r${draftVersion} · Guardado`
  }
  return 'Borrador nuevo · Guardado'
}

export function PlanningScopeHeader({
  school = 'Sistemas',
  period = '2027-I',
  draftVersion,
  draftId,
  savedDraftState,
  workspaceDirty,
  canSave,
  draftBusy,
  onSave,
  disabledReason,
}: PlanningScopeHeaderProps): ReactNode {
  const draftStateText = formatDraftStateLabel(draftVersion, workspaceDirty, savedDraftState, draftId)

  return (
    <header className="planning-scope-header mb-3 box-border flex min-w-0 flex-col gap-2 rounded-planning-panel border border-solid border-border bg-background px-4 py-3 text-foreground [overflow-wrap:anywhere]" aria-label="Ámbito y estado de programación">
      <div className="planning-scope-header__top flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="planning-scope-header__context flex min-w-0 flex-wrap items-center gap-2">
          <span className="planning-scope-header__scope text-sm font-semibold tabular-nums">{school} / {period}</span>
          <Badge variant="secondary">Demo · datos sintéticos</Badge>
        </div>
        <div className="planning-scope-header__actions flex min-w-0 flex-wrap items-center gap-3">
          <Badge
            variant={workspaceDirty ? 'warning' : 'outline'}
            className="planning-scope-header__draft-state"
            role="status"
          >
            {draftStateText}
          </Badge>
          <div className="planning-scope-header__save-wrapper flex min-w-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="planning-scope-header__save-button"
              disabled={!canSave || draftBusy}
              onClick={onSave}
            >
              {draftBusy ? 'Guardando…' : 'Guardar propuesta'}
            </Button>
            {!canSave && disabledReason && (
              <span className="planning-scope-header__disabled-reason text-[13px] text-muted-foreground">{disabledReason}</span>
            )}
          </div>
        </div>
      </div>
      <Separator />
      <div className="planning-scope-header__title-row flex min-w-0 flex-wrap items-baseline justify-between gap-3 [&_.page-title]:m-0">
        <PageTitle>Programación académica asistida</PageTitle>
        <p className="planning-scope-header__disclaimer m-0 flex min-w-0 flex-wrap gap-1 text-[13px] leading-5 text-muted-foreground [&_strong]:text-foreground" role="note">
          <strong>Prototipo local con datos sintéticos.</strong>
          <span>No es una pantalla oficial SUM y no requiere ni otorga permisos administrativos.</span>
        </p>
      </div>
    </header>
  )
}
