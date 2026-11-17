import { useId } from 'react'
import { formatAcademicMinute, resolvePlanningTimeProfile } from '../../data/academicScheduling'
import type { AcademicAdvisorRecommendation, PlanningPolicy } from '../../data/academicScheduling'
import { Checkbox } from '../ui/Checkbox'
import { MessageResponse } from './MessageResponse'
import { AdviceDisclosure } from './AdviceDisclosure'

export function SuggestionCard({ recommendation, checked, disabled, index, measured = false, onCheckedChange, teacherNames, courseNames, roomNames, planningPolicy }: {
  recommendation: AcademicAdvisorRecommendation
  index?: number
  measured?: boolean
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
  teacherNames: Record<string, string>
  courseNames: Record<string, string>
  roomNames: Record<string, string>
  planningPolicy?: PlanningPolicy | null
}) {
  const id = useId()
  const patch = recommendation.patch
  const profile = planningPolicy ? resolvePlanningTimeProfile(planningPolicy) : null
  const afternoonStart = planningPolicy
    ? resolvePlanningTimeProfile({ ...planningPolicy, allowAfternoon: true }).seniorStartMinute
    : null
  const details = patch.kind === 'increase_teacher_load'
    ? patch.adjustments.map((row) => `${teacherNames[row.teacherId] ?? row.teacherId} (${row.teacherId}): ${row.previousMaxWeeklyMinutes} → ${row.nextMaxWeeklyMinutes} min semanales`)
    : patch.kind === 'change_delivery_mode'
      ? patch.courseIds.map((courseId) => `${courseNames[courseId] ?? courseId} (${courseId}): ${[
        patch.deliveryMode && 'componentes en franjas independientes (respeta la asignación docente del curso)',
        patch.teacherAssignmentMode && (patch.teacherAssignmentMode === 'per-session' ? 'docente independiente por sesión' : 'teoría/práctica juntas y laboratorio independiente'),
      ].filter(Boolean).join('; ')}`)
        : patch.kind === 'enable_planning_window'
          ? [
            patch.allowAfternoon && (profile && afternoonStart !== null
              ? `Permitir tardes: habilitar lunes a viernes de ${formatAcademicMinute(afternoonStart)} a ${formatAcademicMinute(profile.weekdayEndMinute)}`
              : 'Permitir tardes: habilitar franja de tarde según el perfil vigente (14:00 a 22:00 salvo excepción)'),
            patch.allowSaturday && (profile
              ? `Permitir sábado: habilitar de ${formatAcademicMinute(profile.saturdayStartMinute)} a ${formatAcademicMinute(profile.saturdayEndMinute)}`
              : 'Permitir sábado: habilitar franja de sábado según el perfil vigente (08:00 a 13:00 salvo excepción)'),
          ].filter(Boolean)
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
      <label htmlFor={id} className="planning-rec__title">{index && <span className="planning-rec__index" aria-hidden="true">{String(index).padStart(2, '0')}</span>}{recommendation.title}</label>
      <div className="planning-rec__badges"><span className="planning-rec__kind">{kind}</span>
        {(patch.kind === 'increase_teacher_load' || patch.kind === 'enable_planning_window') && <span className="planning-rec__kind planning-rec__kind--authorization">Requiere autorización externa</span>}
      </div>
      <p className="planning-rec__scope">Alcance estimado: {recommendation.impactSummary}</p>
      <p className="planning-rec__measurement">{measured ? 'Incluida en la simulación vigente' : 'Impacto no simulado'}</p>
      {patch.kind === 'increase_teacher_load' && <p className="planning-rec__warning">Escenario de simulación: requiere autorización externa para aumentar la carga docente. La consulta normativa no concede esa autorización.</p>}
      {patch.kind === 'enable_planning_window' && <p className="planning-rec__warning">Habilitar una franja requiere autorización externa; no se concede al simular ni aplicar.</p>}
      <AdviceDisclosure label="Por qué se recomienda"><MessageResponse>{recommendation.rationale}</MessageResponse></AdviceDisclosure>
      <details className="planning-rec__details">
        <summary>Ver cambios exactos ({details.length})</summary>
        <ul>{details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
        {patch.kind === 'enable_planning_window' && <p>Se conserva la disponibilidad de docentes y ambientes.</p>}
      </details>
    </div>
  </article>
}
