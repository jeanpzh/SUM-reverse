import { describe, expect, it } from 'vitest'
import { scenarioProgrammingRows } from '../src/matricula-regular/scenario-reference.seed.js'
import { adaptSyntheticCatalog } from '../src/programacion-academica/synthetic-catalog-adapter.js'

describe('synthetic academic reference adapter', () => {
  it('groups all reference rows by course and section and retains every historical session', () => {
    const catalog = adaptSyntheticCatalog()
    const allSections = catalog.courses.flatMap((course) => course.history!.sections)
    const allSessions = allSections.flatMap((section) => section.sessions)

    expect(scenarioProgrammingRows).toHaveLength(165)
    expect(catalog.courses).toHaveLength(56)
    expect(allSections).toHaveLength(scenarioProgrammingRows.length)
    expect(allSessions).toHaveLength(scenarioProgrammingRows.reduce((count, row) => count + row.horarios.length, 0))
    expect(new Set(catalog.courses.map((course) => course.courseId)).size).toBe(56)
    expect(catalog.courses.every((course) => course.planningPatterns!.length > 0)).toBe(true)
    expect(catalog.source?.sourcePeriod).toMatch(/desconocido/i)
    expect(catalog.source?.planningPeriod).toMatch(/sintético/i)
    expect(catalog.teachers).toHaveLength(8)
    expect(catalog.teachers.every((teacher) => teacher.id.startsWith('REF-TEACHER-'))).toBe(true)
    expect(catalog.rooms.some((room) => room.kind === 'laboratory')).toBe(true)
    expect(catalog.referenceTeachers!.some((teacher) => teacher.courseIds.length > 1)).toBe(true)
    expect(catalog.referenceTeachers!.every((teacher) => teacher.name.trim().length > 0)).toBe(true)

    const output = JSON.stringify(catalog)
    const historyTeacherIds = new Set(allSessions.map((session) => session.teacherId))
    for (const row of scenarioProgrammingRows) {
      expect(historyTeacherIds.has(row.codDocente)).toBe(false)
    }
    expect(catalog.referenceTeachers!.every((teacher) => output.includes(teacher.name))).toBe(true)
  })

  it('keeps distinct duration and type sequences as separate patterns and returns isolated copies', () => {
    const catalog = adaptSyntheticCatalog()
    const variableCourse = catalog.courses.find((course) => course.planningPatterns!.length > 1)!
    const patternSignatures = variableCourse.planningPatterns!.map((pattern) => pattern.weeklySessions.map((session) => session.durationMinutes))

    expect(variableCourse).toBeDefined()
    expect(new Set(variableCourse.planningPatterns!.map((pattern) => pattern.id)).size).toBe(patternSignatures.length)
    expect(new Set(variableCourse.planningPatterns!.map((pattern) => pattern.label)).size).toBe(patternSignatures.length)
    expect(variableCourse.weeklySessions).toEqual(variableCourse.planningPatterns![0].weeklySessions)
    expect(variableCourse.history!.sections.flatMap((section) => section.sessions).length).toBeGreaterThan(0)

    variableCourse.history!.sections[0].sessions[0].room = 'mutated'
    catalog.rooms[0].availability[0].startMinute = 0
    catalog.windows[0].startMinute = 0
    catalog.teachers[0].availability[0].startMinute = 0
    const nextCatalog = adaptSyntheticCatalog()
    expect(nextCatalog.courses.find((course) => course.courseId === variableCourse.courseId)!.history!.sections[0].sessions[0].room).not.toBe('mutated')
    expect(nextCatalog.rooms[0].availability[0].startMinute).toBe(480)
    expect(nextCatalog.windows[0].startMinute).toBe(480)
    expect(nextCatalog.teachers[0].availability[0].startMinute).toBe(480)
  })

  it('rejects conflicting course metadata and malformed or ambiguous sessions instead of dropping them', () => {
    const conflicting = structuredClone(scenarioProgrammingRows)
    conflicting[1].creditos += 1
    expect(() => adaptSyntheticCatalog(conflicting)).toThrow(/Metadatos contradictorios/)

    const invalidTime = structuredClone(scenarioProgrammingRows)
    invalidTime[0].horarios[0].horaInicio = '08:60'
    expect(() => adaptSyntheticCatalog(invalidTime)).toThrow(/hora HH:mm/)

    const mismatchedSection = structuredClone(scenarioProgrammingRows)
    mismatchedSection[0].horarios[0].codSeccion += 1
    expect(() => adaptSyntheticCatalog(mismatchedSection)).toThrow(/ambiguas/)
  })

  it('does not attach a row teacher name to a different session teacher code', () => {
    const mismatchedTeacher = structuredClone(scenarioProgrammingRows)
    mismatchedTeacher[0].horarios[0].codDocente = 'SYNTHETIC-UNMATCHED-TEACHER'
    const catalog = adaptSyntheticCatalog(mismatchedTeacher)
    const session = catalog.courses.find((course) => course.courseId === mismatchedTeacher[0].codAsignatura)!
      .history!.sections.find((section) => section.sectionId === String(mismatchedTeacher[0].codSeccion))!.sessions[0]

    expect(session.teacherName).toBeUndefined()
    expect(session.teacherId).not.toContain('SYNTHETIC-UNMATCHED-TEACHER')
  })
})
