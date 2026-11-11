import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACADEMIC_REVISION } from '../../../shared/programacion-academica-api.mjs'
import type {
  AcademicCatalog, AcademicDraftSaveRequest, AcademicProposal, AcademicSavedDraft, AcademicTeacherReview,
} from '../../../shared/programacion-academica-api.mjs'
import {
  buildPlanningWorkspace, createPlanningSession, derivePlanningProgress, derivePlanningView, derivePlanningDraftLabel, derivePlanningPrimaryAction, initialPlanningSessionState, reducePlanningSession,
} from './planningSession.ts'
import { AcademicLoadAuthorizationError } from './academicScheduling.ts'
import type { PlanningBlock, PlanningSessionClient, PlanningSessionState } from './planningSession.ts'

// Synthetic fixtures only.
const catalog = {
  revision: ACADEMIC_REVISION,
  courses: [
    { courseId: 'CS101', name: 'Curso sintético', estimatedDemand: 18, targetCapacity: 20, weeklySessions: [{ id: 'CS101-L1', durationMinutes: 90 }] },
    { courseId: 'CS102', name: 'Curso sintético 2', estimatedDemand: 12, targetCapacity: 20, weeklySessions: [{ id: 'CS102-L1', durationMinutes: 90 }] },
  ],
  teachers: [{ id: 'T1', name: 'Docente sintético', courseIds: ['CS101'], maxWeeklyMinutes: 180, availability: [{ day: 1, startMinute: 480, endMinute: 660 }] }],
  rooms: [{ id: 'R1', name: 'Aula sintética', capacity: 20, availability: [{ day: 1, startMinute: 480, endMinute: 660 }] }],
  windows: [{ day: 1, startMinute: 480, endMinute: 660 }], startStepMinutes: 30, maxExplorations: 100,
  referenceTeachers: [{ id: 'T-REF', name: 'Docente sintético', courseIds: ['CS101', 'CS102'] }],
  referenceRooms: [{ id: 'R-REF', name: 'Aula sintética', capacity: 45, kind: 'classroom' as const, pavilion: 'AP' as const }],
} as AcademicCatalog

function makeProposal(overrides: Partial<AcademicProposal> = {}): AcademicProposal {
  return {
    proposalId: 'proposal-synthetic', createdAt: '2026-10-29T12:00:00.000Z', expiresAt: '2026-10-29T12:15:00.000Z',
    status: 'complete',
    sections: [{ sectionId: 'A', courseId: 'CS101', courseName: 'Curso sintético', capacity: 20, deliveryMode: 'continuous' }],
    assignments: [{ sessionId: 'CS101-L1', sectionId: 'A', courseId: 'CS101', courseName: 'Curso sintético',
      teacherId: 'T-REF', teacherName: 'Docente sintético', roomId: 'R-REF', roomName: 'Aula sintética',
      day: 1, startMinute: 480, endMinute: 570, sessionType: 'Teoría' }],
    pending: [], diagnostics: [], coverageComplete: true,
    counts: { sections: 1, requiredSessions: 1, scheduledSessions: 1 },
    stats: { exploredCandidates: 1, candidateVisits: 1, backtracks: 0, limitReason: null },
    ...overrides,
  } as AcademicProposal
}

const draftId = '123e4567-e89b-42d3-a456-426614174000'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function memoryClient(overrides: Partial<PlanningSessionClient> = {}) {
  const drafts = new Map<string, AcademicSavedDraft>()
  const calls: string[] = []
  const toSaved = (request: AcademicDraftSaveRequest, proposal: AcademicProposal | null): AcademicSavedDraft => ({
    id: request.id ?? draftId, version: (request.expectedVersion ?? 0) + 1, title: request.title, state: request.state,
    createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-07T10:00:00.000Z', configuration: request.configuration,
    demandBase: null, proposal })
  let lastProposal: AcademicProposal | null = null
  const client: PlanningSessionClient = {
    fetchCatalog: async () => { calls.push('catalog'); return catalog },
    estimateDemand: async () => { throw new Error('not used') },
    createProposal: async () => { calls.push('generate'); lastProposal = makeProposal(); return lastProposal },
    adjustProposal: async () => { calls.push('adjust'); return makeProposal({ editVersion: 1 }) },
    fetchDrafts: async () => { calls.push('drafts'); return { items: [], unavailableCount: 0 } },
    saveDraft: async (request) => {
      calls.push('save')
      const current = request.id ? drafts.get(request.id) : undefined
      if (current && current.version !== request.expectedVersion) throw new Error('La propuesta cambió en otra sesión; recárgala antes de continuar')
      const saved = toSaved(request, lastProposal)
      drafts.set(saved.id, saved)
      return saved
    },
    resumeDraft: async (id) => ({ draft: drafts.get(id)! }),
    submitReview: async () => { throw new Error('not used') },
    respondReview: async () => { throw new Error('not used') },
    approveDraft: async (id) => { const draft = { ...drafts.get(id)!, state: 'approved' as const, version: drafts.get(id)!.version + 1 }; drafts.set(id, draft); return draft },
    publishDraft: async (id) => { const draft = { ...drafts.get(id)!, state: 'published' as const, version: drafts.get(id)!.version + 1 }; drafts.set(id, draft); return draft },
    forkDraft: async () => { throw new Error('not used') },
    ...overrides,
  }
  return { client, drafts, calls }
}

async function loadedSession(overrides: Partial<PlanningSessionClient> = {}) {
  const memory = memoryClient(overrides)
  const session = createPlanningSession(memory.client)
  await session.commands.loadCatalog()
  return { session, ...memory }
}

test('catalog load applies period defaults without marking the workspace dirty', async () => {
  const { session } = await loadedSession()
  const state = session.getState()
  assert.equal(state.catalog, catalog)
  assert.equal(state.busy.catalog, false)
  assert.equal(state.dirty, false)
  assert.equal(state.capacities.CS101, '45')
  assert.equal(state.lectiveHourMinutes, 60)
  assert.equal(state.resources.teachers.length, 1)
  assert.deepEqual(state.selectedCourses, [])
})

test('cancelled catalog request cannot finish the next catalog load', async () => {
  const obsolete = deferred<AcademicCatalog>()
  const current = deferred<AcademicCatalog>()
  let calls = 0
  const { client } = memoryClient({ fetchCatalog: () => ++calls === 1 ? obsolete.promise : current.promise })
  const session = createPlanningSession(client)
  const first = session.commands.loadCatalog()
  const latest = session.commands.loadCatalog()
  obsolete.reject(new DOMException('Synthetic cancelled request', 'AbortError'))
  await first
  assert.equal(session.getState().busy.catalog, true)
  assert.equal(derivePlanningView(session.getState()).disabledSaveReason, 'Cargando catálogo local…')
  current.resolve(catalog)
  await latest
  assert.equal(session.getState().catalog, catalog)
  assert.equal(session.getState().busy.catalog, false)
})

test('obsolete catalog success cannot reset edits made after the current catalog loaded', async () => {
  const obsolete = deferred<AcademicCatalog>()
  const current = deferred<AcademicCatalog>()
  let calls = 0
  const { client } = memoryClient({ fetchCatalog: () => ++calls === 1 ? obsolete.promise : current.promise })
  const session = createPlanningSession(client)
  const first = session.commands.loadCatalog()
  const latest = session.commands.loadCatalog()
  current.resolve(catalog)
  await latest
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  session.commands.edit({ type: 'updateDemand', courseId: 'CS101', value: '25' })
  obsolete.resolve(catalog)
  await first
  assert.deepEqual(session.getState().selectedCourses, ['CS101'])
  assert.equal(session.getState().demands.CS101, '25')
})

test('generate stores the proposal; a stale result after an invalidating edit is ignored', async () => {
  const { session } = await loadedSession()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.generate()
  assert.equal(session.getState().proposal?.proposalId, 'proposal-synthetic')
  assert.equal(session.getState().busy.generate, false)

  const pending = deferred<AcademicProposal>()
  const slow = await loadedSession({ createProposal: () => pending.promise })
  slow.session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  const run = slow.session.commands.generate()
  slow.session.commands.edit({ type: 'updatePattern', courseId: 'CS101', value: 'P1' })
  pending.resolve(makeProposal())
  await run
  assert.equal(slow.session.getState().proposal, null)
  assert.equal(slow.session.getState().busy.generate, false)
})

test('edits follow the ported invalidation table', async () => {
  const { session } = await loadedSession()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.generate()
  const estimate = { revision: ACADEMIC_REVISION } as unknown as PlanningSessionState['demandEstimate']
  const withEstimate: PlanningSessionState = { ...session.getState(), demandEstimate: estimate }

  const demand = reducePlanningSession(withEstimate, { type: 'updateDemand', courseId: 'CS101', value: '30' })
  assert.equal(demand.proposal, null, 'updateDemand invalidates the proposal')
  assert.equal(demand.demandEstimate, estimate, 'updateDemand keeps the demand estimate')
  assert.equal(demand.dirty, true)

  const source = reducePlanningSession(withEstimate, { type: 'changeDemandSource', value: 'independent-120-v1' })
  assert.ok(source.proposal, 'changeDemandSource keeps the proposal')
  assert.equal(source.demandEstimate, null, 'changeDemandSource clears the estimate')

  const capacity = reducePlanningSession(withEstimate, { type: 'updateCapacity', courseId: 'CS101', value: '30' })
  assert.equal(capacity.proposal, null)
  assert.equal(capacity.demandEstimate, null)

  const title = reducePlanningSession({ ...withEstimate, dirty: false }, { type: 'setTitle', title: 'Otra' })
  assert.ok(title.proposal, 'title keeps the proposal')
  assert.equal(title.dirty, true)
})

test('a configuration edit returns ready-for-review to draft; a title edit does not', () => {
  const ready: PlanningSessionState = { ...initialPlanningSessionState(), catalog,
    draft: { ...initialPlanningSessionState().draft, state: 'ready-for-review' } }
  assert.equal(reducePlanningSession(ready, { type: 'updateAllocationPolicy', value: 'balanced' }).draft.state, 'draft')
  assert.equal(reducePlanningSession(ready, { type: 'setTitle', title: 'X' }).draft.state, 'ready-for-review')
})

test('save stores the version, clears dirty and refreshes the draft list', async () => {
  const { session, calls } = await loadedSession()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.generate()
  await session.commands.save()
  const state = session.getState()
  assert.equal(state.draft.id, draftId)
  assert.equal(state.draft.version, 1)
  assert.equal(state.dirty, false)
  assert.equal(state.message, 'Guardada · versión 1.')
  assert.equal(state.busy.draft, false)
  await Promise.resolve()
  assert.ok(calls.includes('drafts'))
})

test('save rejects invalid demand without calling the server', async () => {
  const { session, calls } = await loadedSession()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  session.commands.edit({ type: 'updateDemand', courseId: 'CS101', value: '' })
  await session.commands.save()
  assert.match(session.getState().errors.draft ?? '', /Completa demandas y capacidades/)
  assert.equal(calls.includes('save'), false)
})

test('an edit during save keeps the workspace dirty and reports the older capture', async () => {
  const pending = deferred<AcademicSavedDraft>()
  const { session } = await loadedSession({ saveDraft: () => pending.promise })
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  const run = session.commands.save()
  session.commands.edit({ type: 'setTitle', title: 'Editada durante el guardado' })
  pending.resolve({ id: draftId, version: 1, title: 'x', state: 'draft', createdAt: '', updatedAt: '',
    configuration: {} as AcademicSavedDraft['configuration'], demandBase: null, proposal: null })
  await run
  assert.equal(session.getState().dirty, true)
  assert.match(session.getState().message ?? '', /captura anterior/)
  assert.equal(session.getState().draft.version, 1)
})

test('a version conflict keeps the local workspace and reports the error on save only', async () => {
  const { session, drafts } = await loadedSession()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.save()
  drafts.set(draftId, { ...drafts.get(draftId)!, version: 5 })
  session.commands.edit({ type: 'updateDemand', courseId: 'CS101', value: '25' })
  await session.commands.save()
  const state = session.getState()
  assert.match(state.errors.draft ?? '', /No se guardaron los cambios\. La propuesta cambió/)
  assert.equal(state.dirty, true)
  assert.equal(state.demands.CS101, '25')
  assert.deepEqual(state.selectedCourses, ['CS101'])
  assert.equal(state.errors.proposal, null)
})

test('an adjustment failure keeps the proposal and does not touch other errors', async () => {
  const { session } = await loadedSession()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.generate()
  const before = session.getState()
  const blockState = reducePlanningSession(before, { type: 'draft/rejected', message: 'error previo de guardado' })
  const local = createPlanningSession(memoryClient({ adjustProposal: async () => { throw new Error('cruce') } }).client, blockState)
  local.commands.edit({ type: 'startBlockReview', block: { sectionId: 'A', sessionIds: ['CS101-L1'], teacherId: 'T-REF',
    day: 1, startMinute: 480 } as unknown as PlanningBlock })
  assert.ok(local.getState().editingBlock)
  await local.commands.adjust()
  const after = local.getState()
  assert.match(after.errors.adjustment ?? '', /No se aplicó el ajuste.*cruce/)
  assert.equal(after.errors.draft, 'error previo de guardado')
  assert.equal(after.proposal?.proposalId, 'proposal-synthetic')
})

test('resume hydrates the saved workspace and proposal', async () => {
  const shared = memoryClient()
  const writer = createPlanningSession(shared.client)
  await writer.commands.loadCatalog()
  writer.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  writer.commands.edit({ type: 'updateDemand', courseId: 'CS101', value: '33' })
  await writer.commands.generate()
  await writer.commands.save()
  const reader = createPlanningSession(shared.client)
  await reader.commands.loadCatalog()
  assert.equal(await reader.commands.resume(draftId, 1), true)
  const state = reader.getState()
  assert.deepEqual(state.selectedCourses, ['CS101'])
  assert.equal(state.demands.CS101, '33')
  assert.equal(state.lectiveHourMinutes, 60)
  assert.equal(state.draft.version, 1)
  assert.equal(state.dirty, false)
  assert.equal(state.proposal?.proposalId, 'proposal-synthetic')
  assert.match(state.message ?? '', /recuperada\. Puedes continuar/)
})

test('fork of a published draft replaces the workspace with the new draft', async () => {
  const forkedId = '123e4567-e89b-42d3-a456-426614174001'
  const { session, drafts } = await loadedSession({
    forkDraft: async (id) => ({ ...drafts.get(id)!, id: forkedId, version: 1, state: 'draft' as const }),
  })
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.save()
  drafts.set(draftId, { ...drafts.get(draftId)!, state: 'published' })
  assert.equal(await session.commands.fork(draftId, 1), true)
  const state = session.getState()
  assert.equal(state.draft.id, forkedId)
  assert.equal(state.draft.version, 1)
  assert.equal(state.busy.draft, false)
  assert.equal(state.dirty, false)
})

test('resume and fork resolve false when the workspace was not replaced', async () => {
  const { session } = await loadedSession()
  assert.equal(await session.commands.resume('missing-draft', 1), false)
  assert.equal(session.getState().draft.id, null)
  assert.ok(session.getState().errors.draft)
  assert.equal(await session.commands.fork(draftId, 1), false)
  assert.equal(session.getState().draft.id, null)
})

test('approve and publish move the saved state and lock the draft', async () => {
  const { session, drafts } = await loadedSession()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.save()
  drafts.set(draftId, { ...drafts.get(draftId)!, state: 'ready-for-approval' })
  await session.commands.resume(draftId, 1)
  await session.commands.approve()
  assert.equal(session.getState().draft.savedState, 'approved')
  assert.match(session.getState().message ?? '', /Aprobada \(simulada\) · versión 2/)
  await session.commands.publish(null)
  assert.equal(session.getState().draft.savedState, 'published')
  session.commands.edit({ type: 'startBlockReview', block: { sectionId: 'A', sessionIds: [] as string[], teacherId: 'T-REF', day: 1,
    startMinute: 480 } as unknown as PlanningBlock })
  assert.equal(session.getState().editingBlock, null, 'a published draft cannot be adjusted')
})

const baseState = (): PlanningSessionState => ({ ...initialPlanningSessionState(), catalog, busy: { ...initialPlanningSessionState().busy, catalog: false },
  demands: { CS101: '18', CS102: '12' }, capacities: { CS101: '45', CS102: '45' } })
const review = (statuses: Array<'pending' | 'conformity' | 'changes-requested' | 'outdated'>): AcademicTeacherReview => ({
  round: 1, submittedVersion: 2, submittedAt: '2026-11-07T10:00:00.000Z', history: [],
  teachers: statuses.map((status, index) => ({ teacherId: `T${index}`, teacherName: `Docente ${index}`, fingerprint: 'f',
    status, observation: '', decisionVersion: null, decidedAt: null })) })

test('primary action follows every D7 row', () => {
  const base = baseState()
  const withDraft = (patch: Partial<PlanningSessionState['draft']>, extra: Partial<PlanningSessionState> = {}) =>
    ({ ...base, ...extra, draft: { ...base.draft, id: draftId, version: 2, ...patch } })

  assert.equal(derivePlanningPrimaryAction(base, 'preparacion')?.id, 'review-offer')
  const invalid = { ...base, selectedCourses: ['CS101', 'CS102'], demands: { CS101: '', CS102: '12' } }
  assert.deepEqual(derivePlanningPrimaryAction(invalid, 'preparacion'), { id: 'review-offer', label: 'Revisar oferta (1)', count: 1 })
  assert.equal(derivePlanningPrimaryAction({ ...base, selectedCourses: ['CS101'] }, 'preparacion')?.id, 'generate')

  assert.equal(derivePlanningPrimaryAction(base, 'horario')?.id, 'back-preparation')
  const partial = makeProposal({ status: 'search-limit', coverageComplete: false, assignments: [],
    pending: [{ sessionId: 'CS101-L1', sectionId: 'A' }] as AcademicProposal['pending'] })
  assert.deepEqual(derivePlanningPrimaryAction({ ...base, proposal: partial }, 'horario'), { id: 'resolve-pending', label: 'Resolver pendientes (1)', count: 1 })
  assert.equal(derivePlanningPrimaryAction({ ...base, proposal: makeProposal(), dirty: true }, 'horario')?.id, 'save')
  assert.equal(derivePlanningPrimaryAction(withDraft({}, { proposal: makeProposal() }), 'horario')?.id, 'submit-review')

  assert.equal(derivePlanningPrimaryAction(withDraft({ review: review(['pending', 'conformity']) }), 'revision')?.label, 'Registrar respuesta (1)')
  assert.equal(derivePlanningPrimaryAction(withDraft({ review: review(['conformity', 'conformity']) }), 'revision')?.id, 'to-approval')
  assert.equal(derivePlanningPrimaryAction(withDraft({ review: review(['changes-requested']) }), 'revision')?.id, 'back-schedule')
  assert.equal(derivePlanningPrimaryAction(base, 'revision')?.id, 'back-schedule')

  assert.equal(derivePlanningPrimaryAction(withDraft({ savedState: 'ready-for-approval' }), 'aprobacion')?.id, 'approve')
  assert.equal(derivePlanningPrimaryAction(withDraft({ savedState: 'ready-for-approval' }, { dirty: true }), 'aprobacion')?.id, 'back-review')
  assert.equal(derivePlanningPrimaryAction(withDraft({ savedState: 'approved' }), 'aprobacion')?.id, 'publish', 'after approval, publishing is the next valid transition (D7)')
  assert.equal(derivePlanningPrimaryAction(withDraft({ savedState: 'published' }), 'aprobacion'), null)
})


test('draft label distinguishes unsaved work from every persisted lifecycle state', () => {
  const state = initialPlanningSessionState()
  assert.equal(derivePlanningDraftLabel(state), 'Borrador nuevo · Sin guardar')
  assert.equal(derivePlanningDraftLabel({ ...state, dirty: true }), 'Cambios sin guardar.')
  const labels = {
    draft: 'Borrador', 'ready-for-review': 'Lista para revisión', 'in-review': 'En revisión docente',
    'ready-for-approval': 'Lista para aprobación', approved: 'Aprobada (simulada)', published: 'Publicada (simulada)',
  } as const
  for (const savedState of Object.keys(labels) as (keyof typeof labels)[]) {
    const persisted = { ...state, draft: { ...state.draft, id: draftId, version: 4, savedState } }
    assert.equal(derivePlanningDraftLabel(persisted), `${labels[savedState]} r4 · Guardado`)
    assert.equal(derivePlanningDraftLabel({ ...persisted, dirty: true }), 'Cambios sin guardar · versión guardada 4.')
  }
})

test('generation reports only an accepted result so the caller can navigate safely', async () => {
  const { session } = await loadedSession()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  assert.equal(await session.commands.generate(), true)
  const failed = await loadedSession({ createProposal: async () => { throw new Error('Servicio no disponible') } })
  assert.equal(await failed.session.commands.generate(), false)
  const invalid = await loadedSession({ createProposal: async () => makeProposal({ status: 'invalid-input' }) })
  assert.equal(await invalid.session.commands.generate(), false)
  const pending = deferred<AcademicProposal>()
  const stale = await loadedSession({ createProposal: () => pending.promise })
  const generating = stale.session.commands.generate()
  stale.session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  pending.resolve(makeProposal())
  assert.equal(await generating, false, 'an invalidated result must not navigate')
})

test('save translates a title validation error without losing local edits', async () => {
  const { session } = await loadedSession({ saveDraft: async () => { throw new TypeError('title: texto inválido') } })
  session.commands.edit({ type: 'setTitle', title: '' })
  await session.commands.save()
  assert.equal(session.getState().errors.draft, 'No se guardaron los cambios. Escribe un nombre para la propuesta.')
  assert.equal(session.getState().draft.title, '')
  assert.equal(session.getState().dirty, true)
})


test('planning progress starts at preparation without a usable proposal', () => {
  const state = initialPlanningSessionState()
  const expected = { preparacion: 'current', horario: 'upcoming', revision: 'upcoming', aprobacion: 'upcoming' }
  assert.deepEqual(derivePlanningProgress(state), expected)
  assert.deepEqual(derivePlanningProgress({ ...state, proposal: makeProposal({ status: 'invalid-input' }) }), expected)
})

test('planning progress reaches scheduling with a usable draft proposal', () => {
  const state = initialPlanningSessionState()
  for (const status of ['complete', 'search-limit', 'impossible'] as const) {
    assert.deepEqual(derivePlanningProgress({ ...state, proposal: makeProposal({ status }) }),
      { preparacion: 'done', horario: 'current', revision: 'upcoming', aprobacion: 'upcoming' })
  }
})

test('planning progress derives review from the saved lifecycle', () => {
  const state = initialPlanningSessionState()
  assert.deepEqual(derivePlanningProgress({ ...state, draft: { ...state.draft, savedState: 'in-review' } }),
    { preparacion: 'done', horario: 'done', revision: 'current', aprobacion: 'upcoming' })
})

test('planning progress reaches approval for ready and approved versions', () => {
  const state = initialPlanningSessionState()
  for (const savedState of ['ready-for-approval', 'approved'] as const) {
    assert.deepEqual(derivePlanningProgress({ ...state, draft: { ...state.draft, savedState } }),
      { preparacion: 'done', horario: 'done', revision: 'done', aprobacion: 'current' })
  }
})

test('planning progress marks every step done after publication', () => {
  const state = initialPlanningSessionState()
  assert.deepEqual(derivePlanningProgress({ ...state, draft: { ...state.draft, savedState: 'published' } }),
    { preparacion: 'done', horario: 'done', revision: 'done', aprobacion: 'done' })
})


test('generation and saving carry the same explicit demo lective context', async () => {
  let generatedRequest: Parameters<PlanningSessionClient['createProposal']>[0] | undefined
  let savedRequest: AcademicDraftSaveRequest | undefined
  const memory = memoryClient({ createProposal: async (request) => { generatedRequest = request; return makeProposal() } })
  const saveDraft = memory.client.saveDraft
  memory.client.saveDraft = async (request) => { savedRequest = request; return saveDraft(request) }
  const session = createPlanningSession(memory.client)
  await session.commands.loadCatalog()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.generate()
  await session.commands.save()
  assert.equal(generatedRequest?.lectiveHourMinutes, 60)
  assert.equal(generatedRequest?.academicPeriod, '2027-I')
  assert.equal(savedRequest?.configuration.lectiveHourMinutes, 60)
  assert.deepEqual(savedRequest?.configuration.request, generatedRequest)
})

test('lective hour choice invalidates the proposal, is saved with the workspace and can be unset', async () => {
  const memory = memoryClient()
  const session = createPlanningSession(memory.client)
  await session.commands.loadCatalog()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.generate()
  assert.ok(session.getState().proposal)
  session.commands.edit({ type: 'updateLectiveHourMinutes', value: 50 })
  assert.equal(session.getState().proposal, null)
  assert.equal(session.getState().lectiveHourMinutes, 50)
  assert.equal(session.getState().dirty, true)
  session.commands.edit({ type: 'updateLectiveHourMinutes', value: undefined })
  assert.equal(session.getState().lectiveHourMinutes, undefined)
  assert.equal(buildPlanningWorkspace(session.getState()).lectiveHourMinutes, undefined)
})

test('the decisions of an outdated proposal stay visible until the next generation', async () => {
  const decisions = [{ id: 'D1', kind: 'planning-window' as const, teacherId: null, courseIds: [], exceptionKind: null, additionalMinutes: 0,
    sectionsUnlocked: 2, basis: 'window-precheck' as const, policyChange: { allowAfternoon: true as const } }]
  const memory = memoryClient({ createProposal: async () => makeProposal({ decisions }) })
  const session = createPlanningSession(memory.client)
  await session.commands.loadCatalog()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.generate()
  assert.equal(session.getState().staleDecisions, null)
  session.commands.edit({ type: 'updateResources', value: { teachers: [], rooms: [] } })
  assert.equal(session.getState().proposal, null)
  assert.deepEqual(session.getState().staleDecisions?.decisions, decisions)
  session.commands.edit({ type: 'updatePlanningException', key: 'allowSaturday', checked: true })
  assert.deepEqual(session.getState().staleDecisions?.decisions, decisions, 'a second edit keeps the snapshot')
  await session.commands.generate()
  assert.equal(session.getState().staleDecisions, null)
})

test('a publication refused for missing load authorization keeps the blocker list until the draft changes', async () => {
  const blockers = [{ teacherId: 'T1', assignedMinutes: 960, authorizedMaxMinutes: 720, reason: 'over-authorized-load' as const,
    requiredAuthorization: 'voluntary-declaration' as const, sourceIds: ['OF-02'] }]
  const memory = memoryClient({ publishDraft: async () => { throw new AcademicLoadAuthorizationError('Falta registrar la autorización formal.', blockers) } })
  const session = createPlanningSession(memory.client)
  await session.commands.loadCatalog()
  session.commands.edit({ type: 'toggleCourse', courseId: 'CS101', checked: true })
  await session.commands.save()
  memory.drafts.set(draftId, { ...memory.drafts.get(draftId)!, state: 'ready-for-approval' })
  await session.commands.resume(draftId, 1)
  await session.commands.approve()
  assert.equal(session.getState().draft.savedState, 'approved')
  await session.commands.publish(null)
  assert.deepEqual(session.getState().releaseBlockers, blockers)
  assert.match(session.getState().errors.draft ?? '', /autorización formal/)
  session.commands.edit({ type: 'setTitle', title: 'Otro nombre' })
  assert.equal(session.getState().releaseBlockers, null)
})

const searchSnapshot = (proposal: AcademicProposal | null = null, state: 'running' | 'cancelled' | 'completed' = 'running') => ({
  jobId: 'synthetic-job', state, phase: 'coverage' as const, elapsedSeconds: 1, budgetSeconds: 30,
  progress: { requiredSessions: 1, scheduledSessions: proposal ? 1 : 0, requiredSections: 1, scheduledSections: proposal ? 1 : 0, improvements: proposal ? 1 : 0 }, proposal, error: null,
})
test('jobs expose incumbent while busy, prevent save and cancel preserving witness', async () => {
  const { session, calls } = await loadedSession({ startSearch: async () => searchSnapshot(makeProposal()),
    pollSearch: async () => searchSnapshot(makeProposal()), cancelSearch: async () => searchSnapshot(makeProposal(), 'cancelled') })
  const running = session.commands.generate()
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.ok(session.getState().proposal)
  assert.equal(session.getState().busy.generate, true)
  assert.equal(derivePlanningView(session.getState()).canSave, false)
  await session.commands.save()
  assert.ok(!calls.includes('save'))
  await session.commands.cancelSearch()
  await running
  assert.equal(session.getState().search?.state, 'cancelled')
  assert.ok(session.getState().proposal)
  assert.equal(session.getState().busy.generate, false)
  session.dispose()
})
test('late starts after dispose, configuration, period or cancel are cancelled without polling', async () => {
  for (const change of ['dispose', 'configuration', 'period', 'cancel', 'restart']) {
    const late = deferred<ReturnType<typeof searchSnapshot>>()
    const cancelled: string[] = []
    let starts = 0
    const { session } = await loadedSession({ startSearch: () => ++starts === 1 ? late.promise : Promise.resolve(searchSnapshot(null, 'completed')),
      pollSearch: async () => { throw new Error('Must not poll stale job') },
      cancelSearch: async id => { cancelled.push(id); return searchSnapshot(null, 'cancelled') } })
    const pending = session.commands.generate()
    if (change === 'dispose') session.dispose()
    if (change === 'configuration') session.commands.edit({ type: 'updateDemand', courseId: 'CS101', value: '20' })
    if (change === 'period') session.commands.edit({ type: 'applyPeriodDefaults', period: '2026-II' })
    if (change === 'cancel') await session.commands.cancelSearch()
    if (change === 'restart') await session.commands.generate()
    late.resolve(searchSnapshot())
    assert.equal(await pending, false)
    assert.ok(cancelled.includes('synthetic-job'))
    if (change !== 'dispose') assert.equal(session.getState().busy.generate, false)
    assert.equal(session.getState().proposal, null)
    session.dispose()
  }
})
test('job errors do not fall back to synchronous generation', async () => {
  const { session, calls } = await loadedSession({ startSearch: async () => { throw new Error('engine unavailable') },
    pollSearch: async () => searchSnapshot(), cancelSearch: async () => searchSnapshot(null, 'cancelled') })
  assert.equal(await session.commands.generate(), false)
  assert.ok(!calls.includes('generate'))
  assert.match(session.getState().errors.proposal!, /engine unavailable/)
  session.dispose()
})

test('cancellation without a new incumbent keeps the old draft proposal', async () => {
  const memory = memoryClient({ startSearch: async () => searchSnapshot(), pollSearch: async () => searchSnapshot(),
    cancelSearch: async () => searchSnapshot(null, 'cancelled') })
  const base = createPlanningSession(memory.client)
  await base.commands.loadCatalog()
  const old = makeProposal()
  const initial = reducePlanningSession(base.getState(), { type: 'generate/succeeded', token: base.getState().intents.proposal, proposal: old, resources: base.getState().resources })
  base.dispose()
  const session = createPlanningSession(memory.client, initial)
  const pending = session.commands.generate()
  await new Promise(resolve => setTimeout(resolve, 5))
  await session.commands.cancelSearch()
  await pending
  assert.equal(session.getState().proposal, old)
  assert.equal(session.getState().search?.state, 'cancelled')
  session.dispose()
})
test('polls are sequential and an aborted stale poll cannot replace the current configuration', async () => {
  const late = deferred<ReturnType<typeof searchSnapshot>>()
  let polls = 0
  let signal: AbortSignal | undefined
  const { session } = await loadedSession({ startSearch: async () => searchSnapshot(makeProposal()),
    pollSearch: (_id, nextSignal) => { polls++; signal = nextSignal; return late.promise },
    cancelSearch: async () => searchSnapshot(null, 'cancelled') })
  const pending = session.commands.generate()
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.equal(polls, 1)
  session.commands.edit({ type: 'updateDemand', courseId: 'CS101', value: '99' })
  assert.equal(signal?.aborted, true)
  late.resolve(searchSnapshot(makeProposal(), 'completed'))
  await pending
  assert.equal(session.getState().proposal, null)
  assert.equal(polls, 1)
  session.dispose()
})
test('failed cancellation keeps save gated and retry recovers', async () => {
  let offline = true
  const { session } = await loadedSession({ startSearch: async () => searchSnapshot(makeProposal()),
    pollSearch: async () => searchSnapshot(), cancelSearch: async () => { if (offline) throw new Error('offline'); return searchSnapshot(null, 'cancelled') } })
  const pending = session.commands.generate()
  await new Promise(resolve => setTimeout(resolve, 5))
  await session.commands.cancelSearch()
  assert.equal(session.getState().busy.generate, true)
  assert.equal(derivePlanningView(session.getState()).canSave, false)
  assert.match(session.getState().errors.proposal ?? '', /[Rr]eintent/)
  offline = false
  await session.commands.cancelSearch()
  await pending
  assert.equal(session.getState().busy.generate, false)
  session.dispose()
})
test('cancel before start rejection settles instead of swallowing failure forever', async () => {
  const late = deferred<ReturnType<typeof searchSnapshot>>()
  const { session } = await loadedSession({ startSearch: () => late.promise,
    pollSearch: async () => searchSnapshot(), cancelSearch: async () => searchSnapshot(null, 'cancelled') })
  const pending = session.commands.generate()
  await session.commands.cancelSearch()
  late.reject(new Error('lost start'))
  await pending
  assert.equal(session.getState().busy.generate, false)
  session.dispose()
})
test('uncertain obsolete cleanup gates edits and new starts until retry recovers', async () => {
  let offline = true
  let starts = 0
  const { session } = await loadedSession({ startSearch: async () => { starts++; return searchSnapshot() },
    pollSearch: async () => searchSnapshot(), cancelSearch: async () => { if (offline) throw new Error('offline'); return searchSnapshot(null, 'cancelled') } })
  const running = session.commands.generate()
  await new Promise(resolve => setTimeout(resolve, 5))
  session.commands.edit({ type: 'applyPeriodDefaults', period: '2026-II' })
  await running
  const before = session.getState()
  session.commands.edit({ type: 'updateDemand', courseId: 'CS101', value: '999' })
  assert.equal(session.getState(), before)
  assert.equal(await session.commands.generate(), false)
  assert.equal(starts, 1)
  assert.equal(derivePlanningView(session.getState()).canSave, false)
  offline = false
  await session.commands.cancelSearch()
  assert.equal(session.getState().busy.generate, false)
  assert.equal(session.getState().proposal, null)
  session.dispose()
})
test('lost start response uses caller UUID to reconcile accepted work', async () => {
  let known: string | undefined
  let cancelled: string | undefined
  const { session } = await loadedSession({ startSearch: async (_request, id) => { known = id; throw new Error('lost accepted response') },
    pollSearch: async () => searchSnapshot(), cancelSearch: async id => { cancelled = id; return { ...searchSnapshot(null, 'cancelled'), jobId: id } } })
  await session.commands.generate()
  assert.match(known!, /^[0-9a-f-]{36}$/)
  assert.equal(cancelled, known)
  assert.equal(session.getState().busy.generate, false)
  session.dispose()
})
