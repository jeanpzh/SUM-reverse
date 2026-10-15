import { useSyncExternalStore } from 'react'
import { localProfileSessionStore } from './client'

export function useLocalProfileSession() {
  return useSyncExternalStore(localProfileSessionStore.subscribe,
    localProfileSessionStore.getSnapshot, localProfileSessionStore.getSnapshot)
}
