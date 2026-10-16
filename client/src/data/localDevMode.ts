export type LocalDevMode = 'DEV' | 'SIM'
export const LOCAL_MODE_KEY = 'sum:mode'

type ModeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readLocalDevMode(storage: Pick<ModeStorage, 'getItem'> | null): LocalDevMode {
  try {
    return storage?.getItem(LOCAL_MODE_KEY) === 'DEV' ? 'DEV' : 'SIM'
  } catch {
    return 'SIM'
  }
}

export function createLocalModeController(storage: ModeStorage, navigate: (path: string) => void) {
  return {
    get: () => readLocalDevMode(storage),
    set(value: unknown) {
      if (value !== 'DEV' && value !== 'SIM') throw new TypeError('MODE debe ser DEV o SIM')
      if (value === readLocalDevMode(storage)) return
      storage.setItem(LOCAL_MODE_KEY, value)
      // Switching views ends the tab's local identity, preserving any uncertain enrollment intent.
      storage.removeItem('lp:session')
      navigate(value === 'SIM' ? '/local/login' : '/')
    },
  }
}

export function localModeStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export function installLocalModeConsole(enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return
  const storage = localModeStorage()
  if (!storage) return
  const controller = createLocalModeController(storage, (path) => window.location.assign(path))
  Object.defineProperties(window, {
    DEV: { value: 'DEV', configurable: true },
    SIM: { value: 'SIM', configurable: true },
    MODE: { get: controller.get, set: controller.set, configurable: true },
  })
  console.info('Modos locales: MODE = DEV para las vistas SUM; MODE = SIM para escenarios sintéticos.')
}

declare global {
  interface Window {
    readonly DEV: 'DEV'
    readonly SIM: 'SIM'
    MODE: LocalDevMode
  }
}
