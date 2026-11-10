import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Transform/render only. No listening server, browser, backend or operator data.
const vite = await createServer({ configFile: false, envDir: false, root: new URL('..', import.meta.url).pathname,
  ssr: { external: true }, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' })
after(() => vite.close())
const { NormativeAdvice, NormativeQuestionForm } = await vite.ssrLoadModule('/src/components/ai-elements/NormativeAdvice.tsx')
const { NormativeMarkdown } = await vite.ssrLoadModule('/src/components/ai-elements/NormativeMarkdown.tsx')
const { SuggestionCard } = await vite.ssrLoadModule('/src/components/ai-elements/SuggestionCard.tsx')
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))
const advice = { revision: 'PA-NORMATIVE-1', question: 'Pregunta sintética', context: { facultyId: 'FISI', academicPeriod: '2027-I', asOf: '2027-01-01', teacherType: 'unknown' },
  status: 'not-determined', retrievalMode: 'lexical-only', answer: 'Evidencia sintética insuficiente.', gaps: ['Acuerdo FISI pendiente'], citations: [{ id: 'syn-1', documentId: 'syn-doc', title: 'Documento sintético', article: 'Artículo sintético 7', page: 3, url: 'https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R-ANEXO.pdf', excerpt: 'Extracto construido para esta prueba.', sourceClass: 'normative', scope: 'UNMSM', reviewedAt: '2026-11-08', effectiveFrom: null, effectiveTo: null }] }

test('normative pane renders real retrieval modes, abstention, conflict and exact citation provenance', () => {
  const html = render(NormativeAdvice, { advice })
  for (const text of ['lexical-only', 'abstención', 'Acuerdo FISI pendiente', 'Artículo sintético 7', 'página PDF 3', 'vigencia futura no confirmada', 'autorización externa']) assert.ok(html.includes(text), text)
  assert.ok(html.includes('referrerPolicy="no-referrer"'))
  assert.ok(html.includes('rel="noopener noreferrer"'))
  assert.ok(html.includes(advice.citations[0].url))
  for (const mode of ['hybrid', 'unavailable']) assert.ok(render(NormativeAdvice, { advice: { ...advice, retrievalMode: mode } }).includes(mode))
  assert.ok(render(NormativeAdvice, { advice: { ...advice, status: 'conflict' } }).includes('Conflicto documental'))
})

test('normative pane distinguishes actual model generation from extractive fallback and legacy responses', () => {
  const legacy = render(NormativeAdvice, { advice })
  assert.doesNotMatch(legacy, /Generación:/)
  const generated = render(NormativeAdvice, { advice: { ...advice,
    generation: { mode: 'llm-assisted', providerLabel: 'Bedrock · modelo sintético' } } })
  assert.ok(generated.includes('Generación: Bedrock · modelo sintético'))
  const fallback = render(NormativeAdvice, { advice: { ...advice,
    generation: { mode: 'extractive', providerLabel: null, fallbackReason: 'insufficient_evidence' } } })
  assert.ok(fallback.includes('Generación: extractiva'))
  assert.ok(fallback.includes('Se conserva la abstención porque la evidencia es insuficiente.'))
  assert.doesNotMatch(fallback, /Generación: Bedrock/)
})

test('normative prose renders no remote images, raw HTML or arbitrary model links', () => {
  const html = render(NormativeMarkdown, { children: '![image](https://example.com/image.png) <img src="https://example.com/tracker"> [bad](javascript:alert(1)) [untrusted](https://example.com)' })
  assert.doesNotMatch(html, /<img|<a|src=|href=|<script/)
})

test('normative form retains supplied proposal period with explicit labels and unknown teacher type', () => {
  const html = render(NormativeQuestionForm, { academicPeriod: '2026-II' })
  assert.ok(html.includes('value="2026-II"'))
  assert.match(html, /value="unknown" selected=""/)
  for (const text of ['Facultad', 'FISI', 'Periodo académico', 'Fecha de consulta normativa', 'Régimen docente', 'Pregunta normativa', 'maxLength="1000"']) assert.ok(html.includes(text), text)
  assert.equal((html.match(/<label/g) ?? []).length, 5)
})

test('load scenario carries an explicit external approval warning beside its selection', () => {
  const html = render(SuggestionCard, { recommendation: { id: 'synthetic', title: 'Escenario sintético', rationale: 'Prueba', impactSummary: 'Prueba', recommendedByDefault: false,
    patch: { kind: 'increase_teacher_load', adjustments: [] } }, checked: false, disabled: false, onCheckedChange() {}, teacherNames: {}, courseNames: {}, roomNames: {} })
  assert.ok(html.includes('requiere autorización externa'))
  assert.ok(html.includes('data-state="unchecked"'))
})

test('citation panel rejects unsafe HTTPS origins and executable URLs before rendering', () => {
  for (const url of ['javascript:alert(1)', 'https://example.com/untrusted.pdf', 'http://medicina.unmsm.edu.pe/file.pdf']) {
    assert.throws(() => render(NormativeAdvice, { advice: { ...advice, citations: [{ ...advice.citations[0], url }] } }))
  }
})
