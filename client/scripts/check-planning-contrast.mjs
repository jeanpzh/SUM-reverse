// Checks WCAG AA contrast for the internal planning tokens in both themes.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/components/PlanningShell.css', import.meta.url), 'utf8')

function block(selectorPattern) {
  const match = new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`).exec(css)
  if (!match) throw new Error(`Missing token block: ${selectorPattern}`)
  return new Map([...match[1].matchAll(/--(planning-[\w-]+):\s*(#[\da-fA-F]{6})/g)].map(([, key, value]) => [key, value]))
}

const themes = {
  light: block('(?:^|\\n)\\.planning-root'),
  dark: block("\\.planning-root\\[data-theme='dark'\\]"),
}

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
  ['planning-rail-text', 'planning-rail', 4.5],
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
