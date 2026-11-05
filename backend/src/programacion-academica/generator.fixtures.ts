import type { GeneratorInput } from './generator.types.js'

/** Independent synthetic example: 31 students require two 30-seat sections, two meetings each. */
export function createSyntheticGeneratorInput(): GeneratorInput {
  return {
    courses: [{ courseId: 'SYN-GEN-A', estimatedDemand: 31, targetCapacity: 30,
      weeklySessions: [{ id: 'first', durationMinutes: 60 }, { id: 'second', durationMinutes: 60 }] }],
    teachers: [{ id: 'T1', courseIds: ['SYN-GEN-A'], maxWeeklyMinutes: 240,
      availability: [{ day: 1, startMinute: 540, endMinute: 780 }] }],
    rooms: [{ id: 'R1', capacity: 30, availability: [{ day: 1, startMinute: 540, endMinute: 780 }] }],
    compatibleGroups: [], windows: [{ day: 1, startMinute: 540, endMinute: 780 }],
    startStepMinutes: 60, maxExplorations: 100,
  }
}
