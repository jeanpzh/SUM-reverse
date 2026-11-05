import type { AcademicSchedule } from './schedule.types.js'

/** Independently authored synthetic weekly schedule; not derived from any exports. */
export function createSyntheticSchedule(): AcademicSchedule {
  return {
    courses: ['SYN-PLANNING-A', 'SYN-PLANNING-B'],
    teachers: [
      { id: 'T1', courseIds: ['SYN-PLANNING-A', 'SYN-PLANNING-B'], maxWeeklyMinutes: 120,
        availability: [{ day: 1, startMinute: 480, endMinute: 720 }] },
      { id: 'T2', courseIds: ['SYN-PLANNING-A', 'SYN-PLANNING-B'], maxWeeklyMinutes: 120,
        availability: [{ day: 1, startMinute: 480, endMinute: 720 }] },
    ],
    rooms: [
      { id: 'R1', capacity: 30, availability: [{ day: 1, startMinute: 480, endMinute: 720 }] },
      { id: 'R2', capacity: 30, availability: [{ day: 1, startMinute: 480, endMinute: 720 }] },
    ],
    sections: [
      { id: 'S1', courseId: 'SYN-PLANNING-A', capacity: 30 },
      { id: 'S2', courseId: 'SYN-PLANNING-B', capacity: 30 },
    ],
    assignments: [
      { id: 'A1', sectionId: 'S1', teacherId: 'T1', roomId: 'R1', interval: { day: 1, startMinute: 540, endMinute: 600 } },
      { id: 'A2', sectionId: 'S2', teacherId: 'T2', roomId: 'R2', interval: { day: 1, startMinute: 600, endMinute: 660 } },
    ],
    compatibleGroups: [{ id: 'G1', courseIds: ['SYN-PLANNING-A', 'SYN-PLANNING-B'] }],
  }
}
