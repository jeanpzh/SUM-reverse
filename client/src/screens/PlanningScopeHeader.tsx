import type { ReactNode } from 'react'
import { PageTitle } from '../components/Common'
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
    <header className="planning-scope-header" aria-label="Ámbito y estado de programación">
      <div className="planning-scope-header__top">
        <div className="planning-scope-header__context">
          <span className="planning-scope-header__scope">{school} / {period}</span>
          <span className="planning-scope-header__badge">Demo · datos sintéticos</span>
        </div>
        <div className="planning-scope-header__actions">
          <span
            className={`planning-scope-header__draft-state academic-scheduling__draft-note ${workspaceDirty ? 'planning-scope-header__draft-state--dirty' : ''}`}
            role="status"
          >
            {draftStateText}
          </span>
          <div className="planning-scope-header__save-wrapper">
            <button
              type="button"
              className="academic-scheduling__button academic-scheduling__button--secondary planning-scope-header__save-button"
              disabled={!canSave || draftBusy}
              onClick={onSave}
            >
              {draftBusy ? 'Guardando…' : 'Guardar propuesta'}
            </button>
            {!canSave && disabledReason && (
              <span className="planning-scope-header__disabled-reason">{disabledReason}</span>
            )}
          </div>
        </div>
      </div>
      <div className="planning-scope-header__title-row">
        <PageTitle>Programación académica asistida</PageTitle>
        <p className="academic-scheduling__notice planning-scope-header__disclaimer" role="note">
          <strong>Prototipo local con datos sintéticos.</strong>
          <span>No es una pantalla oficial SUM y no requiere ni otorga permisos administrativos.</span>
        </p>
      </div>
    </header>
  )
}
