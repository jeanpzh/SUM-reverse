import { getRouteApi } from '@tanstack/react-router'
import { toStudentSummary } from './adapters'
import { getDataMode } from './client'
import { rememberMiRepresentation } from './miInformacion'

const rootApi = getRouteApi('__root__')

export function useStudentFormData() {
  const response = rootApi.useLoaderData()
  if (getDataMode() === 'mock') rememberMiRepresentation(response, 'local-v1')
  return response
}

export function useStudent() {
  return toStudentSummary(useStudentFormData().data.alumno)
}
