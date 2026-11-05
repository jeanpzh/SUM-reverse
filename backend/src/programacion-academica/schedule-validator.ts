import type { AcademicSchedule, ScheduleIssue, ScheduleValidation, TimeInterval } from './schedule.types.js'

type Row = Record<string, unknown>
const record = (value: unknown): value is Row => value !== null && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const interval = (value: unknown): value is TimeInterval => record(value)
  && Object.keys(value).length === 3 && integer(value.day, 1, 7)
  && integer(value.startMinute, 0, 1439) && integer(value.endMinute, 1, 1440)
  && Number(value.startMinute) < Number(value.endMinute)

/** Half-open intervals: an end at 10:00 does not overlap a start at 10:00. */
export function intervalsOverlap(left: unknown, right: unknown): boolean {
  if (!interval(left) || !interval(right)) throw new TypeError('interval: día o minutos inválidos')
  return overlaps(left, right)
}

function overlaps(left: TimeInterval, right: TimeInterval): boolean {
  return left.day === right.day && left.startMinute < right.endMinute && right.startMinute < left.endMinute
}

function covers(windows: TimeInterval[], session: TimeInterval): boolean {
  let end = session.startMinute
  for (const window of windows.filter((item) => item.day === session.day).sort((a, b) => a.startMinute - b.startMinute)) {
    if (window.endMinute <= end) continue
    if (window.startMinute > end) return false
    end = window.endMinute
    if (end >= session.endMinute) return true
  }
  return false
}

/** Shape validation precedes resource/rule checks; no coercion or input mutation. */
export function validateAcademicSchedule(value: unknown): ScheduleValidation {
  const issues: ScheduleIssue[] = []
  const add = (code: ScheduleIssue['code'], resourceType: ScheduleIssue['resourceType'], resourceId: string | null,
    assignmentIds: string[], message: string, field: string | null = null) => {
    issues.push({ code, resourceType, resourceId, assignmentIds, field, message })
  }
  const invalid = (field: string, message: string) => add('INVALID_INPUT', 'input', null, [], message, field)
  const exact = (item: unknown, fields: string[], path: string, optionalFields: string[] = []): item is Row => {
    if (!record(item)) { invalid(path, 'Se esperaba un objeto plano'); return false }
    for (const key of fields) if (!Object.hasOwn(item, key)) invalid(`${path}.${key}`, 'Campo obligatorio')
    for (const key of Object.keys(item)) if (!fields.includes(key) && !optionalFields.includes(key)) invalid(`${path}.${key}`, 'Campo no permitido')
    return true
  }
  const ids = (item: unknown, path: string) => {
    if (!Array.isArray(item) || !Array.from(item).every(id)) invalid(path, 'Se esperaba una lista de identificadores no vacíos')
    else if (new Set(item).size !== item.length) invalid(path, 'Identificadores repetidos')
  }
  const availability = (item: unknown, path: string) => {
    if (!Array.isArray(item)) invalid(path, 'Se esperaba una lista de disponibilidades')
    else Array.from(item).forEach((window, index) => { if (!interval(window)) invalid(`${path}[${index}]`, 'Intervalo inválido') })
  }
  const fields = ['courses', 'teachers', 'rooms', 'sections', 'assignments', 'compatibleGroups']
  if (!exact(value, fields, 'schedule')) return { valid: false, issues }
  ids(value.courses, 'courses')
  const catalogs: Array<[string, string[]]> = [
    ['teachers', ['id', 'courseIds', 'availability', 'maxWeeklyMinutes']],
    ['rooms', ['id', 'capacity', 'availability']], ['sections', ['id', 'courseId', 'capacity']],
    ['assignments', ['id', 'sectionId', 'teacherId', 'roomId', 'interval']], ['compatibleGroups', ['id', 'courseIds']],
  ]
  for (const [key, shape] of catalogs) {
    const rows = value[key]
    if (!Array.isArray(rows)) { invalid(key, 'Se esperaba una lista'); continue }
    const seen = new Set<string>()
    Array.from(rows).forEach((row: unknown, index: number) => {
      const path = `${key}[${index}]`
      if (!exact(row, shape, path, key === 'teachers' ? ['preferences', 'sectionLimits'] : [])) return
      for (const field of shape.filter((name) => name === 'id' || name.endsWith('Id'))) {
        if (!id(row[field])) invalid(`${path}.${field}`, 'Identificador inválido')
      }
      if (id(row.id)) {
        if (seen.has(row.id)) invalid(`${path}.id`, 'Identificador repetido')
        seen.add(row.id)
      }
      if (shape.includes('courseIds')) ids(row.courseIds, `${path}.courseIds`)
      if (shape.includes('availability')) availability(row.availability, `${path}.availability`)
      if (key === 'teachers') {
        if (row.preferences !== undefined) {
          if (!Array.isArray(row.preferences) || row.preferences.length > 32) invalid(`${path}.preferences`, 'Se requieren hasta 32 preferencias')
          else availability(row.preferences, `${path}.preferences`)
        }
        if (row.sectionLimits !== undefined) {
          if (!Array.isArray(row.sectionLimits) || row.sectionLimits.length > 128) invalid(`${path}.sectionLimits`, 'Se requieren hasta 128 límites por curso')
          else {
            const seenCourses = new Set<string>()
            row.sectionLimits.forEach((limit, limitIndex) => {
              const limitPath = `${path}.sectionLimits[${limitIndex}]`
              if (!exact(limit, ['courseId', 'maxSections'], limitPath)) return
              if (!id(limit.courseId)) invalid(`${limitPath}.courseId`, 'Identificador inválido')
              if (!integer(limit.maxSections, 0, 128)) invalid(`${limitPath}.maxSections`, 'El límite debe ser un entero entre 0 y 128')
              if (id(limit.courseId)) {
                if (seenCourses.has(limit.courseId)) invalid(`${limitPath}.courseId`, 'Límite de curso repetido')
                seenCourses.add(limit.courseId)
              }
            })
          }
        }
      }
      if (shape.includes('capacity') && !integer(row.capacity, 1)) invalid(`${path}.capacity`, 'Capacidad entera mayor que cero requerida')
      if (shape.includes('maxWeeklyMinutes') && !integer(row.maxWeeklyMinutes, 0)) invalid(`${path}.maxWeeklyMinutes`, 'Carga máxima entera no negativa requerida')
      if (shape.includes('interval') && !interval(row.interval)) invalid(`${path}.interval`, 'Intervalo inválido')
    })
  }
  if (issues.length) return { valid: false, issues }
  // All fields have passed runtime shape validation above.
  const schedule = value as unknown as AcademicSchedule
  const courses = new Set(schedule.courses)
  const teachers = new Map(schedule.teachers.map((item) => [item.id, item]))
  const rooms = new Map(schedule.rooms.map((item) => [item.id, item]))
  const sections = new Map(schedule.sections.map((item) => [item.id, item]))
  const missing = (type: ScheduleIssue['resourceType'], resourceId: string, assignments: string[], field: string) =>
    add('RESOURCE_NOT_FOUND', type, resourceId, assignments, 'La referencia no existe en el catálogo', field)
  for (const section of schedule.sections) {
    if (!courses.has(section.courseId)) missing('course', section.courseId, [], `sections.${section.id}.courseId`)
  }
  for (const owner of [...schedule.teachers, ...schedule.compatibleGroups]) {
    for (const courseId of owner.courseIds) if (!courses.has(courseId)) missing('course', courseId, [], `${owner.id}.courseIds`)
  }
  for (const teacher of schedule.teachers) for (const limit of teacher.sectionLimits ?? []) {
    if (!courses.has(limit.courseId)) missing('course', limit.courseId, [], `${teacher.id}.sectionLimits.${limit.courseId}`)
  }
  for (const assignment of schedule.assignments) {
    const { id: assignmentId, sectionId, teacherId, roomId } = assignment
    const section = sections.get(sectionId)
    const teacher = teachers.get(teacherId)
    const room = rooms.get(roomId)
    if (!section) missing('section', sectionId, [assignmentId], `assignments.${assignmentId}.sectionId`)
    if (!teacher) missing('teacher', teacherId, [assignmentId], `assignments.${assignmentId}.teacherId`)
    if (!room) missing('room', roomId, [assignmentId], `assignments.${assignmentId}.roomId`)
    if (room && section && room.capacity < section.capacity) add('ROOM_CAPACITY', 'room', roomId, [assignmentId], 'El aula tiene menos plazas que la sección')
    if (teacher && !covers(teacher.availability, assignment.interval)) add('TEACHER_UNAVAILABLE', 'teacher', teacherId, [assignmentId], 'La sesión no está cubierta por la disponibilidad docente')
    if (room && !covers(room.availability, assignment.interval)) add('ROOM_UNAVAILABLE', 'room', roomId, [assignmentId], 'La sesión no está cubierta por la disponibilidad del aula')
    if (teacher && section && !teacher.courseIds.includes(section.courseId)) add('TEACHER_NOT_QUALIFIED', 'teacher', teacherId, [assignmentId], 'El docente no está habilitado para este curso')
  }
  for (const teacher of schedule.teachers) {
    const sessions = schedule.assignments.filter((item) => item.teacherId === teacher.id)
    const minutes = sessions.reduce((total, item) => total + item.interval.endMinute - item.interval.startMinute, 0)
    if (minutes > teacher.maxWeeklyMinutes) add('TEACHER_LOAD_EXCEEDED', 'teacher', teacher.id, sessions.map((item) => item.id), `Carga semanal ${minutes} minutos; máximo ${teacher.maxWeeklyMinutes}`)
    const sectionIdsByCourse = new Map<string, Set<string>>()
    for (const session of sessions) {
      const courseId = sections.get(session.sectionId)?.courseId
      if (!courseId) continue
      const courseSections = sectionIdsByCourse.get(courseId) ?? new Set<string>()
      courseSections.add(session.sectionId)
      sectionIdsByCourse.set(courseId, courseSections)
    }
    for (const limit of teacher.sectionLimits ?? []) {
      const count = sectionIdsByCourse.get(limit.courseId)?.size ?? 0
      if (count > limit.maxSections) add('TEACHER_SECTION_LIMIT', 'teacher', teacher.id, sessions.filter((item) => sections.get(item.sectionId)?.courseId === limit.courseId).map((item) => item.id), `Secciones de ${limit.courseId}: ${count}; máximo ${limit.maxSections}`)
    }
  }
  for (let left = 0; left < schedule.assignments.length; left++) {
    const a = schedule.assignments[left]!
    for (let right = left + 1; right < schedule.assignments.length; right++) {
      const b = schedule.assignments[right]!
      if (!overlaps(a.interval, b.interval)) continue
      const pair = [a.id, b.id]
      if (a.teacherId === b.teacherId && teachers.has(a.teacherId)) add('TEACHER_CONFLICT', 'teacher', a.teacherId, pair, 'El docente tiene sesiones simultáneas')
      if (a.roomId === b.roomId && rooms.has(a.roomId)) add('ROOM_CONFLICT', 'room', a.roomId, pair, 'El aula tiene sesiones simultáneas')
      if (a.sectionId === b.sectionId && sections.has(a.sectionId)) add('SECTION_CONFLICT', 'section', a.sectionId, pair, 'La sección tiene sesiones simultáneas')
      const first = sections.get(a.sectionId)?.courseId
      const second = sections.get(b.sectionId)?.courseId
      if (first && second && first !== second) {
        for (const group of schedule.compatibleGroups) {
          if (group.courseIds.includes(first) && group.courseIds.includes(second)) add('COURSE_GROUP_CONFLICT', 'group', group.id, pair, 'Los cursos del grupo compatible tienen sesiones simultáneas')
        }
      }
    }
  }
  return { valid: issues.length === 0, issues }
}
