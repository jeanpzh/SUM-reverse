import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Transform React modules in memory only. No listener, browser, API or datasets.
const clientRoot = fileURLToPath(new URL('../../..', import.meta.url))
const vite = await createServer({ root: clientRoot, configFile: false, server: { middlewareMode: true, ws: false }, appType: 'custom' })
after(() => vite.close())
const { MessageResponse } = await vite.ssrLoadModule('/src/components/ai-elements/MessageResponse.tsx')
const { Reasoning } = await vite.ssrLoadModule('/src/components/ai-elements/Reasoning.tsx')
const { SuggestionCard } = await vite.ssrLoadModule('/src/components/ai-elements/SuggestionCard.tsx')
const { PlanningAssistAdvisor } = await vite.ssrLoadModule('/src/screens/PlanningAssistAdvisor.tsx')

const render = (component, props) => renderToStaticMarkup(createElement(component, props))

const sampleCitation = {
  id: 'cit-1',
  documentId: 'doc-1',
  title: 'Reglamento Académico Sintético',
  article: 'Art. 25',
  page: 12,
  url: 'https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R.pdf',
  excerpt: 'Extracto sintético de prueba.',
  sourceClass: 'normative',
  scope: 'UNMSM',
  reviewedAt: '2026-06-01',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
}

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
  assert.match(html, /requiere autorización externa/)
  const checkboxId = html.match(/role="checkbox"[^>]*id="([^"]+)"/)?.[1]
  assert.ok(checkboxId)
  assert.ok(html.includes(`for="${checkboxId}"`))
})

test('SuggestionCard renders structured normativeContrast with status, authorization note, PDF links and gaps', () => {
  const withAuth = render(SuggestionCard, {
    checked: false,
    disabled: false,
    onCheckedChange() {},
    teacherNames: {},
    courseNames: {},
    roomNames: {},
    recommendation: {
      id: 'rec-enable-planning-window-afternoon',
      title: 'Permitir franja de tarde',
      rationale: 'Amplía la franja.',
      impactSummary: 'Destraba 2 componentes en simulación',
      recommendedByDefault: true,
      patch: { kind: 'enable_planning_window', allowAfternoon: true, allowSaturday: false },
      normativeContrast: {
        topic: 'planning_window',
        status: 'not-determined',
        citations: [sampleCitation],
        gaps: ['Confirmar aprobación de turno tarde en sede.'],
        requiresExternalAuthorization: true,
        authorizationNote: 'Decisión de diseño local: requiere autorización académica de franja.',
      },
    },
  })
  assert.match(withAuth, /Contraste normativo/)
  assert.match(withAuth, /data-normative-status="not-determined"/)
  assert.match(withAuth, /Aplicación sin confirmar/)
  assert.match(withAuth, /Decisión de diseño local: requiere autorización académica de franja\./)
  assert.match(withAuth, /Reglamento Académico Sintético · Art\. 25 · p\. 12/)
  assert.match(withAuth, /href="https:\/\/medicina\.unmsm\.edu\.pe\/wp-content\/uploads\/2026\/03\/RESOLUCION-RECTORAL-001380-2026-R\.pdf"/)
  assert.match(withAuth, /Ver verificaciones pendientes \(1\)/)
  assert.match(withAuth, /Confirmar aprobación de turno tarde en sede\./)

  const supportedNoAuth = render(SuggestionCard, {
    checked: false,
    disabled: false,
    onCheckedChange() {},
    teacherNames: {},
    courseNames: { C1: 'Curso Sintético' },
    roomNames: {},
    recommendation: {
      id: 'rec-change-delivery-mode-C1',
      title: 'Cambiar modalidad',
      rationale: 'Separa bloques.',
      impactSummary: 'Destraba 1 componente en simulación',
      recommendedByDefault: false,
      patch: { kind: 'change_delivery_mode', courseIds: ['C1'], deliveryMode: 'split' },
      normativeContrast: {
        topic: 'delivery_mode',
        status: 'supported',
        citations: [sampleCitation],
        gaps: [],
        requiresExternalAuthorization: false,
        authorizationNote: null,
      },
    },
  })
  assert.match(supportedNoAuth, /data-normative-status="supported"/)
  assert.match(supportedNoAuth, /Sustento documental/)
  assert.doesNotMatch(supportedNoAuth, /planning-rec__warning/)
})

test('PlanningAssistAdvisor renders managementActions in a separate non-executable section without checkboxes or apply buttons', () => {
  const html = render(PlanningAssistAdvisor, {
    academicPeriod: '2027-I',
    draftVersion: 3,
    openSections: 2,
    requested: true,
    loading: false,
    error: null,
    advice: {
      summary: 'Diagnóstico sintético.',
      bottlenecks: [{ category: 'missing_resource', title: 'Déficit de laboratorio', detail: 'Falta laboratorio compatible.', affectedSessionCount: 4 }],
      recommendations: [{
        id: 'rec-change-delivery-mode-C1',
        title: 'Separar modalidad',
        rationale: 'Reduce bloque continuo.',
        impactSummary: 'Destraba 1 componente en simulación',
        recommendedByDefault: false,
        patch: { kind: 'change_delivery_mode', courseIds: ['C1'], deliveryMode: 'split' },
      }],
      managementActions: [{
        id: 'mgmt-request-external-room',
        kind: 'request_external_room',
        title: 'Solicitar laboratorio para ciclos pendientes',
        detail: 'Se requieren 2 espacios de laboratorio para cubrir la demanda.',
        relatedCategory: 'missing_resource',
        affectedSessionCount: 4,
        citations: [sampleCitation],
        executable: false,
      }],
      source: { mode: 'deterministic-fallback', providerLabel: null, generatedAt: '2026-11-16T00:00:00Z' },
    },
    impact: null,
    selectedIds: [],
    applying: false,
    isLocked: false,
    canApply: true,
    previewCurrent: false,
    applyDisabledReason: 'Simula antes de aplicar.',
    applyDisabledReasonId: 'apply-disabled',
    canConsult: true,
    consultDisabledReasonId: 'consult-disabled',
    teacherNames: {},
    courseNames: { C1: 'Curso Sintético' },
    roomNames: {},
    onConsult() {},
    onCancel() {},
    onRetry() {},
    onToggle() {},
    onSimulate() {},
    onApply() {},
  })
  const mgmtMatch = html.match(/<section class="planning-mgmt"[^>]*>([\s\S]*?)<\/section>/)
  assert.ok(mgmtMatch, 'managementActions section must render separately')
  const mgmtHtml = mgmtMatch[1]
  assert.match(mgmtHtml, /Acciones de gestión/)
  assert.match(mgmtHtml, /No ejecutable por el motor/)
  assert.match(mgmtHtml, /Solicitar laboratorio para ciclos pendientes/)
  assert.match(mgmtHtml, /4 componentes afectados/)
  assert.match(mgmtHtml, /Reglamento Académico Sintético · Art\. 25 · p\. 12/)
  assert.doesNotMatch(mgmtHtml, /role="checkbox"|type="checkbox"|<button/)
})
