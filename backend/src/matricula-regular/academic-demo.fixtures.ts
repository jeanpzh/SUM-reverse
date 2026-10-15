import { createSyntheticFixture } from './fixtures.js'
import type { AcademicAttempt, AcademicCatalogCourse, ActorProfile, School, SyntheticFixture } from './profile.types.js'
import { validateSyntheticAcademicRecord } from './academic-demo.validation.js'

const courseNames: Record<School, readonly string[]> = {
  SISTEMAS: [
    'Matemática para Sistemas', 'Fundamentos de Computación', 'Comunicación Académica', 'Introducción a Sistemas',
    'Matemática Discreta', 'Programación Estructurada', 'Análisis de Sistemas', 'Organización de Computadoras',
    'Estructuras de Datos', 'Bases de Datos', 'Sistemas de Información', 'Redes de Computadoras',
    'Arquitectura de Sistemas', 'Gestión de Proyectos de Sistemas', 'Analítica de Datos', 'Sistemas Distribuidos',
  ],
  SOFTWARE: [
    'Matemática para Software', 'Fundamentos de Programación', 'Comunicación para Ingeniería', 'Introducción a Ingeniería de Software',
    'Lógica para Programación', 'Programación Orientada a Objetos', 'Ingeniería de Requisitos', 'Procesos de Software',
    'Diseño de Software', 'Construcción de Software', 'Pruebas de Software', 'Bases de Datos para Aplicaciones',
    'Arquitectura de Software', 'Gestión de Proyectos de Software', 'Calidad de Software', 'Desarrollo de Aplicaciones Web',
  ],
}

const grades: Record<School, Record<'A' | 'B', readonly number[]>> = {
  SISTEMAS: {
    A: [14, 15, 16, 17, 15, 16, 17, 18],
    B: [14, 15, 13, 16, 15, 14, 8, 9, 10],
  },
  SOFTWARE: {
    A: [16, 17, 18, 15, 17, 18, 16, 17],
    B: [12, 13, 14, 15, 14, 15, 7, 8, 9],
  },
}

function schoolFor(actor: ActorProfile): School {
  if (actor.scope.schoolId === 'SISTEMAS') return 'SISTEMAS'
  if (actor.scope.schoolId === 'SOFTWARE') return 'SOFTWARE'
  throw new TypeError('El perfil académico sintético requiere Sistemas o Software')
}

function suffixFor(actor: ActorProfile): 'A' | 'B' {
  if (actor.actorId.endsWith('-A')) return 'A'
  if (actor.actorId.endsWith('-B')) return 'B'
  throw new TypeError('El perfil académico sintético requiere un actor SYN A/B')
}

function courseId(school: School, number: number): string {
  return `SYN-${school === 'SISTEMAS' ? 'SIS' : 'SOFT'}-C${String(number).padStart(2, '0')}`
}

function createCatalog(actor: ActorProfile, school: School): AcademicCatalogCourse[] {
  const names = courseNames[school]
  return names.map((name, index) => {
    const number = index + 1
    const id = courseId(school, number)
    return {
      courseId: id,
      planId: actor.scope.planId,
      name,
      credits: 4,
      prerequisiteIds: number < 5 ? [] : [courseId(school, number - 4)],
      cycle: 1 + Math.floor(index / 4),
      courseType: number >= 15 ? 'elective' : 'mandatory',
    }
  })
}

function attemptCourseNumbers(suffix: 'A' | 'B'): number[] {
  return suffix === 'A' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8, 8]
}

function createAttempts(actor: ActorProfile, school: School, suffix: 'A' | 'B'): AcademicAttempt[] {
  const numbers = attemptCourseNumbers(suffix)
  return numbers.map((number, index) => {
    const period = index < 4 ? '2025-1' : index < 8 ? '2025-2' : '2026-1'
    const result = suffix === 'A' || number < 7 ? 'approved' : 'failed'
    const schoolCode = school === 'SISTEMAS' ? 'SIS' : 'SOFT'
    return {
      courseId: courseId(school, number),
      period,
      sectionNumber: 1,
      grade: grades[school][suffix][index]!,
      result,
      recordId: `SYN-ACTA-${schoolCode}-${suffix}-${String(index + 1).padStart(2, '0')}`,
    }
  })
}

function enrichActor(actor: ActorProfile): ActorProfile {
  const school = schoolFor(actor)
  const suffix = suffixFor(actor)
  const enriched: ActorProfile = {
    ...structuredClone(actor),
    academic: {
      seedRevision: 'PS-SEED-1',
      catalog: createCatalog(actor, school),
      attempts: createAttempts(actor, school, suffix),
    },
  }
  validateSyntheticAcademicRecord(enriched, enriched.academic)
  return enriched
}

export function createSyntheticAcademicDemoFixture(school: School): SyntheticFixture {
  const fixture = createSyntheticFixture(school)
  return {
    ...fixture,
    actors: fixture.actors.map(enrichActor),
  }
}
