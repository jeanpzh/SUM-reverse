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

const { PlanningAssistAdvisor } = await vite.ssrLoadModule('/src/screens/PlanningAssistAdvisor.tsx')

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

const advisorProps = {
  academicPeriod: '2026-II', draftVersion: null, openSections: 0,
  proposal: { status: 'complete', pending: [], counts: { requiredSessions: 2, scheduledSessions: 2 } },
  chat: { turns: [], question: '', loading: false, asOf: '2026-11-17', teacherType: 'unknown',
    submit() {}, setQuestion() {}, cancel() {}, changeAsOf() {}, changeTeacherType() {} },
  requested: false, loading: false, error: null, advice: null, impact: undefined,
  selectedIds: [], applying: false, isLocked: false, canApply: true, previewCurrent: false,
  impactInvalidated: false, simulating: false, applyDisabledReason: null, applyDisabledReasonId: 'apply-reason',
  canConsult: false, consultDisabledReasonId: 'consult-reason',
  teacherNames: {}, courseNames: {}, roomNames: {},
  onConsult() {}, onCancel() {}, onRetry() {}, onToggle() {}, onSimulate() {}, onApply() {},
}

test('a complete proposal shows one honest empty state and no simulation/application action', () => {
  const html = render(PlanningAssistAdvisor, advisorProps)
  assert.equal(html.match(/Sin bloqueos que resolver/g)?.length, 1)
  assert.match(html, /2 de 2 sesiones asignadas/)
  assert.doesNotMatch(html, /Consultar consejero<|Simular selección<|Aplicar seleccionadas/)
})

test('an initial consultation failure offers retry without implying a simulation or fabricated result', () => {
  const html = render(PlanningAssistAdvisor, { ...advisorProps, requested: true, error: 'Fallo sintético de transporte',
    proposal: { pending: [{ sessionId: 'synthetic-session' }], counts: { requiredSessions: 2, scheduledSessions: 1 } } })
  assert.match(html, /No se pudo completar la consulta/)
  assert.match(html, /Fallo sintético de transporte/)
  assert.match(html, /Reintentar consejero/)
  assert.doesNotMatch(html, /data-advisor-impact="verified"|Simulación vigente/)
})


test('zero sessions in an invalid input do not claim that there are no blockers', () => {
  const html = render(PlanningAssistAdvisor, { ...advisorProps,
    proposal: { status: 'invalid-input', pending: [], counts: { requiredSessions: 0, scheduledSessions: 0 } } })
  assert.doesNotMatch(html, /Sin bloqueos que resolver/)
})
