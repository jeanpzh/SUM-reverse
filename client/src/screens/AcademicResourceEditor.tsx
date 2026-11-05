import { useMemo, useState } from 'react'
import type { AcademicCatalog } from '../data/academicScheduling'
import { filterAcademicResources, PLANNING_LIMITS } from '../data/academicScheduling'
import type { AcademicPlanningResources, AcademicTeacherResource, AcademicRoomResource, AcademicInterval } from '../../../shared/programacion-academica-api.mjs'

type Props = {
  catalog: AcademicCatalog
  resources: AcademicPlanningResources
  onChange: (resources: AcademicPlanningResources) => void
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function timeValue(minute: number) {
  if (!Number.isFinite(minute)) return ''
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

function timeMinute(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function nextId(prefix: string, current: Array<{ id: string }>) {
  let index = current.length + 1
  while (current.some((item) => item.id === `${prefix}-LOCAL-${index}`)) index += 1
  return `${prefix}-LOCAL-${index}`
}

function updateInterval(intervals: AcademicInterval[], index: number, patch: Partial<AcademicInterval>) {
  return intervals.map((interval, itemIndex) => itemIndex === index ? { ...interval, ...patch } : interval)
}

function cloneResources(resources: AcademicPlanningResources): AcademicPlanningResources {
  return {
    teachers: resources.teachers.map((teacher) => ({ ...teacher, courseIds: [...teacher.courseIds],
      availability: teacher.availability.map((interval) => ({ ...interval })),
      ...(teacher.preferences ? { preferences: teacher.preferences.map((interval) => ({ ...interval })) } : {}),
      ...(teacher.sectionLimits ? { sectionLimits: teacher.sectionLimits.map((limit) => ({ ...limit })) } : {}) })),
    rooms: resources.rooms.map((room) => ({ ...room, availability: room.availability.map((interval) => ({ ...interval })) })),
  }
}

export function AcademicResourceEditor({ catalog, resources, onChange }: Props) {
  const [activeTeacherId, setActiveTeacherId] = useState(resources.teachers[0]?.id ?? '')
  const [activeRoomId, setActiveRoomId] = useState(resources.rooms[0]?.id ?? '')
  const [courseSearch, setCourseSearch] = useState('')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teacherIdError, setTeacherIdError] = useState('')
  const [roomIdError, setRoomIdError] = useState('')
  const [teacherReferenceIds, setTeacherReferenceIds] = useState<Record<string, string>>(() => Object.fromEntries(
    resources.teachers.flatMap((teacher) => catalog.referenceTeachers?.some((reference) => reference.id === teacher.id)
      ? [[teacher.id, teacher.id]] : [])))
  const [roomReferenceIds, setRoomReferenceIds] = useState<Record<string, string>>(() => Object.fromEntries(
    resources.rooms.flatMap((room) => catalog.referenceRooms?.some((reference) => reference.id === room.id)
      ? [[room.id, room.id]] : [])))
  const selectedTeacher = resources.teachers.find((teacher) => teacher.id === activeTeacherId) ?? resources.teachers[0]
  const selectedRoom = resources.rooms.find((room) => room.id === activeRoomId) ?? resources.rooms[0]
  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLocaleLowerCase('es')
    return catalog.courses.filter((course) => !query || `${course.courseId} ${course.name}`.toLocaleLowerCase('es').includes(query))
  }, [catalog.courses, courseSearch])
  const filteredReferenceTeachers = useMemo(() => filterAcademicResources(catalog.referenceTeachers ?? [], teacherSearch), [catalog.referenceTeachers, teacherSearch])
  const filteredActiveTeachers = useMemo(() => filterAcademicResources(resources.teachers, teacherSearch), [resources.teachers, teacherSearch])

  const commit = (update: (draft: AcademicPlanningResources) => void) => {
    const draft = cloneResources(resources)
    update(draft)
    onChange(draft)
  }
  const changeTeacher = (patch: Partial<AcademicTeacherResource>) => {
    if (!selectedTeacher) return
    const oldId = selectedTeacher.id
    if (patch.id !== undefined && patch.id !== oldId) {
      if (resources.teachers.some((teacher) => teacher.id !== oldId && teacher.id === patch.id)) {
        setTeacherIdError('Esa identificación ya está asignada a otro docente.')
        return
      }
      setTeacherIdError('')
      setTeacherReferenceIds((current) => Object.fromEntries(Object.entries(current).map(([id, refId]) => [id === oldId ? patch.id! : id, refId])))
      setActiveTeacherId(patch.id)
    }
    commit((draft) => { draft.teachers = draft.teachers.map((teacher) => teacher.id === oldId ? { ...teacher, ...patch } : teacher) })
  }
  const changeRoom = (patch: Partial<AcademicRoomResource>) => {
    if (!selectedRoom) return
    const oldId = selectedRoom.id
    if (patch.id !== undefined && patch.id !== oldId) {
      if (resources.rooms.some((room) => room.id !== oldId && room.id === patch.id)) {
        setRoomIdError('Esa identificación ya está asignada a otro ambiente.')
        return
      }
      setRoomIdError('')
      setRoomReferenceIds((current) => Object.fromEntries(Object.entries(current).map(([id, refId]) => [id === oldId ? patch.id! : id, refId])))
      setActiveRoomId(patch.id)
    }
    commit((draft) => { draft.rooms = draft.rooms.map((room) => room.id === oldId ? { ...room, ...patch } : room) })
  }
  const addTeacher = () => {
    if (resources.teachers.length >= PLANNING_LIMITS.teachers) return
    const teacher: AcademicTeacherResource = { id: nextId('DOC', resources.teachers), name: 'Docente de demostración', courseIds: [], maxWeeklyMinutes: 600,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) }
    commit((draft) => { draft.teachers.push(teacher) })
    setTeacherIdError('')
    setActiveTeacherId(teacher.id)
  }
  const selectReferenceTeacher = (id: string) => {
    if (!id) return
    const existingId = Object.entries(teacherReferenceIds).find(([, referenceId]) => referenceId === id)?.[0]
      ?? resources.teachers.find((teacher) => teacher.id === id)?.id
    if (existingId !== undefined) { setTeacherIdError(''); setActiveTeacherId(existingId); return }
    const reference = catalog.referenceTeachers?.find((teacher) => teacher.id === id)
    if (!reference || resources.teachers.length >= PLANNING_LIMITS.teachers) return
    const teacher: AcademicTeacherResource = { ...reference, courseIds: [...reference.courseIds], maxWeeklyMinutes: 600,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) }
    commit((draft) => { draft.teachers.push(teacher) })
    setTeacherReferenceIds((current) => ({ ...current, [teacher.id]: id }))
    setTeacherIdError('')
    setActiveTeacherId(teacher.id)
  }
  const addRoom = (kind: 'classroom' | 'laboratory' = 'classroom') => {
    if (resources.rooms.length >= PLANNING_LIMITS.rooms) return
    const room: AcademicRoomResource = { id: nextId('AULA', resources.rooms), name: kind === 'laboratory' ? 'Laboratorio de demostración' : 'Aula de demostración', capacity: 45, kind,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) }
    commit((draft) => { draft.rooms.push(room) })
    setRoomIdError('')
    setActiveRoomId(room.id)
  }
  const selectReferenceRoom = (id: string) => {
    if (!id) return
    const existingId = Object.entries(roomReferenceIds).find(([, referenceId]) => referenceId === id)?.[0]
      ?? resources.rooms.find((room) => room.id === id)?.id
    if (existingId !== undefined) { setRoomIdError(''); setActiveRoomId(existingId); return }
    const reference = catalog.referenceRooms?.find((room) => room.id === id)
    if (!reference || resources.rooms.length >= PLANNING_LIMITS.rooms) return
    const room: AcademicRoomResource = { id: reference.id, name: reference.name, capacity: reference.capacity, kind: reference.kind,
      availability: [1, 2, 3, 4, 5].map((day) => ({ day, startMinute: 480, endMinute: 1320 })) }
    commit((draft) => { draft.rooms.push(room) })
    setRoomReferenceIds((current) => ({ ...current, [room.id]: id }))
    setRoomIdError('')
    setActiveRoomId(room.id)
  }
  const removeTeacher = () => {
    if (!selectedTeacher) return
    const remaining = resources.teachers.filter((teacher) => teacher.id !== selectedTeacher.id)
    commit((draft) => { draft.teachers = remaining })
    setTeacherReferenceIds((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== selectedTeacher.id)))
    setActiveTeacherId(remaining[0]?.id ?? '')
  }
  const removeRoom = () => {
    if (!selectedRoom) return
    const remaining = resources.rooms.filter((room) => room.id !== selectedRoom.id)
    commit((draft) => { draft.rooms = remaining })
    setRoomReferenceIds((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== selectedRoom.id)))
    setActiveRoomId(remaining[0]?.id ?? '')
  }

  return <div className="academic-scheduling__resource-editor">
    <div className="academic-scheduling__editor-heading">
      <div><h4>Docentes disponibles</h4>
        <p>Las habilitaciones de referencia son supuestos de demostración, no confirmaciones para el nuevo periodo.</p></div>
      <div className="academic-scheduling__editor-actions">
        <input type="search" aria-label="Buscar docentes por nombre o código" placeholder="Buscar docente por nombre o código" value={teacherSearch} onChange={(event) => setTeacherSearch(event.currentTarget.value)} />
        <select aria-label="Seleccionar o agregar docente" value="" onChange={(event) => selectReferenceTeacher(event.currentTarget.value)}>
          <option value="">Seleccionar o agregar docente…</option>
          {!filteredReferenceTeachers.length && <option value="" disabled>Sin docentes que coincidan</option>}
          {filteredReferenceTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}
            disabled={resources.teachers.length >= PLANNING_LIMITS.teachers && !Object.values(teacherReferenceIds).includes(teacher.id) && !resources.teachers.some((item) => item.id === teacher.id)}>{teacher.name} · {teacher.id}</option>)}
        </select>
        <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary" onClick={addTeacher} disabled={resources.teachers.length >= PLANNING_LIMITS.teachers}>Agregar demostración</button>
      </div>
    </div>
    <div className="academic-scheduling__resource-roster" aria-label="Docentes incorporados">
      {filteredActiveTeachers.map((teacher) => <button type="button" key={teacher.id} aria-pressed={selectedTeacher?.id === teacher.id}
        className="academic-scheduling__roster-item" onClick={() => { setTeacherIdError(''); setActiveTeacherId(teacher.id) }}>
        {teacher.name} <span>{teacher.id}</span>
      </button>)}
      {!filteredActiveTeachers.length && <p className="academic-scheduling__resource-note">{resources.teachers.length ? 'No hay docentes que coincidan con la búsqueda.' : 'Sin docentes incorporados.'}</p>}
    </div>
    {selectedTeacher && <article className="academic-scheduling__resource-card academic-scheduling__resource-card--teacher">
      <div className="academic-scheduling__resource-card-heading"><strong>{teacherReferenceIds[selectedTeacher.id] ? 'Docente de referencia · no confirmado para el nuevo periodo' : 'Docente de demostración'}</strong>
        <button type="button" className="academic-scheduling__text-button" aria-label={`Quitar docente ${selectedTeacher.name || selectedTeacher.id}`} onClick={removeTeacher}>Quitar</button></div>
      <div className="academic-scheduling__resource-fields">
        <label>Identificación<input aria-label="Identificación docente" aria-invalid={Boolean(teacherIdError)} value={selectedTeacher.id} onChange={(event) => changeTeacher({ id: event.currentTarget.value })} />
          {teacherIdError && <span role="alert" className="academic-scheduling__inline-error">{teacherIdError}</span>}</label>
        <label>Nombre<input aria-label="Nombre docente" value={selectedTeacher.name} onChange={(event) => changeTeacher({ name: event.currentTarget.value })} /></label>
        <label>Carga semanal máxima (minutos)<input type="number" min="0" max="10080" step="1" aria-label="Carga semanal docente"
          value={Number.isFinite(selectedTeacher.maxWeeklyMinutes) ? selectedTeacher.maxWeeklyMinutes : ''}
          onChange={(event) => changeTeacher({ maxWeeklyMinutes: event.currentTarget.value === '' ? Number.NaN : Number(event.currentTarget.value) })} /></label>
      </div>
      {selectedTeacher.qualificationSource === 'synthetic' && <p className="academic-scheduling__resource-note">Metadatos de habilitación locales sintéticos · {selectedTeacher.facultyId ?? 'sin facultad'} · categoría {selectedTeacher.category ?? 'sin especificar'}. No verifican afiliación ni categoría institucional.</p>}
      <fieldset className="academic-scheduling__course-eligibility"><legend>Asignaturas habilitadas · buscar y seleccionar</legend>
        <input type="search" aria-label="Buscar asignatura habilitada" placeholder="Buscar por código o nombre" value={courseSearch} onChange={(event) => setCourseSearch(event.currentTarget.value)} />
        <div className="academic-scheduling__course-options">{filteredCourses.map((course) => <label key={course.courseId}><input type="checkbox" checked={selectedTeacher.courseIds.includes(course.courseId)}
          aria-label={`${selectedTeacher.name || 'Docente'} habilitado para ${course.courseId}`}
          onChange={(event) => changeTeacher({ courseIds: event.currentTarget.checked
            ? [...new Set([...selectedTeacher.courseIds, course.courseId])]
            : selectedTeacher.courseIds.filter((courseId) => courseId !== course.courseId) })} />{course.courseId} · {course.name}</label>)}</div>
        <div className="academic-scheduling__course-chips" aria-label="Asignaturas habilitadas">
          {selectedTeacher.courseIds.map((id) => <span className="academic-scheduling__chip" key={id}>{id}
            {catalog.courses.some((course) => course.courseId === id) && <button type="button" aria-label={`Quitar habilitación ${id}`}
              onClick={() => changeTeacher({ courseIds: selectedTeacher.courseIds.filter((courseId) => courseId !== id) })}>×</button>}
          </span>)}
          {!selectedTeacher.courseIds.length && <span className="academic-scheduling__resource-note">Sin asignaturas habilitadas.</span>}
        </div>
        {selectedTeacher.courseIds.filter((id) => !catalog.courses.some((course) => course.courseId === id)).map((id) => <span key={id}>{id} · habilitación conservada fuera del catálogo visible</span>)}
      </fieldset>
      <fieldset className="academic-scheduling__course-limits"><legend>Máximo de secciones por asignatura (opcional)</legend>
        {selectedTeacher.courseIds.filter((id) => catalog.courses.some((course) => course.courseId === id)).map((id) => {
          const limit = selectedTeacher.sectionLimits?.find((item) => item.courseId === id)?.maxSections
          return <label key={id}>{id} · {catalog.courses.find((course) => course.courseId === id)?.name}
            <input type="number" min="0" max="128" step="1" placeholder="Sin límite adicional" aria-label={`Máximo de secciones ${id}`}
              value={limit === undefined ? '' : Number.isFinite(limit) ? limit : ''} onChange={(event) => {
                const limits = selectedTeacher.sectionLimits?.filter((item) => item.courseId !== id) ?? []
                if (event.currentTarget.value !== '') limits.push({ courseId: id, maxSections: Number(event.currentTarget.value) })
                changeTeacher({ sectionLimits: limits.length ? limits : undefined })
              }} />
          </label>
        })}
        {!selectedTeacher.courseIds.length && <span>Agrega asignaturas habilitadas para configurar sus límites.</span>}
      </fieldset>
      <AvailabilityEditor label="Disponibilidad docente" intervals={selectedTeacher.availability} onChange={(availability) => changeTeacher({ availability })} />
      <AvailabilityEditor label="Preferencias semanales · prioridad blanda" intervals={selectedTeacher.preferences ?? []}
        onChange={(preferences) => changeTeacher({ preferences: preferences.length ? preferences : undefined })} />
      <p className="academic-scheduling__resource-note">Las preferencias ordenan alternativas, no impiden horarios fuera de ellas. Una persona puede atender varias secciones si respeta carga y límites.</p>
    </article>}

    <div className="academic-scheduling__editor-heading academic-scheduling__editor-heading--rooms">
      <div><h4>Aulas y laboratorios</h4><p>El tipo identifica el recurso; no agrega requisitos de equipamiento por sesión. La disponibilidad editable es sintética.</p></div>
      <div className="academic-scheduling__editor-actions">
        <select aria-label="Seleccionar o agregar ambiente" value="" onChange={(event) => selectReferenceRoom(event.currentTarget.value)}>
          <option value="">Seleccionar o agregar ambiente…</option>
          {(catalog.referenceRooms ?? []).map((room) => <option key={room.id} value={room.id}
            disabled={resources.rooms.length >= PLANNING_LIMITS.rooms && !Object.values(roomReferenceIds).includes(room.id) && !resources.rooms.some((item) => item.id === room.id)}>{room.id} · {room.name} · {room.pavilion}</option>)}
        </select>
        <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary" onClick={() => addRoom()} disabled={resources.rooms.length >= PLANNING_LIMITS.rooms}>Agregar aula</button>
        <button type="button" className="academic-scheduling__button academic-scheduling__button--secondary" onClick={() => addRoom('laboratory')} disabled={resources.rooms.length >= PLANNING_LIMITS.rooms}>Agregar laboratorio</button>
      </div>
    </div>
    {catalog.referenceRooms && <details className="academic-scheduling__reference-rooms">
      <summary>Catálogo de referencia · {catalog.referenceRooms.length} ambientes (AP: {catalog.referenceRooms.filter((room) => room.pavilion === 'AP').length}, NP: {catalog.referenceRooms.filter((room) => room.pavilion === 'NP').length})</summary>
      <p>Listado de referencia proporcionado para esta demo. Capacidad inicial: 45. La disponibilidad no está confirmada y no proviene del historial.</p>
      <ul>{catalog.referenceRooms.map((room) => <li key={room.id}>{room.id} · {room.name} · {room.kind === 'laboratory' ? 'Laboratorio' : 'Aula'} · {room.pavilion} · capacidad {room.capacity}</li>)}</ul>
    </details>}
    <div className="academic-scheduling__resource-roster" aria-label="Ambientes incorporados">
      {resources.rooms.map((room) => <button type="button" key={room.id} aria-pressed={selectedRoom?.id === room.id}
        className="academic-scheduling__roster-item" onClick={() => { setRoomIdError(''); setActiveRoomId(room.id) }}>{room.name} <span>{room.id}</span></button>)}
      {!resources.rooms.length && <p className="academic-scheduling__resource-note">Sin ambientes incorporados.</p>}
    </div>
    {selectedRoom && <article className="academic-scheduling__resource-card academic-scheduling__resource-card--room">
      <div className="academic-scheduling__resource-card-heading"><strong>{selectedRoom.kind === 'laboratory' ? 'Laboratorio' : 'Aula'}{roomReferenceIds[selectedRoom.id] ? ' · referencia sintética' : ''}</strong>
        <button type="button" className="academic-scheduling__text-button" aria-label={`Quitar ambiente ${selectedRoom.name || selectedRoom.id}`} onClick={removeRoom}>Quitar</button></div>
      <div className="academic-scheduling__resource-fields">
        <label>Identificación<input aria-label="Identificación ambiente" aria-invalid={Boolean(roomIdError)} value={selectedRoom.id} onChange={(event) => changeRoom({ id: event.currentTarget.value })} />
          {roomIdError && <span role="alert" className="academic-scheduling__inline-error">{roomIdError}</span>}</label>
        <label>Nombre<input aria-label="Nombre ambiente" value={selectedRoom.name} onChange={(event) => changeRoom({ name: event.currentTarget.value })} /></label>
        <label>Tipo<select aria-label="Tipo ambiente" value={selectedRoom.kind ?? 'classroom'} onChange={(event) => changeRoom({ kind: event.currentTarget.value as 'classroom' | 'laboratory' })}>
          <option value="classroom">Aula</option><option value="laboratory">Laboratorio</option></select></label>
        <label>Capacidad<input type="number" min="1" step="1" aria-label="Capacidad ambiente" value={Number.isFinite(selectedRoom.capacity) ? selectedRoom.capacity : ''}
          onChange={(event) => changeRoom({ capacity: event.currentTarget.value === '' ? Number.NaN : Number(event.currentTarget.value) })} /></label>
      </div>
      <AvailabilityEditor label="Disponibilidad del ambiente" intervals={selectedRoom.availability} onChange={(availability) => changeRoom({ availability })} />
    </article>}
  </div>
}

function AvailabilityEditor({ label, intervals, onChange }: { label: string; intervals: AcademicInterval[]; onChange: (value: AcademicInterval[]) => void }) {
  const patch = (index: number, change: Partial<AcademicInterval>) => onChange(updateInterval(intervals, index, change))
  return <fieldset className="academic-scheduling__availability"><legend>{label} · máximo 32 intervalos</legend>
    {intervals.map((interval, index) => <div className="academic-scheduling__availability-row" key={`${label}-${index}`}>
      <label>Día<select aria-label={`${label} día ${index + 1}`} value={interval.day} onChange={(event) => patch(index, { day: Number(event.currentTarget.value) })}>
        {DAYS.map((day, dayIndex) => <option key={day} value={dayIndex + 1}>{day}</option>)}</select></label>
      <label>Inicio<input type="time" aria-label={`${label} inicio ${index + 1}`} value={timeValue(interval.startMinute)} onChange={(event) => patch(index, { startMinute: timeMinute(event.currentTarget.value) })} /></label>
      <label>Fin<input type="time" aria-label={`${label} fin ${index + 1}`} value={timeValue(interval.endMinute)} onChange={(event) => patch(index, { endMinute: timeMinute(event.currentTarget.value) })} /></label>
      <button type="button" className="academic-scheduling__text-button" aria-label={`Quitar ${label} intervalo ${index + 1}`} onClick={() => onChange(intervals.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>
    </div>)}
    <button type="button" className="academic-scheduling__text-button" disabled={intervals.length >= 32}
      onClick={() => onChange([...intervals, { day: 1, startMinute: 480, endMinute: 1020 }])}>Agregar intervalo</button>
  </fieldset>
}
