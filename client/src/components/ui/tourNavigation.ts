/** Pure transition shared by controlled and uncontrolled Dice UI tours.
 * `total` is the completion sentinel, never a renderable step. */
export function getTourStepTransition(current: number, requested: number, total: number) {
  const value = Math.max(0, Math.min(requested, total))
  return { previousValue: current, value, complete: value === total }
}

/** Step requested by an arrow key, or null when the key does nothing.
 * Right/Left follow the reading direction: in RTL the arrows swap. Previous is
 * a no-op on the first step, matching the disabled Anterior button. */
export function getTourArrowKeyRequest(key: string, dir: 'ltr' | 'rtl', current: number) {
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return null
  const forward = (key === 'ArrowRight') === (dir !== 'rtl')
  if (forward) return current + 1
  return current > 0 ? current - 1 : null
}
