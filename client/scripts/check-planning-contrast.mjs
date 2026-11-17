// Checks WCAG AA contrast for the internal planning tokens in both themes.
//
// Two independent sections:
//  - v2 (Planning v2, `--plan-*` tokens): read from client/src/styles/planning-v2.css when the UI
//    worker has added it; otherwise from the proposed docs/design/academic-planning-2026-11-16/theme.css
//    (and the output says so). Must always pass.
//  - legacy (`--planning-*` tokens in PlanningShell.css): kept while that file still declares them;
//    skipped with a note once the legacy tokens are gone.
import { existsSync, readFileSync } from 'node:fs'

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
const normalizeHex = (value) => {
  const hex = /^#([\da-fA-F]{3}|[\da-fA-F]{6})$/.exec(value.trim())
  if (!hex) return null
  const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1]
  return `#${digits.toLowerCase()}`
}

function runPairs(label, themes, pairs) {
  let failed = false
  for (const [theme, values] of Object.entries(themes)) {
    for (const [fg, bg, min] of pairs) {
      const a = values.get(fg)
      const b = values.get(bg)
      if (!a || !b) {
        console.log(`FAIL ${label} ${theme} ${fg}/${bg}: missing or non-hex token`)
        failed = true
        continue
      }
      const result = ratio(a, b)
      const ok = result >= min
      if (!ok) failed = true
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} ${theme} ${fg}/${bg}: ${result.toFixed(2)}:1 (min ${min}:1)`)
    }
  }
  return failed
}

// ---------- v2 ----------
const v2Path = new URL('../src/styles/planning-v2.css', import.meta.url)
const v2DocsPath = new URL('../../docs/design/academic-planning-2026-11-16/theme.css', import.meta.url)

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const isLightSelector = (selector) => selector === '.planning-root'
const isDarkSelector = (selector) =>
  /^\.planning-root\[data-theme=(['"])dark\1\]$/.test(selector) || selector === '.dark .planning-root'

// Collects `--plan-*` declarations of `.planning-root` (light) and its dark selectors from flat or
// at-rule-nested blocks. Values may be hex or `var(--plan-x)` aliases of a hex token.
function readV2Tokens(css) {
  const light = new Map()
  const dark = new Map()
  for (const [, selectorList, body] of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = selectorList.split(',').map((part) => part.trim())
    const target = selectors.some(isDarkSelector) ? dark : selectors.some(isLightSelector) ? light : null
    if (!target) continue
    for (const [, key, value] of body.matchAll(/--(plan-[\w-]+):\s*([^;]+);/g)) target.set(key, value.trim())
  }
  const resolve = (map, key, depth = 0) => {
    const value = map.get(key)
    if (value === undefined || depth > 4) return null
    const alias = /^var\(--(plan-[\w-]+)\s*(?:,[^)]*)?\)$/.exec(value)
    return alias ? resolve(map, alias[1], depth + 1) : normalizeHex(value)
  }
  const flatten = (map) => new Map([...map.keys()].map((key) => [key, resolve(map, key)]).filter(([, value]) => value))
  const lightFlat = flatten(light)
  // Dark inherits unspecified tokens from light; its own aliases may point at light tokens.
  const darkMerged = new Map([...light, ...dark])
  return { light: lightFlat, dark: flatten(darkMerged) }
}

const textOn = ['plan-paper', 'plan-cream', 'plan-sand']
const v2Pairs = [
  ...['plan-ink', 'plan-steel', 'plan-fog'].flatMap((fg) => textOn.map((bg) => [fg, bg, 4.5])),
  ...['success', 'warning', 'danger'].flatMap((status) => [
    [`plan-${status}`, `plan-${status}-bg`, 4.5],
    [`plan-${status}`, 'plan-paper', 4.5],
  ]),
  ['plan-on-ink', 'plan-ink', 4.5], // primary pill label on the ink fill
  ['plan-control-border', 'plan-paper', 3], // WCAG 1.4.11 control boundary
  ['plan-focus', 'plan-paper', 3], // focus ring
]

const v2Source = existsSync(v2Path) ? v2Path : v2DocsPath
const v2IsFallback = v2Source === v2DocsPath
console.log(v2IsFallback
  ? 'v2: client/src/styles/planning-v2.css not found yet; checking the proposed docs/design/academic-planning-2026-11-16/theme.css instead'
  : 'v2: checking client/src/styles/planning-v2.css')
const v2Tokens = readV2Tokens(readFileSync(v2Source, 'utf8'))
let failed = runPairs('v2', v2Tokens, v2Pairs)

// ---------- legacy ----------
const legacyPath = new URL('../src/components/PlanningShell.css', import.meta.url)
const legacyCss = existsSync(legacyPath) ? readFileSync(legacyPath, 'utf8') : ''
if (!/--planning-[\w-]+:\s*#[\da-fA-F]{6}/.test(legacyCss)) {
  console.log('legacy: no --planning-* tokens left in PlanningShell.css; section skipped')
} else {
  function block(selectorPattern, required = true) {
    const match = new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`).exec(legacyCss)
    if (!match) {
      if (required) throw new Error(`Missing token block: ${selectorPattern}`)
      return new Map()
    }
    return new Map([...match[1].matchAll(/--(planning-[\w-]+):\s*(#[\da-fA-F]{6})/g)].map(([, key, value]) => [key, value]))
  }
  const defaults = block('(?:^|\\n)\\.planning-root')
  const legacyThemes = Object.fromEntries(['light', 'dark'].map((theme) => [theme, new Map([
    ...defaults,
    ...block(`\\.planning-root\\[data-theme='${theme}'\\]`, false),
  ])]))
  const legacyPairs = [
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
  failed = runPairs('legacy', legacyThemes, legacyPairs) || failed
}

if (failed) process.exitCode = 1
