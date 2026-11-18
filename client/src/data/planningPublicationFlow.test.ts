import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { ACADEMIC_REVISION } from '../../../shared/programacion-academica-api.mjs'
import type {
  AcademicPublication,
  AcademicPublicationList,
  AcademicReleasePreview,
  AcademicScheduleSnapshot,
} from '../../../shared/programacion-academica-api.mjs'
import {
  createPublicationFlowController,
  derivePublicationView,
  isPublicationListFresh,
  nextAutoListRefreshReason,
  publicationScopeKey,
  type PublicationFlowClient,
  type PublicationFlowState,
  type PublicationScope,
} from './planningPublicationFlow.ts'

const draftIdA = '123e4567-e89b-42d3-a456-426614174000'
const draftIdB = '123e4567-e89b-42d3-a456-426614174001'
const oldPubId = '123e4567-e89b-42d3-a456-426614174099'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeSchedule(): AcademicScheduleSnapshot {
  return {
    schoolId: 'SISTEMAS',
    academicPeriod: '2027-I',
    courses: [{ courseId: 'CS101', name: 'Curso sintético', cycle: 1 }],
    sections: [{ sectionId: 'A', courseId: 'CS101', courseName: 'Curso sintético', capacity: 20, deliveryMode: 'continuous' }],
    assignments: [
      {
        sessionId: 'CS101-L1',
        sectionId: 'A',
        courseId: 'CS101',
        courseName: 'Curso sintético',
        teacherId: 'T1',
        teacherName: 'Docente sintético',
        roomId: 'R1',
        roomName: 'Aula sintética',
        day: 1,
        startMinute: 480,
        endMinute: 570,
        sessionType: 'Teoría',
      },
    ],
    revision: ACADEMIC_REVISION,
  } as unknown as AcademicScheduleSnapshot
}

function makeReleasePreview(overrides: Partial<AcademicReleasePreview> = {}): AcademicReleasePreview {
  return {
    id: draftIdA,
    version: 85,
    title: 'Propuesta SISTEMAS 2027-I',
    state: 'approved',
    schedule: makeSchedule(),
    ...overrides,
  } as AcademicReleasePreview
}

function makePublication(overrides: Partial<AcademicPublication> = {}): AcademicPublication {
  return {
    id: draftIdA,
    title: 'Propuesta SISTEMAS 2027-I',
    approvedVersion: 85,
    publicationVersion: 2,
    publishedAt: '2026-11-17T10:00:00.000Z',
    schedule: makeSchedule(),
    ...overrides,
  } as AcademicPublication
}

function makeSummary(overrides: Partial<AcademicPublicationList['items'][number]> = {}): AcademicPublicationList['items'][number] {
  return {
    id: oldPubId,
    title: 'Publicación histórica sintética',
    approvedVersion: 10,
    publicationVersion: 1,
    sourceProposalVersion: 9,
    approvedAt: '2026-11-10T09:00:00.000Z',
    publishedAt: '2026-11-10T10:00:00.000Z',
    ...overrides,
  }
}

function makeList(overrides: Partial<AcademicPublicationList> = {}): AcademicPublicationList {
  return {
    currentId: oldPubId,
    items: [makeSummary()],
    ...overrides,
  } as AcademicPublicationList
}

function memoryFlowClient(overrides: Partial<PublicationFlowClient> = {}): PublicationFlowClient {
  return {
    fetchPublications: async () => ({ currentId: null, items: [] }),
    fetchPublication: async (id) => makePublication({ id, publicationVersion: 1, approvedVersion: 10, title: 'Histórica' }),
    fetchCurrentPublication: async () => makePublication(),
    fetchReleasePreview: async (id) => makeReleasePreview({ id }),
    ...overrides,
  }
}

test('CAS safety: legitimate null currentId allows publish when list is fresh, unloaded or errored list blocks publish', async () => {
  const approvedScope: PublicationScope = { draftId: draftIdA, draftVersion: 85, draftState: 'approved', dirty: false }
  const flow = createPublicationFlowController(
    memoryFlowClient({
      fetchPublications: async () => ({ currentId: null, items: [] }),
      fetchReleasePreview: async () => makeReleasePreview({ id: draftIdA, version: 85, state: 'approved' }),
    }),
    approvedScope,
  )

  // Before loading publication list: cannot publish even though currentId is not known yet.
  await flow.refreshPreview()
  let view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: approvedScope })
  assert.equal(view.currentPreview?.state, 'approved')
  assert.equal(view.listFresh, false)
  assert.equal(view.canPublish, false, 'unloaded list must never be mistaken for currentId === null')

  // After loading { currentId: null, items: [] } for the approved scope: publishing IS allowed.
  await flow.refreshPublications('scope', true)
  view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: approvedScope })
  assert.equal(flow.getState().publicationList?.currentId, null)
  assert.equal(view.listFresh, true)
  assert.equal(view.canPublish, true)
})

test('transition to approved invalidates pre-approval list, rejects stale async list responses, and enables publish once fresh list + preview settle', async () => {
  const readyScope: PublicationScope = { draftId: draftIdA, draftVersion: 84, draftState: 'ready-for-approval', dirty: false }
  const approvedScope: PublicationScope = { draftId: draftIdA, draftVersion: 85, draftState: 'approved', dirty: false }
  const preApproveList = deferred<AcademicPublicationList>()
  const postApproveList = deferred<AcademicPublicationList>()
  let listCall = 0

  const flow = createPublicationFlowController(
    memoryFlowClient({
      fetchPublications: () => (++listCall === 1 ? preApproveList.promise : postApproveList.promise),
      fetchReleasePreview: async () =>
        makeReleasePreview({
          id: draftIdA,
          version: flow.getState().scope.draftVersion ?? 85,
          state: flow.getState().scope.draftState,
        }),
    }),
    readyScope,
  )

  // Mount triggers list call #1 while in ready-for-approval.
  const firstListReq = flow.refreshPublications('mount', true)
  // User approves (via parent or panel) BEFORE pre-approval list resolves.
  flow.syncScope(approvedScope)
  assert.equal(isPublicationListFresh(flow.getState()), false)
  assert.equal(nextAutoListRefreshReason(flow.getState(), true), 'scope')

  // Auto-refresh starts call #2 for approved scope.
  const secondListReq = flow.refreshPublications('scope', true)
  await flow.refreshPreview()

  // Stale call #1 resolves with wrong currentId=null while call #2 is still in flight -> must NOT enable publish!
  preApproveList.resolve({ currentId: null, items: [] })
  await firstListReq
  let view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: approvedScope })
  assert.equal(view.listFresh, false, 'stale pre-approval list response must be ignored')
  assert.equal(view.canPublish, false)

  // Fresh call #2 resolves with actual server currentId -> publish enables immediately.
  postApproveList.resolve(makeList())
  await secondListReq
  view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: approvedScope })
  assert.equal(view.listFresh, true)
  assert.equal(flow.getState().publicationList?.currentId, oldPubId)
  assert.equal(view.canPublish, true)
})

test('stale list from draft A cannot enable publish after switching to draft B', async () => {
  const approvedA: PublicationScope = { draftId: draftIdA, draftVersion: 85, draftState: 'approved', dirty: false }
  const approvedB: PublicationScope = { draftId: draftIdB, draftVersion: 12, draftState: 'approved', dirty: false }
  const listForA = deferred<AcademicPublicationList>()
  const listForB = deferred<AcademicPublicationList>()
  let call = 0

  const flow = createPublicationFlowController(
    memoryFlowClient({
      fetchPublications: () => (++call === 1 ? listForA.promise : listForB.promise),
      fetchReleasePreview: async (id) =>
        makeReleasePreview({ id, version: id === draftIdA ? 85 : 12, state: 'approved' }),
    }),
    approvedA,
  )

  const reqA = flow.refreshPublications('scope', true)
  // User resumes draft B (also approved) while reqA is still pending.
  flow.syncScope(approvedB)
  await flow.refreshPreview()
  const reqB = flow.refreshPublications('scope', true)

  listForA.resolve({ currentId: null, items: [] })
  await reqA
  let view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: approvedB })
  assert.equal(view.listFresh, false, 'response belonging to draft A scope must be rejected for draft B')
  assert.equal(view.canPublish, false)

  listForB.resolve(makeList())
  await reqB
  view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: approvedB })
  assert.equal(view.listFresh, true)
  assert.equal(view.canPublish, true)
})

test('list failure keeps publicationList null, avoids infinite retry loops, and supports manual retry and entering stage retry', async () => {
  const approvedScope: PublicationScope = { draftId: draftIdA, draftVersion: 85, draftState: 'approved', dirty: false }
  let shouldFail = true
  const flow = createPublicationFlowController(
    memoryFlowClient({
      fetchPublications: async () => {
        if (shouldFail) throw new Error('Error de red local')
        return { currentId: null, items: [] }
      },
    }),
    approvedScope,
  )

  // Suppose initial failure occurred while stage was hidden (active = false).
  await flow.refreshPublications('scope', false)
  assert.equal(flow.getState().listStatus, 'error')
  assert.equal(flow.getState().publicationList, null)
  assert.equal(flow.getState().listError, 'Error de red local')
  assert.equal(nextAutoListRefreshReason(flow.getState(), false), null, 'must not loop automatically while hidden')

  // Opening stage (active = true) allows one automatic retry, then stops if it fails again.
  assert.equal(nextAutoListRefreshReason(flow.getState(), true), 'active')
  await flow.refreshPublications('active', true)
  assert.equal(flow.getState().listStatus, 'error')
  assert.equal(nextAutoListRefreshReason(flow.getState(), true), null, 'must not loop while active after error')

  // Manual retry succeeds cleanly.
  shouldFail = false
  await flow.refreshPreview()
  await flow.refreshPublications('manual', true)
  const view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: approvedScope })
  assert.equal(flow.getState().listError, null)
  assert.equal(view.listFresh, true)
  assert.equal(view.canPublish, true)
})

test('post-publish auto-selects newly published release, waits for vigente preview before enabling activate, and never hijacks manual historical choice', async () => {
  const approvedScope: PublicationScope = { draftId: draftIdA, draftVersion: 85, draftState: 'approved', dirty: false }
  const publishedScope: PublicationScope = { draftId: draftIdA, draftVersion: 86, draftState: 'published', dirty: false }

  const postPublishList = deferred<AcademicPublicationList>()
  const pubPreviewDeferred = deferred<AcademicPublication>()
  let listCall = 0

  const flow = createPublicationFlowController(
    memoryFlowClient({
      fetchPublications: async () => {
        listCall += 1
        if (listCall === 1) return makeList()
        return postPublishList.promise
      },
      fetchCurrentPublication: () => pubPreviewDeferred.promise,
      fetchPublication: async (id) => makePublication({ id, publicationVersion: 1, approvedVersion: 10, title: 'Histórica' }),
    }),
    approvedScope,
  )

  await flow.refreshPublications('scope', true)
  // Publish transition -> arms pendingAutoSelect for draftIdA.
  flow.syncScope(publishedScope)
  assert.equal(flow.getState().pendingAutoSelect?.targetId, draftIdA)
  const refreshAfterPublish = flow.refreshPublications('scope', true)

  postPublishList.resolve({
    currentId: draftIdA,
    items: [
      makeSummary({ id: draftIdA, title: 'Propuesta SISTEMAS 2027-I', approvedVersion: 85, publicationVersion: 2, publishedAt: '2026-11-17T10:00:00.000Z' }),
      ...makeList().items,
    ],
  })
  await refreshAfterPublish

  // Selector updated to newly published release, but preview is still pending -> cannot activate yet.
  assert.equal(flow.getState().selectedPublicationId, draftIdA)
  assert.equal(flow.getState().pendingAutoSelect, null)
  const previewReq = flow.refreshPreview()
  let view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: publishedScope })
  assert.equal(view.selectedSummary?.id, draftIdA)
  assert.equal(view.publicationPreview, null)
  assert.equal(view.canActivate, false, 'must wait for vigente preview before enabling activation')

  // Resolve vigente preview -> activation enables only as explicit user action.
  pubPreviewDeferred.resolve(makePublication({ id: draftIdA, publicationVersion: 2, approvedVersion: 85 }))
  await previewReq
  view = derivePublicationView(flow.getState(), { busy: false, activating: false, currentScope: publishedScope })
  assert.equal(view.publicationPreview?.id, draftIdA)
  assert.equal(view.canActivate, true)

  // Race guard: if user manually switches to historical publication BEFORE late post-publish list arrives,
  // late list response must NOT hijack selectedPublicationId back to draftIdA.
  const raceList = deferred<AcademicPublicationList>()
  let raceCall = 0
  const raceFlow = createPublicationFlowController(
    memoryFlowClient({
      fetchPublications: async () => (++raceCall === 1 ? makeList() : raceList.promise),
      fetchPublication: async (id) => makePublication({ id, publicationVersion: 1, approvedVersion: 10, title: 'Histórica' }),
    }),
    approvedScope,
  )
  await raceFlow.refreshPublications('scope', true)
  raceFlow.syncScope(publishedScope)
  const pendingList = raceFlow.refreshPublications('scope', true)

  // User manually picks oldPubId before raceList resolves.
  raceFlow.selectPublication(oldPubId)
  await raceFlow.refreshPreview()

  raceList.resolve({
    currentId: draftIdA,
    items: [
      makeSummary({ id: draftIdA, title: 'Propuesta SISTEMAS 2027-I', approvedVersion: 85, publicationVersion: 2, publishedAt: '2026-11-17T10:00:00.000Z' }),
      ...makeList().items,
    ],
  })
  await pendingList
  assert.equal(raceFlow.getState().selectedPublicationId, oldPubId, 'late list must never override manual historical selection')
  const raceView = derivePublicationView(raceFlow.getState(), { busy: false, activating: false, currentScope: publishedScope })
  assert.equal(raceView.publicationPreview?.id, oldPubId)
})

test('publicationScopeKey stays deterministic across draftId, version and state', () => {
  assert.equal(publicationScopeKey({ draftId: null, draftVersion: null, draftState: 'draft' }), '||draft')
  assert.equal(publicationScopeKey({ draftId: draftIdA, draftVersion: 85, draftState: 'approved' }), `${draftIdA}|85|approved`)
})

// --- Vite SSR UI regressions (render real TSX components without full browser) ---

const vite = await createServer({
  configFile: false,
  envDir: false,
  root: new URL('../..', import.meta.url).pathname,
  ssr: { external: true },
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  appType: 'custom',
})
after(() => vite.close())

const { PlanningSessionProvider } = (await vite.ssrLoadModule('/src/components/PlanningSessionProvider.tsx')) as {
  PlanningSessionProvider: React.ComponentType<{ children: React.ReactNode }>
}
const { AcademicPublicationPanel, AcademicPublicationHeaderActions } = (await vite.ssrLoadModule('/src/screens/AcademicPublicationPanel.tsx')) as {
  AcademicPublicationPanel: React.ComponentType<Record<string, unknown>>
  AcademicPublicationHeaderActions: React.ComponentType<{
    primaryActionId?: string
    canPublish: boolean
    canApprove: boolean
    draftVersion: number | null
    reasonId: string
    onPublish: () => void
    onApprove: () => void
  }>
}
const schedulingModule = (await vite.ssrLoadModule('/src/screens/AcademicScheduling.tsx')) as Record<string, unknown>

test('AcademicPublicationPanel renders activation scope BEFORE preview section and giant preview table', async () => {
  const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } = await import('@tanstack/react-router')
  const noopAsync = async () => {}
  const noop = () => {}

  const panelElement = React.createElement(AcademicPublicationPanel, {
    active: true,
    draftId: draftIdA,
    draftVersion: 86,
    draftTitle: 'Propuesta SISTEMAS 2027-I',
    draftState: 'published',
    dirty: false,
    busy: false,
    onApprove: noopAsync,
    onPublish: noopAsync,
    onFork: noopAsync,
    onError: noop,
    onMessage: noop,
    initialFlowState: {
      scope: { draftId: draftIdA, draftVersion: 86, draftState: 'published', dirty: false },
      listStatus: 'ready',
      publicationList: {
        currentId: draftIdA,
        items: [makeSummary({ id: draftIdA, title: 'Propuesta SISTEMAS 2027-I', approvedVersion: 85, publicationVersion: 2, publishedAt: '2026-11-17T10:00:00.000Z' })],
      },
      listError: null,
      listScopeKey: `${draftIdA}|86|published`,
      autoListAttemptedKey: `scope:${draftIdA}|86|published`,
      listAttemptedWhileActive: true,
      listToken: 1,
      selectedPublicationId: draftIdA,
      selectionSeq: 0,
      pendingAutoSelect: null,
      preview: {
        id: draftIdA,
        version: 85,
        publicationVersion: 2,
        schedule: makeSchedule(),
        title: 'Propuesta SISTEMAS 2027-I',
        label: 'Publicación 2',
        source: 'publication',
        state: 'published',
      },
      previewLoading: false,
      previewError: null,
      previewToken: 1,
    } satisfies PublicationFlowState,
  })

  const rootRoute = createRootRoute({
    component: () => React.createElement(PlanningSessionProvider, null, panelElement),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/local/programacion-academica'] }),
  })
  await router.load()

  const html = renderToStaticMarkup(React.createElement(RouterProvider, { router } as never))
  const scopeIndex = html.indexOf('academic-publication__scope')
  const previewIndex = html.indexOf('academic-publication__preview')
  assert.ok(scopeIndex >= 0, 'Expected activation scope panel to render')
  assert.ok(previewIndex >= 0, 'Expected preview disclosure to render')
  assert.ok(scopeIndex < previewIndex, 'Activation scope must render BEFORE the large preview table')
  // Wait: verify button is enabled in this hydrated published + preview state, and NOT duplicated.
  assert.equal((html.match(/Activar publicación seleccionada/g) ?? []).length, 1)
  const scopeMatch = html.match(/<button[^>]*>Activar publicación seleccionada<\/button>/)
  assert.ok(scopeMatch && !scopeMatch[0].includes('disabled=""'), 'Activation button should be enabled when vigente preview is loaded')
})

test('AcademicPublicationPanel shows retry button on publication list error without confusing unloaded list with null currentId', async () => {
  const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } = await import('@tanstack/react-router')
  const noopAsync = async () => {}
  const noop = () => {}

  const panelElement = React.createElement(AcademicPublicationPanel, {
    active: true,
    draftId: draftIdA,
    draftVersion: 85,
    draftTitle: 'Propuesta SISTEMAS 2027-I',
    draftState: 'approved',
    dirty: false,
    busy: false,
    onApprove: noopAsync,
    onPublish: noopAsync,
    onFork: noopAsync,
    onError: noop,
    onMessage: noop,
    initialFlowState: {
      scope: { draftId: draftIdA, draftVersion: 85, draftState: 'approved', dirty: false },
      listStatus: 'error',
      publicationList: null,
      listError: 'Error de red sintético',
      listScopeKey: null,
      autoListAttemptedKey: `scope:${draftIdA}|85|approved`,
      listAttemptedWhileActive: true,
      listToken: 1,
      selectedPublicationId: '',
      selectionSeq: 0,
      pendingAutoSelect: null,
      preview: {
        id: draftIdA,
        version: 85,
        schedule: makeSchedule(),
        title: 'Propuesta SISTEMAS 2027-I',
        label: 'Versión 85',
        source: 'draft',
        state: 'approved',
      },
      previewLoading: false,
      previewError: null,
      previewToken: 1,
    } satisfies PublicationFlowState,
  })

  const rootRoute = createRootRoute({
    component: () => React.createElement(PlanningSessionProvider, null, panelElement),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/local/programacion-academica'] }),
  })
  await router.load()

  const html = renderToStaticMarkup(React.createElement(RouterProvider, { router } as never))
  assert.match(html, /No se pudo actualizar el historial: Error de red sintético/)
  assert.match(html, /Reintentar publicaciones/)
  assert.match(html, /No se pudieron cargar las publicaciones/)
})

test('AcademicScheduling proposal chip avoids duplicating version with derivePlanningDraftLabel while keeping state, round and title', () => {
  const PlanningProposalTrigger = schedulingModule.PlanningProposalTrigger as
    | React.ComponentType<{
        draftTitle: string
        draftVersion: number | null
        planningPeriod: string
        displayedDraftState: string
        draftLabel: string
        workspaceDirty: boolean
        draftListOpen: boolean
        onOpen: () => void
      }>
    | undefined

  assert.ok(PlanningProposalTrigger, 'Expected PlanningProposalTrigger component export in AcademicScheduling.tsx')

  const approvedHtml = renderToStaticMarkup(
    React.createElement(PlanningProposalTrigger, {
      draftTitle: 'Propuesta SISTEMAS 2027-I',
      draftVersion: 85,
      planningPeriod: '2027-I',
      displayedDraftState: 'approved',
      draftLabel: 'Aprobada (simulada) · versión 85 · Guardado',
      workspaceDirty: false,
      draftListOpen: false,
      onOpen: () => {},
    }),
  )
  assert.match(approvedHtml, />Aprobada \(simulada\) · versión 85 · Guardado</)
  assert.doesNotMatch(approvedHtml, /planning-scope-header__draft-state[^>]*>v85/)
  assert.match(approvedHtml, /title="Propuesta SISTEMAS 2027-I · Aprobada \(simulada\) · versión 85 · Guardado"/)

  const reviewHtml = renderToStaticMarkup(
    React.createElement(PlanningProposalTrigger, {
      draftTitle: 'Propuesta SISTEMAS 2027-I',
      draftVersion: 84,
      planningPeriod: '2027-I',
      displayedDraftState: 'in-review',
      draftLabel: 'En revisión docente · ronda 1 · versión 84 · Guardado',
      workspaceDirty: false,
      draftListOpen: false,
      onOpen: () => {},
    }),
  )
  assert.match(reviewHtml, />En revisión docente · ronda 1 · versión 84 · Guardado</)
  assert.doesNotMatch(reviewHtml, /planning-scope-header__draft-state[^>]*>v84/)

  const dirtyHtml = renderToStaticMarkup(
    React.createElement(PlanningProposalTrigger, {
      draftTitle: 'Propuesta SISTEMAS 2027-I',
      draftVersion: 84,
      planningPeriod: '2027-I',
      displayedDraftState: 'draft',
      draftLabel: 'Cambios sin guardar · versión guardada 84.',
      workspaceDirty: true,
      draftListOpen: false,
      onOpen: () => {},
    }),
  )
  assert.match(dirtyHtml, />Cambios sin guardar · versión guardada 84\.</)
  assert.doesNotMatch(dirtyHtml, /planning-scope-header__draft-state[^>]*>v84/)
  assert.match(dirtyHtml, /title="Propuesta SISTEMAS 2027-I · Cambios sin guardar · versión guardada 84\."/)
})

test('AcademicPublicationHeaderActions promotes Publicar to primary #planning-tour-primary when approved and preserves disabled guards', () => {
  const noop = () => {}
  const approvePrimaryHtml = renderToStaticMarkup(
    React.createElement(AcademicPublicationHeaderActions, {
      primaryActionId: 'approve',
      canPublish: false,
      canApprove: true,
      draftVersion: 84,
      reasonId: 'academic-approve-reason',
      onPublish: noop,
      onApprove: noop,
    }),
  )
  assert.match(approvePrimaryHtml, /id="planning-tour-primary"[^>]*>Aprobar versión 84<\/button>/)
  assert.match(approvePrimaryHtml, /disabled=""[^>]*>Publicar<\/button>/)

  const publishPrimaryReadyHtml = renderToStaticMarkup(
    React.createElement(AcademicPublicationHeaderActions, {
      primaryActionId: 'publish',
      canPublish: true,
      canApprove: false,
      draftVersion: 85,
      reasonId: 'academic-publish-reason',
      onPublish: noop,
      onApprove: noop,
    }),
  )
  assert.match(publishPrimaryReadyHtml, /id="planning-tour-primary"[^>]*>Publicar<\/button>/)
  assert.doesNotMatch(publishPrimaryReadyHtml, /id="planning-tour-primary"[^>]*disabled=""/)
  assert.doesNotMatch(publishPrimaryReadyHtml, /Aprobar versión/)

  const publishPrimaryBlockedHtml = renderToStaticMarkup(
    React.createElement(AcademicPublicationHeaderActions, {
      primaryActionId: 'publish',
      canPublish: false,
      canApprove: false,
      draftVersion: 85,
      reasonId: 'academic-publish-reason',
      onPublish: noop,
      onApprove: noop,
    }),
  )
  assert.match(publishPrimaryBlockedHtml, /id="planning-tour-primary"[^>]*disabled=""[^>]*>Publicar<\/button>/)
})

