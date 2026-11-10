import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Transform React modules in memory only. No listener, browser, API or datasets.
const vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false }, appType: 'custom' })
after(() => vite.close())
const { MessageResponse } = await vite.ssrLoadModule('/src/components/ai-elements/MessageResponse.tsx')
const { Reasoning } = await vite.ssrLoadModule('/src/components/ai-elements/Reasoning.tsx')
const { SuggestionCard } = await vite.ssrLoadModule('/src/components/ai-elements/SuggestionCard.tsx')

const render = (component, props) => renderToStaticMarkup(createElement(component, props))

test('Markdown formats GFM and discards raw HTML and dangerous link protocols', () => {
  const html = render(MessageResponse, { children: '**Confirmado**\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[enlace](javascript:alert)' })
  assert.match(html, /<strong>Confirmado<\/strong>/)
  assert.match(html, /<table>/)
  assert.doesNotMatch(html, /<script|<img|javascript:|onerror=/)
})

test('tool summaries are collapsed by default and absent when no tools ran', () => {
  assert.equal(render(Reasoning, {}), '')
  const html = render(Reasoning, { steps: [{ toolName: 'simulate_patches_cpsat', inputSummary: 'Parche sintético', outputSummary: 'Búsqueda inconclusa' }] })
  assert.match(html, /<details/)
  assert.doesNotMatch(html, /<details[^>]* open/)
  assert.match(html, /Herramientas ejecutadas \(1\)/)
  assert.match(html, /Entrada: Parche sintético/)
  assert.match(html, /Resultado: Búsqueda inconclusa/)
})

test('advisor prose cannot bypass the structured citation allowlist with Markdown links', () => {
  const html = render(MessageResponse, { children: '[Fuente normativa](http://example.org/unreviewed)\n\n[fuente][ref]\n\n[ref]: https://example.invalid/unreviewed' })
  assert.doesNotMatch(html, /<a\b|href=|<img|<link/)
  assert.match(html, /Fuente normativa/)
})

test('Markdown images cannot trigger external image or preload requests with rehydrated identities', () => {
  const html = render(MessageResponse, { children: '![diagnóstico](https://example.invalid/pixel?teacher=SyntheticTeacherName)\n\n![referencia][pixel]\n\n[pixel]: https://example.invalid/track' })
  assert.doesNotMatch(html, /<img|<link|example\.invalid|SyntheticTeacherName/)
})

test('recommendation exposes every affected teacher with exact previous and next limits and an associated checkbox label', () => {
  const html = render(SuggestionCard, { checked: true, disabled: false, onCheckedChange() {},
    teacherNames: { T1: 'Docente sintético uno', T2: 'Docente sintético dos' }, courseNames: {}, roomNames: {},
    recommendation: { id: 'load', title: 'Ampliar carga', rationale: '**Cambio local**', impactSummary: 'Más capacidad', recommendedByDefault: true,
      patch: { kind: 'increase_teacher_load', adjustments: [
        { teacherId: 'T1', previousMaxWeeklyMinutes: 600, nextMaxWeeklyMinutes: 1200 },
        { teacherId: 'T2', previousMaxWeeklyMinutes: 300, nextMaxWeeklyMinutes: 900 },
      ] } } })
  assert.match(html, /Docente sintético uno \(T1\): 600 → 1200 min/)
  assert.match(html, /Docente sintético dos \(T2\): 300 → 900 min/)
  assert.match(html, /Ver cambios exactos \(2\)/)
  const checkboxId = html.match(/role="checkbox"[^>]*id="([^"]+)"/)?.[1]
  assert.ok(checkboxId)
  assert.ok(html.includes(`for="${checkboxId}"`))
})
