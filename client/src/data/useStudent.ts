import { getRouteApi } from '@tanstack/react-router'
import { toStudentSummary } from './adapters'
import { getDataMode, getLocalProfileActivation, localProfileSessionStore } from './client'
import { rememberMiRepresentation } from './miInformacion'

const rootApi = getRouteApi('__root__')

export function useStudentFormData() {
  const response = rootApi.useLoaderData()
  if (getLocalProfileActivation() === 'synthetic-actors') {
    const snapshot = localProfileSessionStore.getSnapshot()
    if (snapshot.status === 'active' || snapshot.status === 'expired') return snapshot.formulario
    throw new Error('No hay un formulario de perfil local disponible.')
  }
  if (!response) throw new Error('No hay datos de formulario disponibles.')
  if (getDataMode() === 'mock') rememberMiRepresentation(response, 'local-v1')
  return response
}

export function useStudent() {
  return toStudentSummary(useStudentFormData().data.alumno)
}
