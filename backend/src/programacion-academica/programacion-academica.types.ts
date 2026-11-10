/** Local planning input, independent of enrollment and actual seat occupancy. */
export type CourseDemand = {
  courseId: string
  estimatedDemand: number
  targetCapacity: number
}

export type SectionEstimate = CourseDemand & {
  requiredSections: number
}
