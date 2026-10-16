import { getRouteApi } from '@tanstack/react-router'
import { toStudentSummary, type StudentSummaryData } from './adapters'
import { getLocalProfileActivation, localProfileSessionStore } from './client'

const rootApi = getRouteApi('__root__')

export type ShellStudentState =
  | { status: 'pending' }
  | { status: 'ready'; student: StudentSummaryData }
  | { status: 'error' }

export function useShellStudent(): ShellStudentState {
  const localSnapshot = localProfileSessionStore.getSnapshot()
  const match = rootApi.useMatch({ shouldThrow: false })

  if (getLocalProfileActivation() === 'synthetic-actors') {
    if (localSnapshot.status === 'active' || localSnapshot.status === 'expired') {
      return { status: 'ready', student: toStudentSummary(localSnapshot.formulario.data.alumno) }
    }
    return localSnapshot.status === 'error' ? { status: 'error' } : { status: 'pending' }
  }

  if (!match || match.status === 'pending' && !match.loaderData) {
    return { status: 'pending' }
  }

  if (match.status === 'error') {
    return { status: 'error' }
  }

  if (!match.loaderData) {
    return { status: 'pending' }
  }

  return { status: 'ready', student: toStudentSummary(match.loaderData.data.alumno) }
}
