import { useId } from 'react'
import { CircleHelp, ExternalLink, FileCheck2, TriangleAlert } from 'lucide-react'
import type { AcademicAdvisorRecommendation } from '../../data/academicScheduling'
import { Checkbox } from '../ui/Checkbox'
import { MessageResponse } from './MessageResponse'
import { AdviceDisclosure } from './AdviceDisclosure'

const contrastStatusMeta = {
  supported: { label: 'Sustento documental', Icon: FileCheck2 },
  conflict: { label: 'Fuentes en conflicto', Icon: TriangleAlert },
  'not-determined': { label: 'Aplicación sin confirmar', Icon: CircleHelp },
} as const

export function SuggestionCard({ recommendation, checked, disabled, onCheckedChange, teacherNames, courseNames, roomNames }: {
  recommendation: AcademicAdvisorRecommendation
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
  teacherNames: Record<string, string>
  courseNames: Record<string, string>
  roomNames: Record<string, string>
}) {
  const id = useId()
  const patch = recommendation.patch
  const contrast = recommendation.normativeContrast
  const details = patch.kind === 'increase_teacher_load'
    ? patch.adjustments.map((row) => `${teacherNames[row.teacherId] ?? row.teacherId} (${row.teacherId}): ${row.previousMaxWeeklyMinutes} → ${row.nextMaxWeeklyMinutes} min semanales`)
    : patch.kind === 'change_delivery_mode'
      ? patch.courseIds.map((courseId) => `${courseNames[courseId] ?? courseId} (${courseId}): componentes en franjas independientes; un docente responsable por sección`)
      : patch.kind === 'enable_planning_window'
        ? [patch.allowAfternoon && 'Permitir tardes: habilitar lunes a viernes de 14:00 a 22:00', patch.allowSaturday && 'Permitir sábado: habilitar de 08:00 a 13:00'].filter(Boolean)
        : [...patch.teacherIds.map((teacherId) => `Incorporar docente: ${teacherNames[teacherId] ?? teacherId} (${teacherId})`),
          ...patch.roomIds.map((roomId) => `Incorporar ambiente: ${roomNames[roomId] ?? roomId} (${roomId})`)]
  const kind = {
    increase_teacher_load: 'Carga docente',
    incorporate_reference_resource: 'Habilitación',
    enable_planning_window: 'Excepción horaria',
    change_delivery_mode: 'Modalidad',
  }[patch.kind]
  const statusMeta = contrast
    ? contrastStatusMeta[contrast.status]
    : null
  const statusLabel = contrast
    ? (contrast.status === 'not-determined' && contrast.citations.length === 0 ? 'Sin determinación normativa' : statusMeta!.label)
    : null

  return <article className="planning-rec" data-checked={checked || undefined} data-disabled={disabled || undefined}>
    <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} />
    <div className="planning-rec__body">
      <span className="planning-rec__kind">{kind}</span>
      <label htmlFor={id} className="planning-rec__title">{recommendation.title}</label>
      <p className="planning-rec__scope">Alcance estimado: {recommendation.impactSummary}</p>
      {contrast ? (
        <div className="planning-rec__contrast" data-normative-status={contrast.status}>
          <div className="planning-rec__contrast-head">
            <span className="planning-rec__contrast-eyebrow">Contraste normativo</span>
            <span className="planning-rec__contrast-status">
              {statusMeta && <statusMeta.Icon className="size-3.5 shrink-0" aria-hidden="true" />}
              <span>{statusLabel}</span>
            </span>
          </div>
          {contrast.requiresExternalAuthorization && contrast.authorizationNote && (
            <p className="planning-rec__warning">{contrast.authorizationNote}</p>
          )}
          {contrast.citations.length > 0 ? (
            <ul className="planning-rec__contrast-citations">
              {contrast.citations.slice(0, 3).map((citation) => (
                <li key={citation.id}>
                  <a href={citation.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
                    className="planning-rec__contrast-link">
                    <span>{citation.title} · {citation.article} · p. {citation.page}</span>
                    <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                    <span className="sr-only"> (abre en otra pestaña)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="planning-rec__contrast-empty">Sin citas aplicables para este filtro.</p>
          )}
          {contrast.gaps.length > 0 && (
            <details className="planning-rec__details">
              <summary>Ver verificaciones pendientes ({contrast.gaps.length})</summary>
              <ul>{contrast.gaps.slice(0, 4).map((gap, index) => <li key={index}>{gap}</li>)}</ul>
            </details>
          )}
        </div>
      ) : (
        patch.kind === 'increase_teacher_load' && <p className="planning-rec__warning">Escenario de simulación: requiere autorización externa para aumentar la carga docente. La consulta normativa no concede esa autorización.</p>
      )}
      <AdviceDisclosure label="Por qué se recomienda"><MessageResponse>{recommendation.rationale}</MessageResponse></AdviceDisclosure>
      <details className="planning-rec__details">
        <summary>Ver cambios exactos ({details.length})</summary>
        <ul>{details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
        {patch.kind === 'enable_planning_window' && <p>Se conserva la disponibilidad de docentes y ambientes.</p>}
      </details>
    </div>
  </article>
}
