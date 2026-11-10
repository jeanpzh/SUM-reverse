import { useMemo } from 'react'
import { CalendarDays, Search, Table2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NativeSelect } from '../components/ui/NativeSelect'
import { aggregateAcademicBlocks, type AcademicProposal } from '../data/academicScheduling'

export function PlanningScheduleToolbar({ proposal, searchQuery, onSearchChange, teacherFilter, onTeacherFilterChange, viewMode, onToggleView }: {
  proposal: AcademicProposal
  searchQuery: string
  onSearchChange: (value: string) => void
  teacherFilter: string
  onTeacherFilterChange: (value: string) => void
  viewMode: 'tabla' | 'semana'
  onToggleView: (value: 'tabla' | 'semana') => void
}) {
  const { teachers, unassigned } = useMemo(() => {
    const blocks = aggregateAcademicBlocks(proposal)
    const byTeacher = new Map<string, { id: string; name: string; sections: Set<string> }>()
    for (const block of blocks) {
      const teacher = byTeacher.get(block.teacherId) ?? { id: block.teacherId, name: block.teacherName, sections: new Set<string>() }
      teacher.sections.add(block.sectionId)
      byTeacher.set(teacher.id, teacher)
    }
    const assigned = new Set(blocks.map((block) => block.sectionId))
    return {
      teachers: [...byTeacher.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      unassigned: proposal.sections.filter((section) => !assigned.has(section.sectionId)).length,
    }
  }, [proposal])

  return <div className="planning-schedule-toolbar">
    <div className="planning-schedule-toolbar__search">
      <Search size={16} aria-hidden="true" />
      <Input type="search" placeholder="Buscar por curso, sección o recurso…" aria-label="Buscar secciones"
        value={searchQuery} onChange={(event) => onSearchChange(event.currentTarget.value)} />
    </div>
    <div className="planning-schedule-toolbar__teacher">
      <NativeSelect aria-label="Filtrar por docente" value={teacherFilter} onChange={(event) => onTeacherFilterChange(event.currentTarget.value)}>
        <option value="all">Todos los docentes ({teachers.length})</option>
        {unassigned > 0 && <option value="__unassigned__">Sin docente asignado / Pendientes ({unassigned})</option>}
        {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.sections.size})</option>)}
      </NativeSelect>
    </div>
    <div className="planning-sections__view-toggle" role="group" aria-label="Vista">
      <Button variant="ghost" type="button" aria-pressed={viewMode === 'tabla'} onClick={() => onToggleView('tabla')}><Table2 aria-hidden="true" />Tabla</Button>
      <Button variant="ghost" type="button" aria-pressed={viewMode === 'semana'} onClick={() => onToggleView('semana')}><CalendarDays aria-hidden="true" />Semana</Button>
    </div>
  </div>
}
