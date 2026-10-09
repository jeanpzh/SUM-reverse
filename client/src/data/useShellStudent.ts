import { getRouteApi } from '@tanstack/react-router'
import { toStudentSummary, type StudentSummaryData } from './adapters'

const rootApi = getRouteApi('__root__')

export type ShellStudentState =
  | { status: 'pending' }
  | { status: 'ready'; student: StudentSummaryData }
  | { status: 'error' }

export function useShellStudent(): ShellStudentState {
  const match = rootApi.useMatch({ shouldThrow: false })

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
