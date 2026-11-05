import type { CourseDemand } from './programacion-academica.types.js'

/** Independently constructed examples, not derived from snapshots or student records.
 * Local FISI planning demonstration only; not an official course catalog or demand.
 * Each call returns new objects. Nothing registers these in enrollment scenarios.
 */
export function createSyntheticCourseDemands(): CourseDemand[] {
  return [
    { courseId: 'SYN-PLANNING-A', estimatedDemand: 70, targetCapacity: 30 },
    { courseId: 'SYN-PLANNING-B', estimatedDemand: 60, targetCapacity: 30 },
    { courseId: 'SYN-PLANNING-C', estimatedDemand: 0, targetCapacity: 30 },
  ]
}
