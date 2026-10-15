import type { ReactNode } from 'react'
import { DataTable } from './Common'
import type {
  MatriculaRegularChoice,
  MatriculaRegularContext,
  MatriculaRegularId,
} from '../../../shared/matricula-regular.mjs'
import {
  computeSelectableCourses,
  calculateSelectionTotalCredits,
  validateSelectionRules,
  formatMeetingSchedule,
} from '../data/selectionPanel'
import './CourseSelectionPanel.css'

const REVIEW_HEADERS = ['Código', 'Asignatura', 'Sección', 'Créditos', 'Horario de Clases', 'Plan']

export interface CourseSelectionPanelProps {
  context: MatriculaRegularContext
  selectedChoices: readonly MatriculaRegularChoice[]
  onSelectionChange: (choices: MatriculaRegularChoice[]) => void
  disabled?: boolean
}

export function CourseSelectionPanel({
  context,
  selectedChoices,
  onSelectionChange,
  disabled = false,
}: CourseSelectionPanelProps): ReactNode {
  const { preEnrollmentComplete, offerKnown, scope, preEnrollment, offer } = context
  const planId = scope.planId

  const selectableResult = computeSelectableCourses({
    preEnrollmentComplete,
    offerKnown,
    planId,
    preEnrollment,
    offer,
  })

  const totalCredits = calculateSelectionTotalCredits(selectedChoices, offer)
  const validation = validateSelectionRules(selectedChoices)

  const handleSectionSelect = (courseId: MatriculaRegularId, sectionId: MatriculaRegularId) => {
    if (disabled) return

    // If sectionId is already selected for this course, deselect it
    const existingIndex = selectedChoices.findIndex((c) => c.courseId === courseId)

    if (existingIndex >= 0) {
      const currentChoice = selectedChoices[existingIndex]!
      if (currentChoice.sectionId === sectionId) {
        // Toggle off
        const updated = selectedChoices.filter((_, idx) => idx !== existingIndex)
        onSelectionChange(updated)
        return
      }
      // Replace section for this course (one section per course rule)
      const updated = [...selectedChoices]
      updated[existingIndex] = { courseId, sectionId }
      onSelectionChange(updated)
      return
    }

    // Add new choice
    onSelectionChange([...selectedChoices, { courseId, sectionId }])
  }

  // Build review table rows from selectedChoices
  const reviewRows: ReactNode[][] = selectedChoices.map((choice) => {
    const course = offer.find((o) => o.courseId === choice.courseId)
    const section = course?.sections.find((s) => s.sectionId === choice.sectionId)
    const scheduleText = formatMeetingSchedule(section?.schedule ?? null)

    return [
      choice.courseId,
      course?.name ?? 'Desconocida',
      choice.sectionId,
      String(course?.credits ?? 0),
      scheduleText,
      course?.planId ?? planId,
    ]
  })

  return (
    <section className="course-selection-panel" aria-labelledby="selection-panel-title">
      <header className="course-selection-panel__header">
        <h3 id="selection-panel-title" className="course-selection-panel__title">
          Selección y Revisión de Asignaturas
        </h3>
        <p className="course-selection-panel__subtitle">
          Intersección de asignaturas pendientes de prematrícula completa y oferta aplicable del plan {planId}.
        </p>
      </header>

      {/* Banner de datos incompletos / gap PLAN_OR_OFFER_UNKNOWN */}
      {!selectableResult.isComplete && (
        <div className="course-selection-panel__gap-banner" role="status" aria-live="polite">
          <h4 className="course-selection-panel__gap-title">
            Opciones no disponibles (Gap: {selectableResult.gapCode})
          </h4>
          <p>
            La información de prematrícula o de oferta académica está marcada como incompleta.
            La selección requiere un catálogo completo y conocido.
          </p>
        </div>
      )}

      {/* Catálogo de opciones seleccionables */}
      {selectableResult.isComplete && (
        <div className="course-selection-panel__options-section">
          <h4 className="course-selection-panel__section-title">
            Asignaturas Ofertadas Elegibles ({selectableResult.courses.length})
          </h4>

          {selectableResult.courses.length === 0 ? (
            <p className="course-selection-panel__empty-text">
              No existen asignaturas en la intersección de prematrícula y oferta para este plan de estudios.
            </p>
          ) : (
            <div className="course-selection-panel__course-list" role="group" aria-label="Lista de asignaturas disponibles">
              {selectableResult.courses.map((course) => {
                const selectedChoice = selectedChoices.find((c) => c.courseId === course.courseId)

                return (
                  <article key={course.courseId} className="course-card">
                    <div className="course-card__header">
                      <div className="course-card__info">
                        <span className="course-card__code">{course.courseId}</span>
                        <h5 className="course-card__name">{course.name}</h5>
                      </div>
                      <span className="course-card__credits">{course.credits} créditos</span>
                    </div>

                    <div className="course-card__sections">
                      <span className="course-card__sections-label">Secciones disponibles:</span>
                      <div className="course-card__sections-grid" role="group" aria-label={`Secciones para ${course.name}`}>
                        {course.sections.map((section) => {
                          const isSelected = selectedChoice?.sectionId === section.sectionId
                          const scheduleText = formatMeetingSchedule(section.schedule)
                          const isFull = section.occupied >= section.capacity

                          return (
                            <button
                              key={section.sectionId}
                              type="button"
                              className={`section-button ${isSelected ? 'section-button--selected' : ''}`}
                              onClick={() => handleSectionSelect(course.courseId, section.sectionId)}
                              disabled={disabled}
                              aria-pressed={isSelected}
                              aria-label={`Sección ${section.sectionId}, vacantes ${section.capacity - section.occupied} de ${section.capacity}, horario: ${scheduleText}${isFull ? ' (Sección llena)' : ''}`}
                            >
                              <div className="section-button__header">
                                <span className="section-button__id">{section.sectionId}</span>
                                <span className="section-button__vacancies">
                                  {section.capacity - section.occupied}/{section.capacity} vacantes
                                </span>
                              </div>
                              <div className="section-button__schedule">
                                {scheduleText}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Resumen y Revisión de Selección */}
      <div className="course-selection-panel__review-section">
        <div className="course-selection-panel__review-header">
          <h4 className="course-selection-panel__section-title">
            Revisión de Asignaturas Seleccionadas ({selectedChoices.length})
          </h4>
          <div className="course-selection-panel__total-credits">
            <span>Total de créditos:</span>
            <strong>{totalCredits}</strong>
          </div>
        </div>

        {validation.errorMessage && (
          <div className="course-selection-panel__error-banner" role="alert">
            <p>{validation.errorMessage}</p>
          </div>
        )}

        <DataTable
          headers={REVIEW_HEADERS}
          rows={reviewRows}
          empty="No ha seleccionado ninguna asignatura o sección todavía."
          footer={true}
        />

        <p className="course-selection-panel__review-note">
          Nota de integridad: La revisión refleja únicamente las opciones marcadas en memoria local.
          No constituye borrador académico persistido ni reserva de cupos en el servidor.
        </p>
      </div>
    </section>
  )
}
