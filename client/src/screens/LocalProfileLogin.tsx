import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { localProfileDashboardApi, localProfileSessionStore } from '../data/client'
import type { ProfileCatalog } from '../data/localProfileDashboard'
import './LocalProfileLogin.css'

export function LocalProfileLogin() {
  const [catalog, setCatalog] = useState<ProfileCatalog | null>(null)
  const [selectedActorId, setSelectedActorId] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const snapshot = useSyncExternalStore(localProfileSessionStore.subscribe,
    localProfileSessionStore.getSnapshot, localProfileSessionStore.getSnapshot)

  useEffect(() => {
    headingRef.current?.focus()
    const controller = new AbortController()
    localProfileDashboardApi.catalog({ signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return
        setCatalog(response.data)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo local.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [retry])

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selectedProfile = catalog?.profiles.find((profile) => profile.actorId === selectedActorId)
    if (!selectedProfile) return
    await localProfileSessionStore.enter(selectedProfile.actorId)
  }

  return (
    <main className="local-profile-login">
      <section className="local-profile-login-card" aria-labelledby="local-profile-login-heading">
        <p className="local-profile-login-eyebrow">Demostración local</p>
        <h1 id="local-profile-login-heading" ref={headingRef} tabIndex={-1}>Elegir perfil sintético</h1>
        <p className="local-profile-login-description">
          Perfiles de prueba locales. Esta selección no es autenticación SUM ni una cuenta real.
        </p>
        {loading && <p role="status">Cargando perfiles disponibles…</p>}
        {loadError && (
          <div className="local-profile-login-error" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoadError(null); setLoading(true); setRetry((value) => value + 1) }}>Reintentar</button>
          </div>
        )}
        {catalog && (
          <form onSubmit={enter}>
            <fieldset disabled={snapshot.status === 'entering'}>
              <legend>Perfil para esta sesión local</legend>
              {catalog.profiles.map((profile) => (
                <label className="local-profile-choice" key={profile.actorId}>
                  <input type="radio" name="profile" value={profile.actorId}
                    checked={selectedActorId === profile.actorId}
                    onChange={() => setSelectedActorId(profile.actorId)} />
                  <span><strong>{profile.name}</strong><small>{profile.actorId} · {profile.scope.schoolId} · {profile.scope.period}</small></span>
                </label>
              ))}
            </fieldset>
            {snapshot.status === 'error' && <p className="local-profile-login-error" role="alert">{snapshot.message}</p>}
            {snapshot.status === 'anonymous' && snapshot.notice === 'reset'
              && <p className="local-profile-login-notice" role="status">La ejecución local cambió. Elija un perfil para continuar.</p>}
            <button className="local-profile-login-submit" type="submit"
              disabled={!selectedActorId || loading || snapshot.status === 'entering'}>
              {snapshot.status === 'entering' ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
