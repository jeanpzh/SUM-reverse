import { useEffect, useRef, type ReactNode } from 'react'
import type { MatriculaRegularOutcome } from '../../../shared/matricula-regular.mjs'
import {
  formatAcceptedSummary,
  formatOutcomeCauses,
  getDialogKind,
  isAcceptedOutcome,
} from '../data/enrollmentResultDialog'
import './EnrollmentResultDialog.css'

export interface EnrollmentResultDialogProps {
  outcome: MatriculaRegularOutcome | null
  isOpen: boolean
  onClose: () => void
  onViewReport?: (reportPath: string, enrollmentId: string) => void
}

export function EnrollmentResultDialog({
  outcome,
  isOpen,
  onClose,
  onViewReport,
}: EnrollmentResultDialogProps): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const dialogKind = getDialogKind(outcome)

  // Focus management: move focus to heading when dialog opens
  useEffect(() => {
    if (!isOpen || !dialogKind) return

    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    // Set focus on heading for screen readers & keyboard navigation
    const timer = setTimeout(() => {
      headingRef.current?.focus()
    }, 0)

    return () => {
      clearTimeout(timer)
      if (dialog && dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen, dialogKind])

  // If dialog is not open or outcome is not accepted or rejected (e.g. pending/uncertain), do not render
  if (!isOpen || !dialogKind || !outcome) {
    return null
  }

  // Keyboard navigation & focus trap (Tab / Shift+Tab confinement, Escape)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'Tab') {
      const dialog = dialogRef.current
      if (!dialog) return

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )

      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]!
      const lastElement = focusableElements[focusableElements.length - 1]!

      if (event.shiftKey) {
        if (document.activeElement === firstElement || document.activeElement === headingRef.current) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }
  }

  const isAccepted = dialogKind === 'accepted' && isAcceptedOutcome(outcome)
  const acceptedSummary = isAccepted ? formatAcceptedSummary(outcome) : null
  const formattedCauses = !isAccepted ? formatOutcomeCauses(outcome.causes) : []

  return (
    <dialog
      ref={dialogRef}
      className="enrollment-result-dialog"
      aria-labelledby="result-dialog-title"
      aria-describedby="result-dialog-description"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="enrollment-result-dialog__container">
        <header
          className={`enrollment-result-dialog__header enrollment-result-dialog__header--${dialogKind}`}
        >
          <h2
            id="result-dialog-title"
            ref={headingRef}
            tabIndex={-1}
            className={`enrollment-result-dialog__title enrollment-result-dialog__title--${dialogKind}`}
          >
            {isAccepted ? 'Matrícula Regular Aceptada' : 'Solicitud de Matrícula Rechazada'}
          </h2>
          <button
            type="button"
            className="enrollment-result-dialog__close-btn"
            onClick={onClose}
            aria-label="Cerrar aviso de resultado"
          >
            ×
          </button>
        </header>

        <div className="enrollment-result-dialog__body">
          <p id="result-dialog-description" className="enrollment-result-dialog__description">
            {isAccepted
              ? 'Su solicitud de matrícula ha sido procesada y registrada exitosamente en el sistema local.'
              : 'Su solicitud no pudo ser registrada debido a los siguientes impedimentos académicos o de capacidad:'}
          </p>

          {isAccepted && acceptedSummary && (
            <div className="enrollment-result-dialog__summary-card">
              <div className="enrollment-result-dialog__summary-item">
                Asignaturas matriculadas: <strong>{acceptedSummary.courseCount}</strong>
              </div>
              <div className="enrollment-result-dialog__summary-item">
                Constancia local generada para el periodo 2026-II.
              </div>
            </div>
          )}

          {!isAccepted && (
            <>
              <ul className="enrollment-result-dialog__causes-list">
                {formattedCauses.map((cause) => (
                  <li key={cause.code} className="enrollment-result-dialog__cause-item">
                    <div className="enrollment-result-dialog__cause-title">{cause.title}</div>
                    <p className="enrollment-result-dialog__cause-desc">{cause.description}</p>
                    {cause.coursesSummary && (
                      <div className="enrollment-result-dialog__cause-details">
                        {cause.coursesSummary}
                      </div>
                    )}
                    {cause.sectionsSummary && (
                      <div className="enrollment-result-dialog__cause-details">
                        {cause.sectionsSummary}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="enrollment-result-dialog__reset-notice" role="status">
                Conforme al principio de todo-o-nada, la solicitud no generó registros parciales ni reserva de cupos.
                Al cerrar este aviso, el sistema retorna a la pantalla de registro con la selección reiniciada.
              </div>
            </>
          )}
        </div>

        <footer className="enrollment-result-dialog__actions">
          {isAccepted && acceptedSummary && onViewReport && (
            <button
              type="button"
              className="enrollment-result-dialog__btn enrollment-result-dialog__btn--primary"
              onClick={() => onViewReport(acceptedSummary.reportPath, acceptedSummary.enrollmentId)}
            >
              Ver reporte local
            </button>
          )}
          <button
            type="button"
            className={`enrollment-result-dialog__btn ${
              isAccepted
                ? 'enrollment-result-dialog__btn--secondary'
                : 'enrollment-result-dialog__btn--danger'
            }`}
            onClick={onClose}
          >
            {isAccepted ? 'Cerrar' : 'Aceptar y volver al registro'}
          </button>
        </footer>
      </div>
    </dialog>
  )
}
