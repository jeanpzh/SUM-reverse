// Bounded UI cases for the regular-enrollment client flow (T032/T038/T043/T044/T045).
// Node + Vite SSR only: no browser, no ports, no backend, no private data. Fullstack acceptance belongs to the root.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'

const clientDir = resolve(fileURLToPath(new URL('../', import.meta.url)))
const results = []

function check(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { results.push({ name, ok: true }); console.log(`PASS ${name}`) },
    (error) => { results.push({ name, ok: false, error }); console.log(`FAIL ${name}\n  ${error.message.split('\n')[0]}`) },
  )
}

const server = await createServer({
  configFile: false,
  root: clientDir,
  plugins: [
    {
      // The shell hook needs the router's root loader; SSR checks substitute a synthetic stub (this script only).
      name: 'stub-shell-student',
      enforce: 'pre',
      resolveId(source) {
        if (/\/data\/useStudent(\.ts)?$/.test(source)) return resolve(clientDir, 'tests/fixtures/useStudentStub.ts')
        return null
      },
    },
    react(),
  ],
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  logLevel: 'error',
})

try {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')
  const kit = await server.ssrLoadModule('/tests/fixtures/matriculaRegularKit.ts')
  const { syntheticContext } = await server.ssrLoadModule('/tests/fixtures/matriculaRegularContext.ts')
  const shared = await server.ssrLoadModule('/../shared/matricula-regular.mjs')
  const html = (component, props) => renderToStaticMarkup(createElement(component, props))
  const noop = () => {}

  shared.validateContext(syntheticContext())
  shared.validateEnrollmentReport(kit.enrollmentReport())

  // ---- T044/T045: report view (P1) ----
  await check('T044/P1: report heading is programmatically focusable and rows/total come from the accepted report', async () => {
    const { RegularEnrollmentReportView } = await server.ssrLoadModule('/src/screens/RegularEnrollmentReport.tsx')
    const markup = html(RegularEnrollmentReportView, { report: kit.enrollmentReport() })
    assert.match(markup, /<h2[^>]*id="regular-enrollment-report-heading"[^>]*tabindex="-1"/)
    assert.match(markup, /SYN-SIS-C1/)
    assert.match(markup, /SYN-SIS-C2/)
    assert.match(markup, /Total de créditos<\/dt><dd>7</)
    assert.match(markup, /Cursos aceptados<\/dt><dd>2</)
    assert.match(markup, /Descargar/)
    assert.match(markup, /Ventana sintética de prueba/)
    assert.match(markup, /local-only/)
    assert.doesNotMatch(markup, /REDIRECCIONANDO|M-?01/)
  })

  // ---- T032: AcademicRequirementsPanel integration (access-only context, outcome-driven causes/gaps) ----
  const bodyProps = (extra = {}) => ({
    context: syntheticContext(), session: null, sessionBusy: false, sessionNotice: '', onSession: noop,
    choices: [], onChoices: noop, selectionDisabled: true, outcome: null, children: null, ...extra,
  })
  await check('T032: body mounts the requirements panel once with the Context status and sources, no selection verdicts', async () => {
    const { RegularEnrollmentBody } = await server.ssrLoadModule('/src/screens/RegularEnrollment.tsx')
    const markup = html(RegularEnrollmentBody, bodyProps())
    assert.equal((markup.match(/Requisitos Académicos y Condiciones de Matrícula/g) ?? []).length, 1)
    assert.match(markup, /Habilitado para selección/)
    assert.match(markup, /Decisión local sintética L-01/)
    assert.equal((markup.match(/Fuentes Normativas y Trazabilidad Documental/g) ?? []).length, 1)
    assert.doesNotMatch(markup, /excede|CREDIT_LOAD_INVALID|cruce detectado/i)
  })
  await check('T032: after a rejected/pending Outcome the panel reports its causes/gaps while sources still come from Context', async () => {
    const { RegularEnrollmentBody } = await server.ssrLoadModule('/src/screens/RegularEnrollment.tsx')
    const rejected = html(RegularEnrollmentBody, bodyProps({ outcome: kit.rejectedOutcome() }))
    assert.match(rejected, /Solicitud rechazada/)
    assert.match(rejected, /Cruce de horarios detectado/)
    assert.match(rejected, /Decisión local sintética L-01/)
    const pending = html(RegularEnrollmentBody, bodyProps({ outcome: kit.pendingOutcome() }))
    assert.match(pending, /Pendiente de configuración/)
    assert.match(pending, /Catálogo de oferta o plan incompleto/)
    assert.doesNotMatch(pending, /Matrícula aceptada/)
  })
  await check('T032: a configuration-pending Context keeps its gaps and never reads as enabled', async () => {
    const { RegularEnrollmentBody } = await server.ssrLoadModule('/src/screens/RegularEnrollment.tsx')
    const context = syntheticContext({
      preEnrollmentEnabled: null,
      eligibility: { state: 'configuration-pending', windowId: null, windowOrigin: null, causes: [],
        gaps: [{ code: 'PRE_ENROLLMENT_UNKNOWN', courseIds: [], sourceIds: ['L-01'] }] },
    })
    shared.validateContext(context)
    const markup = html(RegularEnrollmentBody, bodyProps({ context }))
    assert.match(markup, /Habilitación de prematrícula desconocida/)
    assert.doesNotMatch(markup, /Habilitado para selección/)
  })

  // ---- T038/T043/T045: submission panel states ----
  const panelProps = (extra = {}) => ({
    phase: 'idle', uncertain: null, notice: null, storageNotice: false, hasSession: true, selectionCount: 2,
    eligible: true, acceptedOutcome: null, onSubmit: noop, onConsult: noop, onReplay: noop, onViewReport: noop, ...extra,
  })
  const loadPanel = async () => (await server.ssrLoadModule('/src/screens/RegularEnrollment.tsx')).SubmissionPanel

  await check('T038: submit is enabled only with session, selection and eligibility; idle exposes a focusable register heading', async () => {
    const SubmissionPanel = await loadPanel()
    const ready = html(SubmissionPanel, panelProps())
    assert.match(ready, /<h3[^>]*id="registration-heading"[^>]*tabindex="-1"/)
    assert.doesNotMatch(ready.match(/<button[^>]*>Enviar solicitud de matrícula/)?.[0] ?? '', /disabled/)
    for (const blocked of [{ hasSession: false }, { selectionCount: 0 }, { eligible: false }]) {
      assert.match(html(SubmissionPanel, panelProps(blocked)).match(/<button[^>]*>Enviar solicitud de matrícula/)?.[0] ?? '', /disabled/)
    }
  })
  await check('T038: sending is announced to AT, disables submit, and is not a blocking modal', async () => {
    const SubmissionPanel = await loadPanel()
    const markup = html(SubmissionPanel, panelProps({ phase: 'submitting' }))
    assert.match(markup, /aria-busy="true"/)
    assert.match(markup, /role="status"[^>]*>[^<]*Enviando/)
    assert.match(markup.match(/<button[^>]*>Enviar solicitud de matrícula/)?.[0] ?? '', /disabled/)
    assert.doesNotMatch(markup, /<dialog|aria-modal/)
  })
  await check('T043: an uncertain result is announced as «no confirmado», offers consult + manual replay and shows no success/rejection', async () => {
    const SubmissionPanel = await loadPanel()
    const markup = html(SubmissionPanel, panelProps({ phase: 'uncertain', uncertain: { reason: 'network', lookup: 'none' } }))
    assert.match(markup, /role="status"[^>]*aria-live="polite"/)
    assert.match(markup, /Resultado no confirmado/)
    assert.match(markup, />Consultar resultado</)
    assert.match(markup, />Repetir el mismo envío</)
    assert.doesNotMatch(markup, /<dialog|Rechazad|Matrícula aceptada/)
    assert.match(markup.match(/<button[^>]*>Enviar solicitud de matrícula/)?.[0] ?? '', /disabled/)
    const noSession = html(SubmissionPanel, panelProps({ phase: 'uncertain', uncertain: { reason: 'network', lookup: 'none' }, hasSession: false }))
    assert.match(noSession.match(/<button[^>]*>Repetir el mismo envío/)?.[0] ?? '', /disabled/)
  })
  await check('T043: lookup «unknown» is stated as unconfirmed, never as «no recibido»', async () => {
    const SubmissionPanel = await loadPanel()
    const markup = html(SubmissionPanel, panelProps({ phase: 'uncertain', uncertain: { reason: 'network', lookup: 'unknown' } }))
    assert.match(markup, /no hay un resultado publicado/i)
    assert.match(markup, /no confirma/i)
    assert.doesNotMatch(markup, /no fue recibida\b|no se recibi[óo] la solicitud/i)
  })
  await check('T043: storage write failure states the reload limit explicitly', async () => {
    const SubmissionPanel = await loadPanel()
    const markup = html(SubmissionPanel, panelProps({ phase: 'uncertain', uncertain: { reason: 'network', lookup: 'none' }, storageNotice: true }))
    assert.match(markup, /recarga/i)
    assert.match(markup, /no se pudo guardar/i)
  })
  await check('T038/T045: pending and definitive-error notices are non-modal; accepted result is a focusable heading with manual «Ver reporte local»', async () => {
    const SubmissionPanel = await loadPanel()
    const pending = html(SubmissionPanel, panelProps({ notice: { tone: 'warning', message: 'Solicitud pendiente de configuración.' } }))
    assert.match(pending, /role="status"[^>]*>[^<]*pendiente de configuración/i)
    assert.doesNotMatch(pending, /<dialog/)
    const accepted = html(SubmissionPanel, panelProps({ acceptedOutcome: kit.acceptedOutcome() }))
    assert.match(accepted, /<h3[^>]*id="accepted-result-heading"[^>]*tabindex="-1"/)
    assert.match(accepted, />Ver reporte local</)
    assert.doesNotMatch(accepted, /REDIRECCIONANDO|M-?01|Redirigiendo/)
    assert.match(accepted.match(/<button[^>]*>Enviar solicitud de matrícula/)?.[0] ?? '', /disabled/)
  })
} finally {
  await server.close()
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} client-flow checks passed`)
if (failed.length > 0) process.exit(1)
