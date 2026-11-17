import type {
  AcademicDraftState,
  AcademicPublication,
  AcademicPublicationList,
  AcademicReleasePreview,
  AcademicScheduleSnapshot,
} from '../../../shared/programacion-academica-api.mjs'
import {
  fetchAcademicPublication,
  fetchAcademicPublications,
  fetchAcademicReleasePreview,
  fetchCurrentAcademicPublication,
} from './academicScheduling.ts'

export type PublicationScope = {
  draftId: string | null
  draftVersion: number | null
  draftState: AcademicDraftState
  dirty: boolean
}

export type PublicationPreviewSource = {
  id: string
  version: number
  publicationVersion?: number
  schedule: AcademicScheduleSnapshot
  title: string
  label: string
  source: 'draft' | 'publication'
  state: AcademicDraftState
}

export type PublicationListStatus = 'idle' | 'loading' | 'ready' | 'error'
export type PublicationListRefreshReason = 'mount' | 'scope' | 'active' | 'manual'

export type PendingAutoSelect = {
  targetId: string
  baseSelectionSeq: number
}

export interface PublicationFlowState {
  scope: PublicationScope
  listStatus: PublicationListStatus
  publicationList: AcademicPublicationList | null
  listError: string | null
  listScopeKey: string | null
  autoListAttemptedKey: string | null
  listAttemptedWhileActive: boolean
  listToken: number
  selectedPublicationId: string
  selectionSeq: number
  pendingAutoSelect: PendingAutoSelect | null
  preview: PublicationPreviewSource | null
  previewLoading: boolean
  previewError: string | null
  previewToken: number
}

export interface PublicationFlowClient {
  fetchPublications(): Promise<AcademicPublicationList>
  fetchPublication(id: string): Promise<AcademicPublication>
  fetchCurrentPublication(): Promise<AcademicPublication>
  fetchReleasePreview(id: string): Promise<AcademicReleasePreview>
}

export const defaultPublicationFlowClient: PublicationFlowClient = {
  fetchPublications: () => fetchAcademicPublications(globalThis.fetch),
  fetchPublication: (id) => fetchAcademicPublication(id, globalThis.fetch),
  fetchCurrentPublication: () => fetchCurrentAcademicPublication(globalThis.fetch),
  fetchReleasePreview: (id) => fetchAcademicReleasePreview(id, globalThis.fetch),
}

export function publicationScopeKey(scope: Pick<PublicationScope, 'draftId' | 'draftVersion' | 'draftState'>): string {
  return `${scope.draftId ?? ''}|${scope.draftVersion ?? ''}|${scope.draftState}`
}

export function requiresFreshListForScope(scope: Pick<PublicationScope, 'draftState'>): boolean {
  return scope.draftState === 'approved' || scope.draftState === 'published'
}

export function isPublicationListFresh(state: Pick<PublicationFlowState, 'scope' | 'listStatus' | 'publicationList' | 'listScopeKey'>): boolean {
  return (
    state.listStatus === 'ready' &&
    state.publicationList !== null &&
    (!requiresFreshListForScope(state.scope) || state.listScopeKey === publicationScopeKey(state.scope))
  )
}

function autoListAttemptKey(
  scope: Pick<PublicationScope, 'draftId' | 'draftVersion' | 'draftState'>,
  reason: Exclude<PublicationListRefreshReason, 'manual'>,
): string {
  return `${reason}:${publicationScopeKey(scope)}`
}

export function nextAutoListRefreshReason(
  state: PublicationFlowState,
  active: boolean,
): Exclude<PublicationListRefreshReason, 'manual'> | null {
  if (state.listStatus === 'loading') return null
  if (state.listStatus === 'error') {
    return active && !state.listAttemptedWhileActive ? 'active' : null
  }
  if (requiresFreshListForScope(state.scope) && !isPublicationListFresh(state)) {
    const scopeAttempt = autoListAttemptKey(state.scope, 'scope')
    if (state.autoListAttemptedKey !== scopeAttempt) return 'scope'
  }
  if (state.listStatus === 'idle') {
    const mountAttempt = autoListAttemptKey(state.scope, 'mount')
    if (state.autoListAttemptedKey !== mountAttempt) return 'mount'
  }
  return null
}

export function initialPublicationFlowState(scope: PublicationScope): PublicationFlowState {
  return {
    scope,
    listStatus: 'idle',
    publicationList: null,
    listError: null,
    listScopeKey: null,
    autoListAttemptedKey: null,
    listAttemptedWhileActive: false,
    listToken: 0,
    selectedPublicationId: '',
    selectionSeq: 0,
    pendingAutoSelect: null,
    preview: null,
    previewLoading: false,
    previewError: null,
    previewToken: 0,
  }
}

export type PreviewTarget =
  | { kind: 'publication'; id: string; publicationVersion: number }
  | { kind: 'draft'; id: string; version: number; state: AcademicDraftState }

export type PublicationFlowEvent =
  | { type: 'scope/synced'; scope: PublicationScope }
  | { type: 'list/started'; reason: PublicationListRefreshReason; active: boolean; scopeKey: string }
  | { type: 'list/succeeded'; token: number; scopeKey: string; list: AcademicPublicationList }
  | { type: 'list/failed'; token: number; message: string }
  | { type: 'selectPublication'; id: string }
  | { type: 'preview/started' }
  | { type: 'preview/succeeded'; token: number; target: PreviewTarget; preview: PublicationPreviewSource }
  | { type: 'preview/failed'; token: number; message: string }

function sameScope(left: PublicationScope, right: PublicationScope): boolean {
  return (
    left.draftId === right.draftId &&
    left.draftVersion === right.draftVersion &&
    left.draftState === right.draftState &&
    left.dirty === right.dirty
  )
}

export function reducePublicationFlow(
  state: PublicationFlowState,
  event: PublicationFlowEvent,
): PublicationFlowState {
  switch (event.type) {
    case 'scope/synced': {
      const prev = state.scope
      const next = event.scope
      if (sameScope(prev, next)) return state

      const draftChanged = prev.draftId !== next.draftId
      const versionOrStateChanged = prev.draftVersion !== next.draftVersion || prev.draftState !== next.draftState
      const enteredApprovalOrPublish =
        (next.draftState === 'approved' && prev.draftState !== 'approved') ||
        (next.draftState === 'published' && prev.draftState !== 'published')
      const justPublishedSameDraft =
        !draftChanged &&
        next.draftId !== null &&
        prev.draftState !== 'published' &&
        next.draftState === 'published'

      if (draftChanged) {
        return {
          ...state,
          scope: next,
          listStatus: state.publicationList ? 'ready' : 'idle',
          listError: null,
          listScopeKey: null,
          autoListAttemptedKey: null,
          listAttemptedWhileActive: false,
          listToken: state.listToken + 1,
          selectedPublicationId: '',
          pendingAutoSelect: null,
          preview: null,
          previewLoading: false,
          previewError: null,
          previewToken: state.previewToken + 1,
        }
      }

      const invalidateList = enteredApprovalOrPublish
      const invalidateDraftPreview = !state.selectedPublicationId && (versionOrStateChanged || (next.dirty && !prev.dirty))

      return {
        ...state,
        scope: next,
        ...(invalidateList
          ? {
              listStatus: state.publicationList ? ('ready' as const) : ('idle' as const),
              listError: null,
              listScopeKey: null,
              autoListAttemptedKey: null,
              listAttemptedWhileActive: false,
              listToken: state.listToken + 1,
            }
          : {}),
        pendingAutoSelect: justPublishedSameDraft && state.selectedPublicationId === ''
          ? { targetId: next.draftId!, baseSelectionSeq: state.selectionSeq }
          : next.draftState === 'approved'
            ? null
            : state.pendingAutoSelect,
        ...(invalidateDraftPreview
          ? {
              preview: null,
              previewLoading: false,
              previewError: null,
              previewToken: state.previewToken + 1,
            }
          : {}),
      }
    }

    case 'list/started':
      return {
        ...state,
        listStatus: 'loading',
        listError: null,
        listToken: state.listToken + 1,
        autoListAttemptedKey: event.reason === 'manual' ? state.autoListAttemptedKey : `${event.reason}:${event.scopeKey}`,
        listAttemptedWhileActive: event.active || state.listAttemptedWhileActive,
      }

    case 'list/succeeded': {
      if (event.token !== state.listToken) return state
      if (requiresFreshListForScope(state.scope) && event.scopeKey !== publicationScopeKey(state.scope)) {
        return state
      }

      let selectedPublicationId = state.selectedPublicationId
      let pendingAutoSelect = state.pendingAutoSelect
      let preview = state.preview
      let previewLoading = state.previewLoading
      let previewError = state.previewError
      let previewToken = state.previewToken

      if (selectedPublicationId && !event.list.items.some((item) => item.id === selectedPublicationId)) {
        selectedPublicationId = ''
        preview = null
        previewLoading = false
        previewError = null
        previewToken += 1
      }

      if (
        pendingAutoSelect &&
        pendingAutoSelect.targetId === state.scope.draftId &&
        state.selectionSeq === pendingAutoSelect.baseSelectionSeq &&
        selectedPublicationId === '' &&
        event.list.items.some((item) => item.id === pendingAutoSelect!.targetId)
      ) {
        selectedPublicationId = pendingAutoSelect.targetId
        preview = null
        previewLoading = false
        previewError = null
        previewToken += 1
      }

      if (!requiresFreshListForScope(state.scope) || event.scopeKey === publicationScopeKey(state.scope)) {
        pendingAutoSelect = null
      }

      return {
        ...state,
        listStatus: 'ready',
        publicationList: event.list,
        listError: null,
        listScopeKey: event.scopeKey,
        selectedPublicationId,
        pendingAutoSelect,
        preview,
        previewLoading,
        previewError,
        previewToken,
      }
    }

    case 'list/failed':
      if (event.token !== state.listToken) return state
      return {
        ...state,
        listStatus: 'error',
        publicationList: null,
        listError: event.message,
        listScopeKey: null,
      }

    case 'selectPublication':
      if (event.id === state.selectedPublicationId && !state.pendingAutoSelect) return state
      return {
        ...state,
        selectedPublicationId: event.id,
        selectionSeq: state.selectionSeq + 1,
        pendingAutoSelect: null,
        preview: null,
        previewLoading: false,
        previewError: null,
        previewToken: state.previewToken + 1,
      }

    case 'preview/started':
      return {
        ...state,
        preview: null,
        previewLoading: true,
        previewError: null,
        previewToken: state.previewToken + 1,
      }

    case 'preview/succeeded': {
      if (event.token !== state.previewToken) return state
      if (event.target.kind === 'publication') {
        const selected = state.publicationList?.items.find((item) => item.id === state.selectedPublicationId) ?? null
        if (!selected || selected.id !== event.target.id || selected.publicationVersion !== event.target.publicationVersion) {
          return state
        }
      } else {
        if (
          state.selectedPublicationId !== '' ||
          state.scope.dirty ||
          state.scope.draftId !== event.target.id ||
          state.scope.draftVersion !== event.target.version ||
          state.scope.draftState !== event.target.state
        ) {
          return state
        }
      }
      return {
        ...state,
        preview: event.preview,
        previewLoading: false,
        previewError: null,
      }
    }

    case 'preview/failed':
      if (event.token !== state.previewToken) return state
      return {
        ...state,
        preview: null,
        previewLoading: false,
        previewError: event.message,
      }
  }
}

export function derivePublicationView(
  state: PublicationFlowState,
  options: { busy: boolean; activating: boolean; currentScope?: PublicationScope },
) {
  const scope = options.currentScope ?? state.scope
  const scopeSynced = sameScope(state.scope, scope)
  const listLoading = state.listStatus === 'loading'
  const listFresh = scopeSynced && isPublicationListFresh(state)
  const working = state.previewLoading
  const selectedSummary = state.publicationList?.items.find((item) => item.id === state.selectedPublicationId) ?? null
  const currentPreview =
    !scope.dirty &&
    state.preview &&
    state.preview.source === 'draft' &&
    state.preview.id === scope.draftId &&
    state.preview.version === scope.draftVersion &&
    state.preview.state === scope.draftState
      ? state.preview
      : null
  const publicationPreview =
    selectedSummary &&
    state.preview?.source === 'publication' &&
    state.preview.id === selectedSummary.id &&
    state.preview.publicationVersion === selectedSummary.publicationVersion
      ? state.preview
      : null
  const currentLabel = state.publicationList?.items.find((item) => item.id === state.publicationList?.currentId)
  const canUseRelease = Boolean(scope.draftId && scope.draftVersion && !scope.dirty && !options.busy && !working)
  const canApprove =
    canUseRelease &&
    scope.draftState === 'ready-for-approval' &&
    currentPreview?.state === 'ready-for-approval'
  const canPublish =
    canUseRelease &&
    scope.draftState === 'approved' &&
    currentPreview?.state === 'approved' &&
    listFresh &&
    !state.listError &&
    !state.selectedPublicationId
  const canActivate = Boolean(
    selectedSummary &&
    publicationPreview &&
    publicationPreview.schedule.schoolId === 'SISTEMAS' &&
    publicationPreview.schedule.academicPeriod === '2027-I' &&
    (listFresh || !requiresFreshListForScope(scope)) &&
    !options.busy &&
    !options.activating &&
    !working,
  )

  return {
    scopeSynced,
    listLoading,
    listFresh,
    working,
    selectedSummary,
    currentPreview,
    publicationPreview,
    currentLabel,
    canApprove,
    canPublish,
    canActivate,
  }
}

export function createPublicationFlowController(
  client: PublicationFlowClient = defaultPublicationFlowClient,
  initialScope: PublicationScope,
  initialOverride?: PublicationFlowState,
) {
  let state = initialOverride ?? initialPublicationFlowState(initialScope)
  const listeners = new Set<() => void>()
  let disposed = false

  const getState = () => state
  const dispatch = (event: PublicationFlowEvent) => {
    const next = reducePublicationFlow(state, event)
    if (next === state) return
    state = next
    for (const listener of listeners) listener()
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const syncScope = (scope: PublicationScope) => {
    dispatch({ type: 'scope/synced', scope })
  }

  const selectPublication = (id: string) => {
    dispatch({ type: 'selectPublication', id })
  }

  const refreshPublications = async (
    reason: PublicationListRefreshReason = 'manual',
    active = true,
  ) => {
    const scopeKey = publicationScopeKey(state.scope)
    dispatch({ type: 'list/started', reason, active, scopeKey })
    const token = state.listToken
    try {
      const list = await client.fetchPublications()
      if (disposed) return
      dispatch({ type: 'list/succeeded', token, scopeKey, list })
    } catch (error) {
      if (disposed) return
      dispatch({
        type: 'list/failed',
        token,
        message: error instanceof Error ? error.message : 'No se pudo consultar el historial local.',
      })
    }
  }

  const refreshPreview = async () => {
    const selected = state.publicationList?.items.find((item) => item.id === state.selectedPublicationId) ?? null
    const { draftId, draftVersion, draftState } = state.scope
    if (!selected && (!draftId || !draftVersion)) return

    const target: PreviewTarget = selected
      ? { kind: 'publication', id: selected.id, publicationVersion: selected.publicationVersion }
      : { kind: 'draft', id: draftId!, version: draftVersion!, state: draftState }

    dispatch({ type: 'preview/started' })
    const token = state.previewToken

    try {
      let next: PublicationPreviewSource
      if (target.kind === 'publication') {
        const useCurrentEndpoint =
          target.id === state.publicationList?.currentId && isPublicationListFresh(state)
        const publication = useCurrentEndpoint
          ? await client.fetchCurrentPublication()
          : await client.fetchPublication(target.id)
        if (publication.id !== target.id || publication.publicationVersion !== target.publicationVersion) {
          throw new Error('El historial cambió mientras se consultaba. Actualiza publicaciones y vuelve a seleccionar la versión.')
        }
        next = {
          id: publication.id,
          version: publication.approvedVersion,
          publicationVersion: publication.publicationVersion,
          schedule: publication.schedule,
          title: publication.title,
          label: `Publicación ${publication.publicationVersion}`,
          source: 'publication',
          state: 'published',
        }
      } else {
        const release = await client.fetchReleasePreview(target.id)
        if (release.id !== target.id || release.version !== target.version || release.state !== target.state) {
          throw new Error('La propuesta cambió. Actualiza la versión y vuelve a consultar la vista previa.')
        }
        next = {
          id: release.id,
          version: release.version,
          schedule: release.schedule,
          title: release.title,
          label: `Versión ${release.version}`,
          source: 'draft',
          state: release.state,
        }
      }
      if (disposed) return
      dispatch({ type: 'preview/succeeded', token, target, preview: next })
    } catch (error) {
      if (disposed) return
      dispatch({
        type: 'preview/failed',
        token,
        message: error instanceof Error ? error.message : 'No se pudo consultar la vista previa local.',
      })
    }
  }

  const mount = () => {
    disposed = false
  }

  const dispose = () => {
    disposed = true
  }

  return {
    getState,
    subscribe,
    syncScope,
    selectPublication,
    refreshPublications,
    refreshPreview,
    mount,
    dispose,
  }
}

export type PublicationFlowController = ReturnType<typeof createPublicationFlowController>
