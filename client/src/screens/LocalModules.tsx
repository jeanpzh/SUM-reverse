import { Link } from '@tanstack/react-router'
import './LocalModules.css'

export function LocalModules() {
  return <section className="local-modules" aria-labelledby="local-modules-title">
    <header className="local-modules__header">
      <p className="local-modules__eyebrow">Acceso local</p>
      <h1 id="local-modules-title">Módulos locales</h1>
      <p>Elige el área que deseas abrir.</p>
    </header>
    <nav className="local-modules__choices" aria-label="Módulos disponibles">
      <Link className="local-modules__choice" to="/alumnoWebSum/v2/inicio">
        <span className="local-modules__choice-icon" aria-hidden="true">E</span>
        <span className="local-modules__choice-copy"><strong>Estudiante</strong><small>Continuar al sistema estudiantil</small></span>
        <span className="local-modules__arrow" aria-hidden="true">→</span>
      </Link>
      <Link className="local-modules__choice" to="/local/programacion-academica">
        <span className="local-modules__choice-icon" aria-hidden="true">P</span>
        <span className="local-modules__choice-copy"><strong>Escuela · Programación académica</strong><small>Herramienta de demostración local con datos sintéticos</small></span>
        <span className="local-modules__arrow" aria-hidden="true">→</span>
      </Link>
    </nav>
  </section>
}
