import type { CourseDocument } from '../matricula-regular/profile.types.js'

/** Local planning input, independent of enrollment and actual seat occupancy. */
export type CourseDemand = {
  courseId: CourseDocument['courseId']
  estimatedDemand: number
  targetCapacity: number
}

export type SectionEstimate = CourseDemand & {
  requiredSections: number
}
