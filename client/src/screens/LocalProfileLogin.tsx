import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { accessProvider, localProfileDashboardApi, localProfileSessionStore } from '../data/client'
import type { ProfileCatalog, ScenarioCatalog } from '../data/localProfileDashboard'
import './LocalProfileLogin.css'

export function LocalProfileLogin({ operationalRunId = null, invalidRunId = false }: {
  operationalRunId?: string | null
  invalidRunId?: boolean
}) {
  return import.meta.env.VITE_SUM_SIMULATOR === '1' ? <PublicSimulatorLogin />
    : <LocalProfileChooser operationalRunId={operationalRunId} invalidRunId={invalidRunId} />
}

function LocalProfileChooser({ operationalRunId, invalidRunId }: { operationalRunId: string | null; invalidRunId: boolean }) {
  const [catalog, setCatalog] = useState<ProfileCatalog | null>(null)
  const [selectedActorId, setSelectedActorId] = useState('')
  const [scenarios, setScenarios] = useState<ScenarioCatalog | null>(null)
  const [runId, setRunId] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState('regular')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const snapshot = useSyncExternalStore(localProfileSessionStore.subscribe,
    localProfileSessionStore.getSnapshot, localProfileSessionStore.getSnapshot)

  useEffect(() => {
    headingRef.current?.focus()
    if (invalidRunId) return
    const controller = new AbortController()
    const catalogRequest = localProfileDashboardApi.catalog({ signal: controller.signal, runId: operationalRunId ?? undefined })
    const scenarioRequest = operationalRunId ? Promise.resolve(null)
      : localProfileDashboardApi.scenarios({ signal: controller.signal })
    Promise.all([catalogRequest, scenarioRequest]).then(([response, scenarioResponse]) => {
        if (controller.signal.aborted) return
        if (operationalRunId && response.runId !== operationalRunId) throw new Error('El catálogo no corresponde a la oferta solicitada.')
        if (scenarioResponse && response.runId !== scenarioResponse.runId) throw new Error('La prueba cambió durante la carga. Pulsa Reintentar.')
        setCatalog(response.data)
        setScenarios(scenarioResponse?.data ?? null)
        setRunId(response.runId)
        if (scenarioResponse) setSelectedScenarioId(scenarioResponse.data.currentScenarioId ?? 'regular')
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo local.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [retry, operationalRunId, invalidRunId])

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selectedProfile = catalog?.profiles.find((profile) => profile.actorId === selectedActorId)
    if (!selectedProfile || starting) return
    setStarting(true)
    setStartError(null)
    try {
      let expectedRunId = runId
      if (scenarios?.scenarios.length) {
        const scenario = scenarios.scenarios.find((item) => item.scenarioId === selectedScenarioId)
        if (!scenario) throw new Error('Selecciona un escenario disponible.')
        const response = await localProfileDashboardApi.selectScenario({ runId, scenarioId: scenario.scenarioId })
        expectedRunId = response.runId
        setRunId(response.runId)
        setCatalog(response.data)
      }
      await localProfileSessionStore.enter(selectedProfile.actorId, {
        expectedRunId,
        ...(operationalRunId ? { contextRunId: operationalRunId } : {}),
      })
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'No se pudo iniciar la prueba.')
      if (error instanceof Error && 'code' in error && error.code === 'RUN_CHANGED') {
        setLoadError('La prueba cambió en otra pestaña. Pulsa Reintentar para cargar los escenarios actuales.')
      }
    } finally {
      setStarting(false)
    }
  }

  const selectedScenario = scenarios?.scenarios.find((scenario) => scenario.scenarioId === selectedScenarioId)
  const selectedCase = selectedScenario?.profiles.find((profile) => profile.actorId === selectedActorId)
  const busy = starting || snapshot.status === 'entering'

  return (
    <main className="local-profile-login">
      <section className={`local-profile-login-card${scenarios?.scenarios.length ? ' local-profile-login-card--scenarios' : ''}`} aria-labelledby="local-profile-login-heading">
        <p className="local-profile-login-eyebrow">Demostración local</p>
        <h1 id="local-profile-login-heading" ref={headingRef} tabIndex={-1}>
          {operationalRunId ? 'Ingresar a matrícula 2027-I' : scenarios?.scenarios.length ? 'Probar un escenario de matrícula' : 'Elegir perfil sintético'}
        </h1>
        <p className="local-profile-login-description">
          {operationalRunId ? 'Selecciona un estudiante de la oferta local publicada. El catálogo se carga para esta ejecución sin reiniciar escenarios.'
            : 'Elige una situación y un estudiante para recorrer el sistema con datos sintéticos.'}
        </p>
        {operationalRunId && <p className="local-profile-login-notice" role="note">Oferta operativa · periodo 2027-I · datos y reloj sintéticos.</p>}
        {loading && !invalidRunId && <p role="status">Cargando perfiles disponibles…</p>}
        {invalidRunId && <div className="local-profile-login-error" role="alert">
          <p>El identificador de la oferta no es válido. Abre el enlace de matrícula desde la publicación local.</p>
        </div>}
        {loadError && (
          <div className="local-profile-login-error" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoadError(null); setLoading(true); setRetry((value) => value + 1) }}>Reintentar</button>
          </div>
        )}
        {catalog && (
          <form onSubmit={enter} aria-busy={busy}>
            {scenarios?.scenarios.length ? (
              <fieldset disabled={busy} className="local-scenario-options">
                <legend>1. Escenario</legend>
                <div className="local-scenario-grid">
                  {scenarios.scenarios.map((scenario) => (
                    <label className="local-profile-choice local-scenario-choice" key={scenario.scenarioId}>
                      <input type="radio" name="scenario" value={scenario.scenarioId}
                        checked={selectedScenarioId === scenario.scenarioId}
                        onChange={() => { setSelectedScenarioId(scenario.scenarioId); setStartError(null) }} />
                      <span><strong>{scenario.label}</strong><small>{scenario.description}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <fieldset disabled={busy} className="local-student-options">
              <legend>{operationalRunId ? 'Estudiante de la oferta' : selectedScenario ? '2. Perfil del estudiante' : 'Perfil para esta sesión local'}</legend>
              <div className="local-student-grid">
              {catalog.profiles.map((profile) => (
                <label className="local-profile-choice" key={profile.actorId}>
                  <input type="radio" name="profile" value={profile.actorId}
                    checked={selectedActorId === profile.actorId}
                    onChange={() => setSelectedActorId(profile.actorId)} />
                  <span><strong>{profile.name} · {profile.scope.schoolId === 'SISTEMAS' ? 'Sistemas' : 'Software'}</strong>
                    <small>{profile.actorId} · {profile.scope.period}</small>
                    {selectedScenario && <small>{selectedScenario.profiles.find((item) => item.actorId === profile.actorId)?.summary}</small>}
                  </span>
                </label>
              ))}
              </div>
            </fieldset>
            {selectedCase && (
              <section className="local-scenario-preview" aria-live="polite" aria-label="Resultado esperado de la prueba">
                <h2>Qué puedes comprobar</h2>
                <p>{selectedCase.expectedResult}</p>
                <p><strong>Asignaturas sugeridas:</strong> {selectedCase.recommendedCourseIds.map((id) => id.split('-').at(-1)).join(', ')}.</p>
              </section>
            )}
            {startError && <p className="local-profile-login-error" role="alert">{startError}</p>}
            {snapshot.status === 'error' && <p className="local-profile-login-error" role="alert">{snapshot.message}</p>}
            {snapshot.status === 'anonymous' && snapshot.notice === 'reset'
              && <p className="local-profile-login-notice" role="status">La ejecución local cambió. Elija un perfil para continuar.</p>}
            {selectedScenario && !operationalRunId && <p className="local-scenario-reset-note">Cada inicio prepara una prueba nueva y reinicia el escenario activo, también en otras pestañas locales.</p>}
            <button className="local-profile-login-submit" type="submit"
              disabled={!selectedActorId || loading || busy || Boolean(loadError)}>
              {busy ? 'Preparando prueba…' : selectedScenario ? 'Iniciar prueba' : 'Ingresar'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

function PublicSimulatorLogin() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const credentialRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryingRevocation, setRetryingRevocation] = useState(false)
  const revocationError = useSyncExternalStore(
    accessProvider.subscribe,
    accessProvider.getLogoutErrorSnapshot,
    accessProvider.getLogoutErrorSnapshot,
  )

  useEffect(() => { headingRef.current?.focus() }, [])

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const credential = credentialRef.current?.value ?? ''
    if (credentialRef.current) credentialRef.current.value = ''
    setLoading(true)
    setError(null)
    try {
      const loggedIn = await accessProvider.login(credential)
      const current = await accessProvider.current()
      if (loggedIn.actorId !== current.actorId || loggedIn.campaignId !== current.campaignId
        || loggedIn.runId !== current.runId || loggedIn.expiresAt !== current.expiresAt) {
        throw new Error('La sesión de acceso cambió durante el ingreso. Inténtalo de nuevo.')
      }
      await localProfileSessionStore.enter()
      const result = localProfileSessionStore.getSnapshot()
      if (result.status === 'error') throw new Error(result.message)
    } catch (cause) {
      const loginError = cause instanceof Error ? cause.message : 'No se pudo ingresar al simulador.'
      if (accessProvider.getLogoutErrorSnapshot()) {
        setError(loginError)
      } else {
        try {
          await accessProvider.logout()
          setError(loginError)
        } catch (logoutCause) {
          setError(logoutCause instanceof Error ? logoutCause.message : 'No se pudo confirmar el cierre de sesión.')
        }
      }
    } finally {
      setLoading(false)
      if (credentialRef.current) credentialRef.current.value = ''
    }
  }

  async function retryLogout() {
    if (retryingRevocation) return
    setRetryingRevocation(true)
    try {
      await accessProvider.logout()
      setError(null)
    } catch {
      // The provider publishes the failure for this screen to display.
    } finally {
      setRetryingRevocation(false)
    }
  }

  return (
    <main className="local-profile-login">
      <section className="local-profile-login-card" aria-labelledby="local-profile-login-heading">
        <p className="local-profile-login-eyebrow">Acceso</p>
        <h1 id="local-profile-login-heading" ref={headingRef} tabIndex={-1}>Ingresar al simulador</h1>
        <p className="local-profile-login-description">Simulador de matrícula · datos sintéticos</p>
        {revocationError && (
          <div className="local-profile-login-error" role="alert">
            <p>{revocationError.message}</p>
            <button type="button" onClick={retryLogout} disabled={retryingRevocation}>
              {retryingRevocation ? 'Confirmando cierre…' : 'Reintentar cierre de sesión'}
            </button>
          </div>
        )}
        <form onSubmit={enter} aria-busy={loading}>
          <label htmlFor="simulator-credential">Código de acceso</label>
          <input ref={credentialRef} id="simulator-credential" name="credential" type="password"
            autoComplete="off" required disabled={loading} />
          {error && !revocationError && <p className="local-profile-login-error" role="alert">{error}</p>}
          <button className="local-profile-login-submit" type="submit" disabled={loading || retryingRevocation || Boolean(revocationError)}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  )
}
