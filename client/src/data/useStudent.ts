import { getRouteApi } from '@tanstack/react-router'
import { toStudentSummary } from './adapters'

const rootApi = getRouteApi('__root__')

export function useStudentFormData() {
  return rootApi.useLoaderData()
}

export function useStudent() {
  return toStudentSummary(useStudentFormData().data.alumno)
}
