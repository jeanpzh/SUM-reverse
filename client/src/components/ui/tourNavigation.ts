/** Pure transition shared by controlled and uncontrolled Dice UI tours.
 * `total` is the completion sentinel, never a renderable step. */
export function getTourStepTransition(current: number, requested: number, total: number) {
  const value = Math.max(0, Math.min(requested, total))
  return { previousValue: current, value, complete: value === total }
}
