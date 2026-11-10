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

    for (const item of cluster) {
      // Find lanes occupied by any overlapping items already assigned in this cluster
      const occupiedLanes = new Set<number>()
      for (const assignedItem of cluster) {
        if (assignedItem.id === item.id) continue
        const assignedLane = laneAssignments.get(assignedItem.id)
        if (assignedLane === undefined) continue

        // Check if intervals overlap: [startA, endA) and [startB, endB)
        const overlaps =
          Math.max(item.startMinute, assignedItem.startMinute) <
          Math.min(item.endMinute, assignedItem.endMinute)

        if (overlaps) {
          occupiedLanes.add(assignedLane)
        }
      }

      // Find first available lane index >= 0
      let lane = 0
      while (occupiedLanes.has(lane)) {
        lane++
      }
      laneAssignments.set(item.id, lane)
    }

    // Total lanes needed for this cluster is max(lane) + 1
    let maxLane = 0
    for (const lane of laneAssignments.values()) {
      if (lane > maxLane) maxLane = lane
    }
    const totalLanes = maxLane + 1

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
