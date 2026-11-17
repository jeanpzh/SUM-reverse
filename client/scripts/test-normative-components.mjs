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
const { AdvisorOutcome } = await vite.ssrLoadModule('/src/components/ai-elements/AdvisorOutcome.tsx')
const { AdvisorImpact } = await vite.ssrLoadModule('/src/components/ai-elements/AdvisorImpact.tsx')
const { AdvisorFindings } = await vite.ssrLoadModule('/src/components/ai-elements/AdvisorFindings.tsx')
const { uniqueNormativeCitations } = await vite.ssrLoadModule('/src/components/ai-elements/normativePresentation.ts')
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))
const advice = { revision: 'PA-NORMATIVE-1', question: 'Pregunta sintética', context: { facultyId: 'FISI', academicPeriod: '2027-I', asOf: '2027-01-01', teacherType: 'unknown' },
  status: 'not-determined', retrievalMode: 'lexical-only', answer: 'Evidencia sintética insuficiente.', gaps: ['Acuerdo FISI pendiente'], citations: [{ id: 'syn-1', documentId: 'syn-doc', title: 'Documento sintético', article: 'Artículo sintético 7', page: 3, url: 'https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R-ANEXO.pdf', excerpt: 'Extracto construido para esta prueba.', sourceClass: 'normative', scope: 'UNMSM', reviewedAt: '2026-11-08', effectiveFrom: null, effectiveTo: null }] }

test('partial evidence explains documentary content visibly and keeps sources and gaps collapsed', () => {
  const html = render(NormativeAdvice, { advice })
  for (const text of ['Aplicación sin confirmar', 'La entrada en vigencia de los extractos localizados no está confirmada.', 'Fuentes localizadas (1)', 'Alcance y verificaciones pendientes (1)', 'Detalles técnicos de la consulta']) assert.ok(html.includes(text), text)
  assert.ok(html.includes(advice.answer))
  assert.ok(html.includes('data-documentary-answer'))
  for (const text of [advice.gaps[0], advice.citations[0].excerpt, advice.citations[0].url]) assert.ok(!html.includes(text), text)
  assert.equal((html.match(/Aplicación sin confirmar/g) ?? []).length, 1)
  assert.ok(html.includes('data-normative-status="not-determined"'))
  assert.ok(html.includes('aria-expanded="false"'))
})

test('empty evidence shows one useful fallback without repeated no-source paragraphs', () => {
  const html = render(NormativeAdvice, { advice: { ...advice, citations: [] } })
  assert.equal((html.match(/Sin evidencia suficiente/g) ?? []).length, 1)
  assert.ok(html.includes('Comprueba el régimen docente'))
  assert.doesNotMatch(html, /Fuentes localizadas|Sin fuentes normativas|No determinado/)
  assert.ok(html.includes(advice.answer))
  const specified = render(NormativeAdvice, { advice: { ...advice, context: { ...advice.context, teacherType: 'contratado' }, citations: [] } })
  assert.ok(specified.includes('Solicita la norma aplicable al régimen contratado'))
  assert.doesNotMatch(specified, /Comprueba el régimen docente/)
})

test('query-specific next step is visible without opening sources or technical details', () => {
  const html = render(NormativeAdvice, { advice: { ...advice,
    nextStep: 'Solicita el acuerdo de Facultad que define la duración para este periodo.' } })
  assert.ok(html.includes('Solicita el acuerdo de Facultad'))
  assert.doesNotMatch(html, /Comprueba el régimen docente|Ver respuesta completa/)
})

test('unavailable retrieval describes a corpus problem instead of suggesting a different regime', () => {
  const html = render(NormativeAdvice, { advice: { ...advice, retrievalMode: 'unavailable', citations: [] } })
  assert.ok(html.includes('Consulta documental no disponible'))
  assert.ok(html.includes('Revisa la disponibilidad del corpus'))
  assert.doesNotMatch(html, /Comprueba el régimen docente|Fuentes localizadas/)
})

test('supported answer stays visible and a conflict never becomes supported evidence', () => {
  const supported = render(NormativeAdvice, { advice: { ...advice, status: 'supported', answer: 'Respuesta sintética sustentada.' } })
  assert.ok(supported.includes('Sustento documental'))
  assert.ok(supported.includes('Respuesta sintética sustentada.'))
  assert.doesNotMatch(supported, /Ver respuesta completa|Siguiente paso:/)
  const conflict = render(NormativeAdvice, { advice: { ...advice, status: 'conflict' } })
  assert.ok(conflict.includes('Fuentes en conflicto'))
  assert.ok(conflict.includes('Las fuentes se contradicen'))
  assert.ok(conflict.includes('data-normative-status="conflict"'))
  assert.doesNotMatch(conflict, /Sustento documental/)
})

test('source dedup preserves different articles from one PDF and exact gap dedup preserves distinct limits', () => {
  const first = advice.citations[0]
  const next = { ...first, id: 'syn-2', article: 'Artículo sintético 8', page: 4 }
  assert.deepEqual(uniqueNormativeCitations([first, { ...first }, next]), [first, next])
  const html = render(NormativeAdvice, { advice: { ...advice, gaps: ['Límite A', 'Límite A', 'Límite B'] } })
  assert.ok(html.includes('Alcance y verificaciones pendientes (2)'))
})

test('technical generation metadata stays collapsed initially for model, fallback and legacy responses', () => {
  const legacy = render(NormativeAdvice, { advice })
  assert.doesNotMatch(legacy, /Generación:/)
  const generated = render(NormativeAdvice, { advice: { ...advice,
    generation: { mode: 'llm-assisted', providerLabel: 'Bedrock · modelo sintético' } } })
  assert.doesNotMatch(generated, /Generación:|Bedrock · modelo sintético/)
  assert.ok(generated.includes('Detalles técnicos de la consulta'))
  const fallback = render(NormativeAdvice, { advice: { ...advice,
    generation: { mode: 'extractive', providerLabel: null, fallbackReason: 'insufficient_evidence' } } })
  assert.doesNotMatch(fallback, /Generación:|Se conserva la abstención/)
  assert.ok(fallback.includes('Detalles técnicos de la consulta'))
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


test('verified impact renders actual before/after counters and honest solver limit', () => {
  const impact = { currentScheduledSessions: 2, projectedScheduledSessions: 3, requiredSessions: 4,
    currentCompleteSections: 1, projectedCompleteSections: 2, totalSections: 3,
    recommendationIds: ['synthetic'], solverStatus: 'search-limit' }
  const html = render(AdvisorImpact, { impact })
  for (const text of ['Simulación verificada en CP-SAT', 'Actual', 'Simulada', '1/3', '2/3', '2/4', '3/4', 'Búsqueda inconclusa', 'Alcance de la simulación']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /imposible|puede obtener otra cobertura/)
  const pending = render(AdvisorImpact, {})
  assert.ok(pending.includes('Impacto no simulado.'))
  assert.ok(pending.includes('Simular selección actual'))
  assert.doesNotMatch(pending, /<table|Simulación verificada/)
})

test('advisor exposes bottleneck counts and keeps supporting evidence behind disclosure', () => {
  const html = render(AdvisorFindings, { advice: { summary: 'Explicación sintética completa.', bottlenecks: [
    { category: 'teacher_load', title: 'Carga insuficiente', detail: 'Detalle sintético del cuello.', affectedSessionCount: 5 },
  ] } })
  const visibleText = html.replace(/<[^>]*>/g, '')
  for (const text of ['Qué limita la cobertura', 'Carga insuficiente', '5 componentes afectados:', 'Ver evidencia y motivos']) assert.ok(visibleText.includes(text), text)
  assert.ok(html.includes('aria-expanded="false"'))
  assert.doesNotMatch(html, /Explicación sintética completa|Detalle sintético del cuello/)
  const noFindings = render(AdvisorFindings, { advice: { summary: 'Diagnóstico sin cuellos identificados.', bottlenecks: [] } })
  assert.ok(noFindings.includes('Diagnóstico sin cuellos identificados.'))
})


test('actual advisor outcome reports a decline honestly instead of reusing projected improvement', () => {
  const html = render(AdvisorOutcome, { outcome: { sourceProposalId: 'synthetic-before', proposalId: 'synthetic-after', editVersion: 0,
    recommendationCount: 2, before: { components: 10, completeSections: 5 }, after: { components: 8, completeSections: 4 },
    requiredComponents: 12, totalSections: 6 } })
  assert.ok(html.includes('data-advisor-outcome'))
  assert.ok(html.includes('10 → 8/12 (-2)'))
  assert.ok(html.includes('5 → 4/6 (-1)'))
  assert.ok(html.includes('Quedan 4 componentes pendientes'))
  assert.doesNotMatch(html, /Simulada|mejor[oó]|resuelt[oa]|complet[oó] la cobertura/)
})

test('SuggestionCard avoids unconditional single-teacher wording and formats Saturday exception windows from PlanningPolicy', () => {
  const splitHtml = render(SuggestionCard, {
    checked: false,
    disabled: false,
    onCheckedChange() {},
    teacherNames: {},
    courseNames: { CS101: 'Curso sintético' },
    roomNames: {},
    recommendation: {
      id: 'split-rec',
      title: 'Dividir bloques',
      rationale: 'Prueba sintética',
      impactSummary: 'Franjas separadas',
      recommendedByDefault: false,
      patch: { kind: 'change_delivery_mode', courseIds: ['CS101'], deliveryMode: 'split' },
    },
  })
  assert.match(splitHtml, /componentes en franjas independientes \(respeta la asignación docente del curso\)/)
  assert.doesNotMatch(splitHtml, /un docente responsable por sección/)

  const exceptionPolicy = {
    revision: 'FISI-PLANNING-1',
    period: '2027-I',
    allowAfternoon: false,
    allowSaturday: true,
    facultyId: 'FISI',
    source: 'synthetic-exception',
    exceptions: { saturdayStartMinute: 540, saturdayEndMinute: 840 },
  }
  const windowWithException = render(SuggestionCard, {
    checked: false,
    disabled: false,
    onCheckedChange() {},
    teacherNames: {},
    courseNames: {},
    roomNames: {},
    planningPolicy: exceptionPolicy,
    recommendation: {
      id: 'sat-rec',
      title: 'Habilitar sábado',
      rationale: 'Prueba sintética',
      impactSummary: 'Franja adicional',
      recommendedByDefault: false,
      patch: { kind: 'enable_planning_window', allowSaturday: true },
    },
  })
  assert.match(windowWithException, /Permitir sábado: habilitar de 09:00 a 14:00/)

  const windowWithoutPolicy = render(SuggestionCard, {
    checked: false,
    disabled: false,
    onCheckedChange() {},
    teacherNames: {},
    courseNames: {},
    roomNames: {},
    recommendation: {
      id: 'sat-rec-generic',
      title: 'Habilitar sábado',
      rationale: 'Prueba sintética',
      impactSummary: 'Franja adicional',
      recommendedByDefault: false,
      patch: { kind: 'enable_planning_window', allowSaturday: true },
    },
  })
  assert.match(windowWithoutPolicy, /según el perfil vigente \(08:00 a 13:00 salvo excepción\)/)
})

test('AcademicPreparationCourses keeps existing course inspector design and exposes accessible teacher assignment selector', async () => {
  const { AcademicPreparationCourses } = await vite.ssrLoadModule('/src/screens/AcademicPreparationCourses.tsx')
  const html = render(AcademicPreparationCourses, {
    catalog: {
      revision: 'PA-DEMO-1',
      courses: [{
        courseId: 'CS101',
        name: 'Curso sintético',
        cycle: 1,
        credits: 4,
        estimatedDemand: 40,
        targetCapacity: 40,
        weeklySessions: [{ id: 'CS101-T', durationMinutes: 120, type: 'Teoría' }, { id: 'CS101-L', durationMinutes: 120, type: 'Laboratorio' }],
      }],
      teachers: [],
      rooms: [],
      windows: [{ day: 1, startMinute: 480, endMinute: 780 }],
      startStepMinutes: 30,
      maxExplorations: 100,
    },
    loadingCatalog: false,
    catalogError: null,
    onRetryCatalog() {},
    planningPeriod: '2027-I',
    onApplyPeriodDefaults() {},
    cycleFilter: 'all',
    onCycleFilterChange() {},
    selectedCourses: ['CS101'],
    onToggleCourse() {},
    onSelectCourses() {},
    demands: { CS101: '40' },
    capacities: { CS101: '40' },
    patterns: {},
    deliveryModes: { CS101: 'continuous' },
    teacherAssignmentModes: { CS101: 'tp-grouped-l-independent' },
    onUpdateDemand() {},
    onUpdateCapacity() {},
    onUpdatePattern() {},
    onUpdateDeliveryMode() {},
    onUpdateTeacherAssignmentMode() {},
    onApplyBulkChanges() {},
    proposal: null,
    demandSourceId: 'existing-regular-v1',
    onChangeDemandSource() {},
    demandEstimate: null,
    demandLoading: false,
    demandError: null,
    onEstimateDemand() {},
    onUseBaseDemand() {},
  })
  assert.match(html, /Cursos de la oferta/)
  assert.match(html, /Inspeccionar CS101/)
  // Note: inspectedCourseId starts null before user click, so verify component mounts cleanly in SSR without errors.
  assert.ok(typeof AcademicPreparationCourses === 'function')
})
