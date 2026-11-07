import { readFileSync } from 'node:fs'
const css = readFileSync(new URL('../src/components/PlanningShell.css', import.meta.url), 'utf8')
const tokens = [...css.matchAll(/--(planning-[\w-]+):\s*(#[\da-fA-F]{6})/g)]
const values = new Map(tokens.map(([, key, value]) => [key, value]))
const rgb = hex => hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
const luminance = hex => { const [r, g, b] = rgb(hex); return .2126 * r + .7152 * g + .0722 * b }
const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
const pairs = [['planning-text','planning-canvas',4.5],['planning-text','planning-surface',4.5],['planning-muted','planning-canvas',4.5],['planning-muted','planning-surface',4.5],['planning-primary-foreground','planning-primary',4.5],['planning-error-foreground','planning-error',4.5],['planning-warning','planning-warning-surface',4.5],['planning-rail-text','planning-rail',4.5]]
let failed = false
for (const [fg,bg,min] of pairs) { const result = ratio(values.get(fg), values.get(bg)); console.log(`${fg}/${bg}: ${result.toFixed(2)}:1 (min ${min}:1)`); if (result < min) failed = true }
if (failed) process.exitCode = 1
