import { useId } from 'react'
import type { AcademicAdvisorRecommendation, AcademicAdvisorResponse } from '../../data/academicScheduling'
import { Badge } from '../ui/Badge'
import { Checkbox } from '../ui/Checkbox'
import { MessageResponse } from './MessageResponse'
import { AdviceDisclosure } from './AdviceDisclosure'

export function SuggestionCard({ recommendation, checked, disabled, onCheckedChange, teacherNames, courseNames, roomNames, sourceMode }: {
  recommendation: AcademicAdvisorRecommendation
  sourceMode?: AcademicAdvisorResponse['source']['mode']
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
  return <article className="min-w-0 border-0 border-b border-solid border-border py-3 text-sm">
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="cursor-pointer font-semibold">{recommendation.title}</label>
        <div className="my-2"><Badge variant="outline" className="whitespace-normal [overflow-wrap:anywhere]">Alcance estimado: {recommendation.impactSummary}</Badge></div>
        {patch.kind === 'increase_teacher_load' && <p className="my-2 font-medium">{sourceMode === 'engine-decisions'
          ? 'Ajuste dentro del máximo ya autorizado. No requiere una nueva autorización formal.'
          : 'Escenario de simulación: requiere autorización externa para aumentar la carga docente. La consulta normativa no concede esa autorización.'}</p>}
        <AdviceDisclosure label="Por qué se recomienda"><MessageResponse>{recommendation.rationale}</MessageResponse></AdviceDisclosure>
        <details className="mt-2">
          <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">Ver cambios exactos ({details.length})</summary>
          <ul className="mb-0 pl-5 [overflow-wrap:anywhere]">{details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
          {patch.kind === 'enable_planning_window' && <p>Se conserva la disponibilidad de docentes y ambientes.</p>}
        </details>
      </div>
    </div>
  </article>
}
