export interface WeekLayoutItem {
  id: string
  startMinute: number
  endMinute: number
}

export interface WeekItemLayout {
  lane: number
  totalLanes: number
  leftPercent: number
  widthPercent: number
}

/**
 * Computes deterministic non-overlapping column lanes for same-day calendar blocks.
 * Overlapping blocks are partitioned into connected clusters, and each block is assigned
 * a lane (column index) such that no two overlapping blocks share the same lane.
 */
export function computeWeekDayLayout<T extends WeekLayoutItem>(
  items: T[]
): Map<string, WeekItemLayout> {
  const result = new Map<string, WeekItemLayout>()
  if (items.length === 0) return result

  // 1. Sort deterministically: startMinute ASC, duration DESC (endMinute DESC), id ASC
  const sorted = [...items].sort((a, b) => {
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute
    const durA = a.endMinute - a.startMinute
    const durB = b.endMinute - b.startMinute
    if (durA !== durB) return durB - durA
    return a.id.localeCompare(b.id)
  })

  // 2. Partition into connected clusters of overlapping intervals
  // Intervals [start, end) overlap if max(startA, startB) < min(endA, endB)
  const clusters: T[][] = []
  let currentCluster: T[] = []
  let clusterEnd = -1

  for (const item of sorted) {
    if (currentCluster.length === 0) {
      currentCluster.push(item)
      clusterEnd = item.endMinute
    } else if (item.startMinute < clusterEnd) {
      currentCluster.push(item)
      if (item.endMinute > clusterEnd) {
        clusterEnd = item.endMinute
      }
    } else {
      clusters.push(currentCluster)
      currentCluster = [item]
      clusterEnd = item.endMinute
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  // 3. For each cluster, assign lanes using greedy interval coloring
  for (const cluster of clusters) {
    const laneAssignments = new Map<string, number>()
    const active = new MinHeap<{ end: number; lane: number }>((a, b) => a.end - b.end || a.lane - b.lane)
    const available = new MinHeap<number>((a, b) => a - b)
    let totalLanes = 0
    for (const item of cluster) {
      // Intervals are half-open: a lane becomes free exactly at its end.
      let earliest = active.peek()
      while (earliest && earliest.end <= item.startMinute) {
        active.pop()
        available.push(earliest.lane)
        earliest = active.peek()
      }
      const lane = available.pop() ?? totalLanes++
      laneAssignments.set(item.id, lane)
      active.push({ end: item.endMinute, lane })
    }

    for (const item of cluster) {
      const lane = laneAssignments.get(item.id) ?? 0
      const widthPercent = 100 / totalLanes
      const leftPercent = (lane * 100) / totalLanes

      result.set(item.id, {
        lane,
        totalLanes,
        leftPercent,
        widthPercent,
      })
    }
  }

  return result
}

/** Blocks intersecting each half-open time slot. This is load, not a conflict diagnosis. */
export function computeWeekLoad<T extends WeekLayoutItem & { day: number }>(
  items: T[], days: number[], startMinute: number, endMinute: number
) {
  const slots: Array<{ startMinute: number; endMinute: number; days: Array<{ day: number; items: T[] }> }> = []
  for (let start = startMinute; start < endMinute; start += 120) {
    const end = Math.min(start + 120, endMinute)
    slots.push({
      startMinute: start,
      endMinute: end,
      days: days.map(day => ({ day, items: items.filter(item => item.day === day && item.startMinute < end && item.endMinute > start) })),
    })
  }
  return slots
}

// Two heaps keep interval coloring O(n log n), with deterministic lowest-free-lane reuse.
class MinHeap<T> {
  private values: T[] = []
  private compare: (a: T, b: T) => number
  constructor(compare: (a: T, b: T) => number) { this.compare = compare }
  peek() { return this.values[0] }
  push(value: T) {
    let index = this.values.length
    this.values.push(value)
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.compare(this.values[parent], value) <= 0) break
      this.values[index] = this.values[parent]
      index = parent
    }
    this.values[index] = value
  }
  pop(): T | undefined {
    const first = this.values[0]
    const last = this.values.pop()
    if (!this.values.length || last === undefined) return first
    let index = 0
    while (index * 2 + 1 < this.values.length) {
      let child = index * 2 + 1
      if (child + 1 < this.values.length && this.compare(this.values[child + 1], this.values[child]) < 0) child++
      if (this.compare(last, this.values[child]) <= 0) break
      this.values[index] = this.values[child]
      index = child
    }
    this.values[index] = last
    return first
  }
}
