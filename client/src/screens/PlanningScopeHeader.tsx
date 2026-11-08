import type { ReactNode } from 'react'
import { PageTitle } from '../components/Common'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { PlanningShellControls } from '../components/PlanningShell'
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
    <header className="planning-scope-header mb-4 box-border flex min-w-0 flex-col gap-3 text-foreground [overflow-wrap:anywhere]" aria-label="Ámbito y estado de programación">
      <div className="planning-scope-header__title-row flex min-w-0 flex-wrap items-center justify-between gap-3 [&_.page-title]:m-0">
        <div className="planning-scope-header__context flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <PageTitle>Programación académica asistida</PageTitle>
          <span className="planning-scope-header__scope text-sm font-semibold tabular-nums text-muted-foreground">{school} / {period}</span>
          <Badge variant="secondary" title="No es una pantalla oficial SUM y no requiere ni otorga permisos administrativos.">Prototipo local · datos sintéticos</Badge>
        </div>
        <PlanningShellControls />
      </div>
      <div className="planning-scope-header__actions flex min-w-0 flex-wrap items-center gap-3 rounded-planning-panel border border-solid border-border bg-background px-4 py-2">
        <Badge
          variant={workspaceDirty ? 'warning' : 'outline'}
          className="planning-scope-header__draft-state"
          role="status"
        >
          {draftStateText}
        </Badge>
        <div className="planning-scope-header__save-wrapper ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {!canSave && disabledReason && (
            <span className="planning-scope-header__disabled-reason text-[13px] text-muted-foreground">{disabledReason}</span>
          )}
          <Button
            type="button"
            variant="outline"
            className="planning-scope-header__save-button"
            disabled={!canSave || draftBusy}
            onClick={onSave}
          >
            {draftBusy ? 'Guardando…' : 'Guardar propuesta'}
          </Button>
        </div>
      </div>
    </header>
  )
}
