import { useId } from 'react'
import type { AcademicAdvisorRecommendation } from '../../data/academicScheduling'
import { Checkbox } from '../ui/Checkbox'
import { MessageResponse } from './MessageResponse'
import { AdviceDisclosure } from './AdviceDisclosure'

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
  return <article className="planning-rec" data-checked={checked || undefined} data-disabled={disabled || undefined}>
    <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} />
    <div className="planning-rec__body">
      <span className="planning-rec__kind">{kind}</span>
      <label htmlFor={id} className="planning-rec__title">{recommendation.title}</label>
      <p className="planning-rec__scope">Alcance estimado: {recommendation.impactSummary}</p>
      {patch.kind === 'increase_teacher_load' && <p className="planning-rec__warning">Escenario de simulación: requiere autorización externa para aumentar la carga docente. La consulta normativa no concede esa autorización.</p>}
      <AdviceDisclosure label="Por qué se recomienda"><MessageResponse>{recommendation.rationale}</MessageResponse></AdviceDisclosure>
      <details className="planning-rec__details">
        <summary>Ver cambios exactos ({details.length})</summary>
        <ul>{details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
        {patch.kind === 'enable_planning_window' && <p>Se conserva la disponibilidad de docentes y ambientes.</p>}
      </details>
    </div>
  </article>
}
