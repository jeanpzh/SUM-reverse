// Checks WCAG AA contrast for the internal planning tokens in both themes.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/components/PlanningShell.css', import.meta.url), 'utf8')

function block(selectorPattern, required = true) {
  const match = new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`).exec(css)
  if (!match) {
    if (required) throw new Error(`Missing token block: ${selectorPattern}`)
    return new Map()
  }
  return new Map([...match[1].matchAll(/--(planning-[\w-]+):\s*(#[\da-fA-F]{6})/g)].map(([, key, value]) => [key, value]))
}

const defaults = block('(?:^|\\n)\\.planning-root')
const themes = Object.fromEntries(['light', 'dark'].map((theme) => [theme, new Map([
  ...defaults,
  ...block(`\\.planning-root\\[data-theme='${theme}'\\]`, false),
])]))

const channel = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const luminance = (hex) => {
  const [r, g, b] = hex.slice(1).match(/../g).map((part) => channel(parseInt(part, 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const pairs = [
  ['planning-border-control', 'planning-surface', 3],
  ['planning-border-control', 'planning-canvas', 3],
  ['planning-border-control', 'planning-surface-subtle', 3],
  ['planning-focus-ring', 'planning-surface-subtle', 3],
  ['planning-primary', 'planning-surface-subtle', 4.5],
  ['planning-muted', 'planning-surface-subtle', 4.5],
  ['planning-success', 'planning-surface', 4.5],
  ['planning-warning', 'planning-surface', 4.5],
  ['planning-text', 'planning-canvas', 4.5],
  ['planning-text', 'planning-surface', 4.5],
  ['planning-text', 'planning-selected', 4.5],
  ['planning-muted', 'planning-canvas', 4.5],
  ['planning-muted', 'planning-surface', 4.5],
  ['planning-primary-foreground', 'planning-primary', 4.5],
  ['planning-primary', 'planning-surface', 3],
  ['planning-error-foreground', 'planning-error', 4.5],
  ['planning-error', 'planning-error-surface', 4.5],
  ['planning-warning', 'planning-warning-surface', 4.5],
  ['planning-success', 'planning-success-surface', 4.5],
  ['planning-border', 'planning-surface', 1.3],
]

let failed = false
for (const [theme, values] of Object.entries(themes)) {
  for (const [fg, bg, min] of pairs) {
    const a = values.get(fg)
    const b = values.get(bg)
    if (!a || !b) {
      console.log(`${theme} ${fg}/${bg}: missing token`)
      failed = true
      continue
    }
    const result = ratio(a, b)
    const ok = result >= min
    if (!ok) failed = true
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme} ${fg}/${bg}: ${result.toFixed(2)}:1 (min ${min}:1)`)
  }
}
if (failed) process.exitCode = 1
